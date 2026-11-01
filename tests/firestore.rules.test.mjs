import { test, before, after } from "node:test";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-veda-test",
    firestore: { rules: await readFile("firestore.rules", "utf8") },
  });
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, "tests/private-paper"), { answer: "secret" });
    await setDoc(doc(db, "testCatalog/public-paper"), {
      active: true,
      title: "Test",
    });
    await setDoc(doc(db, "results/alice-result"), {
      userId: "alice",
      score: 4,
    });
    await setDoc(doc(db, "results/bob-result"), { userId: "bob", score: 0 });
    await setDoc(doc(db, "attempts/active"), { userId: "alice", answers: {} });
    await setDoc(doc(db, "roles/root-admin"), { isAdmin: true });
    await setDoc(doc(db, "roles/alice"), { isAdmin: false });
    await setDoc(doc(db, "roles/forged-admin"), { isAdmin: "true" });
    await setDoc(doc(db, "testCatalog/draft-paper"), {
      active: false,
      title: "Unpublished paper",
    });
    await setDoc(doc(db, "questionBank/private-question"), {
      correctAnswer: "secret",
    });
  });
});
after(async () => {
  if (!env) return;
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const path of [
      "tests/private-paper",
      "testCatalog/public-paper",
      "testCatalog/draft-paper",
      "results/alice-result",
      "results/bob-result",
      "attempts/active",
      "roles/root-admin",
      "roles/alice",
      "roles/forged-admin",
      "questionBank/private-question",
    ])
      await deleteDoc(doc(db, path));
  });
  await env.cleanup();
});
test("anonymous users cannot access catalog or results", async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "testCatalog/public-paper")));
  await assertFails(getDoc(doc(db, "results/alice-result")));
});
test("students can read safe catalog, but not answer keys or private attempts", async () => {
  const db = env.authenticatedContext("alice").firestore();
  await assertSucceeds(getDoc(doc(db, "testCatalog/public-paper")));
  await assertFails(getDoc(doc(db, "tests/private-paper")));
  await assertFails(getDoc(doc(db, "attempts/active")));
  await assertFails(setDoc(doc(db, "tests/evil"), {}));
  await assertFails(setDoc(doc(db, "testCatalog/evil"), {}));
});
test("students can read only their own results, including scoped queries", async () => {
  const db = env.authenticatedContext("alice").firestore();
  await assertSucceeds(getDoc(doc(db, "results/alice-result")));
  await assertFails(getDoc(doc(db, "results/bob-result")));
  await assertSucceeds(
    getDocs(query(collection(db, "results"), where("userId", "==", "alice"))),
  );
  await assertFails(getDocs(collection(db, "results")));
});
test("students cannot create, overwrite, update or delete scores", async () => {
  const db = env.authenticatedContext("alice").firestore();
  await assertFails(
    setDoc(doc(db, "results/forged"), { userId: "alice", score: 300 }),
  );
  await assertFails(
    setDoc(doc(db, "results/alice-result"), { userId: "alice", score: 300 }),
  );
  await assertFails(updateDoc(doc(db, "results/alice-result"), { score: 300 }));
  await assertFails(deleteDoc(doc(db, "results/alice-result")));
  await assertFails(
    updateDoc(doc(db, "attempts/active"), { answers: { 0: "secret" } }),
  );
});

test("role documents are self-readable but cannot be created, modified or listed from browsers", async () => {
  const student = env.authenticatedContext("alice").firestore(),
    admin = env.authenticatedContext("root-admin").firestore();
  await assertSucceeds(getDoc(doc(student, "roles/alice")));
  await assertFails(getDoc(doc(student, "roles/root-admin")));
  await assertFails(getDocs(collection(student, "roles")));
  await assertFails(setDoc(doc(student, "roles/alice"), { isAdmin: true }));
  await assertFails(
    setDoc(doc(student, "roles/new-student"), { isAdmin: true }),
  );
  await assertFails(setDoc(doc(admin, "roles/alice"), { isAdmin: true }));
  await assertFails(getDoc(doc(student, "questionBank/private-question")));
});
test("only a boolean admin role permits bank and all-results reads, never browser writes", async () => {
  const admin = env.authenticatedContext("root-admin").firestore(),
    forged = env.authenticatedContext("forged-admin").firestore();
  await assertSucceeds(getDoc(doc(admin, "questionBank/private-question")));
  await assertSucceeds(getDoc(doc(admin, "results/bob-result")));
  await assertSucceeds(getDocs(collection(admin, "results")));
  await assertFails(getDoc(doc(forged, "questionBank/private-question")));
  await assertFails(
    setDoc(doc(admin, "questionBank/forged"), { correctAnswer: "wrong" }),
  );
  await assertFails(
    updateDoc(doc(admin, "results/bob-result"), { score: 999 }),
  );
  await assertFails(getDoc(doc(admin, "tests/private-paper")));
});
test("role revocation removes admin reads", async () => {
  await env.withSecurityRulesDisabled((c) =>
    setDoc(doc(c.firestore(), "roles/root-admin"), { isAdmin: false }),
  );
  const admin = env.authenticatedContext("root-admin").firestore();
  await assertFails(getDoc(doc(admin, "questionBank/private-question")));
  await assertFails(getDoc(doc(admin, "results/bob-result")));
});

test("students cannot read unpublished catalog documents or unscoped catalog queries", async () => {
  const student = env.authenticatedContext("alice").firestore();
  await assertFails(getDoc(doc(student, "testCatalog/draft-paper")));
  await assertFails(getDocs(collection(student, "testCatalog")));
  await assertSucceeds(
    getDocs(
      query(collection(student, "testCatalog"), where("active", "==", true)),
    ),
  );
  await env.withSecurityRulesDisabled((c) =>
    setDoc(doc(c.firestore(), "roles/root-admin"), { isAdmin: true }),
  );
  const admin = env.authenticatedContext("root-admin").firestore();
  await assertSucceeds(getDoc(doc(admin, "testCatalog/draft-paper")));
  await assertSucceeds(getDocs(collection(admin, "testCatalog")));
});
test("owners can edit only bounded result notes without changing any graded field", async () => {
  const alice = env.authenticatedContext("alice").firestore(),
    bob = env.authenticatedContext("bob").firestore();
  const ref = doc(alice, "results/alice-result");
  await assertSucceeds(
    updateDoc(ref, { studentNotes: "Review the parallel resistance formula." }),
  );
  await assertSucceeds(updateDoc(ref, { studentNotes: "" }));
  await assertFails(updateDoc(ref, { studentNotes: "x".repeat(2001) }));
  await assertFails(updateDoc(ref, { studentNotes: { text: "not a string" } }));
  await assertFails(updateDoc(ref, { studentNotes: "tamper", score: 999 }));
  await assertFails(updateDoc(ref, { studentNotes: "tamper", userId: "bob" }));
  await assertFails(
    updateDoc(doc(bob, "results/alice-result"), {
      studentNotes: "not my result",
    }),
  );
  await assertFails(
    setDoc(doc(alice, "results/new-own-result"), {
      userId: "alice",
      score: 300,
      studentNotes: "forged",
    }),
  );
});
