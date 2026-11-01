import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  validateProductionEnv,
  validateEmulatorEnv,
  REQUIRED_PRODUCTION_KEYS,
} from "../../scripts/production-env.mjs";
// Structural fixtures only: these identify no real Firebase project or credential.
const valid = () => ({
  VITE_FIREBASE_API_KEY: "AIza" + "x".repeat(35),
  VITE_FIREBASE_PROJECT_ID: "veda-release-fixture",
  VITE_FIREBASE_AUTH_DOMAIN: "veda-release-fixture.firebaseapp.com",
  VITE_FIREBASE_APP_ID: "1:123456789:web:abcdef123456",
  VITE_FIREBASE_FUNCTIONS_REGION: "us-central1",
  VITE_USE_FIREBASE_EMULATORS: "false",
});
test("production configuration requires every key and never prints its values", () => {
  for (const key of REQUIRED_PRODUCTION_KEYS) {
    const env = valid();
    delete env[key];
    assert.throws(
      () => validateProductionEnv(env),
      (error) =>
        error.message.includes(key) &&
        !error.message.includes("AIza" + "x".repeat(35)),
    );
  }
  assert.equal(validateProductionEnv(valid()), true);
});
test("production rejects emulator mode and demo or placeholder projects", () => {
  for (const project of [
    "demo-veda-test",
    "your-project-id",
    "replace-me",
    "bad/project",
  ])
    assert.throws(() =>
      validateProductionEnv({ ...valid(), VITE_FIREBASE_PROJECT_ID: project }),
    );
  for (const flag of ["true", "FALSE", "0"])
    assert.throws(() =>
      validateProductionEnv({ ...valid(), VITE_USE_FIREBASE_EMULATORS: flag }),
    );
});
test("production validates Web app config shape and backend region", () => {
  for (const patch of [
    { VITE_FIREBASE_API_KEY: "demo-emulator-key" },
    { VITE_FIREBASE_AUTH_DOMAIN: "https://project.firebaseapp.com/path" },
    { VITE_FIREBASE_APP_ID: "not-web-config" },
    { VITE_FIREBASE_FUNCTIONS_REGION: "europe-west1" },
    { VITE_FIREBASE_MESSAGING_SENDER_ID: "not-numeric" },
    { VITE_FIREBASE_STORAGE_BUCKET: "gs://bucket" },
  ])
    assert.throws(() => validateProductionEnv({ ...valid(), ...patch }));
  assert.equal(
    validateProductionEnv({
      ...valid(),
      VITE_FIREBASE_STORAGE_BUCKET: "veda-release-fixture.firebasestorage.app",
      VITE_FIREBASE_MESSAGING_SENDER_ID: "123456789",
    }),
    true,
  );
});
test("emulator builds are explicit and restricted to local demo projects", () => {
  const local = {
    VITE_USE_FIREBASE_EMULATORS: "true",
    VITE_FIREBASE_PROJECT_ID: "demo-veda-test",
    VITE_FIREBASE_EMULATOR_HOST: "127.0.0.1",
  };
  assert.doesNotThrow(() => validateEmulatorEnv(local));
  for (const patch of [
    { VITE_USE_FIREBASE_EMULATORS: "false" },
    { VITE_FIREBASE_PROJECT_ID: "live-project" },
    { VITE_FIREBASE_EMULATOR_HOST: "external.example.com" },
  ])
    assert.throws(() => validateEmulatorEnv({ ...local, ...patch }));
});
test("hosting configs preserve SPA routes, immutable assets, and Google popup compatibility", async () => {
  const firebase = JSON.parse(await readFile("firebase.json", "utf8")),
    vercel = JSON.parse(await readFile("vercel.json", "utf8"));
  assert.equal(firebase.hosting.public, "dist");
  assert.ok(
    firebase.hosting.rewrites.some((r) => r.destination === "/index.html"),
  );
  assert.ok(
    vercel.rewrites.some(
      (r) => r.source === "/(.*)" && r.destination === "/index.html",
    ),
  );
  assert.equal(vercel.outputDirectory, "dist");
  assert.equal(vercel.buildCommand, "npm run release:check");
  for (const config of [firebase.hosting, vercel]) {
    const headers = config.headers.flatMap((r) => r.headers);
    assert.ok(
      headers.some(
        (h) =>
          h.key === "Cross-Origin-Opener-Policy" &&
          h.value === "same-origin-allow-popups",
      ),
    );
    assert.ok(
      headers.some(
        (h) => h.key === "X-Content-Type-Options" && h.value === "nosniff",
      ),
    );
    assert.ok(
      headers.some(
        (h) => h.key === "Cache-Control" && h.value.includes("immutable"),
      ),
    );
    assert.ok(
      headers.some((h) => h.key === "Cache-Control" && h.value === "no-cache"),
    );
  }
  assert.ok(
    firebase.hosting.predeploy.some((command) =>
      command.includes("release:check"),
    ),
  );
  assert.ok(firebase.functions[0].ignore.includes("test"));
});
test("production template has all required names and contains no live configuration", async () => {
  const template = await readFile(".env.production", "utf8");
  for (const key of REQUIRED_PRODUCTION_KEYS)
    assert.ok(template.includes(key + "="));
  assert.match(template, /^VITE_FIREBASE_API_KEY=$/m);
  assert.match(template, /^VITE_USE_FIREBASE_EMULATORS=false$/m);
  const ignore = await readFile(".gitignore", "utf8");
  assert.ok(ignore.includes(".env.*.local"));
  const storage = await readFile("storage.rules", "utf8");
  assert.match(storage, /allow read, write: if false/);
});

test("browser tests cannot inherit live Firebase settings or reuse a live development server", async () => {
  const { default: config } = await import("../../playwright.config.js");
  assert.equal(config.webServer.env.VITE_FIREBASE_PROJECT_ID, "demo-veda-test");
  assert.equal(config.webServer.env.VITE_USE_FIREBASE_EMULATORS, "true");
  assert.equal(config.webServer.env.VITE_FIREBASE_API_KEY, "demo-emulator-key");
  assert.equal(config.webServer.reuseExistingServer, false);
  assert.equal(config.webServer.url, "http://127.0.0.1:5183");
  assert.match(config.webServer.command, /--mode emulator/);
  assert.match(config.webServer.command, /--strictPort/);
});
