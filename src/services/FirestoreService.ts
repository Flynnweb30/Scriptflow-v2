import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  QueryConstraint,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getAppAuth, getAppFirestore } from '../config/firebase-config';
import { Appointment, Closer, Script, Task } from '../types';
import { CONFIG, DEFAULT_SCRIPTS } from '../config/constants';
import { normalizeUSTimezone } from '../utils/timezone-utils';

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
      ...(appointment.timezone ? { timezone: normalizeUSTimezone(appointment.timezone) } : {}),
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

        // Firestore does not guarantee document order. Keep one deterministic
        // order for the sidebar, keyboard shortcuts, and script panel. Older
        // scripts without `order` retain their legacy keyNumber/insertion order.
        const ordered = Object.entries(result)
          .sort(([keyA, a], [keyB, b]) => {
            const orderA = Number.isFinite(Number((a as Script).order)) ? Number((a as Script).order) : Number((a as Script).keyNumber ?? Number.MAX_SAFE_INTEGER);
            const orderB = Number.isFinite(Number((b as Script).order)) ? Number((b as Script).order) : Number((b as Script).keyNumber ?? Number.MAX_SAFE_INTEGER);
            if (orderA !== orderB) return orderA - orderB;
            return keyA.localeCompare(keyB);
          });
        onUpdate(Object.fromEntries(ordered));
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

  async reorderScripts(orderedIds: string[]): Promise<void> {
    const uid = await requireUser();
    const current = getCachedData<Script[]>('scripts', []);
    const currentMap = new Map<string, Script>();
    Object.entries(DEFAULT_SCRIPTS).forEach(([id, script]) => currentMap.set(id, { ...script, id } as Script));
    current.forEach((script: any) => currentMap.set(script.id, script as Script));

    const uniqueIds = [...new Set(orderedIds)].filter((id) => currentMap.has(id));
    currentMap.forEach((_script, id) => {
      if (!uniqueIds.includes(id)) uniqueIds.push(id);
    });

    const next = uniqueIds.map((id, index) => ({
      ...(currentMap.get(id) as Script),
      id,
      order: index,
      // The visible shortcut number follows the persisted order.
      keyNumber: index + 1,
    }));

    setCachedData('scripts', next);
    notifyCollectionListeners('scripts', next);

    try {
      const batch = writeBatch(requireDb());
      next.forEach(({ id, ...script }) => {
        batch.set(doc(requireDb(), 'scripts', id), { ...script, userId: uid, updatedAt: serverTimestamp() }, { merge: true });
      });
      await batch.commit();
    } catch (error) {
      setCachedData('scripts', current);
      notifyCollectionListeners('scripts', current);
      throw permissionMessage(error, 'reorder the call scripts');
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

  subscribeClosers(onUpdate: (items: Closer[]) => void, onError?: (error: any) => void): Unsubscribe {
    return subscribeCollection<Closer>(
      'closers',
      'closers',
      CONFIG.DEFAULT_CLOSERS,
      (items) => {
        const active = items.filter(c => c.active);
        const activeDefault = active.find(c => c.default);
        const defaultId = activeDefault?.id || active[0]?.id;
        onUpdate(items.map(c => ({ ...c, default: Boolean(defaultId && c.id === defaultId && c.active) })));
      },
      (id, data) => ({ id, ...data }) as Closer,
      undefined,
      onError,
    );
  },

  async saveCloser(closer: Closer, previousName?: string): Promise<void> {
    const uid = await requireUser();
    const db = requireDb();
    const normalizedNext = closer.name.trim();
    if (!normalizedNext) throw new Error('Closer name is required.');

    // Read the authoritative user-owned closer set immediately before a write.
    // This prevents a stale local cache (or another open tab) from restoring an
    // older default when the user switches the default closer.
    let authoritativeClosers = getCachedData<Closer[]>('closers', []);
    try {
      const snapshot = await getDocs(query(collection(db, 'closers'), where('userId', '==', uid)));
      authoritativeClosers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Closer));
    } catch (error) {
      console.warn('Using cached closer state after fresh closer read failed:', error);
    }

    const currentAppointments = getCachedData<Appointment[]>('appointments', []);
    const existing = authoritativeClosers.find(c => c.id === closer.id);
    const nextRecord: Closer = {
      ...(existing || {}),
      ...closer,
      id: closer.id,
      name: normalizedNext,
      active: closer.active !== false,
      default: Boolean(closer.default && closer.active !== false),
    };

    let nextClosers = authoritativeClosers.some(c => c.id === closer.id)
      ? authoritativeClosers.map(c => c.id === closer.id ? nextRecord : c)
      : [...authoritativeClosers, nextRecord];

    // Exactly one active default is allowed. If the requested closer is not
    // default (including when the current default is deactivated), promote the
    // first available active closer instead of leaving the workspace without one.
    const requestedDefault = nextRecord.default && nextRecord.active;
    if (requestedDefault) {
      nextClosers = nextClosers.map(c => ({ ...c, default: c.id === nextRecord.id && c.active }));
    } else {
      const activeExistingDefault = nextClosers.find(c => c.active && c.default && c.id !== nextRecord.id);
      const fallback = activeExistingDefault || nextClosers.find(c => c.active);
      nextClosers = nextClosers.map(c => ({ ...c, default: Boolean(fallback && c.id === fallback.id && c.active) }));
    }

    const normalizedPrevious = previousName?.trim() || existing?.name?.trim();
    const renamed = Boolean(normalizedPrevious && normalizedPrevious !== normalizedNext);
    const nextAppointments = renamed
      ? currentAppointments.map(appointment => appointment.closer === normalizedPrevious
        ? { ...appointment, closer: normalizedNext, updatedAt: new Date().toISOString() }
        : appointment)
      : currentAppointments;

    setCachedData('closers', nextClosers);
    notifyCollectionListeners('closers', nextClosers);
    if (renamed) {
      setCachedData('appointments', nextAppointments);
      notifyAppointmentListeners();
    }

    try {
      const batch = writeBatch(db);
      nextClosers.forEach(c => {
        const previous = authoritativeClosers.find(existingCloser => existingCloser.id === c.id);
        const changed = !previous || previous.name !== c.name || previous.email !== c.email || previous.phone !== c.phone || previous.active !== c.active || previous.default !== c.default || c.id === closer.id;
        if (changed) {
          batch.set(doc(db, 'closers', c.id), { ...c, userId: uid, updatedAt: serverTimestamp() }, { merge: true });
        }
      });
      if (renamed) {
        // Keep historical appointments consistent with the renamed closer.
        currentAppointments.forEach(appointment => {
          if (appointment.closer === normalizedPrevious) {
            batch.set(doc(db, 'appointments', appointment.id), { closer: normalizedNext, userId: uid, updatedAt: serverTimestamp() }, { merge: true });
          }
        });
      }
      await batch.commit();
    } catch (error) {
      setCachedData('closers', authoritativeClosers);
      notifyCollectionListeners('closers', authoritativeClosers);
      if (renamed) { setCachedData('appointments', currentAppointments); notifyAppointmentListeners(); }
      throw permissionMessage(error, 'save the closer and synchronize its appointments');
    }
  },

  async deleteCloser(id: string): Promise<void> {
    const uid = await requireUser();
    const db = requireDb();
    let current = getCachedData<Closer[]>('closers', []);
    try {
      const snapshot = await getDocs(query(collection(db, 'closers'), where('userId', '==', uid)));
      current = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Closer));
    } catch (error) {
      console.warn('Using cached closer state after fresh closer read failed:', error);
    }
    const removed = current.find(c => c.id === id);
    const remaining = current.filter(c => c.id !== id);
    const existingDefault = remaining.find(c => c.active && c.default);
    const fallback = existingDefault || remaining.find(c => c.active);
    const next = remaining.map(c => ({ ...c, default: Boolean(fallback && c.id === fallback.id && c.active) }));
    setCachedData('closers', next);
    notifyCollectionListeners('closers', next);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'closers', id));
      next.forEach(c => {
        const previous = current.find(existingCloser => existingCloser.id === c.id);
        if (previous && previous.default !== c.default) {
          batch.set(doc(db, 'closers', c.id), { default: c.default, userId: uid, updatedAt: serverTimestamp() }, { merge: true });
        }
      });
      await batch.commit();
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
