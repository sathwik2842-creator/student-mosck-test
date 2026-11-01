import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { readServiceAccount } from "./lib/server-credentials.js";
import {
  normalizeAnswers,
  grade,
  publicQuestions,
  validateTest,
  metadata,
  ValidationError,
} from "./grading.js";
if (!getApps().some(app => app.name === "[DEFAULT]")) {
  const configured = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
  const account = configured ? readServiceAccount(process.env) : null;
  initializeApp(account ? { projectId: account.projectId, credential: cert(account) } : undefined);
}
const db = getFirestore();
setGlobalOptions({ region: "us-central1", maxInstances: 10 });
const uidOf = (request) => {
  if (!request.auth)
    throw new HttpsError("unauthenticated", "Sign in to continue.");
  return request.auth.uid;
};
const validId = (id) =>
  typeof id === "string" && /^[a-zA-Z0-9_-]{1,160}$/.test(id);
const safe = (fn) =>
  onCall(async (request) => {
    try {
      return await fn(request);
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      if (error instanceof ValidationError)
        throw new HttpsError("invalid-argument", error.message);
      console.error("Callable operation failed", {
        code: error.code || "unknown",
      });
      throw new HttpsError(
        "internal",
        "Unable to complete the operation. Please retry.",
      );
    }
  });
export const startTest = safe(async (request) => {
  const userId = uidOf(request),
    testId = request.data?.testId;
  if (!validId(testId))
    throw new HttpsError("invalid-argument", "Choose a valid test.");
  const testRef = db.doc(`tests/${testId}`),
    activeRef = db.doc(`activeAttempts/${userId}_${testId}`),
    newRef = db.collection("attempts").doc();
  return db.runTransaction(async (tx) => {
    const testSnap = await tx.get(testRef);
    const activeSnap = await tx.get(activeRef);
    if (activeSnap.exists) {
      const oldRef = db.doc(`attempts/${activeSnap.data().attemptId}`);
      const old = await tx.get(oldRef);
      if (
        old.exists &&
        old.data().status === "active" &&
        old.data().userId === userId
      ) {
        const a = old.data();
        return {
          attemptId: old.id,
          exam: a.exam,
          questions: publicQuestions(a.test.questions),
          answers: a.answers,
          started: a.startedAt.toMillis(),
          deadline: a.deadline.toMillis(),
          serverNow: Date.now(),
          revision: a.revision,
          resumed: true,
        };
      }
    }
    if (!testSnap.exists) throw new HttpsError("not-found", "Test not found.");
    const test = testSnap.data();
    validateTest(test);
    const now = Date.now(),
      exam = metadata(test, testId),
      attempt = {
        userId,
        testId,
        test,
        exam,
        answers: {},
        revision: 0,
        status: "active",
        startedAt: Timestamp.fromMillis(now),
        deadline: Timestamp.fromMillis(now + test.duration * 60000),
      };
    tx.create(newRef, attempt);
    tx.set(activeRef, { attemptId: newRef.id, userId, testId });
    return {
      attemptId: newRef.id,
      exam,
      questions: publicQuestions(test.questions),
      answers: {},
      started: now,
      deadline: now + test.duration * 60000,
      serverNow: now,
      revision: 0,
      resumed: false,
    };
  });
});
export const saveAttempt = safe(async (request) => {
  const userId = uidOf(request),
    { attemptId, answers: input, revision } = request.data || {};
  if (!validId(attemptId) || !Number.isSafeInteger(revision) || revision < 1)
    throw new HttpsError("invalid-argument", "Invalid save request.");
  return db.runTransaction(async (tx) => {
    const ref = db.doc(`attempts/${attemptId}`),
      snapshot = await tx.get(ref);
    if (!snapshot.exists)
      throw new HttpsError("not-found", "Attempt not found.");
    const a = snapshot.data();
    if (a.userId !== userId)
      throw new HttpsError(
        "permission-denied",
        "This attempt belongs to another student.",
      );
    if (a.status !== "active") return { saved: false, submitted: true };
    if (Date.now() > a.deadline.toMillis())
      return { saved: false, expired: true };
    const answers = normalizeAnswers(input, a.test.questions);
    if (revision <= a.revision) return { saved: false, revision: a.revision };
    tx.update(ref, { answers, revision, updatedAt: Timestamp.now() });
    return { saved: true, revision };
  });
});
export const submitTest = safe(async (request) => {
  const userId = uidOf(request),
    { attemptId, answers: input } = request.data || {};
  if (!validId(attemptId))
    throw new HttpsError("invalid-argument", "Choose a valid attempt.");
  return db.runTransaction(async (tx) => {
    const ref = db.doc(`attempts/${attemptId}`),
      resultRef = db.doc(`results/${attemptId}`);
    const snapshot = await tx.get(ref);
    if (!snapshot.exists)
      throw new HttpsError("not-found", "Attempt not found.");
    const a = snapshot.data();
    if (a.userId !== userId)
      throw new HttpsError(
        "permission-denied",
        "This attempt belongs to another student.",
      );
    if (a.status === "submitted") {
      const existing = await tx.get(resultRef);
      const { submittedAt, ...data } = existing.data();
      return { id: existing.id, ...data };
    }
    const now = Date.now(),
      expired = now > a.deadline.toMillis();
    const answers = expired
        ? a.answers
        : normalizeAnswers(input, a.test.questions),
      evaluation = grade(a.test, answers),
      timeTaken = Math.min(
        a.test.duration * 60,
        Math.max(0, Math.round((now - a.startedAt.toMillis()) / 1000)),
      );
    const result = {
      userId,
      studentEmail: request.auth.token.email || "",
      testId: a.testId,
      examId: a.testId,
      exam: a.exam,
      score: evaluation.score,
      totalMarks: a.test.totalMarks,
      accuracy: evaluation.accuracy,
      timeTaken,
      seconds: timeTaken,
      correct: evaluation.correct,
      incorrect: evaluation.incorrect,
      unattempted: evaluation.unattempted,
      total: evaluation.total,
      answers,
      breakdown: evaluation.breakdown,
      date: new Date(now).toISOString(),
      submittedAt: Timestamp.fromMillis(now),
      expired,
      percentile: null,
    };
    tx.create(resultRef, result);
    tx.update(ref, {
      status: "submitted",
      submittedAt: Timestamp.fromMillis(now),
      answers,
    });
    tx.delete(db.doc(`activeAttempts/${userId}_${a.testId}`));
    const { submittedAt, ...response } = result;
    return { id: attemptId, ...response };
  });
});

// Callable handlers perform role checks independently of browser route guards.
export {
  adminOverview,
  adminGetTest,
  adminSaveTest,
  adminDeleteTest,
  adminSaveQuestion,
  adminDeleteQuestion,
  adminImportQuestions,
} from "./admin.js";
