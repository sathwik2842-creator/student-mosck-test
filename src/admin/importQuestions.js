import { normalizeQuestionBatch } from "../../functions/lib/admin-validation.js";
export const CSV_HEADERS = [
  "text",
  "subject",
  "section",
  "optionA",
  "optionB",
  "optionC",
  "optionD",
  "correctAnswer",
  "solutions",
  "correctMarks",
  "incorrectMarks",
];
export function parseCSV(text) {
  if (typeof text !== "string") throw new Error("CSV input must be text.");
  text = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [],
    field = "",
    quoted = false,
    closed = false;
  const push = () => {
    row.push(field);
    field = "";
    closed = false;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += c;
      continue;
    }
    if (closed && ![" ", "\t", ",", "\r", "\n"].includes(c))
      throw new Error("Invalid characters after a quoted CSV field.");
    if (c === '"') {
      if (field) throw new Error("Quotes must surround the whole CSV field.");
      quoted = true;
    } else if (c === ",") push();
    else if (c === "\r" || c === "\n") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      push();
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
    } else if (!closed) field += c;
  }
  if (quoted) throw new Error("CSV has an unclosed quoted field.");
  if (field || row.length || closed) {
    push();
    if (row.some((v) => v.trim())) rows.push(row);
  }
  if (!rows.length) throw new Error("CSV is empty.");
  const headers = rows.shift().map((h) => h.trim());
  if (new Set(headers).size !== headers.length)
    throw new Error("CSV headers must be unique.");
  const required = ["text", "subject", "section", "correctAnswer", "solutions"];
  for (const h of required)
    if (!headers.includes(h)) throw new Error(`Missing CSV header: ${h}.`);
  return rows.map((values, index) => {
    if (values.length !== headers.length)
      throw new Error(
        `CSV row ${index + 2} has ${values.length} fields; expected ${headers.length}.`,
      );
    const r = Object.fromEntries(headers.map((h, i) => [h, values[i]]));
    return {
      text: r.text,
      subject: r.subject,
      section: r.section,
      options:
        r.section === "Numerical"
          ? []
          : ["optionA", "optionB", "optionC", "optionD"].map((h) => r[h] || ""),
      correctAnswer: r.correctAnswer,
      solutions: r.solutions,
      ...(r.correctMarks?.trim() ? { correctMarks: r.correctMarks } : {}),
      ...(r.incorrectMarks?.trim() ? { incorrectMarks: r.incorrectMarks } : {}),
    };
  });
}
export function parseQuestionFile(contents, filename, options) {
  if (new TextEncoder().encode(contents).length > 850000)
    throw new Error("Import files must be smaller than 850 KB.");
  let raw;
  if (filename.toLowerCase().endsWith(".csv")) raw = parseCSV(contents);
  else if (filename.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(contents.replace(/^\uFEFF/, ""));
    raw = Array.isArray(parsed) ? parsed : parsed?.questions;
  } else throw new Error("Choose a .json or .csv file.");
  return normalizeQuestionBatch(raw, options);
}
export function downloadTemplate(type) {
  const question = {
    text: "A resistor of 3 Ω carries a current of 2 A. Find the voltage in volts.",
    subject: "Physics",
    section: "Section A",
    options: ["3", "6", "9", "12"],
    correctAnswer: "B",
    solutions: ["Use Ohm’s law: V = IR.", "V = 2 × 3 = 6 V."],
    correctMarks: 4,
    incorrectMarks: -1,
  };
  const content =
    type === "json"
      ? JSON.stringify([question], null, 2)
      : CSV_HEADERS.join(",") +
        "\n" +
        [
          '"A resistor of 3 Ω carries a current of 2 A. Find the voltage in volts."',
          "Physics",
          "Section A",
          "3",
          "6",
          "9",
          "12",
          "B",
          '"Use Ohm’s law: V = IR.\nV = 2 × 3 = 6 V."',
          "4",
          "-1",
        ].join(",") +
        "\n";
  const blob = new Blob([content], {
    type: type === "json" ? "application/json" : "text/csv",
  });
  const href = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = href;
  a.download = `veda-questions-template.${type}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
