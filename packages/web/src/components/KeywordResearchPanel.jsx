import React, { useState, useCallback, useRef } from 'react';
import { api } from '../lib/api.js';

function useDebounce(fn, delay) {
  const timer = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, []);
}

function DifficultyBar({ value }) {
  const color = value >= 70 ? 'bg-red-500' : value >= 40 ? 'bg-amber-400' : 'bg-green-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs w-6 text-right">{value}</span>
    </div>
  );
}

function TrafficBar({ value }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div className="h-2 rounded-full bg-blue-500" style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs w-6 text-right">{value}</span>
    </div>
  );
}

export default function KeywordResearchPanel({ appId, apps = [] }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [diffFilter, setDiffFilter] = useState('all');
  const [actionState, setActionState] = useState({}); // { [keyword]: 'tracking'|'bookmarking'|'tracked'|'bookmarked' }
  const [selectedAppId, setSelectedAppId] = useState(appId || '');

  React.useEffect(() => {
    if (!selectedAppId && appId) setSelectedAppId(appId);
  }, [appId]);

  const search = async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    setError('');
    try {
      const suggestions = await api.keyword.suggest(q, selectedAppId || appId || 'com.android.vending');
      if (suggestions.length === 0) { setResults([]); return; }
      const scores = await api.keyword.bulkScores(suggestions.slice(0, 15));
      setResults(scores.filter((s) => !s.error));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = useDebounce(search, 600);

  const handleInput = (e) => {
    setQuery(e.target.value);
    debouncedSearch(e.target.value);
  };

  const track = async (result) => {
    if (!selectedAppId) { setError('Select an app first'); return; }
    setActionState((prev) => ({ ...prev, [result.keyword]: 'tracking' }));
    try {
      await api.keywords.add({ appId: selectedAppId, keyword: result.keyword, country: result.country || 'us' });
      setActionState((prev) => ({ ...prev, [result.keyword]: 'tracked' }));
    } catch (e) {
      setError(e.message);
      setActionState((prev) => ({ ...prev, [result.keyword]: null }));
    }
  };

  const bookmark = async (result) => {
    setActionState((prev) => ({ ...prev, [result.keyword]: 'bookmarking' }));
    try {
      await api.post('/keywords/bookmark', {
        keyword: result.keyword,
        country: result.country || 'us',
        difficulty: result.difficulty,
        traffic: result.traffic,
      });
      setActionState((prev) => ({ ...prev, [result.keyword]: 'bookmarked' }));
    } catch (e) {
      setError(e.message);
      setActionState((prev) => ({ ...prev, [result.keyword]: null }));
    }
  };

  const exportCsv = () => {
    const rows = [['Keyword', 'Difficulty', 'Traffic', 'Priority']];
    results.forEach((r) => {
      rows.push([r.keyword, r.difficulty, r.traffic, Math.max(0, Math.round(r.traffic - r.difficulty * 0.5))]);
    });
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: 'keywords.csv' }).click();
  };

  const filtered = results.filter((r) => {
    if (diffFilter === 'easy') return r.difficulty < 40;
    if (diffFilter === 'medium') return r.difficulty >= 40 && r.difficulty < 70;
    if (diffFilter === 'hard') return r.difficulty >= 70;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          value={query}
          onChange={handleInput}
          placeholder="Search keywords..."
          className="flex-1 min-w-48 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {apps.length > 1 && (
          <select
            value={selectedAppId}
            onChange={(e) => setSelectedAppId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
          >
            <option value="">Select app to track</option>
            {apps.map((a) => <option key={a.appId} value={a.appId}>{a.title || a.appId}</option>)}
          </select>
        )}
        <select
          value={diffFilter}
          onChange={(e) => setDiffFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
        >
          <option value="all">All difficulty</option>
          <option value="easy">Easy (&lt;40)</option>
          <option value="medium">Medium (40-70)</option>
          <option value="hard">Hard (70+)</option>
        </select>
        {results.length > 0 && (
          <button onClick={exportCsv} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">
            Export CSV
          </button>
        )}
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      {loading && <div className="text-center py-8 text-gray-400 text-sm">Analyzing keywords...</div>}

      {!loading && filtered.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Keyword</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-40">Difficulty</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-40">Traffic</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-20">Priority</th>
                <th className="px-4 py-3 w-40" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r) => {
                const priority = Math.max(0, Math.round(r.traffic - r.difficulty * 0.5));
                const state = actionState[r.keyword];
                return (
                  <tr key={r.keyword} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.keyword}</td>
                    <td className="px-4 py-3"><DifficultyBar value={r.difficulty} /></td>
                    <td className="px-4 py-3"><TrafficBar value={r.traffic} /></td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${priority >= 50 ? 'bg-green-100 text-green-700' : priority >= 25 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                        {priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        {state === 'tracked' ? (
                          <span className="text-xs text-green-600 font-medium">✓ Tracking</span>
                        ) : state === 'bookmarked' ? (
                          <span className="text-xs text-indigo-600 font-medium">✓ Bookmarked</span>
                        ) : (
                          <>
                            <button
                              onClick={() => track(r)}
                              disabled={state === 'tracking'}
                              className="text-xs px-2 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                            >
                              {state === 'tracking' ? '...' : 'Track'}
                            </button>
                            <button
                              onClick={() => bookmark(r)}
                              disabled={state === 'bookmarking'}
                              className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 font-medium"
                            >
                              {state === 'bookmarking' ? '...' : 'Save'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
