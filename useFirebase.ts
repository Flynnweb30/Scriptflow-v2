import { useState, useCallback } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';

export const useFirebase = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleError = (error: unknown) => {
    console.error('Firebase operation error:', error);
    setError(error instanceof Error ? error.message : 'An error occurred');
    throw error;
  };

  const createDocument = useCallback(async (
    collectionName: string,
    data: Record<string, any>
  ) => {
    if (!user) throw new Error('User must be authenticated');
    setLoading(true);
    setError(null);
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName || user.email,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setLoading(false);
      return { id: docRef.id, ...data };
    } catch (err) {
      setLoading(false);
      return handleError(err);
    }
  }, [user]);

  const readDocuments = useCallback(async (
    collectionName: string,
    constraints: QueryConstraint[] = []
  ) => {
    if (!user) throw new Error('User must be authenticated');
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, collectionName),
        where('userId', '==', user.uid),
        ...constraints
      );
      const querySnapshot = await getDocs(q);
      const documents = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setLoading(false);
      return documents;
    } catch (err) {
      setLoading(false);
      return handleError(err);
    }
  }, [user]);

  const readDocument = useCallback(async (
    collectionName: string,
    documentId: string
  ) => {
    if (!user) throw new Error('User must be authenticated');
    setLoading(true);
    setError(null);
    try {
      const docRef = doc(db, collectionName, documentId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.userId !== user.uid) {
          throw new Error('Unauthorized access');
        }
        setLoading(false);
        return { id: docSnap.id, ...data };
      }
      setLoading(false);
      return null;
    } catch (err) {
      setLoading(false);
      return handleError(err);
    }
  }, [user]);

  const updateDocument = useCallback(async (
    collectionName: string,
    documentId: string,
    data: Record<string, any>
  ) => {
    if (!user) throw new Error('User must be authenticated');
    setLoading(true);
    setError(null);
    try {
      const docRef = doc(db, collectionName, documentId);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date().toISOString(),
      });
      setLoading(false);
      return { id: documentId, ...data };
    } catch (err) {
      setLoading(false);
      return handleError(err);
    }
  }, [user]);

  const deleteDocument = useCallback(async (
    collectionName: string,
    documentId: string
  ) => {
    if (!user) throw new Error('User must be authenticated');
    setLoading(true);
    setError(null);
    try {
      const docRef = doc(db, collectionName, documentId);
      await deleteDoc(docRef);
      setLoading(false);
      return true;
    } catch (err) {
      setLoading(false);
      return handleError(err);
    }
  }, [user]);

  return {
    loading,
    error,
    createDocument,
    readDocuments,
    readDocument,
    updateDocument,
    deleteDocument,
  };
};

export default useFirebase;