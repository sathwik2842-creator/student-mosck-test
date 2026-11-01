import { test, expect } from "@playwright/test";
import { signup } from "./helpers";
async function begin(page, name = "JEE Main") {
  await page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
    .getByRole("button", { name: "Start mock test" })
    .click();
  await page.getByRole("button", { name: "Let’s begin" }).click();
  await expect(page.getByRole("heading", { name: "Question 1" })).toBeVisible();
}
async function submit(page) {
  await page.getByRole("button", { name: "Submit test", exact: true }).click();
  await page.getByRole("button", { name: "Submit & see results" }).click();
  await expect(
    page.getByRole("heading", { name: "Test complete. Growth unlocked." }),
  ).toBeVisible();
}
test("Firestore paper, autosave, server scoring, solutions, review filters and history", async ({
  page,
}) => {
  await signup(page);
  await expect(page.locator(".test-card")).toHaveCount(3);
  await begin(page);
  await page.getByRole("radio").nth(0).check();
  await page.getByRole("button", { name: "Mark for Review & Next" }).click();
  await page.getByRole("radio").nth(0).check();
  await page
    .getByRole("button", { name: "Question 5, not visited", exact: true })
    .click();
  await page.getByLabel("Enter your numerical answer").fill("12");
  await expect(
    page.getByText("Answers saved securely to your account."),
  ).toBeVisible();
  await submit(page);
  await expect(page.locator(".big-score")).toHaveText("7 / 300");
  await expect(page.locator(".result-counts .correct strong")).toHaveText("2");
  await expect(page.locator(".result-counts .incorrect strong")).toHaveText(
    "1",
  );
  await page.getByRole("button", { name: "Incorrect 1", exact: true }).click();
  await expect(page.locator(".review-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "View step-by-step solution" })
    .click();
  await expect(page.locator(".solution li")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Unattempted 72", exact: true })
    .click();
  await page.getByLabel("Filter by subject").selectOption("Mathematics");
  await expect(page.locator(".review-card")).toHaveCount(25);
  await page.reload();
  await expect(page.locator(".stat-card").first()).toContainText("01");
  await page
    .getByRole("button", { name: "My performance", exact: true })
    .click();
  await page.locator(".history-item").click();
  await expect(page.locator(".big-score")).toHaveText("7 / 300");
});
for (const [name, total, marks] of [
  ["JEE Advanced", 54, 162],
  ["NEET UG", 180, 720],
])
  test(`${name} loads its Firestore questions`, async ({ page }) => {
    await signup(page);
    await begin(page, name);
    await expect(page.locator(".question-palette button")).toHaveCount(total);
    await page.getByRole("radio").nth(0).check();
    await submit(page);
    await expect(page.locator(".big-score")).toHaveText(
      `${name === "JEE Advanced" ? 3 : 4} / ${marks}`,
    );
  });
test("user history is isolated between accounts", async ({ page }) => {
  await signup(page);
  await begin(page);
  await submit(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Full name").fill("Other Student");
  await page
    .getByLabel("Email address")
    .fill(`other-${crypto.randomUUID()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("another123");
  await page
    .getByRole("button", { name: "Create your account", exact: true })
    .click();
  await expect(page.locator(".stat-card").first()).toContainText("00");
  await expect(page.locator(".history-item")).toHaveCount(0);
});
test("saved unfinished attempt resumes with the same server deadline", async ({
  page,
}) => {
  await signup(page);
  await begin(page);
  await page.getByRole("radio").nth(0).check();
  await expect(
    page.getByText("Answers saved securely to your account."),
  ).toBeVisible();
  page.on("dialog", (d) => d.accept());
  await page.reload();
  await begin(page);
  await expect(page.getByRole("radio").nth(0)).toBeChecked();
  await expect(page.getByRole("timer")).toContainText("02:");
});
test("mobile palette, review flag and timer auto-submit work", async ({
  page,
}) => {
  await page.clock.install();
  await page.setViewportSize({ width: 390, height: 844 });
  await signup(page);
  await begin(page);
  await page.getByRole("button", { name: "Questions", exact: true }).click();
  await page
    .getByRole("button", { name: "Question 5, not visited", exact: true })
    .click();
  await expect(page.getByLabel("Enter your numerical answer")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.clock.fastForward(176 * 60 * 1000);
  await expect(page.getByRole("timer")).toHaveClass(/warning/);
  await page.clock.fastForward(4 * 60 * 1000 + 1000);
  await expect(
    page.getByRole("heading", { name: "Test complete. Growth unlocked." }),
  ).toBeVisible();
});
