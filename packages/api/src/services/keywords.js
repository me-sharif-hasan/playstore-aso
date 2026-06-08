import { db } from '../lib/firebase.js';
import { searchApps, getSuggest } from './playstore.js';
import crypto from 'crypto';

const SCORE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function scoreHash(keyword, country) {
  return crypto.createHash('md5').update(`${keyword}:${country}`).digest('hex');
}

async function getCachedScore(keyword, country) {
  const id = scoreHash(keyword, country);
  const doc = await db.collection('keyword_scores').doc(id).get();
  if (!doc.exists) return null;

  const data = doc.data();
  const age = Date.now() - data.calculatedAt.toMillis();
  if (age > SCORE_TTL_MS) return null;

  return data;
}

async function saveScore(keyword, country, scores) {
  const id = scoreHash(keyword, country);
  await db.collection('keyword_scores').doc(id).set({
    keyword,
    country,
    ...scores,
    calculatedAt: new Date(),
    ttl: new Date(Date.now() + SCORE_TTL_MS),
  });
}

export async function getKeywordScores(keyword, country = 'us') {
  const cached = await getCachedScore(keyword, country);
  if (cached) {
    return {
      keyword,
      country,
      difficulty: cached.difficulty,
      traffic: cached.traffic,
      suggest: cached.suggest,
      cached: true,
    };
  }

  const [searchResults, suggestions] = await Promise.all([
    searchApps(keyword, country, 10),
    getSuggest(keyword, country),
  ]);

  const difficulty = calculateDifficulty(searchResults);
  const traffic = calculateTraffic(searchResults, suggestions, keyword);

  const scores = { difficulty, traffic, suggest: suggestions.slice(0, 5) };
  await saveScore(keyword, country, scores);

  return { keyword, country, ...scores, cached: false };
}

function calculateDifficulty(top10Apps) {
  if (!top10Apps || top10Apps.length === 0) return 50;

  const apps = top10Apps.slice(0, 10);
  let score = 0;

  // High install counts = harder
  const avgInstalls = apps.reduce((sum, a) => {
    const installs = parseInstalls(a.installs || a.maxInstalls || '0');
    return sum + installs;
  }, 0) / apps.length;

  if (avgInstalls > 10_000_000) score += 30;
  else if (avgInstalls > 1_000_000) score += 20;
  else if (avgInstalls > 100_000) score += 10;

  // High review counts = harder
  const avgReviews = apps.reduce((sum, a) => sum + (a.reviews || 0), 0) / apps.length;
  if (avgReviews > 100_000) score += 25;
  else if (avgReviews > 10_000) score += 15;
  else if (avgReviews > 1_000) score += 8;

  // Apps with keyword in title = harder
  const keywordInTitle = apps.filter((a) =>
    a.title && a.title.toLowerCase().includes('')
  ).length;
  score += Math.min(keywordInTitle * 3, 20);

  // High average ratings = harder
  const avgRating = apps.reduce((sum, a) => sum + (a.score || 0), 0) / apps.length;
  if (avgRating > 4.5) score += 15;
  else if (avgRating > 4.0) score += 10;
  else if (avgRating > 3.5) score += 5;

  return Math.min(Math.round(score), 100);
}

function calculateTraffic(top10Apps, suggestions, keyword) {
  let score = 0;

  // Autocomplete position (if keyword appears in suggestions, it's popular)
  const suggestIndex = suggestions.findIndex(
    (s) => s.toLowerCase() === keyword.toLowerCase()
  );
  if (suggestIndex === 0) score += 30;
  else if (suggestIndex === 1) score += 25;
  else if (suggestIndex <= 3) score += 15;
  else if (suggestIndex > 0) score += 10;

  // Number of suggestions (more = more popular keyword space)
  score += Math.min(suggestions.length * 2, 20);

  // Install counts of top ranking apps (popular apps = popular keyword)
  if (top10Apps && top10Apps.length > 0) {
    const avgInstalls = top10Apps.slice(0, 5).reduce((sum, a) => {
      return sum + parseInstalls(a.installs || a.maxInstalls || '0');
    }, 0) / Math.min(5, top10Apps.length);

    if (avgInstalls > 5_000_000) score += 30;
    else if (avgInstalls > 1_000_000) score += 20;
    else if (avgInstalls > 100_000) score += 10;
  }

  // Keyword length (shorter = more generic = more traffic)
  const wordCount = keyword.trim().split(/\s+/).length;
  if (wordCount === 1) score += 20;
  else if (wordCount === 2) score += 10;
  else if (wordCount === 3) score += 5;

  return Math.min(Math.round(score), 100);
}

export async function getKeywordSuggestions(keyword, appId, country = 'us') {
  const [autocomplete, relatedSearch] = await Promise.all([
    getSuggest(keyword, country),
    searchApps(keyword, country, 10),
  ]);

  // Get keywords from competitor app descriptions
  const competitorKeywords = new Set();
  for (const app of relatedSearch.slice(0, 5)) {
    if (app.appId !== appId && app.title) {
      const words = app.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      words.forEach((w) => competitorKeywords.add(w));
    }
  }

  const suggestions = [
    ...autocomplete,
    ...Array.from(competitorKeywords),
  ];

  return [...new Set(suggestions)].slice(0, 20);
}

export async function bulkKeywordScores(keywords, country = 'us') {
  const results = [];
  for (const keyword of keywords) {
    try {
      const scores = await getKeywordScores(keyword, country);
      results.push(scores);
    } catch (e) {
      results.push({ keyword, country, error: e.message });
    }
  }
  return results;
}

function parseInstalls(installStr) {
  if (typeof installStr === 'number') return installStr;
  const clean = String(installStr).replace(/[^0-9]/g, '');
  return parseInt(clean, 10) || 0;
}
