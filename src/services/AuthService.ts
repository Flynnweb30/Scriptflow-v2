import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getAppAuth, getAppFirestore } from '../config/firebase-config';

const friendlyAuthError = (error: any): Error => {
  const code = error?.code || '';
  const messages: Record<string, string> = {
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/missing-password': 'Please enter your password.',
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/user-not-found': 'The email or password is incorrect.',
    'auth/wrong-password': 'The email or password is incorrect.',
    'auth/email-already-in-use': 'An account already exists with this email. Try signing in instead.',
    'auth/weak-password': 'Use a stronger password with at least 6 characters.',
    'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Please allow popups and try again.',
    'auth/popup-closed-by-user': 'The Google sign-in window was closed. You can try again when ready.',
    'auth/cancelled-popup-request': 'Another sign-in request is already open. Please finish or close it first.',
    'auth/unauthorized-domain': 'This website domain is not authorized in Firebase Authentication.',
    'auth/network-request-failed': 'Network connection failed. Check your connection and try again.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase Authentication.',
  };
  return new Error(messages[code] || error?.message || 'Authentication failed. Please try again.');
};

const saveUserProfile = async (user: User): Promise<void> => {
  const db = getAppFirestore();
  if (!db) return;

  await setDoc(
    doc(db, 'users', user.uid),
    {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};

export const AuthService = {
  getCurrentUser(): User | null {
    return getAppAuth()?.currentUser ?? null;
  },

  onAuthChanged(callback: (user: User | null) => void) {
    return onAuthStateChanged(getAppAuth(), callback);
  },

  async setRememberMe(remember: boolean): Promise<void> {
    await setPersistence(
      getAppAuth(),
      remember ? browserLocalPersistence : browserSessionPersistence,
    );
  },

  async signInWithGoogle(remember = true): Promise<User> {
    const auth = getAppAuth();
    await this.setRememberMe(remember);

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    provider.addScope('email');
    provider.addScope('profile');

    try {
      const result = await signInWithPopup(auth, provider);
      try {
        await saveUserProfile(result.user);
      } catch (profileError) {
        console.warn('User profile sync skipped:', profileError);
      }
      return result.user;
    } catch (error: any) {
      console.warn('Google Sign-In:', error?.code || error);
      throw friendlyAuthError(error);
    }
  },

  async signInWithEmail(email: string, password: string, remember = true): Promise<User> {
    await this.setRememberMe(remember);
    try {
      const result = await signInWithEmailAndPassword(getAppAuth(), email.trim(), password);
      try {
        await saveUserProfile(result.user);
      } catch (profileError) {
        console.warn('User profile sync skipped:', profileError);
      }
      return result.user;
    } catch (error: any) {
      throw friendlyAuthError(error);
    }
  },

  async signUpWithEmail(email: string, password: string, remember = true): Promise<User> {
    await this.setRememberMe(remember);
    try {
      const result = await createUserWithEmailAndPassword(getAppAuth(), email.trim(), password);
      await updateProfile(result.user, { displayName: email.trim().split('@')[0] });
      try {
        await saveUserProfile(result.user);
      } catch (profileError) {
        console.warn('User profile sync skipped:', profileError);
      }
      return result.user;
    } catch (error: any) {
      throw friendlyAuthError(error);
    }
  },

  async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(getAppAuth(), email.trim());
    } catch (error: any) {
      throw friendlyAuthError(error);
    }
  },

  async logout(): Promise<void> {
    await signOut(getAppAuth());
  },
};
