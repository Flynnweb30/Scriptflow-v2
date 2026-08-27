# ScriptFlow Pro — Firebase/Auth/Firestore update

## What was fixed

- Replaced deprecated `enableIndexedDbPersistence()` with Firebase 11's `persistentLocalCache()` + `persistentMultipleTabManager()`.
- Firestore listeners no longer start before Firebase Auth restores a user session.
- All workspace collections are user-scoped with `userId == auth.uid`.
- Local cache keys are also user-scoped so one account cannot display another account's cached workspace.
- Added Firestore security rules for `users`, `appointments`, `scripts`, `tasks`, and `closers`.
- Removed the old manual online/offline `disableNetwork()` / `enableNetwork()` race.
- Removed the appointment server-side `orderBy()` so a composite Firestore index is not required.
- Google popup errors now have user-friendly messages; popup closure is treated as cancellation rather than a fatal app state.
- Added persistent/session login selection and password-reset flow.
- Fixed Render/Express `/health` route ordering.
- Added COOP `same-origin-allow-popups` to both Vite and production Express responses.
- Removed unnecessary COEP configuration that could interfere with popup authentication.
- Added `firebase.json` pointing at the included Firestore rules.

## Required Firebase Console configuration

In Firebase Authentication:

1. Enable **Google** under Sign-in providers.
2. Enable **Email/Password** if email login/signup is required.
3. Add every real deployment hostname to Authentication > Settings > Authorized domains.
   - Your Render hostname
   - Any custom domain
   - `localhost` for local development

In Firestore:

1. Create/enable the Firestore database.
2. Deploy `firestore.rules` from this project:
   `firebase deploy --only firestore:rules`
3. Do not replace these rules with a public `allow read, write: if true` rule.

## Environment

Use `.env.example` and set the `VITE_FIREBASE_*` values for your Firebase project. The existing fallback values are retained for compatibility with the supplied project.

## Authentication flow

1. App starts and waits for `onAuthStateChanged`.
2. If no session exists, workspace listeners are not created.
3. User signs in with Google or email/password.
4. Auth persistence is selected as local or session based on "Remember Me".
5. The user profile is synchronized to `users/{uid}` when permitted.
6. Only after authentication succeeds are workspace listeners created.
7. Every workspace query includes `where('userId', '==', uid)`.
8. Every create/update writes the authenticated user's UID.
9. Sign-out removes active workspace listeners and clears the in-memory workspace state.
10. A later sign-in restores only that user's workspace.

## Important

The application code cannot change Firebase Console security rules by itself. The included `firestore.rules` must be deployed to the same Firebase project used by the Vite environment variables. Until those rules are deployed, Firestore will correctly reject workspace reads/writes with `permission-denied`.
