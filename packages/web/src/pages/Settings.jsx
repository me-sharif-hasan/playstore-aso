import React, { useState } from 'react';
import { useTrackedApps } from '../hooks/useApp.js';
import MCPKeyManager from '../components/MCPKeyManager.jsx';
import MCPConnectionGuide from '../components/MCPConnectionGuide.jsx';
import OAuthClientManager from '../components/OAuthClientManager.jsx';
import AppSearchInput from '../components/AppSearchInput.jsx';
import { api } from '../lib/api.js';
import { auth } from '../lib/firebase.js';

export default function Settings() {
  const { apps, loading } = useTrackedApps();
  const [newAppId, setNewAppId] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [latestApiKey, setLatestApiKey] = useState('');

  const addApp = async () => {
    if (!newAppId.trim()) return;
    setAddLoading(true);
    setError('');
    setSuccess('');
    try {
      const result = await api.app.add(newAppId.trim());
      setSuccess(`Added "${result.title || newAppId}"`);
      setNewAppId('');
    } catch (e) {
      setError(e.message);
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Tracked Apps</h2>

        <div className="flex gap-3">
          <AppSearchInput
            placeholder="Search Play Store or paste app ID..."
            onSelect={(app) => {
              setNewAppId(app.appId);
              setSuccess('');
              setError('');
            }}
          />
          {newAppId && (
            <button
              onClick={addApp}
              disabled={addLoading}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium shrink-0"
            >
              {addLoading ? 'Adding...' : 'Add'}
            </button>
          )}
        </div>
        {newAppId && (
          <p className="text-xs text-gray-500">Selected: <span className="font-mono text-indigo-600">{newAppId}</span></p>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {success && <p className="text-green-600 text-sm">{success}</p>}

        {loading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : apps.length === 0 ? (
          <p className="text-gray-400 text-sm">No apps tracked yet.</p>
        ) : (
          <div className="space-y-2">
            {apps.map((app) => (
              <div key={app.appId} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3">
                {app.icon && <img src={app.icon} alt="" className="w-10 h-10 rounded-xl" />}
                <div>
                  <p className="text-sm font-medium text-gray-800">{app.title}</p>
                  <p className="text-xs text-gray-400">{app.appId}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <hr className="border-gray-200" />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">MCP API Keys</h2>
          <p className="text-sm text-gray-500 mt-1">
            Generate API keys for Claude Desktop, Claude Code, or other AI agents.
          </p>
        </div>
        <MCPKeyManager onKeyGenerated={setLatestApiKey} />
      </section>

      <hr className="border-gray-200" />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Connect to AI Assistants</h2>
          <p className="text-sm text-gray-500 mt-1">
            Use your API key to connect Claude, ChatGPT, or Cursor to your ASO data.
            {!latestApiKey && <span className="ml-1 text-indigo-500">Generate a key above to auto-fill configs.</span>}
          </p>
        </div>
        <MCPConnectionGuide apiKey={latestApiKey || 'YOUR_API_KEY'} />
      </section>

      <hr className="border-gray-200" />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">ChatGPT OAuth Clients</h2>
          <p className="text-sm text-gray-500 mt-1">
            Create OAuth clients so ChatGPT can authenticate via OAuth instead of pasting API keys.
          </p>
        </div>
        <OAuthClientManager />
      </section>

      <hr className="border-gray-200" />

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-800">Account</h2>
        <p className="text-sm text-gray-500">Signed in as <span className="font-medium text-gray-700">{auth.currentUser?.email}</span></p>
      </section>
    </div>
  );
}
