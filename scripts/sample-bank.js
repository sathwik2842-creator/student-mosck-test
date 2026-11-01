export const exams = [
  {
    id: "main",
    name: "JEE Main",
    subtitle: "Your next step towards an NIT.",
    category: "Engineering",
    duration: 180,
    count: 75,
    marks: 300,
    subjects: ["Physics", "Chemistry", "Mathematics"],
    accent: "green",
    level: "Standard",
    tag: "MOST POPULAR",
  },
  {
    id: "advanced",
    name: "JEE Advanced",
    subtitle: "For the ambition that goes a little further.",
    category: "Engineering",
    duration: 180,
    count: 54,
    marks: 162,
    subjects: ["Physics", "Chemistry", "Mathematics"],
    accent: "purple",
    level: "Challenging",
    tag: "RAISE THE BAR",
  },
  {
    id: "neet",
    name: "NEET UG",
    subtitle: "A little closer to your white coat.",
    category: "Medical",
    duration: 180,
    count: 180,
    marks: 720,
    subjects: ["Physics", "Chemistry", "Biology"],
    accent: "orange",
    level: "Standard",
    tag: "FUTURE DOCTORS",
  },
];
const mcq = (text, correct, others, steps, seed) => {
  let options = [String(correct), ...others.map(String)];
  const offset = seed % 4;
  options = [...options.slice(offset), ...options.slice(0, offset)];
  return { text, options, answer: String(correct), steps, type: "mcq" };
};
function makeQuestion(subject, i, exam) {
  const n = i + 2,
    numerical = exam !== "neet" && i % 5 === 4;
  let q;
  if (subject === "Physics") {
    if (i % 3 === 0)
      q = {
        text: `A body starts from rest with uniform acceleration ${n} m/s². Find the distance travelled in 4 seconds (in metres).`,
        answer: String(n * 8),
        steps: [
          "Use the equation of motion: s = ut + ½at².",
          "The body starts from rest, so u = 0.",
          `Substitute a = ${n} and t = 4: s = ½ × ${n} × 16.`,
          `The displacement is ${n * 8} m.`,
        ],
        others: [n * 4, n * 16, n * 2],
      };
    else if (i % 3 === 1)
      q = {
        text: `A resistor of ${n} Ω carries a current of 2 A. What is the potential difference across it (in volts)?`,
        answer: String(2 * n),
        others: [n, n * 4, n + 4],
        steps: [
          "Apply Ohm’s law: V = IR.",
          `I = 2 A and R = ${n} Ω.`,
          `V = 2 × ${n} = ${2 * n} V.`,
        ],
      };
    else
      q = {
        text: `A force of ${n * 3} N acts on a mass of 3 kg on a frictionless surface. What is its acceleration (in m/s²)?`,
        answer: String(n),
        others: [n * 3, n * 9, n + 3],
        steps: [
          "Newton’s second law gives F = ma.",
          `Rearrange: a = F/m = ${n * 3}/3.`,
          `The acceleration is ${n} m/s².`,
        ],
      };
  } else if (subject === "Mathematics") {
    if (i % 2 === 0)
      q = {
        text: `If f(x) = ${n}x² + 3x, find f′(2).`,
        answer: String(n * 4 + 3),
        others: [n * 2 + 3, n * 4, n + 3],
        steps: [
          "Differentiate using the power rule.",
          `f′(x) = ${2 * n}x + 3.`,
          `At x = 2, f′(2) = ${2 * n} × 2 + 3 = ${n * 4 + 3}.`,
        ],
      };
    else
      q = {
        text: `An arithmetic progression has first term ${n} and common difference 3. Find its tenth term.`,
        answer: String(n + 27),
        others: [n + 30, n + 24, n + 21],
        steps: [
          "For an arithmetic progression, aₖ = a + (k − 1)d.",
          `Use a = ${n}, k = 10, and d = 3.`,
          `a₁₀ = ${n} + 9 × 3 = ${n + 27}.`,
        ],
      };
  } else if (subject === "Chemistry") {
    if (i % 2 === 0)
      q = {
        text: `How many moles are present in ${44 * n} g of CO₂? (Molar mass = 44 g/mol.)`,
        answer: String(n),
        others: [n * 2, n * 44, n + 1],
        steps: [
          "Amount in moles = mass / molar mass.",
          `n = ${44 * n} / 44.`,
          `The sample contains ${n} mol of CO₂.`,
        ],
      };
    else {
      const ph = 1 + (i % 6);
      q = {
        text: `The hydrogen ion concentration of a dilute aqueous solution is 10⁻${ph} mol/L. Calculate its pH.`,
        answer: String(ph),
        others: [14 - ph, ph + 1, ph - 1],
        steps: [
          "By definition, pH = −log₁₀[H⁺].",
          `Substitute [H⁺] = 10⁻${ph}.`,
          `pH = −(−${ph}) = ${ph}.`,
        ],
      };
    }
  } else {
    const bio = [
      [
        "Which organelle is the main site of oxidative phosphorylation?",
        "Mitochondrion",
        ["Golgi apparatus", "Ribosome", "Lysosome"],
        [
          "Oxidative phosphorylation couples electron transport to ATP synthesis.",
          "The electron transport chain lies in the inner mitochondrial membrane.",
          "Therefore, the mitochondrion is the correct organelle.",
        ],
      ],
      [
        "In an Aa × Aa monohybrid cross, what is the genotypic ratio?",
        "1 : 2 : 1",
        ["3 : 1", "1 : 1", "9 : 3 : 3 : 1"],
        [
          "Each parent produces A and a gametes.",
          "The four combinations are AA, Aa, Aa, and aa.",
          "The genotypic ratio AA : Aa : aa is 1 : 2 : 1.",
        ],
      ],
      [
        "Which cells transport oxygen in human blood?",
        "Erythrocytes",
        ["Platelets", "Neutrophils", "Lymphocytes"],
        [
          "Oxygen is transported mainly bound to haemoglobin.",
          "Erythrocytes contain haemoglobin.",
          "Platelets help clotting, while the other listed cells are immune cells.",
        ],
      ],
      [
        "Which enzyme fixes CO₂ in the Calvin cycle?",
        "RuBisCO",
        ["Pepsin", "Amylase", "DNA ligase"],
        [
          "The Calvin cycle starts with carbon fixation.",
          "RuBisCO catalyses addition of CO₂ to ribulose-1,5-bisphosphate.",
          "This produces an unstable intermediate that splits into two 3-PGA molecules.",
        ],
      ],
      [
        "Which hormone primarily lowers blood glucose?",
        "Insulin",
        ["Glucagon", "Adrenaline", "Cortisol"],
        [
          "Pancreatic beta cells release insulin when blood glucose rises.",
          "Insulin promotes cellular uptake of glucose and glycogen synthesis.",
          "These actions lower circulating glucose.",
        ],
      ],
      [
        "Double fertilisation in angiosperms produces which two structures?",
        "Zygote and primary endosperm nucleus",
        ["Two zygotes", "Two embryos", "Two pollen tubes"],
        [
          "One male gamete fuses with the egg to form a diploid zygote.",
          "The other fuses with the two polar nuclei.",
          "This second fusion forms the triploid primary endosperm nucleus.",
        ],
      ],
    ];
    const b = bio[i % bio.length];
    q = { text: b[0], answer: b[1], others: b[2], steps: b[3] };
  }
  return numerical
    ? { ...q, type: "numerical", options: undefined }
    : { ...mcq(q.text, q.answer, q.others, q.steps, i) };
}
export function createQuestions(exam) {
  let index = 0;
  return exam.subjects.flatMap((subject) => {
    const count =
      exam.id === "neet" ? (subject === "Biology" ? 90 : 45) : exam.count / 3;
    return Array.from({ length: count }, (_, i) => ({
      ...makeQuestion(subject, i, exam.id),
      id: index++,
      subject,
    }));
  });
}
