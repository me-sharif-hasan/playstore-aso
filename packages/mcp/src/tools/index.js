import fetch from 'node-fetch';
import { db } from '../lib/firebase.js';

const API_BASE = process.env.MCP_API_BASE_URL || 'http://localhost:3001/api';

async function apiGet(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'API error');
  return json.data;
}

async function apiPost(path, body = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'API error');
  return json.data;
}

export const TOOL_DEFINITIONS = [
  {
    name: 'get_app_details',
    description: 'Fetch full app metadata from Google Play Store',
    inputSchema: {
      type: 'object',
      properties: {
        api_key: { type: 'string', description: 'MCP API key' },
        appId: { type: 'string', description: 'App package name (e.g. com.example.app)' },
        country: { type: 'string', description: 'Country code (default: us)' },
      },
      required: ['api_key', 'appId'],
    },
  },
  {
    name: 'get_aso_score',
    description: 'Calculate ASO score 0-100 for app + keyword combination',
    inputSchema: {
      type: 'object',
      properties: {
        api_key: { type: 'string' },
        appId: { type: 'string' },
        keyword: { type: 'string' },
        country: { type: 'string' },
      },
      required: ['api_key', 'appId', 'keyword'],
    },
  },
  {
    name: 'get_keyword_rank',
    description: 'Get app position for a keyword in Play Store search (live)',
    inputSchema: {
      type: 'object',
      properties: {
        api_key: { type: 'string' },
        appId: { type: 'string' },
        keyword: { type: 'string' },
        country: { type: 'string' },
      },
      required: ['api_key', 'appId', 'keyword'],
    },
  },
  {
    name: 'get_keyword_rank_history',
    description: 'Get historical rank snapshots for app + keyword',
    inputSchema: {
      type: 'object',
      properties: {
        api_key: { type: 'string' },
        appId: { type: 'string' },
        keyword: { type: 'string' },
        days: { type: 'number', description: 'Days of history (default: 30)' },
      },
      required: ['api_key', 'appId', 'keyword'],
    },
  },
  {
    name: 'get_keyword_scores',
    description: 'Get difficulty and traffic scores for a keyword (0-100 each)',
    inputSchema: {
      type: 'object',
      properties: {
        api_key: { type: 'string' },
        keyword: { type: 'string' },
        country: { type: 'string' },
      },
      required: ['api_key', 'keyword'],
    },
  },
  {
    name: 'get_keyword_suggestions',
    description: 'Get keyword suggestions based on autocomplete and competitor analysis',
    inputSchema: {
      type: 'object',
      properties: {
        api_key: { type: 'string' },
        keyword: { type: 'string' },
        appId: { type: 'string' },
        country: { type: 'string' },
      },
      required: ['api_key', 'keyword', 'appId'],
    },
  },
  {
    name: 'bulk_keyword_scores',
    description: 'Get difficulty and traffic scores for multiple keywords at once',
    inputSchema: {
      type: 'object',
      properties: {
        api_key: { type: 'string' },
        keywords: { type: 'array', items: { type: 'string' } },
        country: { type: 'string' },
      },
      required: ['api_key', 'keywords'],
    },
  },
  {
    name: 'compare_competitors',
    description: 'Full side-by-side comparison of two apps across all metrics',
    inputSchema: {
      type: 'object',
      properties: {
        api_key: { type: 'string' },
        appId: { type: 'string' },
        competitorId: { type: 'string' },
        country: { type: 'string' },
      },
      required: ['api_key', 'appId', 'competitorId'],
    },
  },
  {
    name: 'get_keyword_gap',
    description: 'Find keywords competitor ranks for that appId does not rank for',
    inputSchema: {
      type: 'object',
      properties: {
        api_key: { type: 'string' },
        appId: { type: 'string' },
        competitorId: { type: 'string' },
      },
      required: ['api_key', 'appId', 'competitorId'],
    },
  },
  {
    name: 'search_apps',
    description: 'Search Play Store and return ranked results',
    inputSchema: {
      type: 'object',
      properties: {
        api_key: { type: 'string' },
        term: { type: 'string' },
        country: { type: 'string' },
      },
      required: ['api_key', 'term'],
    },
  },
  {
    name: 'add_tracked_keyword',
    description: 'Add a keyword to tracking in Firestore',
    inputSchema: {
      type: 'object',
      properties: {
        api_key: { type: 'string' },
        appId: { type: 'string' },
        keyword: { type: 'string' },
        country: { type: 'string' },
      },
      required: ['api_key', 'appId', 'keyword'],
    },
  },
  {
    name: 'list_tracked_keywords',
    description: 'List all tracked keywords with latest positions',
    inputSchema: {
      type: 'object',
      properties: {
        api_key: { type: 'string' },
        appId: { type: 'string' },
      },
      required: ['api_key', 'appId'],
    },
  },
  {
    name: 'add_competitor',
    description: 'Add a competitor app to track',
    inputSchema: {
      type: 'object',
      properties: {
        api_key: { type: 'string' },
        appId: { type: 'string' },
        competitorId: { type: 'string' },
      },
      required: ['api_key', 'appId', 'competitorId'],
    },
  },
  {
    name: 'list_competitors',
    description: 'List competitors with latest comparison data',
    inputSchema: {
      type: 'object',
      properties: {
        api_key: { type: 'string' },
        appId: { type: 'string' },
      },
      required: ['api_key', 'appId'],
    },
  },
  {
    name: 'get_tracked_keywords_export',
    description: 'Export all tracked keywords with positions, difficulty, traffic, and rank history for an app',
    inputSchema: {
      type: 'object',
      properties: {
        api_key: { type: 'string' },
        appId: { type: 'string' },
        include_history: { type: 'boolean', description: 'Include last 30 days rank history per keyword (default: false)' },
      },
      required: ['api_key', 'appId'],
    },
  },
  {
    name: 'get_aso_health_overview',
    description: 'Full ASO health report: score, keyword positions, top issues, recommendations',
    inputSchema: {
      type: 'object',
      properties: {
        api_key: { type: 'string' },
        appId: { type: 'string' },
      },
      required: ['api_key', 'appId'],
    },
  },
];

