import React, { useState, useEffect, useMemo } from 'react';
import { useTrackedApps } from '../hooks/useApp.js';
import { useKeywords, useKeywordSnapshots } from '../hooks/useKeywords.js';
import { useRankQueue } from '../hooks/useRankQueue.js';
import CompetitorCompare from '../components/CompetitorCompare.jsx';
import AppSearchInput from '../components/AppSearchInput.jsx';
import { api } from '../lib/api.js';

// Derive rank change from snapshot history per keyword
function useRankChanges(snapshots, keywords) {
  return useMemo(() => {
    const changes = {};
    keywords.forEach((kw) => {
      const kwSnaps = snapshots
        .filter((s) => s.keywordId === kw.id)
        .sort((a, b) => {
          const ta = a.date?.toMillis ? a.date.toMillis() : new Date(a.date).getTime();
          const tb = b.date?.toMillis ? b.date.toMillis() : new Date(b.date).getTime();
          return tb - ta;
        });
      if (kwSnaps.length >= 2) {
        const latest = kwSnaps[0].position;
        const prev = kwSnaps[1].position;
        changes[kw.id] = latest !== null && prev !== null ? prev - latest : null; // positive = improved
      } else {
        changes[kw.id] = null;
      }
    });
    return changes;
  }, [snapshots, keywords]);
}

function DeltaBadge({ delta }) {
  if (delta === null || delta === undefined) return <span className="text-xs text-gray-300">—</span>;
  if (delta === 0) return <span className="text-xs text-gray-400 font-medium">—</span>;
  if (delta > 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-green-600">
      ▲ {delta}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-500">
      ▼ {Math.abs(delta)}
    </span>
  );
}

function RankBadge({ pos, label }) {
  if (!pos) return <span className="text-sm text-gray-300">—</span>;
  const color = pos <= 3 ? 'text-green-600 font-bold' : pos <= 10 ? 'text-amber-600 font-semibold' : 'text-gray-600';
  return (
    <div className="text-center">
      <span className={`text-sm ${color}`}>#{pos}</span>
      {label && <div className="text-xs text-gray-400 mt-0.5">{label}</div>}
    </div>
  );
}

function WinLossBadge({ yourPos, theirPos }) {
  if (!yourPos && !theirPos) return <span className="text-xs text-gray-300">neither ranking</span>;
  if (!yourPos) return <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">They rank, you don't</span>;
  if (!theirPos) return <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">You rank, they don't</span>;
  if (yourPos < theirPos) return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">You lead</span>;
  if (yourPos > theirPos) return <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">They lead</span>;
  return <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Tied</span>;
}

