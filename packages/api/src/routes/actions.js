import { Router } from 'express';
import { db } from '../lib/firebase.js';
import { getAppDetails } from '../services/playstore.js';
import { getKeywordScores, getKeywordSuggestions, bulkKeywordScores } from '../services/keywords.js';
import { getKeywordRankWithCompetitors } from '../services/playstore.js';

const router = Router();

// GET /actions/app/:appId
router.get('/app/:appId', async (req, res) => {
  try {
    const data = await getAppDetails(req.params.appId, req.query.country || 'us');
    res.json({ success: true, data: { appId: data.appId, title: data.title, developer: data.developer, score: data.score, ratings: data.ratings, installs: data.installs, updated: data.updated, version: data.currentVersion, icon: data.icon } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /actions/keyword/scores?keyword=&country=
router.get('/keyword/scores', async (req, res) => {
  try {
    const { keyword, country = 'us' } = req.query;
    if (!keyword) return res.status(400).json({ success: false, error: 'keyword required' });
    const data = await getKeywordScores(keyword, country);
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /actions/keyword/suggest?keyword=&appId=&country=
router.get('/keyword/suggest', async (req, res) => {
  try {
    const { keyword, appId, country = 'us' } = req.query;
    if (!keyword || !appId) return res.status(400).json({ success: false, error: 'keyword and appId required' });
    const data = await getKeywordSuggestions(keyword, appId, country);
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST /actions/keyword/bulk-scores
router.post('/keyword/bulk-scores', async (req, res) => {
  try {
    const { keywords, country = 'us' } = req.body;
    if (!keywords?.length) return res.status(400).json({ success: false, error: 'keywords array required' });
    const data = await bulkKeywordScores(keywords.slice(0, 20), country);
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /actions/keyword/rank?appId=&keyword=&country=
router.get('/keyword/rank', async (req, res) => {
  try {
    const { appId, keyword, country = 'us' } = req.query;
    if (!appId || !keyword) return res.status(400).json({ success: false, error: 'appId and keyword required' });
    const result = await getKeywordRankWithCompetitors(appId, keyword, [], country);
    res.json({ success: true, data: { appId, keyword, country, position: result.position } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /actions/keywords/:appId — tracked keywords with positions
router.get('/keywords/:appId', async (req, res) => {
  try {
    const snap = await db.collection('keywords').where('appId', '==', req.params.appId).get();
    const data = snap.docs.map((d) => {
      const kw = d.data();
      return { keyword: kw.keyword, position: kw.position, difficulty: kw.difficulty, traffic: kw.traffic, country: kw.country, lastChecked: kw.lastChecked?.toDate?.()?.toISOString() };
    });
    res.json({ success: true, data, total: data.length, ranked: data.filter((k) => k.position).length });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /actions/competitor/compare?appId=&competitorId=&country=
router.get('/competitor/compare', async (req, res) => {
  try {
    const { appId, competitorId, country = 'us' } = req.query;
    if (!appId || !competitorId) return res.status(400).json({ success: false, error: 'appId and competitorId required' });
    const [app, comp] = await Promise.all([getAppDetails(appId, country), getAppDetails(competitorId, country)]);
    res.json({ success: true, data: {
      app: { appId: app.appId, title: app.title, score: app.score, ratings: app.ratings, installs: app.installs },
      competitor: { appId: comp.appId, title: comp.title, score: comp.score, ratings: comp.ratings, installs: comp.installs },
    }});
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

export default router;
