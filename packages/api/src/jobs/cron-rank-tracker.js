import cron from 'node-cron';
import { db } from '../lib/firebase.js';
import { getKeywordRankWithCompetitors } from '../services/playstore.js';

// Runs daily at 02:00 UTC
export function startRankTracker() {
  cron.schedule('0 2 * * *', async () => {
    console.log('[cron] Starting daily rank snapshot job');

    try {
      const kwSnap = await db.collection('keywords').get();
      const keywords = kwSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      for (const kw of keywords) {
        try {
          const appDoc = await db.collection('apps').doc(kw.appId).get();
          const competitors = appDoc.exists ? (appDoc.data().competitors || []) : [];

          const result = await getKeywordRankWithCompetitors(
            kw.appId,
            kw.keyword,
            competitors,
            kw.country || 'us'
          );

          await db.collection('keyword_snapshots').add({
            keywordId: kw.id,
            appId: kw.appId,
            position: result.position,
            date: new Date(),
            country: kw.country || 'us',
            competitor_positions: result.competitor_positions,
          });

          console.log(`[cron] Snapshot saved: ${kw.keyword} → position ${result.position}`);

          // Throttle to avoid 503s
          await new Promise((r) => setTimeout(r, 1000));
        } catch (e) {
          console.error(`[cron] Error tracking keyword ${kw.keyword}:`, e.message);
        }
      }

      console.log('[cron] Daily rank snapshot job complete');
    } catch (e) {
      console.error('[cron] Job failed:', e.message);
    }
  }, { timezone: 'UTC' });

  console.log('[cron] Rank tracker scheduled: daily at 02:00 UTC');
}
