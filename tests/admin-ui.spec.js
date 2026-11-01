// UI-only tests: replace transport/context modules in the browser, never production code.
// Real role enforcement and writes are tested in firestore.rules/backend.integration suites.
import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.__errors = errors;
});
test.afterEach(async ({ page }) => expect(page.__errors).toEqual([]));
async function fixture(page, { admin = true } = {}) {
  await page.addInitScript(
    ({ admin }) => {
      const question = {
        text: "A resistor of 3 Ω carries a current of 2 A. Find the voltage.",
        subject: "Physics",
        section: "Section A",
        sectionType: "mcq",
        options: ["3", "6", "9", "12"],
        correctAnswer: "6",
        solutions: ["Use V = IR.", "V = 6 V."],
        correctMarks: 4,
        incorrectMarks: -1,
      };
      window.__role = admin;
      window.__user = {
        uid: "ui-admin",
        email: "admin@example.com",
        displayName: "Test Admin",
      };
      window.__store = {
        tests: [
          {
            id: "main",
            title: "JEE Main · Mock 01",
            name: "JEE Main · Mock 01",
            examType: "main",
            duration: 180,
            totalMarks: 4,
            marks: 4,
            count: 1,
            subjects: ["Physics", "Chemistry", "Mathematics"],
            category: "Engineering",
            active: true,
            version: 1,
            marking: { correct: 4, mcqIncorrect: -1, numericalIncorrect: -1 },
            questions: [{ ...question, id: 0 }],
          },
        ],
        bank: [{ ...question, id: "bank-1", version: 1 }],
        submissions: [
          {
            id: "result-1",
            userId: "student-1",
            studentEmail: "learner@example.com",
            exam: { name: "JEE Main · Mock 01" },
            score: 4,
            totalMarks: 4,
            accuracy: 100,
            total: 1,
            date: "2026-11-01T10:00:00Z",
          },
        ],
        listeners: [],
      };
    },
    { admin },
  );
  await page.route("**/src/AuthContext.jsx*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `export const AuthProvider=({children})=>children;export const useAuth=()=>({user:window.__user,loading:false,error:'',configured:true,isAdmin:window.__role,roleLoading:false,roleError:'',logout:async()=>{},login:async()=>{},signup:async()=>{},googleLogin:async()=>{}});export const authErrorMessage=e=>e.message;`,
    }),
  );
  await page.route("**/src/api.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `export const subscribeTests=(success)=>{success([]);return()=>{}};export const subscribeResults=(id,success)=>{success([]);return()=>{}};export const apiErrorMessage=e=>e.message;export const startTest=async()=>{};export const saveAttempt=async()=>{};export const submitTest=async()=>{};`,
    }),
  );
  await page.route("**/src/admin/api.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `const s=window.__store;const emit=()=>s.listeners.forEach(fn=>fn());const watch=(key,cb)=>{const fn=()=>cb([...s[key]]);s.listeners.push(fn);fn();return()=>s.listeners=s.listeners.filter(f=>f!==fn)};export const watchTests=(cb)=>watch('tests',cb);export const watchQuestions=(n,cb)=>watch('bank',cb);export const watchSubmissions=(cb)=>watch('submissions',cb);export const getOverview=async()=>({registeredStudents:24,testsTaken:83,activeTests:s.tests.filter(t=>t.active).length,questionCount:s.bank.length,updatedAt:new Date().toISOString()});export const getTest=async id=>structuredClone(s.tests.find(t=>t.id===id));export const saveTest=async(id,paper,version)=>{const old=s.tests.find(t=>t.id===id);if((old?.version||0)!==version)throw Error('This item changed in another session. Reload it before saving.');const next={...paper,id,name:paper.title,marks:paper.totalMarks,count:paper.questions.length,version:version+1};s.tests=old?s.tests.map(t=>t.id===id?next:t):[...s.tests,next];emit();return {id,version:next.version}};export const deleteTest=async id=>{s.tests=s.tests.filter(t=>t.id!==id);emit()};export const saveQuestion=async(id,q,version)=>{const item={...q,id,version:version+1};s.bank=s.bank.some(q=>q.id===id)?s.bank.map(q=>q.id===id?item:q):[item,...s.bank];emit();return {id,version:version+1}};export const deleteQuestion=async id=>{s.bank=s.bank.filter(q=>q.id!==id);emit()};export const importQuestions=async items=>{s.bank.push(...items.map((q,i)=>({...q,id:'import-'+i,version:1})));emit();return {imported:items.length}};`,
    }),
  );
}
test("admin overview, live table, responsive light and dark layouts", async ({
  page,
}) => {
  await fixture(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Good questions. Better outcomes." }),
  ).toBeVisible();
  await expect(page.locator(".admin-stats")).toContainText("24");
  await expect(page.getByText("learner@example.com")).toBeVisible();
  await page.screenshot({
    path: "/tmp/veda-admin-desktop.png",
    fullPage: true,
  });
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({width:390,height:844});
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.screenshot({ path: "/tmp/veda-admin-mobile.png", fullPage: true });
  await page.getByRole('button',{name:'Create new test',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Let’s build a thoughtful test.'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Add question',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.setViewportSize({width:320,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'/tmp/veda-admin-question-mobile.png',fullPage:true});
});
test("non-admin route access redirects with an unauthorized warning", async ({
  page,
}) => {
  await fixture(page, { admin: false });
  await page.goto("/admin/questions");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("status")).toContainText("Unauthorized");
  await expect(
    page.getByRole("button", { name: "Admin workspace" }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "A bank of possibilities." }),
  ).not.toBeVisible();
});
test("create a test, add a question, validate total marks, save and publish", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/admin/tests");
  await page
    .getByRole("button", { name: "Create new test", exact: true })
    .click();
  await page.getByLabel("Test title").fill("JEE Main · Fresh Mock");
  await page.getByRole("button", { name: "Add question", exact: true }).click();
  await page.getByRole("button", { name: "Add to working paper" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page
    .getByLabel("Question text", { exact: true })
    .fill("What is 2 + 2?");
  for (const [i, value] of ["2", "3", "4", "5"].entries())
    await page
      .getByLabel(`Option ${String.fromCharCode(65 + i)}`, { exact: true })
      .fill(value);
  await page.getByLabel("Correct answer", { exact: true }).selectOption("2");
  await page
    .getByLabel("Step-by-step solution")
    .fill("Add the integers.\n2 + 2 = 4.");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.locator(".preview-correct")).toContainText("4");
  await page.getByRole("button", { name: "Add to working paper" }).click();
  await expect(page.locator(".paper-question")).toHaveCount(1);
  await page.getByRole("button", { name: "Publish test", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Total marks");
  await page.getByRole("button", { name: "Use 4", exact: true }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Draft saved");
  await page.getByRole("button", { name: "Publish test", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Test published");
  await page
    .getByRole("button", { name: "All test papers", exact: true })
    .click();
  await expect(
    page.getByText("JEE Main · Fresh Mock", { exact: true }),
  ).toBeVisible();
});
test("bank question CRUD, numerical input, import preview and malformed file rejection", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/admin/questions");
  await page.getByRole("button", { name: "Add question", exact: true }).click();
  await page
    .getByLabel("Question text", { exact: true })
    .fill("Find the numerical value of 12 / 3.");
  await page.getByLabel("Section / question type").selectOption("Numerical");
  await page.getByLabel("Correct numerical answer").fill("4");
  await page
    .getByLabel("Step-by-step solution")
    .fill("Divide 12 by 3.\nThe answer is 4.");
  await page
    .getByRole("button", { name: "Save question", exact: true })
    .click();
  await expect(page.locator(".bank-question")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Edit question", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Question text", { exact: true })
    .fill("Find the numerical value of 16 / 4.");
  await page
    .getByRole("button", { name: "Save question", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Find the numerical value of 16 / 4." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete question 1", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.locator(".bank-question")).toHaveCount(1);
  await page.getByRole("button", { name: "Bulk import", exact: true }).click();
  await page
    .getByLabel("Upload question file")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from("{bad"),
    });
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Import questions", exact: true }),
  ).toBeDisabled();
  const data = [
    {
      text: "What is 3 + 3?",
      subject: "Mathematics",
      section: "Section B",
      options: ["3", "4", "5", "6"],
      correctAnswer: "D",
      solutions: ["Add the numbers.", "3 + 3 = 6."],
    },
  ];
  await page
    .getByLabel("Upload question file")
    .setInputFiles({
      name: "good.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(data)),
    });
  await expect(
    page.getByRole("heading", { name: "1 questions validated" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Import 1 questions" }).click();
  await expect(page.locator(".bank-question")).toHaveCount(2);
});
test("stale paper edits surface a conflict instead of overwriting data", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/admin/tests");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Test title").fill("My local changes");
  await page.evaluate(() => (window.__store.tests[0].version = 2));
  await page.getByRole("button", { name: "Publish changes" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "changed in another session",
  );
  await expect(page.getByLabel("Test title")).toHaveValue("My local changes");
});
