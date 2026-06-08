import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase.js';
import { auth } from '../lib/firebase.js';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';

function generateApiKey() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const ALL_PERMISSIONS = [
  'get_app_details', 'get_aso_score', 'get_keyword_rank', 'get_keyword_scores',
  'get_keyword_suggestions', 'bulk_keyword_scores', 'compare_competitors', 'get_keyword_gap',
  'search_apps', 'add_tracked_keyword', 'list_tracked_keywords', 'add_competitor',
  'list_competitors', 'get_aso_health_overview',
];

export default function MCPKeyManager({ onKeyGenerated } = {}) {
  const [clients, setClients] = useState([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState(null);
  const [visibleKeys, setVisibleKeys] = useState({});
  const [loading, setLoading] = useState(false);

  const loadClients = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const q = query(collection(db, 'mcp_clients'), where('owner', '==', uid));
    const snap = await getDocs(q);
    setClients(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => { loadClients(); }, []);

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    setLoading(true);
    try {
      const rawKey = generateApiKey();
      const hash = await sha256(rawKey);
      const uid = auth.currentUser?.uid;

      await addDoc(collection(db, 'mcp_clients'), {
        name: newKeyName,
        apiKeyHash: hash,
        owner: uid,
        permissions: ALL_PERMISSIONS,
        createdAt: new Date(),
        lastUsed: null,
      });

      setGeneratedKey(rawKey);
      setNewKeyName('');
      onKeyGenerated?.(rawKey);
      await loadClients();
    } finally {
      setLoading(false);
    }
  };

  const revokeKey = async (clientId) => {
    await deleteDoc(doc(db, 'mcp_clients', clientId));
    await loadClients();
  };

  const toggleVisible = (id) => {
    setVisibleKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      {generatedKey && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-green-800 mb-1">API Key Created — copy now, won't be shown again</p>
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 bg-white border border-green-200 rounded-lg px-3 py-2 text-sm font-mono break-all">
              {generatedKey}
            </code>
            <button
              onClick={() => { navigator.clipboard.writeText(generatedKey); }}
              className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Copy
            </button>
            <button
              onClick={() => setGeneratedKey(null)}
              className="px-3 py-2 text-sm bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <input
          type="text"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder="Key name (e.g. Claude Desktop)"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={createKey}
          disabled={loading || !newKeyName.trim()}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
        >
          Generate Key
        </button>
      </div>

      {clients.length > 0 && (
        <div className="space-y-3">
          {clients.map((client) => (
            <div key={client.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-800">{client.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Created {client.createdAt?.toDate?.()?.toLocaleDateString() || '—'} •
                  Last used {client.lastUsed?.toDate?.()?.toLocaleDateString() || 'never'}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(client.permissions || []).slice(0, 4).map((p) => (
                    <span key={p} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{p}</span>
                  ))}
                  {(client.permissions || []).length > 4 && (
                    <span className="text-xs text-gray-400">+{client.permissions.length - 4} more</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => revokeKey(client.id)}
                className="text-sm text-red-500 hover:underline shrink-0"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      {clients.length === 0 && !generatedKey && (
        <p className="text-sm text-gray-400 text-center py-4">No API keys yet. Generate one above.</p>
      )}
    </div>
  );
}
