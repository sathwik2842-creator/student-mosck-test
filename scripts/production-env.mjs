import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
export const REQUIRED_PRODUCTION_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_FIREBASE_FUNCTIONS_REGION",
  "VITE_USE_FIREBASE_EMULATORS",
];
export function validateProductionEnv(env) {
  const missing = REQUIRED_PRODUCTION_KEYS.filter(
    (key) => typeof env[key] !== "string" || !env[key].trim(),
  );
  if (missing.length)
    throw new Error(
      `Production configuration is incomplete. Set: ${missing.join(", ")}. Use .env.production.local or your hosting provider's build environment.`,
    );
  if (env.VITE_USE_FIREBASE_EMULATORS !== "false")
    throw new Error(
      "Production builds require VITE_USE_FIREBASE_EMULATORS=false. Use npm run build:emulator for local verification.",
    );
  const project = env.VITE_FIREBASE_PROJECT_ID;
  if (
    !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project) ||
    project.startsWith("demo-") ||
    ["your-project-id", "your-firebase-project", "replace-me"].includes(project)
  )
    throw new Error(
      "VITE_FIREBASE_PROJECT_ID must identify your live Firebase project, not an emulator or placeholder.",
    );
  if (!/^AIza[A-Za-z0-9_-]{35}$/.test(env.VITE_FIREBASE_API_KEY))
    throw new Error(
      "VITE_FIREBASE_API_KEY must be the Web app API key copied from Firebase Console.",
    );
  if (
    !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(
      env.VITE_FIREBASE_AUTH_DOMAIN,
    )
  )
    throw new Error(
      "VITE_FIREBASE_AUTH_DOMAIN must be a hostname without a scheme, port or path.",
    );
  if (!/^1:\d+:web:[a-f0-9]+$/i.test(env.VITE_FIREBASE_APP_ID))
    throw new Error(
      "VITE_FIREBASE_APP_ID must be the Firebase Web app ID from Firebase Console.",
    );
  if (env.VITE_FIREBASE_FUNCTIONS_REGION !== "us-central1")
    throw new Error(
      "VITE_FIREBASE_FUNCTIONS_REGION must match the deployed Functions region: us-central1. Change the backend and this validation together if migrating regions.",
    );
  if (
    env.VITE_FIREBASE_MESSAGING_SENDER_ID &&
    !/^\d+$/.test(env.VITE_FIREBASE_MESSAGING_SENDER_ID)
  )
    throw new Error(
      "VITE_FIREBASE_MESSAGING_SENDER_ID must be numeric when supplied.",
    );
  if (
    env.VITE_FIREBASE_STORAGE_BUCKET &&
    !/^[a-z0-9][a-z0-9.-]+[a-z0-9]$/.test(env.VITE_FIREBASE_STORAGE_BUCKET)
  )
    throw new Error(
      "VITE_FIREBASE_STORAGE_BUCKET must be a bucket name, not a URL.",
    );
  return true;
}
export function validateEmulatorEnv(env) {
  if (
    env.VITE_USE_FIREBASE_EMULATORS !== "true" ||
    !env.VITE_FIREBASE_PROJECT_ID?.startsWith("demo-") ||
    !["127.0.0.1", "localhost", "::1"].includes(
      env.VITE_FIREBASE_EMULATOR_HOST || "127.0.0.1",
    )
  )
    throw new Error(
      "Emulator builds require explicit local emulator settings and a demo-* project.",
    );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { loadEnv } = await import("vite");
  try {
    validateProductionEnv(loadEnv("production", process.cwd(), "VITE_"));
    console.log(
      "Production Firebase configuration passed structural checks. Live project access is verified separately.",
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
