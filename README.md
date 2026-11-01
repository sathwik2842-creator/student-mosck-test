# Veda Test

React, Tailwind CSS and Lucide frontend with Firebase Authentication, Cloud Firestore and callable Cloud Functions. Sign-in is required. Test history is scoped to the signed-in student. There is no mock auth, local result storage, client-side answer bank, or client-authoritative grading.

## Local development

Requirements: Node.js 22, Java 21 for the Firestore emulator. The current cloud machine has Node 24; frontend, SDK and grading tests run on it. Deployed Functions target the supported Node 22 runtime.

```sh
npm ci
npm --prefix functions ci
# In a new checkout: copy .env.example to .env.local, then set emulator values below.
npm run emulators
# In another terminal:
npm run seed:emulator
npm run dev
```

`.env.local` is ignored by Git. For local development, use:

```dotenv
VITE_USE_FIREBASE_EMULATORS=true
VITE_FIREBASE_PROJECT_ID=demo-veda-test
VITE_FIREBASE_API_KEY=demo-emulator-key
VITE_FIREBASE_AUTH_DOMAIN=demo-veda-test.firebaseapp.com
VITE_FIREBASE_APP_ID=demo-veda-test-web
VITE_FIREBASE_FUNCTIONS_REGION=us-central1
VITE_FIREBASE_EMULATOR_HOST=127.0.0.1
```

The `demo-*` project is an emulator-only namespace, not a real Firebase project. Emulator mode rejects non-loopback emulator hosts and non-demo project IDs. The emulator suite must be running before testing papers or submissions. Accounts and data disappear when emulators stop unless you explicitly export/import emulator state with Firebase CLI options.

The seed inserts JEE Main (75 questions), simplified JEE Advanced (54) and NEET UG (180). Existing test documents are preserved; `node scripts/seed.mjs --overwrite` explicitly replaces sample documents when appropriate. These remain generated sample papers with repeated concepts and parameter variations, not a curated or official question bank.

## Production Firebase setup

1. Follow [LAUNCH.md](LAUNCH.md) for the complete release procedure. Copy `.env.production` to ignored `.env.production.local`, fill the real Firebase Web app values, and keep `VITE_USE_FIREBASE_EMULATORS=false`. Process environment values have highest priority. `npm run build` now refuses incomplete or emulator production configuration. Use `npm run build:emulator` only for local verification.
2. In Authentication, enable Email/Password and Google providers. Set Google's support email and add the deployed application domain to Authorized domains. Add localhost separately if developing against production.
3. Create the default Cloud Firestore database and choose the appropriate location. Cloud Functions use `us-central1`; keep `VITE_FIREBASE_FUNCTIONS_REGION` consistent if you change the function region. A billing-enabled project is required to deploy Functions.
4. Authenticate the Firebase CLI using your existing authorized account or workload credentials. Do not put service-account private keys or Admin credentials in `VITE_*` variables or the frontend.
5. Review and deploy the security rules, indexes and Functions, selecting the project explicitly:

```sh
npx firebase deploy --project YOUR_PROJECT_ID --only firestore,functions
```

6. Using authorized application-default credentials on a trusted machine, seed the initial private papers and safe catalog. This is a real database write; inspect the generated content before use:

```sh
GCLOUD_PROJECT=YOUR_PROJECT_ID npm run seed:production
```

7. Build with the production environment values and publish the static frontend:

```sh
npm run release:check
npx firebase deploy --project YOUR_PROJECT_ID --only hosting
```

No deployment or production database writes were performed during implementation. A missing Firebase configuration displays a setup screen, never a demo login fallback. Authentication errors, denied reads, submission failures and unavailable tests have visible states. Google sign-in uses `signInWithPopup`; popup cancellation is handled.

The network policy must permit the emulator artifact at `storage.googleapis.com`, Google SDK at `apis.google.com`, and production services at `accounts.google.com`, `identitytoolkit.googleapis.com`, `securetoken.googleapis.com`, `firestore.googleapis.com`, your project's `<project>.firebaseapp.com` auth domain and `<region>-<project>.cloudfunctions.net` function domain. Firebase deployment may require additional Google control-plane destinations according to the actual CLI operation.

## Data model and trust boundary

