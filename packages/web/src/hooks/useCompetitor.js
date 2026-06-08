import { useState, useEffect } from 'react';
import { db } from '../lib/firebase.js';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';

export function useCompetitorAnalyses(appId) {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appId) { setLoading(false); return; }

    const q = query(
      collection(db, 'competitor_analysis'),
      where('appId', '==', appId),
      orderBy('runAt', 'desc'),
      limit(20)
    );

    const unsub = onSnapshot(q, (snap) => {
      setAnalyses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return unsub;
  }, [appId]);

  return { analyses, loading };
}
