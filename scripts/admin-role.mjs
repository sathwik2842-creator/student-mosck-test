import { createRequire } from "node:module";
const require = createRequire(
  new URL("../functions/package.json", import.meta.url),
);
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const args = process.argv.slice(2),
  uid = args[args.indexOf("--uid") + 1],
  grant = args.includes("--grant"),
  revoke = args.includes("--revoke"),
  projectId = process.env.GCLOUD_PROJECT;
if (
  !args.includes("--uid") ||
  !uid ||
  uid.startsWith("--") ||
  grant === revoke ||
  !projectId
)
  throw new Error(
    "Set GCLOUD_PROJECT and pass --uid USER_UID with exactly one of --grant or --revoke.",
  );
const emulator = !!process.env.FIRESTORE_EMULATOR_HOST;
if (
  emulator &&
  (!projectId.startsWith("demo-") ||
    !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    ![
      process.env.FIRESTORE_EMULATOR_HOST,
      process.env.FIREBASE_AUTH_EMULATOR_HOST,
    ].every((host) => /^(127\.0\.0\.1|localhost):\d+$/.test(host)))
)
  throw new Error(
    "Use a demo-* project and both Auth/Firestore emulator hosts.",
  );
if (!emulator && !args.includes("--production"))
  throw new Error(
    "Production role changes require an explicit --production flag.",
  );
initializeApp({
  projectId,
  ...(!emulator ? { credential: applicationDefault() } : {}),
});
await getAuth().getUser(uid);
await getFirestore()
  .doc(`roles/${uid}`)
  .set({ isAdmin: grant, updatedAt: Timestamp.now() }, { merge: true });
console.log(
  `Administrator access ${grant ? "granted" : "revoked"} for the specified UID in ${projectId}.`,
);
