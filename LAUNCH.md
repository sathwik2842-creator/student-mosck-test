> **New deployment option:** For the complete app on Vercel (including secure grading/admin API), follow [VERCEL-LAUNCH.md](VERCEL-LAUNCH.md). This avoids Firebase Cloud Functions deployment. Firebase Auth/Firestore must remain active.

# Veda Test — production launch

This repository supports a Vercel static frontend or Firebase Hosting. Both use Firebase Authentication, Firestore and callable Cloud Functions as the backend. Vercel does **not** deploy the Firebase backend.

Preparation is complete at the configuration/code level; this is not a deployment report. Firebase Web app configuration for `vedamock` is saved locally in ignored `.env.production.local`. Configuration validation, 30 unit checks and the production build have passed. Email/Password sign-in was verified enabled and Google is enabled according to the user’s Console screenshot. Production Firestore, rules, Functions and Hosting still need verification/deployment; the full isolated emulator suite passes, and live Google OAuth remains unverified. Complete the release gates below before opening the service to students.

## 1. Select the live Firebase project

1. Use Node.js 22 LTS (`.nvmrc`), npm, and Java 21 for local Firestore tests. Node 24 also satisfies the frontend's declared engine range; deployed Functions use Node 22.
2. Create/select the Firebase project, enable billing required by Cloud Functions, and register a **Web app**. Keep staging and production projects separate.
3. Create the default Cloud Firestore database. Choose its location deliberately. Functions currently use `us-central1`; both backend modules and the build validator must be changed together if you migrate regions.
4. In **Authentication → Sign-in method**, enable Email/Password and Google, and set Google's support email.
5. In **Authentication → Settings → Authorized domains**, add the exact frontend host(s), e.g. your stable Vercel project domain and your custom domain. Add `www` separately if used. Only add preview domains you deliberately trust; Firebase does not accept a wildcard Vercel domain here. The configured Firebase auth handler domain must also be authorized. Google consent-screen settings must permit the intended audience.
6. Use your existing authorized Firebase CLI and application-default credentials on a trusted machine. If needed, sign in using `npx firebase login`. Select the project explicitly in every deployment or administrative command. Do not put Admin SDK/service-account credentials in the repository, Vercel frontend environment, or any `VITE_*` value.

Install reproducibly:

```sh
npm ci
npm --prefix functions ci
```

## 2. Configure the production build

`.env.production` is a committed **blank template**, not a real configuration. For local release builds:

```sh
cp .env.production .env.production.local
# Edit .env.production.local using your Firebase Web app SDK configuration.
```

`.env.production.local` is ignored by Git. Keep the template blank. For Vercel, set the same values in the project's **Production** environment instead of uploading the local file.

