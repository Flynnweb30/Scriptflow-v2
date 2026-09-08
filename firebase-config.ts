// Backward-compatible accessors. Firebase is initialized exactly once in firebase.ts.
export { app, db, auth, firebaseConfig } from './firebase';

import { app, db, auth } from './firebase';

export function getFirebaseApp() {
    return app;
}

export function getAppFirestore() {
    return db;
}

export function getAppAuth() {
    return auth;
}
