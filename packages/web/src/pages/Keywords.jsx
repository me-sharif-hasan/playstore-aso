import React, { useState, useEffect } from 'react';
import { useTrackedApps } from '../hooks/useApp.js';
import { useKeywords } from '../hooks/useKeywords.js';
import KeywordTable from '../components/KeywordTable.jsx';
import { api } from '../lib/api.js';

export default function Keywords() {
  const { apps } = useTrackedApps();
  const [selectedAppId, setSelectedAppId] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [newCountry, setNewCountry] = useState('us');
  const [adding, setAdding] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [rankLoading, setRankLoading] = useState({});
  const [error, setError] = useState('');
  const { keywords, loading, error: kwError } = useKeywords(selectedAppId);
  const [enriched, setEnriched] = useState([]);

  useEffect(() => {
    if (apps.length > 0 && !selectedAppId) setSelectedAppId(apps[0].appId);
  }, [apps]);

  useEffect(() => { setEnriched(keywords); }, [keywords]);

  const addKeyword = async () => {
    if (!newKeyword.trim() || !selectedAppId) return;
    setAdding(true);
    setError('');
    try {
      await api.keywords.add({ appId: selectedAppId, keyword: newKeyword.trim(), country: newCountry });
      setNewKeyword('');
    } catch (e) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  };

  const removeKeyword = async (kwId) => {
    try {
      await api.keywords.remove(kwId);
    } catch (e) {
      setError(e.message);
    }
  };

  const checkRank = async (kw) => {
    setRankLoading((prev) => ({ ...prev, [kw.id]: true }));
    try {
      const result = await api.keywords.rank(kw.id);
      setEnriched((prev) => prev.map((k) =>
        k.id === kw.id
          ? { ...k, position: result.position, competitor_positions: result.competitor_positions || {} }
          : k
      ));
    } catch (e) {
      setError(e.message);
    } finally {
      setRankLoading((prev) => ({ ...prev, [kw.id]: false }));
    }
  };

  const bulkCheckScores = async () => {
    if (keywords.length === 0) return;
    setBulkLoading(true);
    try {
      const kwList = keywords.map((k) => k.keyword);
      const scores = await api.keyword.bulkScores(kwList, newCountry, selectedAppId);
      setEnriched((prev) => prev.map((kw) => {
        const s = scores.find((sc) => sc.keyword === kw.keyword);
        return s ? { ...kw, difficulty: s.difficulty, traffic: s.traffic } : kw;
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Keywords</h1>
        <div className="flex gap-3">
          <select
            value={selectedAppId}
            onChange={(e) => setSelectedAppId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
          >
            {apps.map((app) => <option key={app.appId} value={app.appId}>{app.title || app.appId}</option>)}
          </select>
          <button
            onClick={bulkCheckScores}
            disabled={bulkLoading || keywords.length === 0}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg font-medium disabled:opacity-50"
          >
            {bulkLoading ? 'Checking...' : 'Bulk Score Check'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
            placeholder="Add keyword to track..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={newCountry}
            onChange={(e) => setNewCountry(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
          >
            <option value="us">US</option>
            <option value="gb">UK</option>
            <option value="de">DE</option>
            <option value="fr">FR</option>
            <option value="in">IN</option>
            <option value="br">BR</option>
          </select>
          <button
            onClick={addKeyword}
            disabled={adding || !newKeyword.trim()}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      {kwError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          Firestore error: {kwError}
          {kwError.includes('index') && (
            <span className="ml-2 font-medium">→ check browser console for index creation link</span>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm">Loading keywords...</div>
      ) : (
        <KeywordTable keywords={enriched} onRemove={removeKeyword} onCheckRank={checkRank} />
      )}
    </div>
  );
}
