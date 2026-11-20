import { useCallback, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
} from '../firebase';
import type { FoodAnalysis, FoodScanRecord } from '../types';

const LOCAL_STORAGE_KEY = 'foodsnap_local_scans_v1';

function generateScanId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `scan_${Date.now()}_${rand}`;
}

function loadLocalScans(): FoodScanRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is FoodScanRecord =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.id === 'string' &&
        typeof item.foodName === 'string',
    );
  } catch {
    return [];
  }
}

function saveLocalScans(scans: FoodScanRecord[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(scans.slice(0, 40)));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

function sanitizeAnalysisPayload(
  analysis: FoodAnalysis,
  thumbnailDataUrl: string,
  scanId: string,
  userId: string,
) {
  const clamp = (n: number, max: number) =>
    Math.round(Math.min(max, Math.max(0, Number.isFinite(n) ? n : 0)));

  const ingredients = (analysis.ingredients || [])
    .map((item) => item.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 25);

  const healthHighlights = (analysis.healthHighlights || [])
    .map((item) => item.trim().slice(0, 160))
    .filter(Boolean)
    .slice(0, 8);

  return {
    id: scanId.slice(0, 128),
    userId: userId.slice(0, 128),
    foodName: (analysis.foodName || 'Identified Dish').trim().slice(0, 140),
    cuisineOrCategory: (analysis.cuisineOrCategory || 'Meal').trim().slice(0, 80),
    description: (analysis.description || 'Food scan result.').trim().slice(0, 800),
    servingSize: (analysis.servingSize || '1 serving').trim().slice(0, 80),
    calories: clamp(analysis.calories, 10000),
    proteinGrams: clamp(analysis.proteinGrams, 1000),
    carbsGrams: clamp(analysis.carbsGrams, 1000),
    fatGrams: clamp(analysis.fatGrams, 1000),
    fiberGrams: clamp(analysis.fiberGrams, 500),
    ingredients: ingredients.length > 0 ? ingredients : ['Mixed fresh ingredients'],
    healthHighlights,
    thumbnailDataUrl: thumbnailDataUrl.slice(0, 180000),
    createdAt: serverTimestamp(),
  };
}

export function useScanHistory() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [cloudScans, setCloudScans] = useState<FoodScanRecord[]>([]);
  const [localScans, setLocalScans] = useState<FoodScanRecord[]>(() => loadLocalScans());
  const [historyLoading, setHistoryLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);

      if (nextUser) {
        const userDocPath = `users/${nextUser.uid}`;
        try {
          const userRef = doc(db, 'users', nextUser.uid);
          const snap = await getDoc(userRef);
          const profilePayload = {
            uid: nextUser.uid,
            displayName: (nextUser.displayName || 'FoodSnap User').slice(0, 120),
            ...(nextUser.photoURL ? { photoUrl: nextUser.photoURL.slice(0, 500) } : {}),
            ...(snap.exists()
              ? { createdAt: snap.data().createdAt }
              : { createdAt: serverTimestamp() }),
          };
          await setDoc(userRef, profilePayload, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, userDocPath);
        }

        // Migrate any guest local scans up to Firestore upon sign-in
        const pendingLocal = loadLocalScans();
        if (pendingLocal.length > 0) {
          try {
            const batch = writeBatch(db);
            for (const item of pendingLocal.slice(0, 20)) {
              const safeId = /^[a-zA-Z0-9_\-]+$/.test(item.id) ? item.id : generateScanId();
              const ref = doc(db, 'foodScans', safeId);
              batch.set(
                ref,
                sanitizeAnalysisPayload(item, item.thumbnailDataUrl || '', safeId, nextUser.uid),
              );
            }
            await batch.commit();
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            setLocalScans([]);
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, 'foodScans');
          }
        }
      } else {
        setCloudScans([]);
        setHistoryLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setHistoryLoading(false);
      return;
    }

    setHistoryLoading(true);
    const collectionPath = 'foodScans';
    const q = query(collection(db, collectionPath), where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const records: FoodScanRecord[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const createdTs = d.createdAt as { toMillis?: () => number } | undefined;
          return {
            id: docSnap.id,
            userId: typeof d.userId === 'string' ? d.userId : user.uid,
            foodName: typeof d.foodName === 'string' ? d.foodName : 'Food Scan',
            cuisineOrCategory: typeof d.cuisineOrCategory === 'string' ? d.cuisineOrCategory : 'Meal',
            description: typeof d.description === 'string' ? d.description : '',
            servingSize: typeof d.servingSize === 'string' ? d.servingSize : '1 serving',
            calories: typeof d.calories === 'number' ? d.calories : 0,
            proteinGrams: typeof d.proteinGrams === 'number' ? d.proteinGrams : 0,
            carbsGrams: typeof d.carbsGrams === 'number' ? d.carbsGrams : 0,
            fatGrams: typeof d.fatGrams === 'number' ? d.fatGrams : 0,
            fiberGrams: typeof d.fiberGrams === 'number' ? d.fiberGrams : 0,
            ingredients: Array.isArray(d.ingredients) ? d.ingredients : [],
            healthHighlights: Array.isArray(d.healthHighlights) ? d.healthHighlights : [],
            thumbnailDataUrl: typeof d.thumbnailDataUrl === 'string' ? d.thumbnailDataUrl : '',
            createdAtMs: createdTs?.toMillis ? createdTs.toMillis() : Date.now(),
            source: 'cloud',
          };
        });
        records.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setCloudScans(records);
        setHistoryLoading(false);
      },
      (err) => {
        setHistoryLoading(false);
        handleFirestoreError(err, OperationType.LIST, collectionPath);
      },
    );

    return () => unsubscribe();
  }, [authReady, user]);

  const saveScan = useCallback(
    async (analysis: FoodAnalysis, thumbnailDataUrl: string): Promise<FoodScanRecord> => {
      const id = generateScanId();
      const nowMs = Date.now();

      if (user) {
        const docPath = `foodScans/${id}`;
        const payload = sanitizeAnalysisPayload(analysis, thumbnailDataUrl, id, user.uid);
        try {
          await setDoc(doc(db, 'foodScans', id), payload);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, docPath);
        }
        return {
          ...analysis,
          id,
          userId: user.uid,
          thumbnailDataUrl: payload.thumbnailDataUrl,
          createdAtMs: nowMs,
          source: 'cloud',
        };
      }

      const localRecord: FoodScanRecord = {
        ...analysis,
        id,
        thumbnailDataUrl: thumbnailDataUrl.slice(0, 180000),
        createdAtMs: nowMs,
        source: 'local',
      };
      setLocalScans((prev) => {
        const next = [localRecord, ...prev];
        saveLocalScans(next);
        return next;
      });
      return localRecord;
    },
    [user],
  );

  const deleteScan = useCallback(
    async (scanId: string): Promise<void> => {
      if (user) {
        const docPath = `foodScans/${scanId}`;
        try {
          await deleteDoc(doc(db, 'foodScans', scanId));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, docPath);
        }
        return;
      }

      setLocalScans((prev) => {
        const next = prev.filter((item) => item.id !== scanId);
        saveLocalScans(next);
        return next;
      });
    },
    [user],
  );

  const clearAllHistory = useCallback(async (): Promise<void> => {
    if (user) {
      if (cloudScans.length === 0) return;
      try {
        const batch = writeBatch(db);
        for (const scan of cloudScans) {
          batch.delete(doc(db, 'foodScans', scan.id));
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'foodScans');
      }
      return;
    }

    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setLocalScans([]);
  }, [user, cloudScans]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    setAuthBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to sign in with Google.';
      if (!message.includes('popup-closed-by-user')) {
        setAuthError(message);
      }
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setAuthError(null);
    setAuthBusy(true);
    try {
      await signOut(auth);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to sign out.');
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const scans = user ? cloudScans : localScans;

  return {
    user,
    authReady,
    authBusy,
    authError,
    scans,
    historyLoading,
    saveScan,
    deleteScan,
    clearAllHistory,
    signInWithGoogle,
    signOutUser,
  };
}
