import React, { useState, useEffect } from 'react';
import { useTrackedApps } from '../hooks/useApp.js';
import { useKeywords, useKeywordSnapshots } from '../hooks/useKeywords.js';
import ASOScoreCard from '../components/ASOScoreCard.jsx';
import RankHistoryChart from '../components/RankHistoryChart.jsx';
import KeywordTable from '../components/KeywordTable.jsx';
import { api } from '../lib/api.js';

export default function Dashboard() {
  const { apps, loading: appsLoading } = useTrackedApps();
  const [selectedAppId, setSelectedAppId] = useState('');
  const [asoData, setAsoData] = useState(null);
  const [loading, setLoading] = useState(false);
  const { keywords } = useKeywords(selectedAppId);
  const snapshots = useKeywordSnapshots(selectedAppId);

  useEffect(() => {
    if (apps.length > 0 && !selectedAppId) setSelectedAppId(apps[0].appId);
  }, [apps]);

  useEffect(() => {
    if (!selectedAppId) return;
    setLoading(true);
    api.aso.health(selectedAppId).then(setAsoData).catch(console.error).finally(() => setLoading(false));
  }, [selectedAppId]);

  if (appsLoading) return <div className="p-8 text-gray-400">Loading...</div>;

  if (apps.length === 0) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full gap-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">No apps tracked yet</h2>
          <p className="text-gray-500 text-sm">Go to Settings to add your first app</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <select
          value={selectedAppId}
          onChange={(e) => setSelectedAppId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {apps.map((app) => (
            <option key={app.appId} value={app.appId}>{app.title || app.appId}</option>
          ))}
        </select>
      </div>

      {loading && <div className="text-gray-400 text-sm">Fetching ASO data...</div>}

      {asoData && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <ASOScoreCard
                score={asoData.asoScore?.total || 0}
                breakdown={asoData.asoScore?.breakdown}
              />
            </div>

            <div className="lg:col-span-2 space-y-4">
              {asoData.issues?.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <h3 className="text-sm font-semibold text-amber-800 mb-2">Issues</h3>
                  <ul className="space-y-1">
                    {asoData.issues.map((issue, i) => (
                      <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                        <span className="text-amber-500 mt-0.5">•</span>{issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {asoData.recommendations?.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                  <h3 className="text-sm font-semibold text-green-800 mb-2">Recommendations</h3>
                  <ul className="space-y-1">
                    {asoData.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-green-700 flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">→</span>{rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <RankHistoryChart snapshots={snapshots} keywords={keywords} />

          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Tracked Keywords</h2>
            <KeywordTable keywords={keywords.slice(0, 10)} />
          </div>
        </>
      )}
    </div>
  );
}
