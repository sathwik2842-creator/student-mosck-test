import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  normalizePaper,
  normalizeQuestion,
  normalizeQuestionBatch,
  isAdminRole,
  AdminValidationError,
} from "./lib/admin-validation.js";
import { metadata } from "./grading.js";
const db = () => getFirestore();
const uid = (request) => {
  if (!request.auth)
    throw new HttpsError("unauthenticated", "Sign in to continue.");
  return request.auth.uid;
};
const validId = (id) =>
  typeof id === "string" && /^[a-zA-Z0-9_-]{1,160}$/.test(id);
async function requireAdmin(userId, transaction) {
  const ref = db().doc(`roles/${userId}`);
  const role = await (transaction ? transaction.get(ref) : ref.get());
  if (!role.exists || !isAdminRole(role.data()))
    throw new HttpsError(
      "permission-denied",
      "Administrator access is required.",
    );
}
const callable = (fn) =>
  onCall(
    { timeoutSeconds: 120, region: "us-central1", maxInstances: 10 },
    async (request) => {
      try {
        const userId = uid(request);
        await requireAdmin(userId);
        return await fn(request, userId);
      } catch (error) {
        if (error instanceof HttpsError) throw error;
        if (error instanceof AdminValidationError)
          throw new HttpsError("invalid-argument", error.message);
        console.error("Admin operation failed", {
          code: error.code || "unknown",
        });
        throw new HttpsError(
          "internal",
          "The admin operation failed. Please retry.",
        );
      }
    },
  );
function checkVersion(existing, expectedVersion) {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0)
    throw new HttpsError(
      "invalid-argument",
      "A valid document version is required.",
    );
  if ((existing.exists ? existing.data().version || 1 : 0) !== expectedVersion)
    throw new HttpsError(
      "aborted",
      "This item changed in another session. Reload it before saving.",
    );
}
function pickId(data) {
  if (!validId(data?.id))
    throw new HttpsError("invalid-argument", "Choose a valid item.");
  return data.id;
}
function questionForBank(data) {
  const q = normalizeQuestion(data);
  const { id, ...clean } = q;
  return clean;
}
export const adminOverview = callable(async () => {
  // Auth pagination and independent Firestore counts can run concurrently.
  const countRegisteredStudents = async () => {
    const adminRoles = await db().collection("roles").where("isAdmin", "==", true).get();
    const admins = new Set(adminRoles.docs.map((d) => d.id));
    let registeredStudents = 0, pageToken;
    do {
      const page = await getAuth().listUsers(1000, pageToken);
      registeredStudents += page.users.filter(
        (u) => !admins.has(u.uid) && u.providerData.length > 0,
      ).length;
      pageToken = page.pageToken;
    } while (pageToken);
    return registeredStudents;
  };
  const [registeredStudents, resultsCount, activeCount, questionCount] = await Promise.all([
    countRegisteredStudents(),
    db().collection("results").count().get(),
    db().collection("testCatalog").where("active", "==", true).count().get(),
    db().collection("questionBank").count().get(),
  ]);
  return {
    registeredStudents,
    testsTaken: resultsCount.data().count,
    activeTests: activeCount.data().count,
    questionCount: questionCount.data().count,
    updatedAt: new Date().toISOString(),
  };
});

