# Veda Test: launch on Vercel without Firebase Cloud Functions

This deployment serves the React app and authenticated Node API together on Vercel. Firebase Authentication and Firestore still store real users, papers, answers and results. Do not deploy Firebase Functions for this path. Google Cloud Functions billing is not required; Firebase Auth/Firestore and Vercel quotas/terms still apply.

## 1. Restore database availability

The previous `vedamock` project was linked to a CLOSED billing account. The new selected project is `vedamock-29e3f`; keep it on Spark and enable Auth/Firestore there. For the old project only: In Firebase project settings, switch the project to Spark if allowed, or link an open billing account. Confirm Firestore can read/write and Authentication is enabled. Vercel cannot repair or bypass a suspended Firebase project. If the console refuses changes, resolve billing through Google support or use a new Firebase Spark project and update all configuration to that project.

## 2. Deploy database rules

Open PowerShell inside the folder containing package.json and firebase.json:

```powershell
npm.cmd ci
npx.cmd firebase login
npx.cmd firebase deploy --project vedamock-29e3f --only "firestore"
```

Do NOT include `functions`. Private test documents and answer keys remain inaccessible to students; the Node API grades on the server. No Storage deployment is needed because uploads are local JSON/CSV parsing.

## 3. Create Vercel project and set environment variables

Import `sathwik2842-creator/student-mosck-test` at https://vercel.com/new and choose Vite. Use Node 22 or 24. The repository's vercel.json supplies build and API configuration.

Before deploying, add these variables to Vercel **Project Settings → Environment Variables → Production** (also Preview if you intentionally use the same database there):

| Name | Value/source |
| --- | --- |
| VITE_FIREBASE_API_KEY | Firebase web app apiKey |
| VITE_FIREBASE_AUTH_DOMAIN | vedamock-29e3f.firebaseapp.com |
| VITE_FIREBASE_PROJECT_ID | vedamock-29e3f |
| VITE_FIREBASE_APP_ID | Your Firebase web app appId |
| VITE_FIREBASE_MESSAGING_SENDER_ID | 481678947260 |
| VITE_FIREBASE_STORAGE_BUCKET | vedamock-29e3f.firebasestorage.app |
| VITE_FIREBASE_FUNCTIONS_REGION | us-central1 (retained for optional Functions deployment) |
| VITE_USE_FIREBASE_EMULATORS | false |
| VITE_API_BACKEND | vercel |
| FIREBASE_PROJECT_ID | vedamock-29e3f |
| FIREBASE_CLIENT_EMAIL | Service account client_email |
| FIREBASE_PRIVATE_KEY | Service account private_key, including BEGIN/END lines |

The last three are **server-only**: never prefix them with VITE_, commit a key file, or paste private keys into a chat. In Firebase Console → Project settings → Service accounts → Firebase Admin SDK, generate a private key, then copy client_email and private_key into Vercel's private environment settings. Vercel accepts actual newlines or literal `\n` in the private-key value. Keep the downloaded file out of the repository and revoke/rotate leaked keys. A dedicated service account can use Cloud Datastore User and Firebase Authentication Admin roles; initial role creation below is performed by you in the console. If your organization blocks key creation, configure supported workload identity or ask its administrator; do not weaken Firestore rules.

Deploy or redeploy after saving environment variables. Environment changes need a new deployment. Keep the stable production domain; add it under Firebase Console → Authentication → Settings → Authorized domains (hostname only, no https://). This is required for Google login.

CLI alternative, after setting variables in Vercel:

```powershell
npx.cmd vercel login
npx.cmd vercel link
npx.cmd vercel --prod
```

## 4. First admin and tests

1. Open the deployed app and sign up/sign in.
2. Firebase Console → Authentication → Users: copy your user's UID.
3. Firestore → Start collection `roles` → document ID exactly that UID → add `isAdmin` as **boolean true**, not a string. Only a trusted console administrator may do this; the browser cannot grant roles.
4. Refresh the app, open `/admin`, create a test, add/import questions, verify total marks, and publish it.
5. Question import templates are provided in the admin interface. The optional seed script contains sample practice questions, not a verified official exam paper; review before publishing.

## 5. Check the live app

Use a separate student account: sign in, start a published test, answer, reload to resume, submit, check results/history. Test Google login on the production hostname. Verify the student cannot open /admin. As admin, check submissions, edit/import a paper and publish. A GET to /api/veda should return JSON with HTTP 405; an unauthenticated POST should return 401. If it returns HTML, inspect Vercel API deployment/routing. If you see server errors, inspect private Vercel function logs and verify all three server credentials belong to the same Firebase project.

The API verifies Firebase token signature/expiry/revocation and user status on every request. The existing transactional handlers enforce ownership, authoritative deadlines, immutable paper snapshots, idempotent server grading, and live admin role checks. Answers/keys never go in VITE_ configuration. Results are not trusted from the browser. The browser directly reads only rule-protected catalog/history data.

## Costs and limits

A closed billing account is separate from choosing a Firebase plan. Confirm the project is actually usable on Spark. Vercel plan eligibility, function duration, traffic and Firebase quotas apply; set usage alerts and check current provider pricing before public promotion. The API is configured for up to 60 seconds; large admin user counts may require paginated analytics later.

## Local development and verification

Existing `npm run test:firebase` starts isolated demo-project emulators and exercises backend, rules and UI. It also tests the Vercel adapter with real emulator ID tokens. Existing emulator development still calls the Functions emulator; production Vercel calls `/api/veda`. For local Vercel testing, use `vercel dev` with server credentials set locally, and use a separate non-production Firebase project. Never point automated tests at production.

The older Firebase Hosting + Cloud Functions route in LAUNCH.md remains an alternative only with an OPEN billing account. A frontend-only Vercel deployment is insufficient: all server environment variables above are required.
