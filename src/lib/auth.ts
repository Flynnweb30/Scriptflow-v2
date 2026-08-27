import {
  User,
  UserCredential,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  Auth,
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';

// Google Sign-In with Popup
export const signInWithGooglePopup = async (): Promise<UserCredential> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result;
  } catch (error) {
    console.error('Google sign-in popup error:', error);
    throw error;
  }
};

// Google Sign-In with Redirect
export const signInWithGoogleRedirect = async (): Promise<void> => {
  try {
    await signInWithRedirect(auth, googleProvider);
  } catch (error) {
    console.error('Google sign-in redirect error:', error);
    throw error;
  }
};

// Get redirect result
export const getGoogleRedirectResult = async (): Promise<UserCredential | null> => {
  try {
    const result = await getRedirectResult(auth);
    return result;
  } catch (error) {
    console.error('Redirect result error:', error);
    return null;
  }
};

// Authentication state observer
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Sign out
export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
};

// Send password reset email
export const resetPassword = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error('Password reset error:', error);
    throw error;
  }
};

// Get current user
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  return !!auth.currentUser;
};

// Get auth instance
export const getAuth = (): Auth => {
  return auth;
};

// Update user profile
export const updateUserProfile = async (displayName: string, photoURL?: string): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('No user logged in');
    await updateProfile(user, { displayName, photoURL: photoURL || user.photoURL });
  } catch (error) {
    console.error('Update profile error:', error);
    throw error;
  }
};