| Collection | Contents | Student access |
|---|---|---|
| `tests/{testId}` | title, duration, totalMarks, subjects, active flag, version, full questions with options, correctAnswer, sectionType, solutions and per-question marks | None; Admin SDK only |
| `testCatalog/{testId}` | Safe published metadata, no questions or keys | Published only; admin roles can read drafts |
| `attempts/{attemptId}` | Owner, immutable paper snapshot, original server deadline, answers, monotonic save revision and status | Through authenticated Functions only |
| `activeAttempts/{uid_testId}` | Active attempt pointer for resuming | Through Functions only |
| `results/{attemptId}` | userId, testId, score, totalMarks, accuracy, timeTaken, submittedAt, immutable detailed answer/solution breakdown and display metadata | Owner read; only own `studentNotes` may be updated directly, graded fields stay immutable |

Firestore rules cannot hide selected fields inside an otherwise readable document. Therefore the complete `tests` document, including the answer key requested by the schema, is private. The dashboard subscribes to `testCatalog`; `TestScreen.jsx` starts a callable-backed session that reads Firestore and returns only student-safe question fields. Correct answers and solutions are returned only after submission in the student's result.

`startTest` requires authentication, snapshots the paper and sets its deadline on the server. It resumes existing active attempts without extending time. `saveAttempt` validates the owner's answers and ignores out-of-order save revisions. `submitTest` validates ownership, grades on the server using its private snapshot, and writes the result atomically. It ignores client-supplied scores, identities and elapsed time. Retries return the same result ID and score. Submissions after the deadline use the last answers saved before expiry; late injected answers are ignored. Answer autosave is debounced by 300 ms, so keep a working connection and watch the save indicator. Leaving the page retains saved answers but does not pause the timer.

Results contain the original paper and evaluations, so future paper edits do not change historical grades. Dashboard and history subscribe to the student's most recent 100 server results. Theme is the only application preference persisted in localStorage; Firebase manages authentication persistence. The old local mock history is not imported as trusted results.

A percentile cannot be computed honestly without cohort statistics. Results show “Not available” until a trustworthy percentile pipeline is added. This app does not implement exam proctoring, paid test access, or automated deletion of abandoned sessions.

## Validation

```sh
npm test                       # 30 grading, admin, import and production-config tests
npm run build:emulator         # explicit local-test bundle; never deploy it
npm run release:check          # real production values required
# All services must be running for browser-only invocation:
npm run test:e2e
# Or let Firebase start/stop the services, seed the papers, and run all backend + browser tests:
npm run test:firebase
```

The Firestore rules suite asserts anonymous denial, private answer-key denial, owner-only results, scoped result queries, and rejection of all student score writes. Backend integration tests cover authenticated starts, no leaked keys, server grading, forged scores, duplicate submissions, other-user attempts and expired deadlines. Student/auth browser tests use real Firebase emulator SDK calls; the separate admin UI suite uses explicit test-only service fakes and does not prove backend authorization. `npm run test:auth` runs only Authentication/UI checks against a running Auth emulator; it does not validate Firestore.

The official Firestore emulator is now available and the full isolated Firebase suite passes (9 rules, 7 backend and 14 browser tests). Browser tests force the local demo project on port 5183, even when the environment contains live Firebase settings. They do not reuse the production development server. Live `vedamock` Email/Password sign-in was subsequently verified enabled. Production Google sign-in and deployment remain unverified.

## Administrator workspace

See [ADMIN.md](ADMIN.md) for protected `/admin` routes, trusted role provisioning, test and question management, JSON/CSV import formats, metrics, and admin-specific security tests. The first administrator must be explicitly provisioned by a trusted operator; signup does not grant permissions.

## Public launch

[LAUNCH.md](LAUNCH.md) describes Firebase setup, the first admin, environment precedence, guarded production builds, Vercel/Firebase Hosting deployment, release gates and rollback. Deployments have not been executed. The unused Storage policy is deny-all.

## Continuation package

Read [HANDOFF.md](HANDOFF.md) for the latest verified state and remaining work. [GEMINI_START_HERE.md](GEMINI_START_HERE.md) contains a ready-to-use continuation request. The complete handoff export also supplies a single-file source transcript, compiled assets, reference screenshots and integrity manifest.
