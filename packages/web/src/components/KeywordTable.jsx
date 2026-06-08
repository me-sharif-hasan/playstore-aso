import React, { useState } from 'react';

function positionColor(pos) {
  if (!pos) return 'text-gray-400';
  if (pos <= 3) return 'text-green-600 font-bold';
  if (pos <= 10) return 'text-amber-600 font-semibold';
  return 'text-gray-500';
}

function rowBg(pos) {
  if (!pos) return '';
  if (pos <= 3) return 'bg-green-50';
  if (pos <= 10) return 'bg-amber-50';
  return '';
}

function ScoreBar({ value = 0, color = 'bg-indigo-500' }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-gray-600 w-6 text-right">{value}</span>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-3.5 w-3.5 inline" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function CompetitorPositions({ positions = {} }) {
  const entries = Object.entries(positions).filter(([, pos]) => pos !== null);
  if (entries.length === 0) return <span className="text-xs text-gray-300">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([appId, pos]) => {
        const short = appId.split('.').pop();
        const color = pos <= 3 ? 'bg-green-100 text-green-700' : pos <= 10 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500';
        return (
          <span key={appId} title={appId} className={`text-xs px-1.5 py-0.5 rounded font-medium ${color}`}>
            {short} #{pos}
          </span>
        );
      })}
    </div>
  );
}

export default function KeywordTable({ keywords = [], onRemove, onCheckRank, rankLoading = {}, removeLoading = {} }) {
  const [sortBy, setSortBy] = useState('keyword');
  const [sortDir, setSortDir] = useState('asc');

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const sorted = [...keywords].sort((a, b) => {
    let av = a[sortBy] ?? (sortDir === 'asc' ? 999999 : -1);
    let bv = b[sortBy] ?? (sortDir === 'asc' ? 999999 : -1);
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  const SortHeader = ({ col, label, className = '' }) => (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-800 select-none ${className}`}
      onClick={() => toggleSort(col)}
    >
      {label} {sortBy === col ? (sortDir === 'asc' ? '↑' : '↓') : <span className="text-gray-300">↕</span>}
    </th>
  );

  const hasCompetitors = keywords.some((k) => Object.keys(k.competitor_positions || {}).length > 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <SortHeader col="keyword" label="Keyword" />
            <SortHeader col="position" label="Your Rank" />
            {hasCompetitors && (
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Competitors</th>
            )}
            <SortHeader col="difficulty" label="Difficulty" className="w-36" />
            <SortHeader col="traffic" label="Traffic" className="w-36" />
            <SortHeader col="country" label="Country" />
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.length === 0 && (
            <tr><td colSpan={hasCompetitors ? 7 : 6} className="text-center py-8 text-gray-400 text-sm">No keywords tracked yet</td></tr>
          )}
          {sorted.map((kw) => (
            <tr key={kw.id} className={`hover:bg-gray-50 ${rowBg(kw.position)}`}>
              <td className="px-4 py-3 text-sm font-medium text-gray-900">{kw.keyword}</td>
              <td className="px-4 py-3">
                {rankLoading[kw.id] ? (
                  <span className="text-indigo-400"><Spinner /></span>
                ) : (
                  <span className={`text-sm ${positionColor(kw.position)}`}>
                    {kw.position ? `#${kw.position}` : kw.lastChecked ? '—' : <span className="text-gray-300 text-xs">fetching...</span>}
                  </span>
                )}
              </td>
              {hasCompetitors && (
                <td className="px-4 py-3">
                  <CompetitorPositions positions={kw.competitor_positions} />
                </td>
              )}
              <td className="px-4 py-3 w-36">
                {kw.difficulty != null ? <ScoreBar value={kw.difficulty} color="bg-red-400" /> : <span className="text-xs text-gray-300">—</span>}
              </td>
              <td className="px-4 py-3 w-36">
                {kw.traffic != null ? <ScoreBar value={kw.traffic} color="bg-blue-400" /> : <span className="text-xs text-gray-300">—</span>}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">{kw.country || 'us'}</td>
              <td className="px-4 py-3">
                <div className="flex gap-2 justify-end items-center">
                  {onCheckRank && (
                    <button
                      onClick={() => onCheckRank(kw)}
                      disabled={!!rankLoading[kw.id]}
                      className="text-xs text-indigo-600 hover:underline disabled:opacity-40 flex items-center gap-1"
                    >
                      {rankLoading[kw.id] ? <><Spinner /> Checking...</> : 'Refresh rank'}
                    </button>
                  )}
                  {onRemove && (
                    <button
                      onClick={() => onRemove(kw.id)}
                      disabled={!!removeLoading[kw.id]}
                      className="text-xs text-red-500 hover:underline disabled:opacity-40 flex items-center gap-1"
                    >
                      {removeLoading[kw.id] ? <><Spinner /> Removing...</> : 'Remove'}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
