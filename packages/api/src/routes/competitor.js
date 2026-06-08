import { Router } from 'express';
import { db } from '../lib/firebase.js';
import { getAppDetails, searchApps } from '../services/playstore.js';
import { getKeywordScores } from '../services/keywords.js';
import { calculateAsoScore, compareApps } from '../services/scoring.js';

const router = Router();

// GET /api/competitor/compare?appId=&competitorId=&country=
router.get('/compare', async (req, res) => {
  try {
    const { appId, competitorId, country = 'us' } = req.query;
    if (!appId || !competitorId) return res.status(400).json({ success: false, error: 'appId and competitorId required' });

    const [appData, competitorData] = await Promise.all([
      getAppDetails(appId, country),
      getAppDetails(competitorId, country),
    ]);

    const comparison = compareApps(appData, competitorData);

    // Save analysis
    await db.collection('competitor_analysis').add({
      appId,
      competitorId,
      scores: comparison,
      runAt: new Date(),
      owner: req.user.uid,
    });

    res.json({
      success: true,
      data: {
        app: appData,
        competitor: competitorData,
        comparison,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/competitor/keyword-gap?appId=&competitorId=
router.get('/keyword-gap', async (req, res) => {
  try {
    const { appId, competitorId, country = 'us' } = req.query;
    if (!appId || !competitorId) return res.status(400).json({ success: false, error: 'appId and competitorId required' });

    const [competitorData] = await Promise.all([getAppDetails(competitorId, country)]);

    // Extract keywords from competitor title + description
    const text = `${competitorData.title || ''} ${competitorData.summary || ''} ${competitorData.description || ''}`;
    const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
    const wordFreq = {};
    words.forEach((w) => { wordFreq[w] = (wordFreq[w] || 0) + 1; });

    // Filter stopwords and get top keywords
    const stopwords = new Set(['the', 'and', 'for', 'are', 'with', 'your', 'you', 'this', 'that', 'from', 'have', 'can', 'will', 'app', 'all', 'any']);
    const candidateKeywords = Object.entries(wordFreq)
      .filter(([w]) => !stopwords.has(w) && w.length > 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([w]) => w);

    // Check appId rank vs competitor for each keyword
    const gapAnalysis = [];
    for (const keyword of candidateKeywords) {
      try {
        const [appSearch, compSearch] = await Promise.all([
          searchApps(keyword, country, 50),
          Promise.resolve(null),
        ]);
        const appPos = appSearch.findIndex((r) => r.appId === appId);
        const compPos = appSearch.findIndex((r) => r.appId === competitorId);
        gapAnalysis.push({
          keyword,
          appPosition: appPos === -1 ? null : appPos + 1,
          competitorPosition: compPos === -1 ? null : compPos + 1,
          gap: appPos === -1 ? 'not ranking' : compPos === -1 ? 'you rank, they dont' : appPos > compPos ? 'competitor leads' : 'you lead',
        });
      } catch {
        // skip keyword on error
      }
    }

    res.json({ success: true, data: gapAnalysis });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/competitor/aso-score?appId=
router.get('/aso-score', async (req, res) => {
  try {
    const { appId, keyword = '', country = 'us' } = req.query;
    if (!appId) return res.status(400).json({ success: false, error: 'appId required' });

    const appData = await getAppDetails(appId, country);
    const score = calculateAsoScore(appData, keyword);

    res.json({ success: true, data: score });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
