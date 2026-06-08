import React, { useState, useEffect, useCallback } from 'react';
import { auth } from '../lib/firebase.js';

const BACKEND = import.meta.env.VITE_API_URL || 'https://aso-be.iishanto.com';
// ChatGPT's fixed callback URL for user-defined OAuth clients
const CHATGPT_CALLBACK = 'https://chatgpt.com/aip/g-*/oauth/callback';

async function authHeader() {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium transition-colors"
    >
      {copied ? '✓' : label}
    </button>
  );
}

export default function OAuthClientManager() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRedirectUri, setNewRedirectUri] = useState('');
  const [newSecret, setNewSecret] = useState(null); // shown once after creation
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeader();
      const res = await fetch(`${BACKEND}/oauth/clients`, { headers });
      const data = await res.json();
      setClients(data.clients || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newRedirectUri.trim()) return;
    setCreating(true);
    setError('');
    setNewSecret(null);
    try {
      const headers = { ...(await authHeader()), 'Content-Type': 'application/json' };
      const res = await fetch(`${BACKEND}/oauth/clients`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: newName.trim(),
          redirect_uris: [newRedirectUri.trim()],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewSecret({ client_id: data.client_id, client_secret: data.client_secret, name: data.name });
      setNewName('');
      setNewRedirectUri('');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const remove = async (clientId) => {
    if (!confirm('Delete this OAuth client? ChatGPT will lose access.')) return;
    try {
      const headers = await authHeader();
      await fetch(`${BACKEND}/oauth/clients/${clientId}`, { method: 'DELETE', headers });
      setClients((c) => c.filter((x) => x.clientId !== clientId));
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Newly created client — show secret once */}
      {newSecret && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p className="text-sm font-semibold text-green-800">OAuth client created — save these now!</p>
          </div>
          <p className="text-xs text-green-700">The client secret is shown only once. Copy it to ChatGPT before closing.</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-green-200">
              <div>
                <p className="text-xs text-gray-500">Client ID</p>
                <p className="text-xs font-mono text-gray-800 break-all">{newSecret.client_id}</p>
              </div>
              <CopyButton text={newSecret.client_id} />
            </div>
            <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-green-200">
              <div>
                <p className="text-xs text-gray-500">Client Secret</p>
                <p className="text-xs font-mono text-gray-800 break-all">{newSecret.client_secret}</p>
              </div>
              <CopyButton text={newSecret.client_secret} />
            </div>
          </div>
          <button onClick={() => setNewSecret(null)} className="text-xs text-green-600 underline">I've saved these — dismiss</button>
        </div>
      )}

      {/* ChatGPT setup info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800 space-y-1.5">
        <p className="font-semibold">ChatGPT OAuth fields:</p>
        <div className="flex items-center justify-between">
          <span>Authorization URL</span>
          <div className="flex items-center gap-1">
            <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-blue-200">https://aso-be.iishanto.com/oauth/authorize</span>
            <CopyButton text="https://aso-be.iishanto.com/oauth/authorize" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span>Token URL</span>
          <div className="flex items-center gap-1">
            <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-blue-200">https://aso-be.iishanto.com/oauth/token</span>
            <CopyButton text="https://aso-be.iishanto.com/oauth/token" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span>Scope</span>
          <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-blue-200">aso:read aso:write</span>
        </div>
        <p className="text-blue-600 mt-1">Callback URL: paste the one shown in ChatGPT's OAuth settings when creating your client.</p>
      </div>

      {/* Existing clients */}
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : clients.length > 0 ? (
        <div className="space-y-2">
          {clients.map((c) => (
            <div key={c.clientId} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-3">
              <div>
                <p className="text-sm font-medium text-gray-800">{c.name}</p>
                <p className="text-xs font-mono text-gray-400 break-all">{c.clientId}</p>
              </div>
              <div className="flex items-center gap-2">
                <CopyButton text={c.clientId} label="Copy ID" />
                <button
                  onClick={() => remove(c.clientId)}
                  className="text-xs px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600 font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">No OAuth clients yet.</p>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Create form */}
      <form onSubmit={create} className="space-y-2">
        <p className="text-xs font-medium text-gray-600">
          First, go to ChatGPT → New App → enter the MCP URL → choose OAuth → copy the <strong>Callback URL</strong> shown. Paste it below.
        </p>
        <div className="flex gap-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Client name (e.g. My ChatGPT)"
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex gap-3">
          <input
            value={newRedirectUri}
            onChange={(e) => setNewRedirectUri(e.target.value)}
            placeholder="ChatGPT callback URL (e.g. https://chatgpt.com/connector/oauth/v-xxx)"
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={creating || !newName.trim() || !newRedirectUri.trim()}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium shrink-0"
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
