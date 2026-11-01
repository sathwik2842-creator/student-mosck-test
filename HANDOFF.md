> **New deployment option:** For the complete app on Vercel (including secure grading/admin API), follow [VERCEL-LAUNCH.md](VERCEL-LAUNCH.md). This avoids Firebase Cloud Functions deployment. Firebase Auth/Firestore must remain active.

# Veda Test — complete continuation handoff

Prepared on 1 November 2026 (Asia/Kolkata). Read this file first when continuing in Gemini or another development environment. This is a working codebase, not a specification to rebuild from scratch.

## What is included

The complete React frontend, Firebase callable Functions, security rules, indexes, deployment configurations, dependency lockfiles, environment templates, sample paper generator, tests and operational guides are in this source repository. The separate complete handoff ZIP additionally includes the supplied public Firebase Web configuration and the latest compiled frontend. `ALL_SOURCE_FILES.md` is a single-file transcript of the editable project files, including lockfiles and local Web configuration. `previews/` contains reference screenshots from automated UI tests; their displayed users and metrics are fixtures, not a real administrator or real student data.

Installed `node_modules`, Firebase emulator binaries, Git internals, temporary logs, browser sessions, machine credentials and generated test caches are deliberately excluded. They are not application source. Reinstall dependencies from the two lockfiles. Do not ask the user for passwords, authorization codes, refresh tokens or service-account private keys in chat.

## Current status — authoritative

- The application is named **Veda Test**, for JEE Main, JEE Advanced and NEET UG students.
- The local source and production build are complete for the implemented features listed below.
- Latest verified checks: **30 unit/configuration tests**, **9 Firestore-rule tests**, **7 callable/backend integration tests**, and **14 browser tests**, plus a successful production build. Five of the browser tests explicitly fake admin service transports; the separate real emulator rule/backend tests verify security.
- All Firebase test writes were in `demo-veda-test`. Production Email/Password availability was verified with a deliberately nonexistent reserved-domain sign-in request; no real account was created or signed in by that check.
- Firebase project: **vedamock**. The supplied App ID and API key were checked against the Auth project's number. The SDK config is already saved; do not start another project or ask the user to resend it.
- **Email/Password is now verified enabled.** Earlier `PASSWORD_LOGIN_DISABLED` errors were resolved after the user enabled the provider. Do not continue troubleshooting that obsolete state unless a new check shows a regression.
- Google sign-in is enabled according to the user's Firebase Console screenshot. A real production Google OAuth login has not been completed by the assistant.
- The user says the default Standard-edition Firestore database was created in a US location; the exact database location has not been independently verified. Database ID must remain `(default)`. Functions target `us-central1`.
- The user most recently confirmed **Blaze enabled**. Billing status was not independently checked through a billing API.
- The cloud network issue was resolved. The official Firestore emulator downloaded successfully and the full isolated test suite ran. Old suggestions to keep saving network settings are no longer the next step.
- **The app has not been publicly deployed by the assistant.** Rules, indexes and Functions have not been deployed by the assistant to the real project. No production paper seed or administrator grant was performed.
- The last targeted Firebase CLI access check failed authentication. This cloud workspace has no verified deployment authorization. A Web API key is not an administrator/deployment credential.
- The user requested transfer through GitHub after the workspace download links did not work. Download/clone this source repository, run `npm ci`, `npm --prefix functions ci`, and `npx firebase login` on the deployment computer. CLI login has not been confirmed. A login on one computer does not authenticate a separate cloud workspace.
- The owner supplied an intended account email during setup; personal account details are omitted from this public source handoff. This is not proof an application Auth account exists, is an administrator, or has project IAM access. Confirm the intended admin UID before assigning privileges.
- GitHub repository: `sathwik2842-creator/student-mosck-test`. This is the full source prepared for its first main-branch commit, replacing the originally empty repository. Use Git history and the remote branch to determine the exact published revision. Private/local environment files, installed dependencies, previews and compiled output are intentionally not tracked.
- The previous `vedaosprototype` checkout was removed only after confirming it was clean and fully pushed. A recoverable archive was kept in the original workspace. It is unrelated to this app and is not required here.

## Product features

### Authentication and student workspace

Email/password signup and login, password visibility and validation, Google popup sign-in, Firebase session persistence, global Auth Context and sign-out. Unauthenticated users see login rather than protected student/admin views. Firebase configuration failures show an explicit setup screen, not a mock-account fallback.

Responsive dashboard, category filters, published test cards, real student results/history, theme preference persistence and light/dark mode. No production mock history or mock authentication is used.