export default function Competitors() {
  const { apps } = useTrackedApps();
  const [selectedAppId, setSelectedAppId] = useState('');
  const [selectedCompetitor, setSelectedCompetitor] = useState('');
  const [competitors, setCompetitors] = useState([]);
  const [compareData, setCompareData] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [rankLoading, setRankLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('keywords'); // 'keywords' | 'profile'

  const [competitorMeta, setCompetitorMeta] = useState({}); // { [appId]: { title, icon } }

  const { keywords } = useKeywords(selectedAppId);
  const snapshots = useKeywordSnapshots(selectedAppId);
  const rankChanges = useRankChanges(snapshots, keywords);
  const { active: queueActive, done: queueDone, items: queueItems } = useRankQueue(selectedAppId);

  useEffect(() => {
    if (apps.length > 0 && !selectedAppId) setSelectedAppId(apps[0].appId);
  }, [apps]);

  useEffect(() => {
    if (!selectedAppId) return;
    api.app.getCompetitors(selectedAppId).then((list) => {
      setCompetitors(list);
      // Fetch metadata for any competitor not yet cached
      list.forEach((cId) => {
        if (!competitorMeta[cId]) {
          api.app.get(cId).then((data) => {
            setCompetitorMeta((prev) => ({ ...prev, [cId]: { title: data.title, icon: data.icon } }));
          }).catch(() => {});
        }
      });
    }).catch(console.error);
  }, [selectedAppId]);

  useEffect(() => {
    if (!selectedAppId || !selectedCompetitor) { setCompareData(null); return; }
    setCompareLoading(true);
    api.competitor.compare(selectedAppId, selectedCompetitor)
      .then(setCompareData)
      .catch((e) => setError(e.message))
      .finally(() => setCompareLoading(false));
  }, [selectedAppId, selectedCompetitor]);

  const addCompetitor = async (app) => {
    // accepts either an appId string or an app object from AppSearchInput
    const appId = typeof app === 'string' ? app : app.appId;
    if (!appId || !selectedAppId) return;
    setAddLoading(true);
    setError('');
    try {
      // Cache meta immediately if we have it from the search result
      if (typeof app === 'object' && app.title) {
        setCompetitorMeta((prev) => ({ ...prev, [appId]: { title: app.title, icon: app.icon } }));
      }
      await api.app.addCompetitor(selectedAppId, appId);
      const updated = await api.app.getCompetitors(selectedAppId);
      setCompetitors(updated);
      setSelectedCompetitor(appId);
      // Fetch full meta if not cached yet
      if (!competitorMeta[appId]) {
        api.app.get(appId).then((data) => {
          setCompetitorMeta((prev) => ({ ...prev, [appId]: { title: data.title, icon: data.icon } }));
        }).catch(() => {});
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setAddLoading(false);
    }
  };

  const removeCompetitor = async (cId) => {
    try {
      await api.app.removeCompetitor(selectedAppId, cId);
      setCompetitors((prev) => prev.filter((c) => c !== cId));
      if (selectedCompetitor === cId) { setSelectedCompetitor(''); setCompareData(null); }
    } catch (e) {
      setError(e.message);
    }
  };

  const refreshAllRanks = async () => {
    if (!keywords.length || !selectedAppId) return;
    setRankLoading(true);
    try {
      for (const kw of keywords) {
        await api.keywords.rank(kw.id);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setRankLoading(false);
    }
  };

  // Stats derived from keyword data
  const stats = useMemo(() => {
    if (!selectedCompetitor) return null;
    let wins = 0, losses = 0, tied = 0, youOnly = 0, theyOnly = 0, gained = 0, dropped = 0;
    keywords.forEach((kw) => {
      const yourPos = kw.position;
      const theirPos = kw.competitor_positions?.[selectedCompetitor];
      if (yourPos && theirPos) {
        if (yourPos < theirPos) wins++;
        else if (yourPos > theirPos) losses++;
        else tied++;
      } else if (yourPos && !theirPos) {
        youOnly++;
      } else if (!yourPos && theirPos) {
        theyOnly++;
      }
      const delta = rankChanges[kw.id];
      if (delta > 0) gained++;
      else if (delta < 0) dropped++;
    });
    return { wins, losses, tied, youOnly, theyOnly, gained, dropped };
  }, [keywords, selectedCompetitor, rankChanges]);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Competitors</h1>
        <div className="flex gap-3 flex-wrap">
          <select
            value={selectedAppId}
            onChange={(e) => { setSelectedAppId(e.target.value); setSelectedCompetitor(''); setCompareData(null); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
          >
            {apps.map((app) => <option key={app.appId} value={app.appId}>{app.title || app.appId}</option>)}
          </select>
          {keywords.length > 0 && (
            <button
              onClick={refreshAllRanks}
              disabled={rankLoading}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
            >
              {rankLoading ? 'Refreshing...' : 'Refresh All Ranks'}
            </button>
          )}
        </div>
      </div>

      {/* Add competitor */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700">Add Competitor</p>
        <div className="flex gap-3 items-start">
          <AppSearchInput
            placeholder="Search Play Store for competitor..."
            onSelect={(app) => addCompetitor(app)}
          />
          {addLoading && <span className="text-sm text-gray-400 py-2">Adding...</span>}
        </div>

        {competitors.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {competitors.map((cId) => {
              const meta = competitorMeta[cId];
              const isSelected = selectedCompetitor === cId;
              return (
                <button
                  key={cId}
                  onClick={() => setSelectedCompetitor(cId)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  {meta?.icon && (
                    <img src={meta.icon} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                  )}
                  <span className="max-w-36 truncate font-medium">
                    {meta?.title || cId.split('.').slice(-2).join('.')}
                  </span>
                  <span
                    onClick={(e) => { e.stopPropagation(); removeCompetitor(cId); }}
                    className={`ml-0.5 cursor-pointer ${isSelected ? 'opacity-70 hover:opacity-100' : 'opacity-50 hover:opacity-100'}`}
                  >×</span>
                </button>
              );
            })}
          </div>
        )}
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>

      {/* Rank queue panel */}
      {queueItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">Rank Refresh Queue</span>
              {queueActive.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                  </svg>
                  {queueActive.length} processing
                </span>
              )}
              {queueActive.length === 0 && queueDone.length > 0 && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Complete</span>
              )}
            </div>
            <span className="text-xs text-gray-400">{queueDone.length}/{queueItems.length} done</span>
          </div>
          <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
            {queueItems.map((item) => (
              <div key={item.id} className="px-4 py-2 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  {item.status === 'processing' && (
                    <svg className="animate-spin h-3.5 w-3.5 text-indigo-500 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                    </svg>
                  )}
                  {item.status === 'pending' && <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 flex-shrink-0" />}
                  {item.status === 'done' && <span className="text-green-500 flex-shrink-0">✓</span>}
                  {item.status === 'error' && <span className="text-red-500 flex-shrink-0">✗</span>}
                  <span className="text-gray-700 truncate font-medium">{item.keyword}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0 truncate max-w-24">
                    via {item.competitorId?.split('.').pop()}
                  </span>
                </div>
                <div className="flex-shrink-0 ml-3">
                  {item.status === 'done' && (
                    <span className={`text-xs font-semibold ${
                      !item.position ? 'text-gray-400' :
                      item.position <= 3 ? 'text-green-600' :
                      item.position <= 10 ? 'text-amber-600' : 'text-gray-600'
                    }`}>
                      {item.position ? `#${item.position}` : 'not ranked'}
                    </span>
                  )}
                  {item.status === 'error' && <span className="text-xs text-red-400">{item.error?.slice(0, 30)}</span>}
                  {(item.status === 'pending' || item.status === 'processing') && (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats row */}
      {stats && selectedCompetitor && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'You Lead', value: stats.wins, color: 'bg-green-50 text-green-700 border-green-200' },
            { label: 'They Lead', value: stats.losses, color: 'bg-red-50 text-red-600 border-red-200' },
            { label: 'Tied', value: stats.tied, color: 'bg-gray-50 text-gray-600 border-gray-200' },
            { label: 'You Only', value: stats.youOnly, color: 'bg-blue-50 text-blue-600 border-blue-200' },
            { label: 'They Only', value: stats.theyOnly, color: 'bg-orange-50 text-orange-600 border-orange-200' },
            { label: '↑ Gained', value: stats.gained, color: 'bg-green-50 text-green-700 border-green-200' },
            { label: '↓ Dropped', value: stats.dropped, color: 'bg-red-50 text-red-600 border-red-200' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`rounded-xl border p-3 text-center ${color}`}>
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs font-medium mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      {selectedCompetitor && (
        <div className="flex gap-1 border-b border-gray-200">
          {['keywords', 'profile'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'keywords' ? 'Keyword Rankings' : 'App Profile'}
            </button>
          ))}
        </div>
      )}

      {/* Keyword rankings table */}
      {(!selectedCompetitor || activeTab === 'keywords') && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">
              Tracked Keywords {selectedCompetitor ? `vs ${selectedCompetitor.split('.').pop()}` : ''}
            </h3>
            <span className="text-xs text-gray-400">{keywords.length} keywords</span>
          </div>

          {keywords.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              No tracked keywords. Add keywords on the Keywords page first.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Keyword</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Your Rank</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Change</th>
                    {selectedCompetitor && (
                      <>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">
                          {selectedCompetitor.split('.').pop()}
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Head-to-Head</th>
                      </>
                    )}
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Difficulty</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Traffic</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {keywords.map((kw) => {
                    const theirPos = kw.competitor_positions?.[selectedCompetitor];
                    const delta = rankChanges[kw.id];
                    const youLead = kw.position && theirPos && kw.position < theirPos;
                    const theyLead = kw.position && theirPos && kw.position > theirPos;
                    return (
                      <tr key={kw.id} className={`hover:bg-gray-50 ${youLead ? 'bg-green-50/40' : theyLead ? 'bg-red-50/30' : ''}`}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{kw.keyword}</td>
                        <td className="px-4 py-3 text-center">
                          <RankBadge pos={kw.position} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <DeltaBadge delta={delta} />
                        </td>
                        {selectedCompetitor && (
                          <>
                            <td className="px-4 py-3 text-center">
                              <RankBadge pos={theirPos} />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <WinLossBadge yourPos={kw.position} theirPos={theirPos} />
                            </td>
                          </>
                        )}
                        <td className="px-4 py-3 text-center text-xs text-gray-500">
                          {kw.difficulty ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-gray-500">
                          {kw.traffic ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* App profile comparison */}
      {selectedCompetitor && activeTab === 'profile' && (
        compareLoading ? (
          <div className="text-gray-400 text-sm">Loading comparison...</div>
        ) : compareData ? (
          <CompetitorCompare
            app={compareData.app}
            competitor={compareData.competitor}
            comparison={compareData.comparison}
          />
        ) : null
      )}
    </div>
  );
}
