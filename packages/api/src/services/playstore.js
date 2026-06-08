import gplay from 'google-play-scraper';

const SEARCH_NUM = 250;
const DELAY_MS = 1000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function getAppDetails(appId, country = 'us', lang = 'en') {
  const data = await gplay.app({ appId, country, lang });
  return data;
}

export async function searchApps(term, country = 'us', num = SEARCH_NUM) {
  const results = await gplay.search({ term, num, country, fullDetail: false });
  return results;
}

export async function getKeywordRank(appId, keyword, country = 'us') {
  const results = await gplay.search({
    term: keyword,
    num: SEARCH_NUM,
    country,
    fullDetail: false,
  });

  const index = results.findIndex((app) => app.appId === appId);
  return index === -1 ? null : index + 1;
}

export async function getKeywordRankWithCompetitors(appId, keyword, competitorIds = [], country = 'us') {
  const results = await gplay.search({
    term: keyword,
    num: SEARCH_NUM,
    country,
    fullDetail: false,
  });

  const appIndex = results.findIndex((app) => app.appId === appId);
  const competitorPositions = {};

  for (const cId of competitorIds) {
    const cIndex = results.findIndex((app) => app.appId === cId);
    competitorPositions[cId] = cIndex === -1 ? null : cIndex + 1;
  }

  return {
    position: appIndex === -1 ? null : appIndex + 1,
    competitor_positions: competitorPositions,
  };
}

export async function getSuggest(keyword, country = 'us') {
  const results = await gplay.suggest({ term: keyword, country });
  return results;
}

export async function bulkGetKeywordRanks(appId, keywords, country = 'us') {
  const results = [];
  for (const keyword of keywords) {
    const rank = await getKeywordRank(appId, keyword, country);
    results.push({ keyword, rank });
    await sleep(DELAY_MS);
  }
  return results;
}

export async function getDeveloperApps(devId, country = 'us') {
  return gplay.developer({ devId, country });
}

export async function getAppReviews(appId, country = 'us', num = 20) {
  const { data } = await gplay.reviews({ appId, country, num, sort: gplay.sort.NEWEST });
  return data;
}
