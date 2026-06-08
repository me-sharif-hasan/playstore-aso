import gplay from 'google-play-scraper';

const DELAY_MS = 1000;
// Play Store returns ~30 results per page; fetch 9 pages = 270 results (covers rank ~250)
const SEARCH_PAGES = 9;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function getAppDetails(appId, country = 'us', lang = 'en') {
  const data = await gplay.app({ appId, country, lang });
  return data;
}

export async function searchApps(term, country = 'us', num = 30) {
  const results = await gplay.search({ term, num, country, fullDetail: false });
  return results;
}

async function searchAllPages(term, country) {
  const seen = new Set();
  const all = [];
  for (let page = 0; page < SEARCH_PAGES; page++) {
    try {
      const batch = await gplay.search({
        term,
        num: 30,
        country,
        fullDetail: false,
        nextPaginationToken: page === 0 ? undefined : undefined,
      });
      if (!batch || batch.length === 0) break;
      for (const app of batch) {
        if (!seen.has(app.appId)) {
          seen.add(app.appId);
          all.push(app);
        }
      }
      if (batch.length < 30) break; // last page
      await sleep(300);
    } catch {
      break;
    }
  }
  return all;
}

export async function getKeywordRank(appId, keyword, country = 'us') {
  const results = await searchAllPages(keyword, country);
  const index = results.findIndex((app) => app.appId === appId);
  return index === -1 ? null : index + 1;
}

export async function getKeywordRankWithCompetitors(appId, keyword, competitorIds = [], country = 'us') {
  const results = await searchAllPages(keyword, country);

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
