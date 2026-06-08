import { auth } from './firebase.js';

const BASE = '/api';

async function getToken() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

async function request(method, path, body) {
  const token = await getToken();
  const url = `${BASE}${path}`;
  console.log(`[api] ${method} ${url}`, body || '');
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  console.log(`[api] ${method} ${url} → ${res.status}`);
  const json = await res.json();
  if (!json.success) {
    console.error(`[api] error:`, json);
    throw new Error(json.error || 'Request failed');
  }
  return json.data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  delete: (path) => request('DELETE', path),

  app: {
    search: (term, country = 'us') => request('GET', `/app/search?term=${encodeURIComponent(term)}&country=${country}`),
    get: (appId, params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/app/${appId}${qs ? '?' + qs : ''}`);
    },
    add: (appId) => request('POST', '/app/add', { appId }),
    getCompetitors: (appId) => request('GET', `/app/${appId}/competitors`),
    addCompetitor: (appId, competitorId) => request('POST', `/app/${appId}/competitor`, { competitorId }),
    removeCompetitor: (appId, cId) => request('DELETE', `/app/${appId}/competitor/${cId}`),
  },

  keywords: {
    list: (appId) => request('GET', `/keywords/${appId}`),
    add: (data) => request('POST', '/keywords', data),
    remove: (kwId) => request('DELETE', `/keywords/${kwId}`),
    rank: (kwId, params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/keywords/${kwId}/rank${qs ? '?' + qs : ''}`);
    },
    history: (kwId, days = 30) => request('GET', `/keywords/${kwId}/history?days=${days}`),
    competitorRanks: (kwId) => request('GET', `/keywords/${kwId}/competitor-ranks`),
  },

  keyword: {
    scores: (keyword, country = 'us') => request('GET', `/keyword/scores?keyword=${encodeURIComponent(keyword)}&country=${country}`),
    suggest: (keyword, appId, country = 'us') => request('GET', `/keyword/suggest?keyword=${encodeURIComponent(keyword)}&appId=${appId}&country=${country}`),
    volume: (keyword, country = 'us') => request('GET', `/keyword/volume?keyword=${encodeURIComponent(keyword)}&country=${country}`),
    difficulty: (keyword, country = 'us') => request('GET', `/keyword/difficulty?keyword=${encodeURIComponent(keyword)}&country=${country}`),
    bulkScores: (keywords, country = 'us', appId) => request('POST', '/keyword/bulk-scores', { keywords, country, appId }),
  },

  competitor: {
    compare: (appId, competitorId, country = 'us') => request('GET', `/competitor/compare?appId=${appId}&competitorId=${competitorId}&country=${country}`),
    keywordGap: (appId, competitorId) => request('GET', `/competitor/keyword-gap?appId=${appId}&competitorId=${competitorId}`),
    asoScore: (appId, keyword = '') => request('GET', `/competitor/aso-score?appId=${appId}&keyword=${encodeURIComponent(keyword)}`),
  },

  aso: {
    health: (appId, keyword = '') => request('GET', `/aso/health?appId=${appId}&keyword=${encodeURIComponent(keyword)}`),
  },
};
