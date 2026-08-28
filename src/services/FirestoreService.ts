import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  QueryConstraint,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  where,
} from 'firebase/firestore';
import { getAppAuth, getAppFirestore } from '../config/firebase-config';
import { Appointment, Closer, Script, Task } from '../types';
import { CONFIG, DEFAULT_SCRIPTS } from '../config/constants';

const CACHE_EXPIRY = 5 * 60 * 1000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
type Unsubscribe = () => void;

const currentUserId = (): string | null => getAppAuth()?.currentUser?.uid ?? null;

// Firebase can briefly report a null currentUser while restoring a persisted
// session. Workspace writes wait for the initial auth state and for a short
// sign-in transition window before deciding the user is genuinely signed out.
const waitForAuthenticatedUser = async (): Promise<string> => {
  const auth = getAppAuth();
  if (!auth) throw new Error('Authentication is unavailable. Please refresh and try again.');

  try {
    if (typeof (auth as any).authStateReady === 'function') {
      await (auth as any).authStateReady();
    }
  } catch (error) {
    console.warn('Firebase auth state initialization warning:', error);
  }

  const immediateUid = auth.currentUser?.uid;
  if (immediateUid) return immediateUid;

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let unsubscribe: (() => void) | undefined;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe?.();
      reject(new Error('You must be signed in to use workspace data.'));
    }, 3000);

    unsubscribe = auth.onIdTokenChanged((user) => {
      if (settled || !user) return;
      settled = true;
      window.clearTimeout(timeout);
      unsubscribe?.();
      resolve(user.uid);
    });
  });
};

const cacheKey = (kind: string): string => `scriptflow_${currentUserId() || 'anonymous'}_${kind}`;

const getCachedData = <T>(kind: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(cacheKey(kind));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Date.now() - parsed.timestamp < CACHE_EXPIRY ? parsed.data as T : fallback;
  } catch {
    return fallback;
  }
};