### Exam and result flow

Distraction-free exam view with an optional browser-fullscreen control, countdown and under-five-minute warning, subject tabs, MCQ and numerical responses, previous/next, clear response, review flags, four-state question palette, submission confirmation and automatic timer submission.

The server starts the attempt and its deadline, snapshots the paper, accepts revisioned/debounced answer saves and grades authoritatively. Existing attempts resume without resetting their timer. Late submissions use only answers saved before the deadline. Duplicate submissions return the same result. A save-status race found by the real browser suite was fixed: changing an answer immediately shows `saving`, not a stale `saved` acknowledgment.

Results include score, correctness counts, accuracy, elapsed time, subject breakdown, filters/search and expandable step-by-step explanations. Historical evaluations use immutable stored question snapshots. Percentile is honestly shown as **Not available**, because no statistically valid cohort model exists.

### Administrator workspace

Routes: `/admin`, `/admin/tests`, `/admin/questions`, `/admin/submissions`.

A server-managed `roles/{uid}` document with the boolean `isAdmin: true` grants access. Missing, false, string `"true"`, or unverifiable roles deny access. Admin UI observes role changes and redirects unauthorized users with a warning. Every admin Function checks the actual authenticated UID's role; write transactions re-check it atomically. No self-service or first-signup administrator shortcut exists.

Features: platform metrics, test creation/editing, drafts/publishing/archiving, question CRUD, a reusable question bank, copying questions into papers, duplication/reordering, numerical and Section A/B MCQs, configurable marking, JSON/CSV templates/import preview and validation, optimistic edit versions, transactional/idempotent bulk imports and live recent student submissions.

Published papers cannot be deleted until unpublished; papers with unfinished attempts must remain archived. Existing result snapshots and copied paper questions survive changes to the original bank. Admin writes create server-owned audit entries.

## Technology and important files

- React 19, Vite 7, Tailwind CSS 4, Lucide React, Firebase modular Web SDK.
- Firebase Admin SDK and callable Cloud Functions v2, deployed runtime Node 22.
- Playwright browser tests and Node built-in unit/integration tests.
- No external font or image dependency is needed for the actual application UI.

| File | Purpose |
|---|---|
| `src/main.jsx` | App shell, authentication screens, dashboard/history/results, guarded lazy admin entry |
| `src/AuthContext.jsx` | Firebase authentication methods, session tracking and own-role listener |
| `src/firebase.js` | SDK initialization and strict loopback/demo emulator connections |
| `src/api.js` | Student callable API and safe catalog/result subscriptions |
| `src/TestScreen.jsx` | Exam interaction, timer and revisioned autosave |
| `src/admin/AdminPanel.jsx` | Admin dashboard, paper editor, bank, import UI and submissions |
| `src/admin/api.js` | Admin API/subscription boundary |
| `src/admin/importQuestions.js` | CSV/JSON parser, templates and client-side import validation |
| `src/routing.js` | Browser history navigation for admin paths |
| `src/components/` | Shared brand, theme control and accessible modal |
| `src/styles.css`, `src/admin/admin.css` | Responsive light/dark UI |
| `functions/index.js` | Student attempt and grading callables |
| `functions/grading.js` | Server validation, student-safe projection and score calculation |
| `functions/admin.js` | Role-checked admin operations, versions, imports and audit writes |
| `functions/lib/admin-validation.js` | Shared pure paper/question validation; no stored question keys |
| `scripts/sample-bank.js`, `scripts/seed.mjs` | Sample paper generation and guarded Admin SDK seeding |
| `scripts/admin-role.mjs` | Trusted operator grant/revoke script; verifies an existing Auth UID |
| `scripts/production-env.mjs` | Structural production/emulator environment checks |
| `firestore.rules`, `firestore.indexes.json` | Authorization policy and results query index |
| `storage.rules` | Deny-all policy for unused cloud uploads |
| `firebase.json`, `.firebaserc`, `vercel.json` | Hosting, backend, emulator and project selection |
| `playwright.config.js`, `tests/`, `functions/test/` | Test infrastructure and coverage |
| `README.md`, `ADMIN.md`, `LAUNCH.md` | Development, operations and launch instructions |

## Firebase identifiers and environment handling

In the original workspace and the complete handoff ZIP, the supplied public Web config is in ignored `.env.production.local`. GitHub deliberately excludes this local file. When using a GitHub download, copy `.env.production` to `.env.production.local` and fill the Web config from the owner’s saved configuration or Firebase Console. These values identify the browser app; they do not grant administrator/deployment access.

