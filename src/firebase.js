import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  connectAuthEmulator,
} from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const useEmulators =
  import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";
export const missingFirebaseConfig = [
  "apiKey",
  "authDomain",
  "projectId",
  "appId",
].filter((key) => !config[key]);
export const firebaseApp = missingFirebaseConfig.length
  ? null
  : getApps().length
    ? getApp()
    : initializeApp(config);
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const db = firebaseApp ? getFirestore(firebaseApp) : null;
export const functions = firebaseApp
  ? getFunctions(
      firebaseApp,
      import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || "us-central1",
    )
  : null;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
if (firebaseApp && useEmulators && !globalThis.__vedaEmulatorsConnected) {
  const host = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || "127.0.0.1";
  if (!["127.0.0.1", "localhost", "::1"].includes(host))
    throw new Error("Firebase emulators must run on a loopback host.");
  if (!config.projectId.startsWith("demo-"))
    throw new Error(
      "Use a demo-* project ID with local emulators to avoid production access.",
    );
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectFunctionsEmulator(functions, host, 5001);
  globalThis.__vedaEmulatorsConnected = true;
}