export const adminGetTest = callable(async (request) => {
  const id = pickId(request.data),
    snapshot = await db().doc(`tests/${id}`).get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Test not found.");
  const { createdAt, updatedAt, ...data } = snapshot.data();
  return { id, ...data };
});
export const adminSaveTest = callable(async (request, userId) => {
  const id = pickId(request.data),
    paper = normalizePaper(request.data.paper),
    ref = db().doc(`tests/${id}`);
  return db().runTransaction(async (tx) => {
    await requireAdmin(userId, tx);
    const existing = await tx.get(ref);
    checkVersion(existing, request.data.expectedVersion);
    const version = (existing.exists ? existing.data().version || 1 : 0) + 1,
      now = Timestamp.now();
    const full = {
      ...paper,
      version,
      createdAt: existing.exists ? existing.data().createdAt || now : now,
      updatedAt: now,
      updatedBy: userId,
    };
    tx.set(ref, full);
    tx.set(db().doc(`testCatalog/${id}`), metadata(full, id));
    tx.create(db().collection("auditLog").doc(), {
      actorId: userId,
      action: existing.exists ? "test.updated" : "test.created",
      targetId: id,
      at: now,
    });
    return { id, version };
  });
});
export const adminDeleteTest = callable(async (request, userId) => {
  const id = pickId(request.data),
    ref = db().doc(`tests/${id}`);
  return db().runTransaction(async (tx) => {
    await requireAdmin(userId, tx);
    const existing = await tx.get(ref);
    if (!existing.exists) throw new HttpsError("not-found", "Test not found.");
    checkVersion(existing, request.data.expectedVersion);
    if (existing.data().active)
      throw new HttpsError(
        "failed-precondition",
        "Unpublish this test before deleting it.",
      );
    const pointers = await tx.get(
      db().collection("activeAttempts").where("testId", "==", id).limit(1),
    );
    if (!pointers.empty)
      throw new HttpsError(
        "failed-precondition",
        "This test has unfinished attempts. Keep it archived to preserve resume access.",
      );
    tx.delete(ref);
    tx.delete(db().doc(`testCatalog/${id}`));
    tx.create(db().collection("auditLog").doc(), {
      actorId: userId,
      action: "test.deleted",
      targetId: id,
      at: Timestamp.now(),
    });
    return { deleted: true };
  });
});
export const adminSaveQuestion = callable(async (request, userId) => {
  const id = pickId(request.data),
    question = questionForBank(request.data.question),
    ref = db().doc(`questionBank/${id}`);
  return db().runTransaction(async (tx) => {
    await requireAdmin(userId, tx);
    const existing = await tx.get(ref);
    checkVersion(existing, request.data.expectedVersion);
    const version = (existing.exists ? existing.data().version || 1 : 0) + 1;
    tx.set(ref, {
      ...question,
      version,
      updatedBy: userId,
      updatedAt: Timestamp.now(),
    });
    tx.create(db().collection("auditLog").doc(), {
      actorId: userId,
      action: existing.exists ? "question.updated" : "question.created",
      targetId: id,
      at: Timestamp.now(),
    });
    return { id, version };
  });
});
export const adminDeleteQuestion = callable(async (request, userId) => {
  const id = pickId(request.data),
    ref = db().doc(`questionBank/${id}`);
  return db().runTransaction(async (tx) => {
    await requireAdmin(userId, tx);
    const existing = await tx.get(ref);
    if (!existing.exists)
      throw new HttpsError("not-found", "Question not found.");
    checkVersion(existing, request.data.expectedVersion);
    tx.delete(ref);
    tx.create(db().collection("auditLog").doc(), {
      actorId: userId,
      action: "question.deleted",
      targetId: id,
      at: Timestamp.now(),
    });
    return { deleted: true };
  });
});
export const adminImportQuestions = callable(async (request, userId) => {
  const questions = normalizeQuestionBatch(request.data?.questions),
    importId = request.data?.importId;
  if (!validId(importId))
    throw new HttpsError(
      "invalid-argument",
      "A valid import identifier is required.",
    );
  const importRef = db().doc(`adminImports/${userId}_${importId}`);
  return db().runTransaction(async (tx) => {
    await requireAdmin(userId, tx);
    const existing = await tx.get(importRef);
    if (existing.exists) return { imported: existing.data().count };
    const now = Timestamp.now();
    for (const { id, ...q } of questions)
      tx.create(db().doc(`questionBank/${importId}_${id}`), {
        ...q,
        version: 1,
        updatedBy: userId,
        updatedAt: now,
      });
    tx.create(importRef, { userId, count: questions.length, createdAt: now });
    tx.create(db().collection("auditLog").doc(), {
      actorId: userId,
      action: "questions.imported",
      count: questions.length,
      at: now,
    });
    return { imported: questions.length };
  });
});