const setCachedData = <T>(kind: string, data: T): void => {
  try {
    localStorage.setItem(cacheKey(kind), JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // Storage may be unavailable in private/restricted contexts.
  }
};

const requireUser = async (): Promise<string> => waitForAuthenticatedUser();

const requireDb = () => {
  const db = getAppFirestore();
  if (!db) throw new Error('Database is unavailable. Please refresh and try again.');
  return db;
};

type AppointmentListener = (items: Appointment[]) => void;
const appointmentListeners = new Set<AppointmentListener>();
type CollectionListener<T> = (items: T) => void;
const collectionListeners = new Map<string, Set<CollectionListener<any>>>();

const addCollectionListener = <T>(kind: string, listener: CollectionListener<T>): (() => void) => {
  const listeners = collectionListeners.get(kind) || new Set<CollectionListener<T>>();
  listeners.add(listener);
  collectionListeners.set(kind, listeners);
  return () => listeners.delete(listener);
};

const notifyCollectionListeners = <T>(kind: string, data: T): void => {
  const listeners = collectionListeners.get(kind);
  if (!listeners) return;
  listeners.forEach((listener) => {
    try {
      listener(data);
    } catch (error) {
      console.warn(`Local ${kind} listener failed:`, error);
    }
  });
};

const notifyAppointmentListeners = (): void => {
  const items = getCachedData<Appointment[]>('appointments', []);
  notifyCollectionListeners('appointments', items);
  appointmentListeners.forEach((listener) => {
    try {
      listener(items);
    } catch (error) {
      console.warn('Local appointment listener failed:', error);
    }
  });
};

const permissionMessage = (error: any, action: string): Error => {
  if (error?.code === 'permission-denied') {
    return new Error(`You do not have permission to ${action}. Please sign in again or check the Firestore security rules.`);
  }
  return new Error(error?.message || `Unable to ${action}.`);
};

const subscribeCollection = <T>(
  kind: string,
  collectionName: string,
  fallback: T[],
  onUpdate: (items: T[]) => void,
  mapDoc: (id: string, data: any) => T,
  sortField?: string,
  onError?: (error: any) => void,
): Unsubscribe => {
  const uid = currentUserId();
  if (!uid) {
    onUpdate(fallback);
    return () => {};
  }

  const db = getAppFirestore();
  if (!db) {
    onUpdate(getCachedData<T[]>(kind, fallback));
    return () => {};
  }

  const cached = getCachedData<T[]>(kind, fallback);
  if (cached.length) onUpdate(cached);
  const removeLocalListener = addCollectionListener<T[]>(kind, onUpdate);

  let unsubscribe: Unsubscribe | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryCount = 0;
  let disposed = false;

  const start = () => {
    if (disposed || currentUserId() !== uid) return;

    const constraints: QueryConstraint[] = [where('userId', '==', uid)];

    unsubscribe = onSnapshot(
      query(collection(requireDb(), collectionName), ...constraints),
      (snapshot) => {
        retryCount = 0;
        const items = snapshot.docs.map((d) => mapDoc(d.id, d.data()));
        if (sortField) {
          items.sort((a: any, b: any) => {
            const av = a?.[sortField];
            const bv = b?.[sortField];
            const at = av?.seconds ? av.seconds * 1000 : Date.parse(String(av || '')) || 0;
            const bt = bv?.seconds ? bv.seconds * 1000 : Date.parse(String(bv || '')) || 0;
            return bt - at;
          });
        }
        setCachedData(kind, items);
        onUpdate(items);
      },
      (error) => {
        if (error?.code === 'permission-denied') {
          onUpdate(getCachedData<T[]>(kind, fallback));
          onError?.(error);
          return;
        }
        if (retryCount < MAX_RETRIES && !disposed) {
          retryCount += 1;
          retryTimer = setTimeout(start, RETRY_DELAY * retryCount);
          return;
        }
        onUpdate(getCachedData<T[]>(kind, fallback));
        onError?.(error);
      },
    );
  };

  start();

  return () => {
    disposed = true;
    if (retryTimer) clearTimeout(retryTimer);
    unsubscribe?.();
    removeLocalListener();
  };
};

export const FirestoreService = {
  // Firestore 11+ cache is configured once in src/config/firebase.ts.
  async initializePersistence(): Promise<void> {},

  // Firestore automatically manages connectivity. Avoid racing enable/disableNetwork calls.
  async handleNetworkStatus(): Promise<void> {},

  subscribeAppointments(onUpdate: (items: Appointment[]) => void, onError?: (error: any) => void): Unsubscribe {
    const remoteUnsubscribe = subscribeCollection(
      'appointments',
      'appointments',
      [],
      onUpdate,
      (id, data) => ({ id, ...data }) as Appointment,
      'createdAt',
      onError,
    );

    return () => {
      remoteUnsubscribe();
    };
  },

  async saveAppointment(appointment: Partial<Appointment> & { id: string }): Promise<void> {
    const uid = await requireUser();
    const now = new Date().toISOString();
    const current = getCachedData<Appointment[]>('appointments', []);
    const existing = current.find((item) => item.id === appointment.id);
    const createdAt = appointment.createdAt || existing?.createdAt || (!existing ? now : undefined);
    const data = {
      ...appointment,
      userId: uid,
      updatedAt: now,
      ...(createdAt ? { createdAt } : {}),
    };

    const next = current.some((item) => item.id === appointment.id)
      ? current.map((item) => item.id === appointment.id ? { ...item, ...data } as Appointment : item)
      : [data as Appointment, ...current];
    setCachedData('appointments', next);
    notifyAppointmentListeners();

    try {
      await setDoc(doc(requireDb(), 'appointments', appointment.id), data, { merge: true });
    } catch (error) {
      setCachedData('appointments', current);
      notifyAppointmentListeners();
      throw permissionMessage(error, 'save this appointment');
    }
  },

  async deleteAppointment(id: string): Promise<void> {
    await requireUser();
    const current = getCachedData<Appointment[]>('appointments', []);
    setCachedData('appointments', current.filter((a) => a.id !== id));
    notifyAppointmentListeners();
    try {
      await deleteDoc(doc(requireDb(), 'appointments', id));
    } catch (error) {
      setCachedData('appointments', current);
      notifyAppointmentListeners();
      throw permissionMessage(error, 'delete this appointment');
    }
  },

  subscribeScripts(onUpdate: (scripts: Record<string, Script>) => void, onError?: (error: any) => void): Unsubscribe {
    if (!currentUserId()) {
      onUpdate(DEFAULT_SCRIPTS);
      return () => {};
    }

    return subscribeCollection<Script>(
      'scripts',
      'scripts',
      [],
      (items) => {
        const result: Record<string, Script> = { ...DEFAULT_SCRIPTS };
        items.forEach((item: any) => { result[item.id] = item as Script; });
        onUpdate(result);
      },
      (id, data) => ({ id, ...data }) as Script,
      undefined,
      onError,
    );
  },

  async saveScript(id: string, script: Script): Promise<void> {
    const uid = await requireUser();
    const current = getCachedData<Script[]>('scripts', []);
    const currentArray = current;
    const nextArray = currentArray.some((item) => item.id === id)
      ? currentArray.map((item) => item.id === id ? { ...item, ...script, id } : item)
      : [...currentArray, { ...script, id }];
    setCachedData('scripts', nextArray);
    notifyCollectionListeners('scripts', nextArray);
    try {
      await setDoc(
        doc(requireDb(), 'scripts', id),
        { ...script, userId: uid, updatedAt: serverTimestamp() },
        { merge: true },
      );
    } catch (error) {
      // Never leave an optimistic script edit in the local cache when the
      // authenticated write fails. The next snapshot can safely reconcile it.
      setCachedData('scripts', currentArray);
      notifyCollectionListeners('scripts', currentArray);
      throw permissionMessage(error, 'save this script');
    }
  },

  async deleteScript(id: string): Promise<void> {
    await requireUser();
    const current = getCachedData<Script[]>('scripts', []);
    const next = current.filter((item) => item.id !== id);
    setCachedData('scripts', next);
    notifyCollectionListeners('scripts', next);
    try {
      await deleteDoc(doc(requireDb(), 'scripts', id));
    } catch (error) {
      setCachedData('scripts', current);
      notifyCollectionListeners('scripts', current);
      throw permissionMessage(error, 'delete this script');
    }
  },

  async saveScriptOrder(orderedScripts: Array<{ id: string; order: number }>): Promise<void> {
    const uid = await requireUser();
    if (!orderedScripts.length) return;

    const current = getCachedData<Script[]>('scripts', []);
    const orderById = new Map(orderedScripts.map((item) => [item.id, item.order]));
    const next = current.map((script) => (
      orderById.has(script.id)
        ? { ...script, order: orderById.get(script.id) }
        : script
    ));

    // Keep locally cached scripts in the exact same order used by the UI.
    next.sort((a, b) => {
      const ao = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER;
      const bo = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER;
      return ao - bo;
    });
    setCachedData('scripts', next);
    notifyCollectionListeners('scripts', next);

    const batch = writeBatch(requireDb());
    orderedScripts.forEach(({ id, order }) => {
      batch.set(
        doc(requireDb(), 'scripts', id),
        { userId: uid, order, updatedAt: serverTimestamp() },
        { merge: true },
      );
    });

    try {
      await batch.commit();
    } catch (error) {
      setCachedData('scripts', current);
      notifyCollectionListeners('scripts', current);
      throw permissionMessage(error, 'reorder your scripts');
    }
  },

  subscribeClosers(onUpdate: (items: Closer[]) => void, onError?: (error: any) => void): Unsubscribe {
    return subscribeCollection<Closer>(
      'closers',
      'closers',
      CONFIG.DEFAULT_CLOSERS,
      onUpdate,
      (id, data) => ({ id, ...data }) as Closer,
      undefined,
      onError,
    );
  },

  async saveCloser(closer: Closer): Promise<void> {
    const uid = await requireUser();
    const current = getCachedData<Closer[]>('closers', CONFIG.DEFAULT_CLOSERS as Closer[]);
    const next = current.some((c) => c.id === closer.id)
      ? current.map((c) => c.id === closer.id ? closer : c)
      : [...current, closer];
    setCachedData('closers', next);
    notifyCollectionListeners('closers', next);

    try {
      await setDoc(
        doc(requireDb(), 'closers', closer.id),
        { ...closer, userId: uid, updatedAt: serverTimestamp() },
        { merge: true },
      );
    } catch (error) {
      setCachedData('closers', current);
      notifyCollectionListeners('closers', current);
      throw permissionMessage(error, 'save this closer');
    }
  },

  async deleteCloser(id: string): Promise<void> {
    await requireUser();
    const current = getCachedData<Closer[]>('closers', CONFIG.DEFAULT_CLOSERS as Closer[]);
    const next = current.filter((c) => c.id !== id);
    setCachedData('closers', next);
    notifyCollectionListeners('closers', next);
    try {
      await deleteDoc(doc(requireDb(), 'closers', id));
    } catch (error) {
      setCachedData('closers', current);
      notifyCollectionListeners('closers', current);
      throw permissionMessage(error, 'delete this closer');
    }
  },

  subscribeTasks(onUpdate: (items: Task[]) => void, onError?: (error: any) => void): Unsubscribe {
    return subscribeCollection(
      'tasks',
      'tasks',
      [],
      onUpdate,
      (id, data) => ({ id, ...data }) as Task,
      undefined,
      onError,
    );
  },

  async saveTask(task: Task): Promise<void> {
    const uid = await requireUser();
    const current = getCachedData<Task[]>('tasks', []);
    const next = current.some((t) => t.id === task.id)
      ? current.map((t) => t.id === task.id ? task : t)
      : [task, ...current];
    setCachedData('tasks', next);
    notifyCollectionListeners('tasks', next);

    try {
      await setDoc(
        doc(requireDb(), 'tasks', task.id),
        { ...task, userId: uid, updatedAt: serverTimestamp() },
        { merge: true },
      );
    } catch (error) {
      setCachedData('tasks', current);
      notifyCollectionListeners('tasks', current);
      throw permissionMessage(error, 'save this task');
    }
  },

  async deleteTask(id: string): Promise<void> {
    await requireUser();
    const current = getCachedData<Task[]>('tasks', []);
    const next = current.filter((t) => t.id !== id);
    setCachedData('tasks', next);
    notifyCollectionListeners('tasks', next);
    try {
      await deleteDoc(doc(requireDb(), 'tasks', id));
    } catch (error) {
      setCachedData('tasks', current);
      notifyCollectionListeners('tasks', current);
      throw permissionMessage(error, 'delete this task');
    }
  },

  clearCache(): void {
    const uid = currentUserId();
    if (!uid) return;
    ['appointments', 'scripts', 'tasks', 'closers'].forEach((kind) => {
      localStorage.removeItem(`scriptflow_${uid}_${kind}`);
    });
  },
};
