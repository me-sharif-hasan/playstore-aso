import React from 'react';

function getColor(score) {
  if (score >= 70) return { stroke: '#22c55e', text: 'text-green-600', bg: 'bg-green-50', label: 'Good' };
  if (score >= 40) return { stroke: '#f59e0b', text: 'text-amber-600', bg: 'bg-amber-50', label: 'Fair' };
  return { stroke: '#ef4444', text: 'text-red-600', bg: 'bg-red-50', label: 'Poor' };
}

export default function ASOScoreCard({ score = 0, title = 'ASO Score', breakdown }) {
  const pct = Math.min(Math.max(score, 0), 100);
  const color = getColor(pct);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (pct / 100) * circumference;

  return (
    <div className={`rounded-2xl ${color.bg} border border-gray-100 p-6`}>
      <h3 className="text-sm font-medium text-gray-500 mb-4">{title}</h3>
      <div className="flex items-center gap-6">
        <div className="relative">
          <svg width="128" height="128" className="-rotate-90">
            <circle cx="64" cy="64" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10" />
            <circle
              cx="64" cy="64" r={radius}
              fill="none"
              stroke={color.stroke}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
            <span className={`text-3xl font-bold ${color.text}`}>{pct}</span>
            <span className={`text-xs font-medium ${color.text}`}>{color.label}</span>
          </div>
        </div>

        {breakdown && (
          <div className="flex-1 space-y-2">
            {Object.entries(breakdown).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-28 truncate capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full"
                    style={{ width: `${val}%`, backgroundColor: color.stroke }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-700 w-6 text-right">{val}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
