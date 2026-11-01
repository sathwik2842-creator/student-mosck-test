import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { createHandler } from "../server/http.js";

let handlers;
async function initialize() {
  if (!getApps().some(app => app.name === "[DEFAULT]")) {
    const { FIREBASE_PROJECT_ID: projectId, FIREBASE_CLIENT_EMAIL: clientEmail, FIREBASE_PRIVATE_KEY: privateKey } = process.env;
    if (!projectId || !clientEmail || !privateKey) throw Object.assign(new Error("Server configuration is missing."), { code: "internal" });
    if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST)
      throw new Error("Emulators are forbidden in the deployed API.");
    try {
      initializeApp({ projectId, credential: cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") }) });
    } catch {
      console.error("Firebase Admin initialization failed. Check the server project, service-account email and private-key format.");
      throw Object.assign(new Error("Server authentication configuration is invalid."), { code: "internal" });
    }
  }
}
export default createHandler({
  verifyToken: async (token) => { await initialize(); return getAuth().verifyIdToken(token, true); },
  getHandlers: async () => { handlers ||= import("../functions/index.js"); return handlers; },
});