- Project ID: `vedamock`
- Project number / sender ID: `2369128935`
- App ID: `1:2369128935:web:a92cf66d1edf024cd01542`
- Auth domain: `vedamock.firebaseapp.com`
- Storage bucket: `vedamock.firebasestorage.app` (Storage SDK/uploads are not currently used)
- Optional original measurement ID: `G-8YVYB509HX` (Analytics is not initialized or required)
- Functions region: `us-central1`
- Real-build emulator flag: `VITE_USE_FIREBASE_EMULATORS=false`

`.env.production` must remain a blank committed template. `.env.production.local` is ignored and contains the user's supplied public Web configuration. `.env.local` and `.env.emulator` hold explicit local demo settings. Process environment values have the highest Vite priority, so inherited live values can override local files.

Browser tests solve that problem explicitly: they start their own server on **5183**, force demo-project values in the server environment, use `--mode emulator --strictPort`, and **never reuse an existing server**. The real signup helper asserts the demo project before making a signup request. Do not remove those guards or point tests at production.

`npm run build` and `npm run release:check` reject missing/placeholder Web configuration, emulator production settings, invalid SDK identifiers and region mismatch. `npm run build:emulator` is local-only; if your process has live `VITE_*` overrides, clear/override them deliberately for that mode. Never publish its `dist/`. The included compiled `dist/` was produced by the successful **production** build, but deployment should rebuild from source through the guarded hosting predeploy/build hooks.

## Security model and schema

| Collection | Access and role |
|---|---|
| `roles/{uid}` | User may read their own role only; no browser role writes, including by admins |
| `tests/{testId}` | Full private papers, answer keys and solutions; only trusted server operations |
| `testCatalog/{testId}` | Safe metadata; students read active/published records, admins may read drafts |
| `questionBank/{id}` | Admin-readable reusable questions; changes only through validated admin Functions |
| `attempts/{id}` | Server-owned original paper snapshot, owner, deadline, saved answers and save revision |
| `activeAttempts/{uid_testId}` | Private active-attempt pointer; prevents a restart from extending time |
| `results/{attemptId}` | Owner reads, admins read all; only owner's bounded `studentNotes` is browser-editable |
| `adminImports/{id}` | Private idempotent-import receipt |
| `auditLog/{id}` | Server-owned administrator activity records |

Firestore cannot hide fields inside an otherwise readable document. Never make complete `tests` documents readable to students merely because they are published: that exposes answers. `startTest` returns a student-safe projection; solutions are returned only with the owner's graded result.

Do not allow browser score writes, trust browser-supplied `userId`/score/time, use localStorage as proof of login/admin status, turn off security rules, or assign admin privileges from a signup field. Theme is the only app preference stored in localStorage; Firebase manages its own session persistence.

### Callable API inventory

All calls require Firebase Authentication; `admin*` additionally require the server-side role.

- `startTest({testId})` — start/resume an owner session, private Firestore snapshot, safe questions.
- `saveAttempt({attemptId, answers, revision})` — owner-only, before deadline, monotonic revisions.
- `submitTest({attemptId, answers})` — authoritative server grading, atomic/idempotent result creation.
- `adminOverview({})` — actual Auth student count and Firestore aggregation metrics.
- `adminGetTest({id})` — private paper for an administrator.
- `adminSaveTest({id, paper, expectedVersion})` — validate and version a paper; update safe catalog atomically.
- `adminDeleteTest({id, expectedVersion})` — require unpublished paper and no unfinished attempts.
- `adminSaveQuestion({id, question, expectedVersion})` — validated reusable bank CRUD.
- `adminDeleteQuestion({id, expectedVersion})` — version-checked deletion preserving copies/results.
- `adminImportQuestions({questions, importId})` — validate 1–100 questions atomically, retry without duplicates.

## Reproduce locally

Use Node.js 22 LTS; the source was also tested on Node 24. Use Java 21 for Firestore emulation.

```sh
npm ci
npm --prefix functions ci
npm test
npm run release:check
```

The complete handoff ZIP includes the local release file; the GitHub source does not. Supply `.env.production.local` before release checks when starting from GitHub. Only Firebase Web SDK fields belong there. No authenticated CLI session is included in either distribution.

For the complete isolated test run, on Linux/macOS/WSL:

```sh
npm run test:firebase
```

That command starts/stops all required emulators, seeds demo papers and runs rules, backend and browser checks. The Node host warning about Node 24 vs deployed Node 22 was observed; tests completed. Auth emulator “function was not triggered” diagnostic warnings were also observed, with all applicable callable assertions passing.

