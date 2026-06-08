import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const DAYS_OPTIONS = [7, 14, 30];

export default function RankHistoryChart({ snapshots = [], keywords = [] }) {
  const [days, setDays] = useState(30);

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const filtered = snapshots.filter((s) => {
    const ts = s.date?.toMillis ? s.date.toMillis() : new Date(s.date).getTime();
    return ts >= cutoff;
  });

  // Group by keyword and date
  const byDate = {};
  filtered.forEach((s) => {
    const ts = s.date?.toMillis ? s.date.toMillis() : new Date(s.date).getTime();
    const dateKey = new Date(ts).toLocaleDateString();
    if (!byDate[dateKey]) byDate[dateKey] = { date: dateKey };
    const kw = keywords.find((k) => k.id === s.keywordId);
    if (kw) byDate[dateKey][kw.keyword] = s.position;
  });

  const chartData = Object.values(byDate).sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Rank History</h3>
        <div className="flex gap-1">
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 text-xs rounded-lg font-medium ${days === d ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
          No rank history yet. Check keyword ranks to populate.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis reversed domain={[1, 'auto']} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ fontSize: 12 }}
              formatter={(val) => val ? `#${val}` : 'Not found'}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {keywords.slice(0, 6).map((kw, i) => (
              <Line
                key={kw.id}
                type="monotone"
                dataKey={kw.keyword}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
