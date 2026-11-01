export class ValidationError extends Error {}
export function normalizeAnswers(input, questions) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).length > questions.length
  )
    throw new ValidationError("Answers must be a valid answer map.");
  const byId = new Map(questions.map((q) => [String(q.id), q]));
  const answers = {};
  for (const [id, value] of Object.entries(input)) {
    const q = byId.get(id);
    if (!q) throw new ValidationError("Unknown question ID.");
    if (value === null || value === "") continue;
    if (typeof value !== "string" || value.length > 2000)
      throw new ValidationError("Invalid answer format.");
    const text = value.trim();
    if (!text) continue;
    if (q.sectionType === "numerical") {
      if (text.length > 80 || !Number.isFinite(Number(text)))
        throw new ValidationError("Numerical answers must be finite numbers.");
    } else if (!q.options.includes(text))
      throw new ValidationError("Choose an available answer option.");
    answers[id] = text;
  }
  return answers;
}
export function grade(test, answers) {
  let score = 0,
    correct = 0,
    incorrect = 0;
  const breakdown = test.questions.map((q) => {
    const userAnswer = answers[String(q.id)] ?? null;
    const matches =
      userAnswer !== null &&
      (q.sectionType === "numerical"
        ? Math.abs(Number(userAnswer) - Number(q.correctAnswer)) < 1e-9
        : userAnswer === q.correctAnswer);
    const status =
      userAnswer === null ? "unattempted" : matches ? "correct" : "incorrect";
    const awardedMarks =
      status === "unattempted"
        ? 0
        : matches
          ? q.correctMarks
          : q.incorrectMarks;
    if (matches) correct++;
    else if (userAnswer !== null) incorrect++;
    score += awardedMarks;
    return {
      id: q.id,
      subject: q.subject,
      text: q.text,
      options: q.options || [],
      type: q.sectionType,
      answer: q.correctAnswer,
      steps: q.solutions,
      userAnswer,
      status,
      awardedMarks,
      correctMarks: q.correctMarks,
      incorrectMarks: q.incorrectMarks,
    };
  });
  return {
    score,
    correct,
    incorrect,
    unattempted: test.questions.length - correct - incorrect,
    total: test.questions.length,
    accuracy:
      correct + incorrect
        ? Math.round((correct / (correct + incorrect)) * 10000) / 100
        : 0,
    breakdown,
  };
}
export function publicQuestions(questions) {
  return questions.map(
    ({
      id,
      subject,
      text,
      options,
      sectionType,
      correctMarks,
      incorrectMarks,
    }) => ({
      id,
      subject,
      text,
      options: options || [],
      type: sectionType,
      correctMarks,
      incorrectMarks,
    }),
  );
}
export function validateTest(test) {
  if (
    !test ||
    !test.active ||
    typeof test.title !== "string" ||
    !Number.isFinite(test.duration) ||
    test.duration <= 0 ||
    test.duration > 360 ||
    !Array.isArray(test.subjects) ||
    !test.subjects.length ||
    !Array.isArray(test.questions) ||
    !test.questions.length ||
    test.questions.length > 300
  )
    throw new ValidationError(
      "The test configuration is unavailable or invalid.",
    );
  const seen = new Set();
  let total = 0;
  for (const [i, q] of test.questions.entries()) {
    if (
      q.id !== i ||
      seen.has(q.id) ||
      typeof q.text !== "string" ||
      !test.subjects.includes(q.subject) ||
      !["mcq", "numerical"].includes(q.sectionType) ||
      typeof q.correctAnswer !== "string" ||
      !Array.isArray(q.solutions) ||
      !q.solutions.length ||
      !Number.isFinite(q.correctMarks) ||
      q.correctMarks <= 0 ||
      !Number.isFinite(q.incorrectMarks) ||
      q.incorrectMarks > 0
    )
      throw new ValidationError("Invalid question configuration.");
    if (
      q.sectionType === "mcq" &&
      (!Array.isArray(q.options) ||
        q.options.length !== 4 ||
        new Set(q.options).size !== 4 ||
        !q.options.includes(q.correctAnswer))
    )
      throw new ValidationError("Invalid MCQ configuration.");
    if (
      q.sectionType === "numerical" &&
      (!q.correctAnswer.trim() || !Number.isFinite(Number(q.correctAnswer)))
    )
      throw new ValidationError("Invalid numerical answer.");
    total += q.correctMarks;
    seen.add(q.id);
  }
  if (total !== test.totalMarks)
    throw new ValidationError("Test total marks do not match question marks.");
}
export function metadata(test, id) {
  return {
    id,
    name: test.title,
    title: test.title,
    duration: test.duration,
    marks: test.totalMarks,
    totalMarks: test.totalMarks,
    count: test.questions.length,
    subjects: test.subjects,
    category: test.category,
    subtitle: test.subtitle || "",
    accent: test.accent || "green",
    level: test.level || "Standard",
    active: test.active,
    order: test.order || 0,
    description: test.description || "",
    version: test.version || 1,
    examType:
      test.examType ||
      (Object.keys({ main: 1, advanced: 1, neet: 1 }).includes(id)
        ? id
        : "main"),
    marking: test.marking || {
      correct: id === "advanced" ? 3 : 4,
      mcqIncorrect: -1,
      numericalIncorrect: id === "advanced" ? 0 : -1,
    },
  };
}
