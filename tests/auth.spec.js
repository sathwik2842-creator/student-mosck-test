import { test, expect } from "@playwright/test";
import { signup } from "./helpers";
test("protected workspace opens Firebase login and validates forms", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome to Veda Test." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Find your next test" }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Log in to your workspace" }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(page.getByText("Enter your password.")).toBeVisible();
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create your account", exact: true })
    .click();
  await expect(
    page.getByText("Please enter at least 2 characters."),
  ).toBeVisible();
  await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
});
test("real Firebase signup, session restore, logout and password login", async ({
  page,
}) => {
  const address = await signup(page);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A fresh start, Ananya." }),
  ).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "practice123",
  );
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to Veda Test." }),
  ).toBeVisible();
  await page.getByLabel("Email address").fill(address);
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Log in to your workspace" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "email or password is incorrect",
  );
  await page.getByLabel("Password", { exact: true }).fill("practice123");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Log in to your workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "A fresh start, Ananya." }),
  ).toBeVisible();
});
test("login remains responsive and theme survives reload", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/veda-firebase-login.png",
    fullPage: true,
  });
});
