import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase.js';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';

export function useKeywords(appId) {
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!appId) { setLoading(false); return; }
    const uid = auth.currentUser?.uid;
    if (!uid) { setLoading(false); return; }

    setLoading(true);
    const q = query(
      collection(db, 'keywords'),
      where('appId', '==', appId),
      where('owner', '==', uid)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setKeywords(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[useKeywords] Firestore error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsub;
  }, [appId]);

  return { keywords, loading, error };
}

export function useKeywordSnapshots(appId) {
  const [snapshots, setSnapshots] = useState([]);

  useEffect(() => {
    if (!appId) return;

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const q = query(
      collection(db, 'keyword_snapshots'),
      where('appId', '==', appId),
      where('date', '>=', cutoff),
      orderBy('date', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => { setSnapshots(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); },
      (err) => { console.error('[useKeywordSnapshots] Firestore error:', err); }
    );

    return unsub;
  }, [appId]);

  return snapshots;
}
