# Veda Test administrator workspace

The administrator area lives at `/admin`, with `/admin/tests`, `/admin/questions`, and `/admin/submissions`. Firebase Hosting already rewrites application routes to `index.html`, so direct links work after deployment.

## Access model

A `roles/{firebaseAuthUid}` document containing the **boolean** `isAdmin: true` grants access. Missing documents, false values, strings such as `"true"`, and read failures deny access. The browser watches only its own role document and redirects non-admins to the student dashboard with a warning. A role revocation removes the workspace when received. Unauthenticated visitors see the existing login screen.

The route guard is only a user-experience layer. Every administrator callable checks the authenticated UID's role using the Admin SDK. Mutations re-check the role inside the same Firestore transaction, so a concurrent revocation conflicts with the write and forces a fresh authorization check. Firestore rules deny **all** browser role writes, including writes by admins. There is no client role-grant endpoint and no first-signup administrator shortcut.

## Grant or revoke access

An already-authorized project operator must identify an existing Firebase Authentication user's UID and run the trusted script. Use the Firebase Console Authentication user list, or the local Auth emulator's user information, to identify the UID. Do not copy credentials or tokens into the frontend.

Local development, after both Auth and Firestore emulators are running:

```sh
GCLOUD_PROJECT=demo-veda-test \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
npm run admin:role -- --uid EXISTING_USER_UID --grant
```

For production, use authorized application-default credentials on a trusted machine and explicitly select the project:

```sh
GCLOUD_PROJECT=YOUR_PROJECT_ID \
npm run admin:role -- --uid EXISTING_USER_UID --grant --production
# Replace --grant with --revoke to remove access.
```

This is a real permission change. The script verifies the Auth user exists and requires `--production` for production writes. It never puts Admin credentials in browser configuration. No administrator was granted and no production data was changed during implementation.

Deploy the updated rules, indexes and Functions before using the workspace against production:

```sh
npx firebase deploy --project YOUR_PROJECT_ID --only firestore,functions
npm run release:check
npx firebase deploy --project YOUR_PROJECT_ID --only hosting
```

## Managing papers

- Create a paper with its exam type, title, duration, total marks, instructions and marking defaults. Drafts can be empty; published tests must contain questions and the exact total must equal the sum of question marks.
- Add inline questions, select copies from the reusable bank, or import a collection. Section A and Section B support single-answer MCQs. Numerical questions support finite decimal answers.
- Each question stores its own correct and incorrect marks. Changing defaults affects new questions; **Apply to all questions** explicitly updates existing ones. Marks use increments of 0.25. Unanswered questions always receive zero.
- Save a private draft or publish it to the student catalog. Saving a published paper as a draft unpublishes it. Unpublishing does not invalidate existing attempts: they resume their original snapshot and deadline.
- Reorder, duplicate, edit or remove inline questions, then save the paper to persist changes. Bank edits and paper copies are independent.
- Every save requires the document's current version. A stale editor receives a conflict error and preserves its local changes. Reload the saved version deliberately before trying again.
- A published paper must be unpublished before deletion. Papers with unfinished attempts must stay archived. Saved student results are never deleted by paper or bank operations.

Question and paper sizes are bounded below Firestore's document limit. Publication also checks the estimated result size, so long answers cannot create papers whose review documents would exceed storage limits.

## Bulk import format

JSON accepts an array or an object with a `questions` array. Downloadable JSON and CSV templates are available in the import dialog. A minimal JSON question is:

```json
[
  {
    "text": "A 3 Ω resistor carries 2 A. Find the voltage in volts.",
    "subject": "Physics",
    "section": "Section A",
    "options": ["3", "6", "9", "12"],
    "correctAnswer": "B",
    "solutions": ["Use Ohm's law: V = IR.", "V = 2 × 3 = 6 V."],
    "correctMarks": 4,
    "incorrectMarks": -1
  }
]
```

CSV headers:

```csv
text,subject,section,optionA,optionB,optionC,optionD,correctAnswer,solutions,correctMarks,incorrectMarks
```

Quote fields containing commas, quotes or newlines; escape quotes by doubling them. The `solutions` cell can contain quoted newlines, one step per line. UTF-8 BOMs, CRLF line endings and multiline fields are supported. Use `Numerical` as the section for numeric questions; options are ignored for them. MCQ correct answers may be the exact option text or its A–D label. When an option itself is a single letter, exact option text takes precedence. Mark fields are optional and default to the current paper's rules or the bank defaults.

Imports accept 1–100 questions and at most 850 KB. All rows are validated before any writes. A malformed row rejects the entire batch. Bank imports are transactional and use a stable import ID so network retries do not duplicate an already saved batch. Paper imports modify only the working draft until it is saved. Uploaded files are parsed as data; HTML and expressions are never executed.

## Metrics and monitoring

- Registered students are counted from Firebase Authentication users, excluding users with an explicit admin role and anonymous-only accounts. Counts are fetched from the server, not guessed from current browser activity.
- Completed tests and active papers use Firestore aggregation counts. Counts refresh on demand and after admin writes.
- The read-only submissions table streams the newest 50 results across all students. It shows the verified token email recorded at submission, test, score, accuracy and timestamp. Older results without an email display “Email not recorded” rather than fabricating one.
- Question bank browsing loads the newest 100 records, with load-more controls up to 1,000. Search applies to the loaded set. Paper lists use safe catalog metadata; private paper bodies are fetched through a role-checked function when edited.
- Admin writes append server-owned `auditLog` entries. `roles`, `adminImports`, `attempts`, private `tests` and audit logs cannot be directly written from a browser. Admins may read the bank and all results; even admins cannot forge scores through Firestore.

## Tests and remaining environment requirements

```sh
npm test                  # 30 domain/grading/import/production-config tests
npm run test:admin-ui      # editor/route/layout tests with explicit test-only transport fakes
npm run test:auth          # real Firebase Authentication emulator tests
npm run test:firebase      # full Firestore rules, callable integration and browser suite
npm run release:check
```

UI tests with transport fakes verify frontend behavior; they do not prove backend permissions. The Firestore suites separately cover self-promotion denial, admin-only reads, role revocation, all admin callables rejecting students, version conflicts, atomic imports, snapshot-safe paper edits, and deletion constraints.

The cloud network is now applied and the full Firebase emulator suite passes, including role enforcement, revocation, import atomicity and paper-edit conflicts. Live production deployment remains separate: Email/Password was subsequently verified enabled, while no public deployment or administrator grant has been performed. See `LAUNCH.md` for the remaining release gates.

For the production environment template, guarded builds, hosting configuration and final release gates, follow [LAUNCH.md](LAUNCH.md). Local build verification uses `npm run build:emulator`; its output must not be published.
