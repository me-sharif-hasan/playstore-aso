import React from 'react';

function MetricRow({ label, a, b, winner, format }) {
  const fmt = format || ((v) => v);
  const aWins = winner === 'a';
  const bWins = winner === 'b';

  return (
    <div className="grid grid-cols-3 py-3 border-b border-gray-100 last:border-0 items-center">
      <div className={`text-sm text-right pr-4 ${aWins ? 'font-semibold text-green-600' : bWins ? 'text-red-500' : 'text-gray-700'}`}>
        {fmt(a)}
        {aWins && <span className="ml-1 text-green-500">✓</span>}
      </div>
      <div className="text-xs text-center text-gray-400 font-medium">{label}</div>
      <div className={`text-sm text-left pl-4 ${bWins ? 'font-semibold text-green-600' : aWins ? 'text-red-500' : 'text-gray-700'}`}>
        {bWins && <span className="mr-1 text-green-500">✓</span>}
        {fmt(b)}
      </div>
    </div>
  );
}

export default function CompetitorCompare({ app, competitor, comparison }) {
  if (!app || !competitor) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
        Select a competitor to compare
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-200">
        <div className="p-4 flex items-center gap-3">
          {app.icon && <img src={app.icon} alt="" className="w-10 h-10 rounded-xl" />}
          <div>
            <p className="text-sm font-semibold text-gray-800 line-clamp-1">{app.title}</p>
            <p className="text-xs text-indigo-600">You</p>
          </div>
        </div>
        <div className="p-4 flex items-center justify-center">
          <span className="text-xs font-medium text-gray-400 uppercase">vs</span>
        </div>
        <div className="p-4 flex items-center gap-3">
          {competitor.icon && <img src={competitor.icon} alt="" className="w-10 h-10 rounded-xl" />}
          <div>
            <p className="text-sm font-semibold text-gray-800 line-clamp-1">{competitor.title}</p>
            <p className="text-xs text-gray-400">Competitor</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        {comparison && Object.entries(comparison).map(([key, val]) => (
          <MetricRow
            key={key}
            label={key.charAt(0).toUpperCase() + key.slice(1)}
            a={val.a}
            b={val.b}
            winner={val.winner}
            format={key === 'installs' ? (v) => v?.toLocaleString() : undefined}
          />
        ))}
      </div>
    </div>
  );
}
