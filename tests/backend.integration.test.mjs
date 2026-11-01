import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  getFunctions,
  connectFunctionsEmulator,
  httpsCallable,
} from "firebase/functions";
const require = createRequire(
  new URL("../functions/package.json", import.meta.url),
);
const { initializeApp: adminApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const admin = adminApp({ projectId: "demo-veda-test" }, "integration-admin"),
  db = getFirestore(admin);
const apps = [];
async function client() {
  const app = initializeApp(
    {
      projectId: "demo-veda-test",
      apiKey: "emulator-key",
      authDomain: "demo-veda-test.firebaseapp.com",
    },
    crypto.randomUUID(),
  );
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const functions = getFunctions(app);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  await createUserWithEmailAndPassword(
    auth,
    `${crypto.randomUUID()}@example.com`,
    "test-pass-123",
  );
  return {
    user: auth.currentUser,
    call: async (name, data) =>
      (await httpsCallable(functions, name)(data)).data,
  };
}
after(async () => {
  await Promise.all(apps.map(deleteApp));
  await admin.delete();
});
test("authenticated start hides keys; server grades, ignores forged score and saves an owner result idempotently", async () => {
  const c = await client(),
    start = await c.call("startTest", { testId: "main" });
  assert.equal(start.questions.length, 75);
  assert.equal(start.questions[0].answer, undefined);
  assert.equal(start.questions[0].correctAnswer, undefined);
  assert.equal(start.questions[0].steps, undefined);
  const resumed = await c.call("startTest", { testId: "main" });
  assert.equal(resumed.attemptId, start.attemptId);
  const result = await c.call("submitTest", {
    attemptId: start.attemptId,
    answers: { 0: "16", 1: "3", 4: "12" },
    score: 300,
    userId: "someone-else",
  });
  assert.equal(result.score, 7);
  assert.equal(result.correct, 2);
  assert.equal(result.incorrect, 1);
  assert.equal(result.totalMarks, 300);
  assert.equal(result.userId, c.user.uid);
  assert.equal(result.breakdown[0].answer, "16");
  const retry = await c.call("submitTest", {
    attemptId: start.attemptId,
    answers: {},
    score: 999,
  });
  assert.equal(retry.id, result.id);
  assert.equal(retry.score, 7);
  const stored = (await db.doc(`results/${result.id}`).get()).data();
  assert.equal(stored.score, 7);
  assert.equal(stored.userId, c.user.uid);
});
test("other students cannot save or submit an attempt", async () => {
  const owner = await client(),
    other = await client(),
    start = await owner.call("startTest", { testId: "advanced" });
  await assert.rejects(
    other.call("saveAttempt", {
      attemptId: start.attemptId,
      answers: {},
      revision: 1,
    }),
    (e) => e.code === "functions/permission-denied",
  );
  await assert.rejects(
    other.call("submitTest", { attemptId: start.attemptId, answers: {} }),
    (e) => e.code === "functions/permission-denied",
  );
});
test("expired attempts grade saved answers and ignore late injected answers", async () => {
  const c = await client(),
    s = await c.call("startTest", { testId: "main" });
  await c.call("saveAttempt", {
    attemptId: s.attemptId,
    answers: { 0: "16" },
    revision: 2,
  });
  await c.call("saveAttempt", {
    attemptId: s.attemptId,
    answers: { 0: "8" },
    revision: 1,
  });
  await db
    .doc(`attempts/${s.attemptId}`)
    .update({ deadline: Timestamp.fromMillis(Date.now() - 1000) });
  const late = await c.call("saveAttempt", {
    attemptId: s.attemptId,
    answers: { 0: "8" },
    revision: 3,
  });
  assert.equal(late.expired, true);
  const result = await c.call("submitTest", {
    attemptId: s.attemptId,
    answers: { 0: "8", 1: "6" },
  });
  assert.equal(result.score, 4);
  assert.equal(result.correct, 1);
  assert.equal(result.unattempted, 74);
  assert.equal(result.expired, true);
});
test("unauthenticated function access is rejected", async () => {
  const app = initializeApp(
    { projectId: "demo-veda-test", apiKey: "emulator-key" },
    crypto.randomUUID(),
  );
  apps.push(app);
  const functions = getFunctions(app);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  await assert.rejects(
    httpsCallable(functions, "startTest")({ testId: "main" }),
    (e) => e.code === "functions/unauthenticated",
  );
});

const adminQuestion = () => ({
  text: "What is 2 + 2?",
  subject: "Mathematics",
  section: "Section A",
  options: ["2", "3", "4", "5"],
  correctAnswer: "C",
  solutions: ["Add the integers.", "2 + 2 = 4."],
  correctMarks: 4,
  incorrectMarks: -1,
});
const adminPaper = () => ({
  title: "Administrator integration paper",
  examType: "main",
  duration: 1,
  totalMarks: 4,
  active: false,
  marking: { correct: 4, mcqIncorrect: -1, numericalIncorrect: -1 },
  questions: [adminQuestion()],
});
test("student cannot invoke any admin API or forge admin privileges", async () => {
  const c = await client();
  for (const name of [
    "adminOverview",
    "adminGetTest",
    "adminSaveTest",
    "adminDeleteTest",
    "adminSaveQuestion",
    "adminDeleteQuestion",
    "adminImportQuestions",
  ])
    await assert.rejects(
      c.call(name, {
        id: "main",
        isAdmin: true,
        role: "admin",
        paper: adminPaper(),
        expectedVersion: 1,
      }),
      (e) => e.code === "functions/permission-denied",
    );
});
test("authorized admin can create, publish, edit and delete papers with optimistic concurrency", async () => {
  const a = await client();
  await db.doc(`roles/${a.user.uid}`).set({ isAdmin: true });
  const id = crypto.randomUUID();
  let created = await a.call("adminSaveTest", {
    id,
    paper: adminPaper(),
    expectedVersion: 0,
  });
  assert.equal(created.version, 1);
  let p = await a.call("adminGetTest", { id });
  assert.equal(p.questions[0].correctAnswer, "4");
  assert.equal((await db.doc(`testCatalog/${id}`).get()).data().active, false);
  await assert.rejects(
    a.call("adminSaveTest", { id, paper: adminPaper(), expectedVersion: 0 }),
    (e) => e.code === "functions/aborted",
  );
  await a.call("adminSaveTest", {
    id,
    paper: { ...adminPaper(), active: true },
    expectedVersion: 1,
  });
  const student = await client();
  const session = await student.call("startTest", { testId: id });
  assert.equal(session.questions[0].answer, undefined);
  await assert.rejects(
    a.call("adminDeleteTest", { id, expectedVersion: 2 }),
    (e) => e.code === "functions/failed-precondition",
  );
  await a.call("adminSaveTest", {
    id,
    paper: {
      ...adminPaper(),
      questions: [{ ...adminQuestion(), correctAnswer: "5" }],
      active: false,
    },
    expectedVersion: 2,
  });
  const resumed = await student.call("startTest", { testId: id });
  assert.equal(resumed.attemptId, session.attemptId);
  await assert.rejects(
    a.call("adminDeleteTest", { id, expectedVersion: 3 }),
    (e) => e.code === "functions/failed-precondition",
  );
  const result = await student.call("submitTest", {
    attemptId: session.attemptId,
    answers: { 0: "4" },
  });
  assert.equal(result.score, 4);
  assert.equal(result.breakdown[0].answer, "4");
  await a.call("adminDeleteTest", { id, expectedVersion: 3 });
  assert.equal((await db.doc(`tests/${id}`).get()).exists, false);
  assert.equal(
    (await db.doc(`results/${session.attemptId}`).get()).exists,
    true,
  );
});
test("bank CRUD, atomic import validation, idempotent retries and role revocation", async () => {
  const a = await client();
  await db.doc(`roles/${a.user.uid}`).set({ isAdmin: true });
  const id = crypto.randomUUID();
  await a.call("adminSaveQuestion", {
    id,
    question: adminQuestion(),
    expectedVersion: 0,
  });
  assert.equal(
    (await db.doc(`questionBank/${id}`).get()).data().correctAnswer,
    "4",
  );
  await a.call("adminSaveQuestion", {
    id,
    question: { ...adminQuestion(), text: "What is two plus two?" },
    expectedVersion: 1,
  });
  await assert.rejects(
    a.call("adminSaveQuestion", {
      id,
      question: adminQuestion(),
      expectedVersion: 1,
    }),
    (e) => e.code === "functions/aborted",
  );
  const importId = crypto.randomUUID();
  const payload = { questions: [adminQuestion(), adminQuestion()], importId };
  const first = await a.call("adminImportQuestions", payload),
    retry = await a.call("adminImportQuestions", payload);
  assert.equal(first.imported, 2);
  assert.equal(retry.imported, 2);
  assert.equal((await db.doc(`questionBank/${importId}_0`).get()).exists, true);
  const badId = crypto.randomUUID();
  await assert.rejects(
    a.call("adminImportQuestions", {
      importId: badId,
      questions: [adminQuestion(), { ...adminQuestion(), text: "" }],
    }),
    (e) => e.code === "functions/invalid-argument",
  );
  assert.equal((await db.doc(`questionBank/${badId}_0`).get()).exists, false);
  await a.call("adminDeleteQuestion", { id, expectedVersion: 2 });
  await db.doc(`roles/${a.user.uid}`).set({ isAdmin: false });
  await assert.rejects(
    a.call("adminOverview", {}),
    (e) => e.code === "functions/permission-denied",
  );
  await assert.rejects(
    a.call("adminSaveQuestion", {
      id,
      question: adminQuestion(),
      expectedVersion: 0,
    }),
    (e) => e.code === "functions/permission-denied",
  );
});
