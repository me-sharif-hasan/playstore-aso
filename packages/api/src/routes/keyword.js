import { Router } from 'express';
import { db } from '../lib/firebase.js';
import { getKeywordRankWithCompetitors } from '../services/playstore.js';
import { getKeywordScores, getKeywordSuggestions, bulkKeywordScores } from '../services/keywords.js';

async function fetchInitialRank(kwId, appId, keyword, country) {
  try {
    const appDoc = await db.collection('apps').doc(appId).get();
    const competitors = appDoc.exists ? (appDoc.data().competitors || []) : [];
    const result = await getKeywordRankWithCompetitors(appId, keyword, competitors, country);
    await db.collection('keyword_snapshots').add({
      keywordId: kwId, appId,
      position: result.position,
      date: new Date(), country,
      competitor_positions: result.competitor_positions,
    });
    await db.collection('keywords').doc(kwId).update({
      position: result.position,
      competitor_positions: result.competitor_positions,
      lastChecked: new Date(),
    });
    return result;
  } catch (e) {
    console.error('[rank] Initial rank fetch failed:', e.message);
    return null;
  }
}

const router = Router();

// ── Keyword research (static routes FIRST — must be before /:appId) ──────────

// GET /api/keyword/scores?keyword=&country=
router.get('/scores', async (req, res) => {
  try {
    const { keyword, country = 'us' } = req.query;
    if (!keyword) return res.status(400).json({ success: false, error: 'keyword required' });
    const data = await getKeywordScores(keyword, country);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/keyword/suggest?keyword=&appId=&country=
router.get('/suggest', async (req, res) => {
  try {
    const { keyword, appId, country = 'us' } = req.query;
    if (!keyword || !appId) return res.status(400).json({ success: false, error: 'keyword and appId required' });
    const data = await getKeywordSuggestions(keyword, appId, country);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/keyword/volume?keyword=&country=
router.get('/volume', async (req, res) => {
  try {
    const { keyword, country = 'us' } = req.query;
    if (!keyword) return res.status(400).json({ success: false, error: 'keyword required' });
    const scores = await getKeywordScores(keyword, country);
    res.json({ success: true, data: { keyword, country, traffic: scores.traffic } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/keyword/difficulty?keyword=&country=
router.get('/difficulty', async (req, res) => {
  try {
    const { keyword, country = 'us' } = req.query;
    if (!keyword) return res.status(400).json({ success: false, error: 'keyword required' });
    const scores = await getKeywordScores(keyword, country);
    res.json({ success: true, data: { keyword, country, difficulty: scores.difficulty } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/keyword/bulk-scores
router.post('/bulk-scores', async (req, res) => {
  try {
    const { keywords, country = 'us', appId } = req.body;
    if (!keywords || !Array.isArray(keywords)) return res.status(400).json({ success: false, error: 'keywords array required' });
    const data = await bulkKeywordScores(keywords, country);

    // If appId provided, persist scores back to keyword docs
    if (appId) {
      const snap = await db.collection('keywords')
        .where('appId', '==', appId)
        .where('owner', '==', req.user.uid)
        .get();
      const batch = db.batch();
      snap.docs.forEach((doc) => {
        const kw = doc.data();
        const score = data.find((s) => s.keyword === kw.keyword);
        if (score && !score.error) {
          batch.update(doc.ref, { difficulty: score.difficulty, traffic: score.traffic });
        }
      });
      await batch.commit();
    }

    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Keyword tracking (dynamic routes AFTER static) ────────────────────────────

// GET /api/keywords/:appId — list tracked keywords
router.get('/:appId', async (req, res) => {
  try {
    const { appId } = req.params;
    const snap = await db.collection('keywords')
      .where('appId', '==', appId)
      .where('owner', '==', req.user.uid)
      .get();
    const keywords = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ success: true, data: keywords });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/keywords — track keyword (fetches scores + initial rank)
router.post('/', async (req, res) => {
  try {
    const { appId, keyword, country = 'us', lang = 'en' } = req.body;
    if (!appId || !keyword) return res.status(400).json({ success: false, error: 'appId and keyword required' });

    let difficulty = null, traffic = null;
    try {
      const scores = await getKeywordScores(keyword, country);
      difficulty = scores.difficulty;
      traffic = scores.traffic;
    } catch { /* non-fatal */ }

    const ref = await db.collection('keywords').add({
      appId, keyword, country, lang,
      difficulty, traffic,
      position: null, competitor_positions: {},
      owner: req.user.uid,
      createdAt: new Date(),
    });

    // Respond immediately, fetch rank in background
    res.json({ success: true, data: { id: ref.id, appId, keyword, country, difficulty, traffic } });

    // Non-blocking initial rank fetch
    fetchInitialRank(ref.id, appId, keyword, country);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/keywords/bookmark — save keyword without rank tracking
router.post('/bookmark', async (req, res) => {
  try {
    const { keyword, country = 'us', difficulty, traffic } = req.body;
    if (!keyword) return res.status(400).json({ success: false, error: 'keyword required' });

    const ref = await db.collection('keyword_bookmarks').add({
      keyword, country, difficulty, traffic,
      owner: req.user.uid,
      createdAt: new Date(),
    });
    res.json({ success: true, data: { id: ref.id, keyword, country } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/keywords/bookmarks — list bookmarks
router.get('/bookmarks', async (req, res) => {
  try {
    const snap = await db.collection('keyword_bookmarks')
      .where('owner', '==', req.user.uid)
      .get();
    res.json({ success: true, data: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/keywords/bookmark/:id
router.delete('/bookmark/:id', async (req, res) => {
  try {
    const doc = await db.collection('keyword_bookmarks').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'Not found' });
    if (doc.data().owner !== req.user.uid) return res.status(403).json({ success: false, error: 'Forbidden' });
    await doc.ref.delete();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/keywords/:kwId
router.delete('/:kwId', async (req, res) => {
  try {
    const { kwId } = req.params;
    const doc = await db.collection('keywords').doc(kwId).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'Keyword not found' });
    if (doc.data().owner !== req.user.uid) return res.status(403).json({ success: false, error: 'Forbidden' });
    await db.collection('keywords').doc(kwId).delete();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/keywords/:kwId/rank
router.get('/:kwId/rank', async (req, res) => {
  try {
    const { kwId } = req.params;
    const { country } = req.query;
    const doc = await db.collection('keywords').doc(kwId).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'Keyword not found' });
    const kw = doc.data();
    if (kw.owner !== req.user.uid) return res.status(403).json({ success: false, error: 'Forbidden' });

    const appDoc = await db.collection('apps').doc(kw.appId).get();
    const competitors = appDoc.exists ? (appDoc.data().competitors || []) : [];

    const result = await getKeywordRankWithCompetitors(
      kw.appId, kw.keyword, competitors, country || kw.country || 'us'
    );

    await db.collection('keyword_snapshots').add({
      keywordId: kwId,
      appId: kw.appId,
      position: result.position,
      date: new Date(),
      country: country || kw.country || 'us',
      competitor_positions: result.competitor_positions,
    });

    res.json({ success: true, data: { ...result, keyword: kw.keyword, appId: kw.appId } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/keywords/:kwId/history
router.get('/:kwId/history', async (req, res) => {
  try {
    const { kwId } = req.params;
    const days = parseInt(req.query.days || '30', 10);
    const doc = await db.collection('keywords').doc(kwId).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'Keyword not found' });
    if (doc.data().owner !== req.user.uid) return res.status(403).json({ success: false, error: 'Forbidden' });

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const snap = await db.collection('keyword_snapshots')
      .where('keywordId', '==', kwId)
      .where('date', '>=', since)
      .orderBy('date', 'desc')
      .get();

    res.json({ success: true, data: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/keywords/:kwId/competitor-ranks
router.get('/:kwId/competitor-ranks', async (req, res) => {
  try {
    const { kwId } = req.params;
    const doc = await db.collection('keywords').doc(kwId).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'Keyword not found' });
    const kw = doc.data();
    if (kw.owner !== req.user.uid) return res.status(403).json({ success: false, error: 'Forbidden' });

    const appDoc = await db.collection('apps').doc(kw.appId).get();
    const competitors = appDoc.exists ? (appDoc.data().competitors || []) : [];
    const result = await getKeywordRankWithCompetitors(kw.appId, kw.keyword, competitors, kw.country || 'us');
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
