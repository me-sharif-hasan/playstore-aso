import React, { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';

function useDebounce(fn, delay) {
  const timer = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, []);
}

export default function AppSearchInput({ onSelect, placeholder = 'Search or paste app ID...' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const doSearch = async (q) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const data = await api.app.search(q);
      setResults(data);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = useDebounce(doSearch, 500);

  const handleChange = (e) => {
    setQuery(e.target.value);
    debouncedSearch(e.target.value);
  };

  const handleSelect = (app) => {
    onSelect(app);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 text-sm outline-none"
        />
        {loading && (
          <span className="px-3 text-xs text-gray-400 animate-pulse">Searching...</span>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-80 overflow-y-auto">
          {results.map((app) => (
            <button
              key={app.appId}
              onClick={() => handleSelect(app)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0"
            >
              {app.icon && (
                <img src={app.icon} alt="" className="w-9 h-9 rounded-lg shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{app.title}</p>
                <p className="text-xs text-gray-400 truncate">{app.appId}</p>
              </div>
              {app.score && (
                <span className="text-xs text-amber-500 font-medium shrink-0">★ {app.score.toFixed(1)}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
