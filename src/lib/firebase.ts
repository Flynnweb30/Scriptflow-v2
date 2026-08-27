import {
  getAuth,
  Auth,
  browserLocalPersistence,
  setPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  User,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { app, db, auth } from '../config/firebase';

// Backward-compatible exports for legacy hooks/components. The application now
// uses the single Firebase/Auth instances from src/config/firebase.ts.
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');
googleProvider.setCustomParameters({ prompt: 'select_account' });

export {
  app,
  auth,
  db,
  googleProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  firebaseSignOut as signOut,
  sendPasswordResetEmail,
  updateProfile,
  browserLocalPersistence,
  setPersistence,
};
export type { Auth, User };
export default app;