| Variable | Required | Value |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | Yes | Web app API key from Firebase Console |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Firebase auth hostname, normally `<project>.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Live project ID; never `demo-*` |
| `VITE_FIREBASE_APP_ID` | Yes | Web app ID in `1:<number>:web:<id>` format |
| `VITE_FIREBASE_FUNCTIONS_REGION` | Yes | `us-central1`, matching this backend |
| `VITE_USE_FIREBASE_EMULATORS` | Yes | Literal `false` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Optional | SDK sender ID; no messaging feature is used |
| `VITE_FIREBASE_STORAGE_BUCKET` | Optional | SDK bucket name; no cloud upload feature is used |

These Web app values are public identifiers embedded in JavaScript; permissions come from Authentication, roles, rules and server authorization. They are not substitutes for security rules. Server credentials must never use the `VITE_` prefix.

Vite loads process/build environment values with highest priority. `.env.production.local` overrides `.env.production`, which overrides `.env.local` during production builds. An inherited `VITE_USE_FIREBASE_EMULATORS=true` therefore still needs to be corrected. Changing a `VITE_*` value requires a rebuild and redeploy; it is not runtime configuration.

```sh
npm run check:production
npm run release:check
```

`release:check` validates the Web configuration, runs unit tests and builds the frontend. The production guard rejects missing/placeholder configuration, emulator mode, demo project IDs, malformed SDK identifiers and a region mismatch. It checks structure, not actual Firebase access. Never bypass it to obtain a deployable artifact.

For explicitly local verification without production values:

```sh
npm run build:emulator
```

That mode reads the committed `.env.emulator` defaults and produces a **local-only** bundle. Never publish that `dist/`. Firebase Hosting's predeploy hook runs `release:check` and rebuilds the release artifact; Vercel also runs `release:check`, so the normal deployment paths cannot silently publish an emulator build. Do not use a prebuilt deployment to bypass these hooks.

## 3. Deploy the backend and security rules first

```sh
npx firebase deploy --project YOUR_PROJECT_ID --only firestore,functions
```

This deploys `firestore.rules`, `firestore.indexes.json` and the authenticated student/admin callable Functions. The Functions predeploy hook checks JavaScript syntax. Ensure the composite `results(userId, submittedAt)` index finishes building. Check the deployed callable endpoints and runtime service-account access to Firestore and Firebase Authentication user listing.

### Authorization policy

- Students can read only **published** `testCatalog` records. Their catalog queries must include `where('active', '==', true)`.
- Private `tests` documents contain correct answers and solutions. Students cannot read them directly. `startTest` exposes safe questions for published tests; the owner may also resume an existing snapshot after a paper is archived.
- Students create/submit their own attempts through authenticated Functions. Identity, deadlines, grading and result creation are enforced on the server. Students can read only their own results and may directly update only a `studentNotes` string of at most 2,000 characters. Scores, ownership, accuracy, answers, timestamps and breakdowns cannot be edited, replaced or deleted from a browser.
- Administrators are authorized by the server-managed `roles/{uid}.isAdmin === true` boolean. This project uses collection roles, **not** custom claims. The UI observes that role, rules verify it for admin reads, and every admin callable verifies it again. Mutations re-check it within their Firestore transaction.
- Only role-checked admin Functions can change papers or questions. Even administrators cannot bypass validation/audit logging with direct browser writes or forge student scores. Their browser may read the question bank and all student results.
- Browser clients cannot grant roles or directly access private attempts, import receipts or audit records. The default is denial.

Allowing owners to write arbitrary `results` documents or reading entire published `tests` documents would bypass grading or leak keys. The callable submission interface and limited notes update intentionally implement ownership without those weaknesses.

### Optional Storage policy

There are no Firebase Storage/avatar uploads in this app. Question CSV/JSON files are parsed locally, then validated data is sent to admin Functions. `storage.rules` therefore denies all reads/writes. If your project already has a bucket, apply this policy explicitly:

```sh
npx firebase deploy --project YOUR_PROJECT_ID --only storage
```

A bucket is not required for this app; do not provision one just for question imports. Implement and test validated, owner-scoped file paths before enabling future avatar uploads. Avoid a bare `firebase deploy` if unused Storage has not been initialized; the explicit commands in this guide deploy only the needed services.

## 4. Provision the first administrator

1. Create the intended person's account in Firebase Authentication (Console → Users → Add user), or have them sign up through a verified staging/live frontend connected to this project. Copy their **UID**, not their email address.
2. On a trusted machine with authorized application-default credentials, run:

```sh
GCLOUD_PROJECT=YOUR_PROJECT_ID \
npm run admin:role -- --uid EXISTING_AUTH_UID --grant --production
```

Ensure neither `FIRESTORE_EMULATOR_HOST` nor `FIREBASE_AUTH_EMULATOR_HOST` is set in that production terminal. The script verifies the Auth user exists, updates only the role fields, and requires the explicit production flag.

Alternatively, an authorized project operator can create `roles/<EXISTING_AUTH_UID>` in the **Firestore Console** with `isAdmin` set to the boolean `true`. Do not use a string and do not add this permission through application signup/profile forms. Console access is an operator IAM permission, not a student-facing rule exception.

3. Sign in as that user and open `/admin`. Confirm a normal student is redirected away with a warning. Remove access using the same script with `--revoke` instead of `--grant`; verify the workspace and backend calls lose access.
4. Create and publish the first reviewed paper. Use `ADMIN.md` for question/import formats. The seed script contains generated samples and repeated concepts, not official papers. Do not silently launch those samples as a curated exam bank. No production seed or admin grant has been executed by this preparation task.

## 5A. Deploy the frontend on Vercel

From the project root on your authorized machine:

```sh
npx vercel login  # only if not already authenticated
npx vercel link
```

Select the correct Vercel project. Set its Node.js version to 22.x, framework to Vite, root directory to this repository, build command to `npm run release:check`, output directory to `dist`, and install command to `npm ci`. `vercel.json` supplies the framework/build/output settings.

Enter each required value in Vercel Production environment settings, or use CLI prompts:

```sh
npx vercel env add VITE_FIREBASE_API_KEY production
npx vercel env add VITE_FIREBASE_AUTH_DOMAIN production
npx vercel env add VITE_FIREBASE_PROJECT_ID production
npx vercel env add VITE_FIREBASE_APP_ID production
npx vercel env add VITE_FIREBASE_FUNCTIONS_REGION production
npx vercel env add VITE_USE_FIREBASE_EMULATORS production
```

Use `us-central1` and `false` for the last two. Supply optional SDK fields only if needed. Then deploy:

```sh
npx vercel --prod
# Equivalent with a globally installed CLI: vercel --prod
```

The SPA fallback is `source: "/(.*)"`, `destination: "/index.html"`; the leading slash is Vercel's route syntax. Direct `/admin`, `/admin/tests` and `/admin/questions` navigation must load the app. Configure Preview environment values separately if you want preview deployments; do not unintentionally connect untrusted preview sites to production accounts.

## 5B. Deploy the frontend on Firebase Hosting

With real production values present in `.env.production.local` or the build environment:

```sh
npm run release:check
npx firebase deploy --project YOUR_PROJECT_ID --only hosting
```

Hosting publishes only `dist/`; it never publishes `.env*`, source files, tests or Admin credentials. Its predeploy hook repeats the release gate to replace any stale emulator artifact. SPA rewrites load `index.html` for app routes. If using CI, provide the same Web app environment values before invoking the deployment; the CLI project selection does not populate Vite config automatically.

Both hosting configurations set MIME sniffing protection, referrer policy, frame protection, restricted device permissions, and a baseline CSP. `Cross-Origin-Opener-Policy: same-origin-allow-popups` preserves Firebase Google popup behavior. The baseline CSP does not claim to be a complete script-source policy; stricter script/connect/frame allowlists need validation against the real Firebase/Google domains first. Hashed `/assets/` files receive long immutable caching, while the app shell and admin routes use revalidation. Google sign-in still needs an actual end-to-end check on the deployed domain.

## 6. Release gates — before public promotion

- [ ] Production project/billing, database, auth providers and authorized domains are configured.
- [ ] `npm run release:check` passes with **real** production Web app configuration.
- [ ] `npm --prefix functions run check` passes; backend Functions, rules and indexes are deployed to the intended project.
- [ ] `npm run test:firebase` passes in the isolated emulator project. This covers security rules, score tampering, student isolation, server deadlines, admin role checks/revocation, imports and edit conflicts. Java 21 and the official Firestore emulator download are required.
- [ ] `npm run test:auth` and `npm run test:admin-ui` pass. The former uses real local Firebase Auth; the admin UI suite uses explicit test-only transports and does not substitute for Firestore permission tests.
- [ ] Two real test accounts on staging prove signup/login/logout, Google popup login, ownership isolation, a complete timed submission and restored history.
- [ ] A student cannot read a draft, another student's result, answer keys or bank entries; cannot promote their own role; and cannot forge a score. An admin can manage papers/questions, view submissions, and loses privileges on revocation.
- [ ] `/admin` deep links, root refresh, JS/CSS asset URLs, mobile layouts and light/dark mode work on the final host.
- [ ] Browser requests go to the intended Firebase project and callable region, with no emulator/loopback requests and no real credentials printed in logs.
- [ ] Published paper content, marking rules and total marks have been reviewed. The sample bank is clearly separated from reviewed launch content.
- [ ] Hosting cache/security headers, HTTPS, Cloud Function errors, Firestore index readiness and deployment logs have been checked on the deployed service.

Current preparation evidence: the supplied `vedamock` Web app configuration passes structural validation. The isolated emulator suite passed 9 Firestore rules tests, 7 callable/backend integration tests and 14 browser tests (5 of those browser tests use explicit admin UI transport fakes). Unit/configuration tests and the production build are checked separately with `npm run release:check`. The emulator runs on host Node 24; deployed Functions target Node 22. Browser tests now run on dedicated port 5183 with explicit demo-project environment values and refuse to reuse the live development server. The running cloud network now reaches the official emulator download and Firebase Auth public configuration endpoint. Email/Password was initially disabled and was subsequently verified enabled. Google production sign-in, backend deployment, index readiness and the final hosting deployment still require verification. The last checked Hosting initialization URL returned 404; no successful hosting deployment was performed by the assistant. No public release or administrator grant has been performed.

## 7. Updating and rolling back

Retain the previous successful frontend deployment and backend source revision. Roll back frontend releases with the chosen host's deployment controls, then verify auth and submissions again. Redeploy the reviewed prior Functions version explicitly if backend rollback is needed; a frontend rollback does not roll back Firebase. Keep rules restrictive and preserve result/attempt snapshots. Web environment changes require a new frontend build; do not overwrite production data with sample seeds during rollback.

For the complete continuation status, including the latest provider verification, pending CLI authorization and Windows notes, read [HANDOFF.md](HANDOFF.md).
