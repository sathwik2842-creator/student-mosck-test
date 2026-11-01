import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAnswers,
  grade,
  publicQuestions,
  validateTest,
  metadata,
} from "../grading.js";
import { exams, createQuestions } from "../../scripts/sample-bank.js";
const toTest = (e) => ({
  title: e.name,
  duration: e.duration,
  totalMarks: e.marks,
  active: true,
  subjects: e.subjects,
  category: e.category,
  questions: createQuestions(e).map((q) => ({
    id: q.id,
    subject: q.subject,
    text: q.text,
    options: q.options || [],
    sectionType: q.type,
    correctAnswer: q.answer,
    solutions: q.steps,
    correctMarks: e.id === "advanced" ? 3 : 4,
    incorrectMarks: e.id === "advanced" && q.type === "numerical" ? 0 : -1,
  })),
});
for (const exam of exams) {
  test(`${exam.name}: full bank integrity and perfect score`, () => {
    const t = toTest(exam);
    validateTest(t);
    assert.equal(t.questions.length, exam.count);
    const answers = Object.fromEntries(
      t.questions.map((q) => [q.id, q.correctAnswer]),
    );
    const result = grade(t, normalizeAnswers(answers, t.questions));
    assert.equal(result.score, exam.marks);
    assert.equal(result.accuracy, 100);
    assert.equal(result.correct, exam.count);
    assert.equal(result.incorrect, 0);
    assert.equal(metadata(t, exam.id).marks, exam.marks);
  });
  test(`${exam.name}: all unattempted yields zero`, () => {
    const t = toTest(exam),
      r = grade(t, {});
    assert.equal(r.score, 0);
    assert.equal(r.unattempted, exam.count);
    assert.equal(r.accuracy, 0);
  });
}
test("negative marking, equivalent numerical answers, and immutable detailed breakdown", () => {
  const t = toTest(exams[0]);
  const result = grade(t, {
    0: t.questions[0].correctAnswer,
    1: t.questions[1].options.find((o) => o !== t.questions[1].correctAnswer),
    4: "12.000",
  });
  assert.equal(result.score, 7);
  assert.equal(result.correct, 2);
  assert.equal(result.incorrect, 1);
  assert.equal(result.unattempted, 72);
  assert.equal(result.accuracy, 66.67);
  assert.equal(result.breakdown[0].answer, t.questions[0].correctAnswer);
  assert.equal(result.breakdown[1].status, "incorrect");
  assert.equal(result.breakdown[4].awardedMarks, 4);
  assert.deepEqual(result.breakdown[0].steps, t.questions[0].solutions);
});
test("advanced numerical errors have zero penalty", () => {
  const t = toTest(exams[1]),
    result = grade(t, { 4: "99999" });
  assert.equal(result.score, 0);
  assert.equal(result.incorrect, 1);
  assert.equal(result.breakdown[4].awardedMarks, 0);
});
test("invalid answers and unknown question identifiers are rejected", () => {
  const qs = toTest(exams[0]).questions;
  for (const input of [
    null,
    [],
    { 999: "1" },
    { 0: 4 },
    { 0: "not-an-option" },
    { 4: "NaN" },
    { 4: "Infinity" },
    { 4: "x".repeat(90) },
  ])
    assert.throws(() => normalizeAnswers(input, qs));
  assert.deepEqual(normalizeAnswers({ 0: "", 1: "   ", 4: "-3.5" }, qs), {
    4: "-3.5",
  });
});
test("student projections contain no answer keys or solutions", () => {
  const t = toTest(exams[0]);
  for (const q of publicQuestions(t.questions)) {
    assert.equal("correctAnswer" in q, false);
    assert.equal("solutions" in q, false);
    assert.equal("answer" in q, false);
    assert.equal("steps" in q, false);
    assert.ok(q.text);
    assert.ok(q.correctMarks);
  }
});
test("invalid banks cannot start", () => {
  const t = toTest(exams[0]);
  assert.throws(() => validateTest({ ...t, active: false }));
  assert.throws(() => validateTest({ ...t, totalMarks: 1 }));
  const bad = structuredClone(t);
  bad.questions[0].options[1] = bad.questions[0].options[0];
  assert.throws(() => validateTest(bad));
  const wrongId = structuredClone(t);
  wrongId.questions[0].id = 99;
  assert.throws(() => validateTest(wrongId));
});
