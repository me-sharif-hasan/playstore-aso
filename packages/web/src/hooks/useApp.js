import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase.js';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export function useTrackedApps() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setLoading(false); return; }

    const q = query(collection(db, 'apps'), where('owner', '==', uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setApps(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('[useTrackedApps] Firestore error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsub;
  }, []);

  return { apps, loading, error };
}