export const toolHandlers = {
  get_app_details: async ({ appId, country }) => {
    const data = await apiGet(`/app/${appId}`, { country });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },

  get_aso_score: async ({ appId, keyword, country }) => {
    const data = await apiGet('/competitor/aso-score', { appId, keyword, country });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },

  get_keyword_rank: async ({ appId, keyword, country }) => {
    // Direct service call - search and find position
    const gplay = (await import('google-play-scraper')).default;
    const results = await gplay.search({ term: keyword, num: 250, country: country || 'us', fullDetail: false });
    const index = results.findIndex((a) => a.appId === appId);
    const position = index === -1 ? null : index + 1;
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ appId, keyword, country, position, found: position !== null }, null, 2),
      }],
    };
  },

  get_keyword_rank_history: async ({ appId, keyword, days = 30 }) => {
    const snap = await db.collection('keyword_snapshots')
      .where('appId', '==', appId)
      .where('date', '>=', new Date(Date.now() - days * 24 * 60 * 60 * 1000))
      .orderBy('date', 'desc')
      .get();
    const history = snap.docs.map((d) => d.data());
    return { content: [{ type: 'text', text: JSON.stringify(history, null, 2) }] };
  },

  get_keyword_scores: async ({ keyword, country }) => {
    const { getKeywordScores } = await import('../../../api/src/services/keywords.js').catch(() => null) || {};
    // Fallback: call API directly
    const data = await apiGet('/keyword/scores', { keyword, country });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },

  get_keyword_suggestions: async ({ keyword, appId, country }) => {
    const data = await apiGet('/keyword/suggest', { keyword, appId, country });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },

  bulk_keyword_scores: async ({ keywords, country }) => {
    const data = await apiPost('/keyword/bulk-scores', { keywords, country });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },

  compare_competitors: async ({ appId, competitorId, country }) => {
    const data = await apiGet('/competitor/compare', { appId, competitorId, country });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },

  get_keyword_gap: async ({ appId, competitorId }) => {
    const data = await apiGet('/competitor/keyword-gap', { appId, competitorId });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },

  search_apps: async ({ term, country }) => {
    const gplay = (await import('google-play-scraper')).default;
    const results = await gplay.search({ term, num: 20, country: country || 'us', fullDetail: false });
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  },

  add_tracked_keyword: async ({ appId, keyword, country = 'us' }) => {
    const ref = await db.collection('keywords').add({
      appId, keyword, country,
      createdAt: new Date(),
      owner: 'mcp',
    });
    return { content: [{ type: 'text', text: JSON.stringify({ id: ref.id, appId, keyword, country }) }] };
  },

  list_tracked_keywords: async ({ appId }) => {
    const snap = await db.collection('keywords').where('appId', '==', appId).get();
    const keywords = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { content: [{ type: 'text', text: JSON.stringify(keywords, null, 2) }] };
  },

  add_competitor: async ({ appId, competitorId }) => {
    const { FieldValue } = await import('firebase-admin/firestore');
    const ref = db.collection('apps').doc(appId);
    const doc = await ref.get();
    if (!doc.exists) {
      await ref.set({ appId, competitors: [competitorId], createdAt: new Date() });
    } else {
      await ref.update({ competitors: FieldValue.arrayUnion(competitorId) });
    }
    return { content: [{ type: 'text', text: JSON.stringify({ appId, competitorId, added: true }) }] };
  },

  list_competitors: async ({ appId }) => {
    const doc = await db.collection('apps').doc(appId).get();
    const competitors = doc.exists ? (doc.data().competitors || []) : [];
    return { content: [{ type: 'text', text: JSON.stringify({ appId, competitors }, null, 2) }] };
  },

  get_tracked_keywords_export: async ({ appId, include_history = false }) => {
    const snap = await db.collection('keywords').where('appId', '==', appId).get();
    const keywords = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (include_history) {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      for (const kw of keywords) {
        const hSnap = await db.collection('keyword_snapshots')
          .where('keywordId', '==', kw.id)
          .where('date', '>=', since)
          .orderBy('date', 'desc')
          .get();
        kw.history = hSnap.docs.map((d) => {
          const data = d.data();
          return { date: data.date?.toDate?.()?.toISOString() || data.date, position: data.position };
        });
      }
    }

    const summary = {
      appId,
      total: keywords.length,
      ranked: keywords.filter((k) => k.position).length,
      top3: keywords.filter((k) => k.position && k.position <= 3).length,
      top10: keywords.filter((k) => k.position && k.position <= 10).length,
      avgPosition: keywords.filter((k) => k.position).length
        ? Math.round(keywords.filter((k) => k.position).reduce((s, k) => s + k.position, 0) / keywords.filter((k) => k.position).length)
        : null,
      keywords,
    };
    return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
  },

  get_aso_health_overview: async ({ appId }) => {
    const gplay = (await import('google-play-scraper')).default;
    const { calculateAsoScore } = await import('../../../api/src/services/scoring.js');

    const appData = await gplay.app({ appId, country: 'us' });
    const asoScore = calculateAsoScore(appData, '');

    const kwSnap = await db.collection('keywords').where('appId', '==', appId).get();
    const trackedKeywords = kwSnap.docs.map((d) => d.data());

    const issues = [];
    if (asoScore.breakdown.updateRecency < 60) issues.push('App not updated recently');
    if (asoScore.breakdown.screenshots < 80) issues.push('Insufficient screenshots');
    if (asoScore.breakdown.rating < 60) issues.push('Rating below average');
    if (asoScore.breakdown.reviewCount < 60) issues.push('Low review count');

    const report = {
      appId,
      title: appData.title,
      asoScore: asoScore.total,
      breakdown: asoScore.breakdown,
      trackedKeywords: trackedKeywords.length,
      issues,
      recommendations: issues.map((i) => `Fix: ${i}`),
    };

    return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
  },
};
