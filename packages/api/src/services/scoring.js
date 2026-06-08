// ASO score calculation as per SRS section 5.4 - NOT cached, recalculated every request

export function calculateAsoScore(appData, keyword) {
  const scores = {
    titleKeyword: scoreTitleKeyword(appData, keyword),
    shortDescDensity: scoreShortDescDensity(appData, keyword),
    descDensity: scoreDescDensity(appData, keyword),
    rating: scoreRating(appData),
    installVelocity: scoreInstallVelocity(appData),
    updateRecency: scoreUpdateRecency(appData),
    reviewCount: scoreReviewCount(appData),
    screenshots: scoreScreenshots(appData),
  };

  const weighted =
    scores.titleKeyword * 0.20 +
    scores.shortDescDensity * 0.15 +
    scores.descDensity * 0.15 +
    scores.rating * 0.15 +
    scores.installVelocity * 0.10 +
    scores.updateRecency * 0.10 +
    scores.reviewCount * 0.10 +
    scores.screenshots * 0.05;

  return {
    total: Math.round(weighted),
    breakdown: scores,
    keyword,
    appId: appData.appId,
  };
}

function scoreTitleKeyword(app, keyword) {
  if (!keyword || !app.title) return 0;
  return app.title.toLowerCase().includes(keyword.toLowerCase()) ? 100 : 0;
}

function scoreShortDescDensity(app, keyword) {
  const text = app.summary || app.shortDescription || '';
  return keywordDensityScore(text, keyword, 1, 2);
}

function scoreDescDensity(app, keyword) {
  const text = app.description || '';
  return keywordDensityScore(text, keyword, 4, 8);
}

function keywordDensityScore(text, keyword, minTarget, maxTarget) {
  if (!keyword || !text) return 0;
  const kw = keyword.toLowerCase();
  const words = text.toLowerCase().split(/\s+/);
  const count = words.filter((w) => w.includes(kw)).length;

  if (count === 0) return 0;
  if (count >= minTarget && count <= maxTarget) return 100;
  if (count < minTarget) return Math.round((count / minTarget) * 100);
  // Over-optimized penalty
  return Math.max(0, Math.round(100 - ((count - maxTarget) / maxTarget) * 50));
}

function scoreRating(app) {
  if (!app.score) return 0;
  const ratingScore = (app.score / 5) * 100;
  // Weight by review count (more reviews = more reliable)
  const reviewCount = app.reviews || 0;
  const reviewWeight = reviewCount > 10000 ? 1.0 : reviewCount > 1000 ? 0.8 : reviewCount > 100 ? 0.6 : 0.4;
  return Math.round(ratingScore * reviewWeight);
}

function scoreInstallVelocity(app) {
  const installs = parseInstalls(app.installs || app.maxInstalls || '0');
  if (installs >= 10_000_000) return 100;
  if (installs >= 1_000_000) return 80;
  if (installs >= 100_000) return 60;
  if (installs >= 10_000) return 40;
  if (installs >= 1_000) return 20;
  return 5;
}

function scoreUpdateRecency(app) {
  if (!app.updated) return 0;
  const updatedMs = typeof app.updated === 'number' ? app.updated : new Date(app.updated).getTime();
  const daysSinceUpdate = (Date.now() - updatedMs) / (1000 * 60 * 60 * 24);

  if (daysSinceUpdate <= 30) return 100;
  if (daysSinceUpdate <= 60) return 80;
  if (daysSinceUpdate <= 90) return 60;
  if (daysSinceUpdate <= 180) return 30;
  return 0;
}

function scoreReviewCount(app) {
  const count = app.reviews || 0;
  // Log scale, 1000+ = max
  if (count >= 1000) return 100;
  if (count === 0) return 0;
  return Math.round((Math.log10(count) / Math.log10(1000)) * 100);
}

function scoreScreenshots(app) {
  const count = (app.screenshots || []).length;
  return Math.min(Math.round((count / 8) * 100), 100);
}

function parseInstalls(installStr) {
  if (typeof installStr === 'number') return installStr;
  const clean = String(installStr).replace(/[^0-9]/g, '');
  return parseInt(clean, 10) || 0;
}

export function compareApps(appA, appB) {
  const fields = {
    title: { weight: 1, compare: (a, b) => a.title && b.title ? null : null },
    rating: { value: (a) => a.score || 0 },
    reviews: { value: (a) => a.reviews || 0 },
    installs: { value: (a) => parseInstalls(a.installs || a.maxInstalls || '0') },
    updated: { value: (a) => a.updated ? (typeof a.updated === 'number' ? a.updated : new Date(a.updated).getTime()) : 0 },
    screenshots: { value: (a) => (a.screenshots || []).length },
  };

  const result = {};
  for (const [field, config] of Object.entries(fields)) {
    if (config.value) {
      const valA = config.value(appA);
      const valB = config.value(appB);
      result[field] = {
        a: valA,
        b: valB,
        winner: valA > valB ? 'a' : valB > valA ? 'b' : 'tie',
      };
    }
  }

  return result;
}
