import { createRequire } from "node:module";
const require = createRequire(
  new URL("../functions/package.json", import.meta.url),
);
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
import { exams, createQuestions } from "./sample-bank.js";
import { validateTest, metadata } from "../functions/grading.js";
const projectId =
  process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
if (!projectId)
  throw new Error("Set GCLOUD_PROJECT to the intended Firebase project ID.");
const emulator = !!process.env.FIRESTORE_EMULATOR_HOST;
if (emulator && !projectId.startsWith("demo-"))
  throw new Error("Use a demo-* project ID for emulator seed data.");
if (!emulator && !process.argv.includes("--production"))
  throw new Error(
    "Production writes require an explicit --production flag and application-default credentials.",
  );
initializeApp({
  projectId,
  ...(!emulator ? { credential: applicationDefault() } : {}),
});
const db = getFirestore();
const overwrite = process.argv.includes("--overwrite");
for (const [order, exam] of exams.entries()) {
  const questions = createQuestions(exam).map((q) => ({
    id: q.id,
    subject: q.subject,
    text: q.text,
    options: q.options || [],
    sectionType: q.type,
    correctAnswer: q.answer,
    solutions: q.steps,
    correctMarks: exam.id === "advanced" ? 3 : 4,
    incorrectMarks: exam.id === "advanced" && q.type === "numerical" ? 0 : -1,
  }));
  const test = {
    title: exam.name,
    duration: exam.duration,
    totalMarks: exam.marks,
    active: true,
    version: 1,
    category: exam.category,
    subjects: exam.subjects,
    subtitle: exam.subtitle,
    accent: exam.accent,
    level: exam.level,
    order,
    description:
      "Generated sample practice paper. Includes concept repetitions and parameter variations; not an official exam paper.",
    questions,
  };
  validateTest(test);
  const ref = db.doc(`tests/${exam.id}`),
    catalog = db.doc(`testCatalog/${exam.id}`);
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists && !overwrite) {
      console.log(`Preserved existing test: ${exam.id}`);
      return;
    }
    tx.set(ref, test);
    tx.set(catalog, metadata(test, exam.id));
  });
  console.log(`Seed checked: ${exam.name} (${questions.length} questions)`);
}
console.log(
  `Seed complete (${emulator ? "emulator" : "production"} project: ${projectId}).`,
);
