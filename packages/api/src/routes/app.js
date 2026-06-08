import { Router } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../lib/firebase.js';
import { getAppDetails } from '../services/playstore.js';

const router = Router();

// GET /api/app/search?term=&country=  (must be before /:appId)
router.get('/search', async (req, res) => {
  try {
    const { term, country = 'us' } = req.query;
    if (!term) return res.status(400).json({ success: false, error: 'term required' });
    const { searchApps } = await import('../services/playstore.js');
    const results = await searchApps(term, country, 20);
    const data = results.map((a) => ({
      appId: a.appId,
      title: a.title,
      developer: a.developer,
      icon: a.icon,
      score: a.score,
      installs: a.installs,
    }));
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/app/:appId
router.get('/:appId', async (req, res) => {
  try {
    const { appId } = req.params;
    const { country = 'us', lang = 'en' } = req.query;
    const data = await getAppDetails(appId, country, lang);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/app/add
router.post('/add', async (req, res) => {
  try {
    const { appId } = req.body;
    if (!appId) return res.status(400).json({ success: false, error: 'appId required' });

    const appData = await getAppDetails(appId);

    const appRef = db.collection('apps').doc(appId);
    await appRef.set({
      appId,
      title: appData.title,
      icon: appData.icon,
      owner: req.user.uid,
      competitors: [],
      createdAt: new Date(),
      lastUpdated: new Date(),
    }, { merge: true });

    await db.collection('users').doc(req.user.uid).set(
      { apps: FieldValue.arrayUnion(appId) },
      { merge: true }
    );

    res.json({ success: true, data: { appId, title: appData.title } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/app/:appId/competitors
router.get('/:appId/competitors', async (req, res) => {
  try {
    const { appId } = req.params;
    const doc = await db.collection('apps').doc(appId).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'App not found' });

    const data = doc.data();
    if (data.owner !== req.user.uid) return res.status(403).json({ success: false, error: 'Forbidden' });

    res.json({ success: true, data: data.competitors || [] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/app/:appId/competitor
router.post('/:appId/competitor', async (req, res) => {
  try {
    const { appId } = req.params;
    const { competitorId } = req.body;
    if (!competitorId) return res.status(400).json({ success: false, error: 'competitorId required' });

    const appRef = db.collection('apps').doc(appId);
    const doc = await appRef.get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'App not found' });
    if (doc.data().owner !== req.user.uid) return res.status(403).json({ success: false, error: 'Forbidden' });

    await appRef.update({ competitors: FieldValue.arrayUnion(competitorId) });

    res.json({ success: true, data: { competitorId } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/app/:appId/competitor/:cId
router.delete('/:appId/competitor/:cId', async (req, res) => {
  try {
    const { appId, cId } = req.params;
    const appRef = db.collection('apps').doc(appId);
    const doc = await appRef.get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'App not found' });
    if (doc.data().owner !== req.user.uid) return res.status(403).json({ success: false, error: 'Forbidden' });

    await appRef.update({ competitors: FieldValue.arrayRemove(cId) });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
