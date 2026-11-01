export class AdminValidationError extends Error {}
const reject = (message) => {
  throw new AdminValidationError(message);
};
const text = (value, label, max, required = true) => {
  if (typeof value !== "string") reject(`${label} must be text.`);
  const clean = value.trim();
  if ((required && !clean) || clean.length > max)
    reject(`${label} must contain ${required ? "1" : "0"}–${max} characters.`);
  return clean;
};
const number = (value, label, min, max) => {
  if (!["number", "string"].includes(typeof value))
    reject(`${label} must be a number.`);
  if (typeof value === "string" && !value.trim())
    reject(`${label} is required.`);
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max)
    reject(`${label} must be between ${min} and ${max}.`);
  return n;
};
const marks = (value, label, min, max) => {
  const n = number(value, label, min, max);
  if (!Number.isInteger(n * 4)) reject(`${label} must use increments of 0.25.`);
  return n;
};
export const EXAM_TYPES = {
  main: {
    label: "JEE Main",
    subjects: ["Physics", "Chemistry", "Mathematics"],
    accent: "green",
    category: "Engineering",
  },
  advanced: {
    label: "JEE Advanced",
    subjects: ["Physics", "Chemistry", "Mathematics"],
    accent: "purple",
    category: "Engineering",
  },
  neet: {
    label: "NEET UG",
    subjects: ["Physics", "Chemistry", "Biology"],
    accent: "orange",
    category: "Medical",
  },
};
export const isAdminRole = (role) => role?.isAdmin === true;
export function normalizeQuestion(
  input,
  {
    index = 0,
    subjects = ["Physics", "Chemistry", "Mathematics", "Biology"],
    marking = { correct: 4, mcqIncorrect: -1, numericalIncorrect: 0 },
  } = {},
) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    reject("Question must be an object.");
  const subject = text(input.subject, "Subject", 30);
  if (!subjects.includes(subject))
    reject(`Subject must be one of: ${subjects.join(", ")}.`);
  const section =
    input.section ||
    (input.sectionType === "numerical" ? "Numerical" : "Section A");
  if (!["Section A", "Section B", "Numerical"].includes(section))
    reject("Choose Section A, Section B or Numerical.");
  const sectionType = section === "Numerical" ? "numerical" : "mcq";
  let answer = text(String(input.correctAnswer ?? ""), "Correct answer", 2000);
  let options = [];
  if (sectionType === "mcq") {
    if (!Array.isArray(input.options) || input.options.length !== 4)
      reject("MCQs need exactly four answer options.");
    options = input.options.map((o, i) =>
      text(o, `Option ${String.fromCharCode(65 + i)}`, 2000),
    );
    if (new Set(options).size !== 4)
      reject("All four options must be distinct.");
    if (!options.includes(answer) && /^[A-D]$/i.test(answer))
      answer = options[answer.toUpperCase().charCodeAt(0) - 65];
    if (!options.includes(answer))
      reject("The correct answer must match an option (or be its A–D label).");
  } else if (
    !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(answer) ||
    !Number.isFinite(Number(answer))
  )
    reject("Numerical answers must be finite decimal numbers.");
  const steps = Array.isArray(input.solutions)
    ? input.solutions
    : typeof input.solutions === "string"
      ? input.solutions.split(/\r?\n/).filter((s) => s.trim())
      : [];
  if (!steps.length || steps.length > 30) reject("Add 1–30 solution steps.");
  return {
    id: index,
    text: text(input.text, "Question text", 12000),
    subject,
    section,
    sectionType,
    options,
    correctAnswer: answer,
    solutions: steps.map((s) => text(s, "Solution step", 3000)),
    correctMarks: marks(
      input.correctMarks === undefined ? marking.correct : input.correctMarks,
      "Correct marks",
      0.25,
      20,
    ),
    incorrectMarks: marks(
      input.incorrectMarks === undefined
        ? sectionType === "numerical"
          ? marking.numericalIncorrect
          : marking.mcqIncorrect
        : input.incorrectMarks,
      "Incorrect marks",
      -20,
      0,
    ),
  };
}
export function normalizePaper(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    reject("Provide valid test data.");
  const info = EXAM_TYPES[input.examType];
  if (!info) reject("Choose a valid exam type.");
  const duration = number(input.duration, "Duration", 1, 360);
  if (!Number.isInteger(duration))
    reject("Duration must be a whole number of minutes.");
  const marking = {
    correct: marks(input.marking?.correct ?? 4, "Correct marks", 0.25, 20),
    mcqIncorrect: marks(
      input.marking?.mcqIncorrect ?? -1,
      "MCQ penalty",
      -20,
      0,
    ),
    numericalIncorrect: marks(
      input.marking?.numericalIncorrect ?? -1,
      "Numerical penalty",
      -20,
      0,
    ),
  };
  if (!Array.isArray(input.questions) || input.questions.length > 300)
    reject("A test may contain up to 300 questions.");
  const questions = input.questions.map((q, index) =>
    normalizeQuestion(q, { index, subjects: info.subjects, marking }),
  );
  const totalMarks = marks(input.totalMarks, "Total marks", 0.25, 6000);
  if (input.active === true && !questions.length)
    reject("Add questions before publishing.");
  if (
    input.active === true &&
    Math.abs(questions.reduce((s, q) => s + q.correctMarks, 0) - totalMarks) >
      1e-9
  )
    reject(
      "Total marks must equal the sum of question marks before publishing.",
    );
  const result = {
    title: text(input.title, "Title", 120),
    examType: input.examType,
    subjects: info.subjects,
    category: info.category,
    accent: info.accent,
    subtitle: text(input.subtitle || "", "Subtitle", 180, false),
    description: text(input.description || "", "Description", 2000, false),
    duration,
    totalMarks,
    active: input.active === true,
    marking,
    questions,
    level: input.examType === "advanced" ? "Challenging" : "Standard",
    order: 0,
  };
  const worstAnswers = Object.fromEntries(
    questions.map((q) => [
      q.id,
      q.sectionType === "numerical"
        ? "9".repeat(80)
        : q.options.reduce((a, b) => (a.length > b.length ? a : b), ""),
    ]),
  );
  const reviewEstimate = {
    answers: worstAnswers,
    breakdown: questions.map((q) => ({
      ...q,
      userAnswer: worstAnswers[q.id],
      answer: q.correctAnswer,
      status: "incorrect",
      awardedMarks: q.incorrectMarks,
    })),
  };
  if (new TextEncoder().encode(JSON.stringify(reviewEstimate)).length > 850000)
    reject(
      "This paper would produce results that exceed database limits. Shorten answer options or split the paper.",
    );
  if (new TextEncoder().encode(JSON.stringify(result)).length > 850000)
    reject(
      "This paper is too large. Shorten question text or split it into smaller papers.",
    );
  return result;
}
export function normalizeQuestionBatch(input, options) {
  if (new TextEncoder().encode(JSON.stringify(input ?? null)).length > 850000)
    reject("The import is too large. Keep the batch below 850 KB.");
  if (!Array.isArray(input) || !input.length || input.length > 100)
    reject("Import between 1 and 100 questions at a time.");
  return input.map((q, index) => {
    try {
      return normalizeQuestion(q, { ...options, index });
    } catch (e) {
      throw new AdminValidationError(`Question ${index + 1}: ${e.message}`);
    }
  });
}
