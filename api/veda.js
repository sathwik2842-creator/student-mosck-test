import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { createHandler } from "../server/http.js";
import { readServiceAccount, ServerConfigurationError } from "../functions/lib/server-credentials.js";

let handlers;
async function initialize() {
  if (!getApps().some(app => app.name === "[DEFAULT]")) {
    try {
      if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST)
        throw new ServerConfigurationError("deployed-api-emulators-forbidden");
      const account = readServiceAccount(process.env);
      initializeApp({ projectId: account.projectId, credential: cert(account) });
    } catch (error) {
      console.error("Firebase Admin configuration failed", {
        reason: error instanceof ServerConfigurationError ? error.reason : "admin-sdk-initialization-failed",
      });
      throw Object.assign(new Error("Server authentication configuration is invalid."), { code: "internal" });
    }
  }
}
export default createHandler({
  verifyToken: async (token) => { await initialize(); return getAuth().verifyIdToken(token, true); },
  getHandlers: async () => { handlers ||= import("../functions/index.js"); return handlers; },
});
