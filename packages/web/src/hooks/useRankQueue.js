import { useState, useEffect } from 'react';
import { db } from '../lib/firebase.js';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';

export function useRankQueue(appId) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!appId) { setItems([]); return; }
    const since = new Date(Date.now() - 30 * 60 * 1000); // last 30 min
    const q = query(
      collection(db, 'rank_queue'),
      where('appId', '==', appId),
      where('createdAt', '>=', since),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, console.error);
    return unsub;
  }, [appId]);

  const active = items.filter((i) => i.status === 'pending' || i.status === 'processing');
  const done = items.filter((i) => i.status === 'done' || i.status === 'error');

  return { items, active, done };
}
