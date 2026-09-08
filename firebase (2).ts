import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyD_Ry0pM7EKSDJeTegt0rY5muiw-xCgrhw',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'scriptflow-pro-2cf4c.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'scriptflow-pro-2cf4c',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'scriptflow-pro-2cf4c.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '250157640936',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:250157640936:web:cd6218470c302b305aed5d',
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch {
  // Supports HMR or another module that initialized Firestore first.
  db = getFirestore(app);
}

const auth = getAuth(app);

if (import.meta.env.DEV && import.meta.env.VITE_USE_FIRESTORE_EMULATOR === 'true') {
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  } catch (error) {
    console.debug('Firebase emulator connection skipped:', error);
  }
}

export { app, db, auth };
