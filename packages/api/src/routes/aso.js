import { Router } from 'express';
import { getAppDetails } from '../services/playstore.js';
import { getKeywordScores, getKeywordSuggestions } from '../services/keywords.js';
import { calculateAsoScore } from '../services/scoring.js';
import { db } from '../lib/firebase.js';

const router = Router();

// GET /api/aso/health?appId=&keyword=
router.get('/health', async (req, res) => {
  try {
    const { appId, keyword = '', country = 'us' } = req.query;
    if (!appId) return res.status(400).json({ success: false, error: 'appId required' });

    const appData = await getAppDetails(appId, country);
    const asoScore = calculateAsoScore(appData, keyword);

    // Get tracked keywords with latest positions
    const kwSnap = await db.collection('keywords')
      .where('appId', '==', appId)
      .where('owner', '==', req.user.uid)
      .get();

    const keywords = kwSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Identify top issues
    const issues = [];
    if (asoScore.breakdown.titleKeyword < 100 && keyword) issues.push('Keyword not in title');
    if (asoScore.breakdown.shortDescDensity < 50) issues.push('Keyword underused in short description');
    if (asoScore.breakdown.descDensity < 50) issues.push('Keyword underused in description');
    if (asoScore.breakdown.rating < 60) issues.push('Rating below average');
    if (asoScore.breakdown.updateRecency < 60) issues.push('App not updated recently');
    if (asoScore.breakdown.screenshots < 80) issues.push('Need more screenshots (target: 8)');

    const recommendations = [];
    if (keyword && asoScore.breakdown.titleKeyword < 100) recommendations.push(`Add "${keyword}" to app title`);
    if (asoScore.breakdown.screenshots < 80) recommendations.push('Add more screenshots to reach 8');
    if (asoScore.breakdown.updateRecency < 60) recommendations.push('Update app within last 90 days');
    if (asoScore.breakdown.reviewCount < 80) recommendations.push('Encourage users to leave reviews');

    res.json({
      success: true,
      data: {
        appId,
        appData: { title: appData.title, icon: appData.icon, score: appData.score },
        asoScore,
        trackedKeywords: keywords,
        issues,
        recommendations,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