For interactive local emulator development, use the preserved `.env.local` demo values, start `npm run emulators`, seed in a second terminal, and run Vite. Do not accidentally inherit real process-level `VITE_*` overrides. Keep production and emulator terminals distinct.

### Windows / PowerShell notes

The production commands `npm ci`, `npm --prefix functions ci`, `npm run release:check` and `npx firebase login` are normal npm/CLI commands.

The existing `seed:emulator` npm script uses POSIX inline environment assignments. For emulator workflows on Windows, use WSL or make that script cross-platform before expecting the entire one-command suite to run in native PowerShell. A direct PowerShell seed invocation is:

```powershell
$env:GCLOUD_PROJECT="demo-veda-test"
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
node scripts/seed.mjs
```

Use a separate terminal for production admin work so emulator variables do not carry over. Hosting/Functions predeploy commands use Firebase CLI's `$PROJECT_DIR` and `$RESOURCE_DIR` variables; confirm expansion on the installed Windows CLI if it reports a prefix/path error. Windows deployment has not been executed by the assistant.

## Continue deployment from here

1. On the user's computer (or a deliberately authorized cloud terminal), authenticate the Google account that owns the project:

   ```sh
   npx firebase login
   npx firebase apps:list WEB --project vedamock
   ```

   Never send OAuth codes or private credentials through chat. Logging in locally does not log in a separate cloud container.

2. Recheck the production build and server syntax:

   ```sh
   npm run release:check
   npm --prefix functions run check
   ```

3. When the user authorizes the live changes, deploy the backend, rules and indexes:

   ```sh
   npx firebase deploy --project vedamock --only firestore,functions
   ```

4. Ensure the required Firestore index is ready, runtime service-account access is appropriate, the default database is correct, providers are enabled, and the real Auth domains include the final frontend domain. Storage is not used; do not create a bucket for local question imports. The deny-all Storage policy may be deployed separately if a bucket exists.

5. Deploy the frontend after reviewing the live target:

   ```sh
   npx firebase deploy --project vedamock --only hosting
   ```

   Hosting predeploy runs the production gate and rebuilds. Vercel is an alternative in `LAUNCH.md` but only hosts the frontend; Firebase backend deployment is still required. The user selected Firebase Hosting and has been guided toward that route.

6. Create/use the intended application account, confirm its actual Auth UID, and grant the first administrator via an authorized operator in Firestore Console (`roles/<uid>`, boolean `isAdmin: true`) or the trusted script. The script uses Admin SDK application-default credentials: Firebase CLI browser login alone does not necessarily provide ADC. No private key should be pasted into Gemini/chat.

7. Verify real Google popup login, real student signup/login, submission/history, admin publishing and revocation, ownership isolation, deep links, headers, mobile layout and real billable-service behavior. No public-launch claim should be made before that verification.

## Known limitations / next development priorities

- Sample papers are generated, include repeated concepts and parameter variations, and are not official or curated exam papers. Main: 75 questions/300 marks; simplified Advanced: 54/162; NEET: 180/720. All three sample durations are 180 minutes.
- Advanced is a simplified single-correct/numerical practice format, not the complete official two-paper/multi-answer scheme.
- Real percentile ranking, proctoring, payments and institutional access controls are not implemented.
- There is no dedicated password-reset UI or enforced email-verification flow yet; use Firebase's appropriate account workflows before claiming those features exist.
- Live production Google OAuth, backend deployment, first-admin grant, billing and actual production IAM have not been end-to-end verified by the assistant.
- Abandoned attempt cleanup and scheduled retention are not implemented.
- Admin metrics scan Firebase Auth user pages for an exact current student count. For very large installations, replace that with an audited aggregate/mirror strategy.
- Admin question bank browsing/search is bounded to loaded records (100 initially, load more up to 1,000); recent submissions show the newest 50; student history shows the newest 100.
- Active marking/review/navigation UI flags are session state; the persisted attempt resumes saved answers and original deadline, not every temporary navigation/review flag.
- GitHub excludes ignored local configuration and generated assets. Preserve the separate configuration backup when moving machines, and use `npm ci` plus the guarded build to recreate dependencies and assets.

## Keep these invariants while extending

Preserve the backend trust boundary, role checks, immutable historical grades, server deadlines, duplicate-submission/import protection, optimistic versions, complete test assertions, production build guard and explicit emulator isolation. Fix failures rather than weakening rules or replacing real integration coverage with passing mock-only tests. Use the included code as the source of truth; ask the user only for genuinely missing deployment authorization or product decisions, not for already supplied Firebase identifiers.
