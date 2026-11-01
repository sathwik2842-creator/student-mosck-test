import { expect } from "@playwright/test";
const email = () => `student-${crypto.randomUUID()}@example.com`;
export async function signup(page) {
  await page.goto("/");
  const isolated = await page.evaluate(async () => {
    const config = await import("/src/firebase.js");
    return (
      config.useEmulators &&
      config.firebaseApp.options.projectId === "demo-veda-test"
    );
  });
  expect(
    isolated,
    "Browser signup tests must use the isolated demo emulator project",
  ).toBe(true);
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  const address = email();
  await page.getByLabel("Full name").fill("Ananya Student");
  await page.getByLabel("Email address").fill(address);
  await page.getByLabel("Password", { exact: true }).fill("practice123");
  await page
    .getByRole("button", { name: "Create your account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A fresh start, Ananya." }),
  ).toBeVisible();
  return address;
}
