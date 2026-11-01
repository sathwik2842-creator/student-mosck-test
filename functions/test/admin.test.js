import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePaper,
  normalizeQuestion,
  normalizeQuestionBatch,
  isAdminRole,
} from "../lib/admin-validation.js";
import {
  parseCSV,
  parseQuestionFile,
} from "../../src/admin/importQuestions.js";
const question = () => ({
  text: "A current of 2 A passes through 3 Ω. Find the voltage.",
  subject: "Physics",
  section: "Section A",
  options: ["3", "6", "9", "12"],
  correctAnswer: "B",
  solutions: ["Use V = IR.", "V = 2 × 3 = 6 V."],
});
const paper = () => ({
  title: "JEE Main · Mock 02",
  examType: "main",
  duration: 180,
  totalMarks: 4,
  active: true,
  marking: { correct: 4, mcqIncorrect: -1, numericalIncorrect: -1 },
  questions: [question()],
});
test("roles require an explicit true boolean and reject truthy values", () => {
  assert.equal(isAdminRole({ isAdmin: true }), true);
  for (const role of [
    undefined,
    null,
    {},
    { isAdmin: false },
    { isAdmin: "true" },
    { isAdmin: 1 },
    { roles: ["admin"] },
  ])
    assert.equal(isAdminRole(role), false);
});
test("published paper normalizes metadata, answer labels, marking and IDs", () => {
  const p = normalizePaper({ ...paper(), isAdmin: true, userId: "forged" });
  assert.equal(p.questions[0].correctAnswer, "6");
  assert.equal(p.questions[0].id, 0);
  assert.equal(p.questions[0].correctMarks, 4);
  assert.equal(p.questions[0].incorrectMarks, -1);
  assert.equal(p.category, "Engineering");
  assert.equal(p.accent, "green");
  assert.equal(p.isAdmin, undefined);
  assert.equal(p.userId, undefined);
  assert.deepEqual(p.subjects, ["Physics", "Chemistry", "Mathematics"]);
});
test("drafts can be empty; published tests require consistent marks and questions", () => {
  assert.equal(
    normalizePaper({
      ...paper(),
      active: false,
      questions: [],
      totalMarks: 300,
    }).questions.length,
    0,
  );
  assert.throws(() => normalizePaper({ ...paper(), questions: [] }));
  assert.throws(() => normalizePaper({ ...paper(), totalMarks: 300 }));
  assert.throws(() => normalizePaper({ ...paper(), duration: 1.5 }));
  assert.throws(() => normalizePaper({ ...paper(), examType: "forged" }));
});
test("subjects are compatible with the exam and text content remains plain text", () => {
  assert.throws(() =>
    normalizePaper({
      ...paper(),
      questions: [{ ...question(), subject: "Biology" }],
    }),
  );
  const q = normalizeQuestion({
    ...question(),
    text: "<script>alert(1)</script>",
  });
  assert.equal(q.text, "<script>alert(1)</script>");
});
test("negative rules support zero penalty numerical questions", () => {
  const p = normalizePaper({
    ...paper(),
    examType: "advanced",
    totalMarks: 3,
    marking: { correct: 3, mcqIncorrect: -1, numericalIncorrect: 0 },
    questions: [
      {
        ...question(),
        section: "Numerical",
        correctAnswer: "-2.5",
        options: [],
      },
    ],
  });
  assert.equal(p.questions[0].sectionType, "numerical");
  assert.equal(p.questions[0].incorrectMarks, 0);
  assert.deepEqual(p.questions[0].options, []);
});
test("MCQ validation rejects blanks, duplicates, unknown answers and incomplete solutions", () => {
  for (const patch of [
    { options: ["1", "1", "2", "3"] },
    { options: ["1", "", "3", "4"] },
    { correctAnswer: "not available" },
    { solutions: [] },
    { text: "" },
  ])
    assert.throws(() => normalizeQuestion({ ...question(), ...patch }));
});
test("numeric validation rejects nonnumbers, nonfinite values and invalid mark increments", () => {
  for (const answer of ["Infinity", "NaN", "0x10", "", "word"])
    assert.throws(() =>
      normalizeQuestion({
        ...question(),
        section: "Numerical",
        correctAnswer: answer,
      }),
    );
  for (const mark of [true, null, "", Infinity, 0, -1, 0.3, 21])
    assert.throws(() =>
      normalizeQuestion({ ...question(), correctMarks: mark }),
    );
  assert.throws(() => normalizeQuestion({ ...question(), incorrectMarks: 1 }));
});
test("batch validation is atomic and labels the failing row", () => {
  assert.throws(
    () => normalizeQuestionBatch([question(), { ...question(), text: "" }]),
    /Question 2/,
  );
  assert.throws(() => normalizeQuestionBatch([]));
  assert.throws(() =>
    normalizeQuestionBatch(Array.from({ length: 101 }, question)),
  );
  assert.equal(normalizeQuestionBatch([question()])[0].correctAnswer, "6");
});
test("JSON accepts arrays or questions wrappers and rejects invalid schemas", () => {
  for (const input of [[question()], { questions: [question()] }])
    assert.equal(
      parseQuestionFile(JSON.stringify(input), "questions.JSON")[0]
        .correctAnswer,
      "6",
    );
  assert.throws(() => parseQuestionFile("{}", "a.json"));
  assert.throws(() => parseQuestionFile("not json", "a.json"));
  assert.throws(() => parseQuestionFile("", "a.exe"));
});
test("CSV handles commas, escaped quotes, BOM, CRLF and multiline explanations", () => {
  const csv =
    '\uFEFFtext,subject,section,optionA,optionB,optionC,optionD,correctAnswer,solutions\r\n"Find voltage, using \"\"Ohm\"\" law",Physics,Section A,3,6,9,12,B,"Use V = IR.\nV = 6 V."\r\n';
  const result = parseQuestionFile(csv, "questions.csv");
  assert.equal(result[0].text, 'Find voltage, using "Ohm" law');
  assert.equal(result[0].correctAnswer, "6");
  assert.equal(result[0].solutions.length, 2);
});
test("CSV rejects broken quotes, duplicate or missing headers and inconsistent columns", () => {
  for (const csv of [
    "",
    "text,text\na,b",
    "text,subject\na,b",
    'text,subject,section,correctAnswer,solutions\n"unclosed',
    "text,subject,section,correctAnswer,solutions\na,b,c,d,e,f",
    'text,subject,section,correctAnswer,solutions\n"a"x,b,c,d,e',
  ])
    assert.throws(() => parseCSV(csv));
});
test("import file size, question text and document sizes are bounded", () => {
  assert.throws(() => parseQuestionFile("x".repeat(850001), "a.json"));
  assert.throws(() =>
    normalizeQuestion({ ...question(), text: "x".repeat(12001) }),
  );
  const long = {
    ...question(),
    options: [
      "a".repeat(1997),
      "b".repeat(1998),
      "c".repeat(1999),
      "d".repeat(2000),
    ],
    correctAnswer: "D",
    solutions: ["x".repeat(3000)],
  };
  assert.throws(
    () =>
      normalizePaper({
        ...paper(),
        totalMarks: 1200,
        questions: Array.from({ length: 300 }, () => long),
      }),
    /too large|database limits/,
  );
});
