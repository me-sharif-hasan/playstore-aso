import React, { useState } from 'react';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium transition-colors"
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

function CodeBlock({ code }) {
  return (
    <div className="relative">
      <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
      <div className="absolute top-2.5 right-2.5">
        <CopyButton text={code} />
      </div>
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center mt-0.5">
        {n}
      </div>
      <div className="space-y-2 flex-1">
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        {children}
      </div>
    </div>
  );
}

const TABS = ['Claude Desktop', 'Claude Code', 'Cursor', 'ChatGPT'];

export default function MCPConnectionGuide({ apiKey = 'YOUR_API_KEY' }) {
  const [tab, setTab] = useState('Claude Desktop');

  const repoPath = {
    mac: '~/aso-platform',
    win: 'C:\\aso-platform',
  };

  const envVars = `FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/service-account.json
FIREBASE_PROJECT_ID=kikhabo-firebase
MCP_DEFAULT_API_KEY=${apiKey}
MCP_API_BASE_URL=https://aso-be.iishanto.com/api`;

  const claudeDesktopConfig = JSON.stringify({
    mcpServers: {
      'aso-intelligence': {
        command: 'node',
        args: ['/path/to/aso-platform/packages/mcp/src/index.js'],
        env: {
          FIREBASE_SERVICE_ACCOUNT_PATH: '/path/to/service-account.json',
          FIREBASE_PROJECT_ID: 'kikhabo-firebase',
          MCP_DEFAULT_API_KEY: apiKey,
          MCP_API_BASE_URL: 'https://aso-be.iishanto.com/api',
        },
      },
    },
  }, null, 2);

  const claudeCodeCmd = `claude mcp add aso-intelligence -- node /path/to/aso-platform/packages/mcp/src/index.js`;

  const cursorConfig = JSON.stringify({
    mcpServers: {
      'aso-intelligence': {
        command: 'node',
        args: ['/path/to/aso-platform/packages/mcp/src/index.js'],
        env: {
          FIREBASE_SERVICE_ACCOUNT_PATH: '/path/to/service-account.json',
          FIREBASE_PROJECT_ID: 'kikhabo-firebase',
          MCP_DEFAULT_API_KEY: apiKey,
          MCP_API_BASE_URL: 'https://aso-be.iishanto.com/api',
        },
      },
    },
  }, null, 2);

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Claude Desktop */}
      {tab === 'Claude Desktop' && (
        <div className="space-y-4">
          <Step n={1} title="Clone the repo and install dependencies">
            <CodeBlock code={`git clone https://github.com/me-sharif-hasan/playstore-aso.git ~/aso-platform\ncd ~/aso-platform && npm install`} />
          </Step>

          <Step n={2} title="Download service-account.json from Firebase Console">
            <p className="text-xs text-gray-500">
              Firebase Console → Project Settings → Service accounts → Generate new private key → save as <code className="bg-gray-100 px-1 rounded">/path/to/service-account.json</code>
            </p>
          </Step>

          <Step n={3} title="Add to Claude Desktop config">
            <p className="text-xs text-gray-500 mb-1">
              Open config file:
              <span className="ml-1 font-mono bg-gray-100 px-1 rounded">macOS: ~/Library/Application Support/Claude/claude_desktop_config.json</span>
              <span className="ml-1 font-mono bg-gray-100 px-1 rounded">Windows: %APPDATA%\Claude\claude_desktop_config.json</span>
            </p>
            <CodeBlock code={claudeDesktopConfig} />
            <p className="text-xs text-gray-400 mt-1">Replace <code>/path/to/...</code> with actual paths on your machine.</p>
          </Step>

          <Step n={4} title="Restart Claude Desktop">
            <p className="text-xs text-gray-500">Quit and reopen Claude Desktop. The ASO Intelligence tools will appear in the tools menu (hammer icon).</p>
          </Step>
        </div>
      )}

      {/* Claude Code */}
      {tab === 'Claude Code' && (
        <div className="space-y-4">
          <Step n={1} title="Clone and install (if not done)">
            <CodeBlock code={`git clone https://github.com/me-sharif-hasan/playstore-aso.git ~/aso-platform\ncd ~/aso-platform && npm install`} />
          </Step>

          <Step n={2} title="Create .env file for MCP server">
            <CodeBlock code={envVars} />
            <p className="text-xs text-gray-400 mt-1">Save this as <code className="bg-gray-100 px-1 rounded">~/aso-platform/.env</code></p>
          </Step>

          <Step n={3} title="Register MCP server with Claude Code">
            <CodeBlock code={claudeCodeCmd} />
            <p className="text-xs text-gray-400 mt-1">Or add manually to <code className="bg-gray-100 px-1 rounded">~/.claude.json</code> under <code className="bg-gray-100 px-1 rounded">mcpServers</code>.</p>
          </Step>

          <Step n={4} title="Verify connection">
            <CodeBlock code={`claude mcp list\n# Should show: aso-intelligence`} />
          </Step>
        </div>
      )}

      {/* Cursor */}
      {tab === 'Cursor' && (
        <div className="space-y-4">
          <Step n={1} title="Clone and install (if not done)">
            <CodeBlock code={`git clone https://github.com/me-sharif-hasan/playstore-aso.git ~/aso-platform\ncd ~/aso-platform && npm install`} />
          </Step>

          <Step n={2} title="Open Cursor MCP settings">
            <p className="text-xs text-gray-500">Cursor → Settings → Features → MCP Servers → Add new server → Edit config manually</p>
          </Step>

          <Step n={3} title="Paste this config into ~/.cursor/mcp.json">
            <CodeBlock code={cursorConfig} />
            <p className="text-xs text-gray-400 mt-1">Replace <code>/path/to/...</code> with actual paths.</p>
          </Step>

          <Step n={4} title="Restart Cursor">
            <p className="text-xs text-gray-500">Reload window (Cmd/Ctrl+Shift+P → Reload Window). ASO tools appear in Cursor's AI context.</p>
          </Step>
        </div>
      )}

      {/* ChatGPT */}
      {tab === 'ChatGPT' && (
        <div className="space-y-4">
          <Step n={1} title="Get your API key from MCP API Keys section above">
            <p className="text-xs text-gray-500 mb-1">Your key: <code className="font-mono bg-gray-100 px-1 rounded text-indigo-600 break-all">{apiKey}</code></p>
          </Step>

          <Step n={2} title="Open ChatGPT → click your avatar → Settings → Connected apps / MCP">
            <p className="text-xs text-gray-500">Or go to <strong>chatgpt.com → top-right menu → Add apps</strong> → New App</p>
          </Step>

          <Step n={3} title="Enter the MCP server URL">
            <CodeBlock code="https://aso-be.iishanto.com/mcp" />
            <p className="text-xs text-gray-400 mt-1">Select <strong>Server URL</strong> (not Tunnel). This is a native MCP over HTTP endpoint.</p>
          </Step>

          <Step n={4} title="Set authentication to Mixed, paste your API key">
            <p className="text-xs text-gray-500 mb-2">Select <strong>Mixed</strong> auth → paste key as Bearer token:</p>
            <CodeBlock code={apiKey} />
            <p className="text-xs text-gray-400 mt-1">Alternatively use <strong>No Auth</strong> and pass <code className="bg-gray-100 px-1 rounded">api_key</code> in every tool call.</p>
          </Step>

          <Step n={5} title="Save and test">
            <p className="text-xs text-gray-500">Ask ChatGPT: <em>"What's the keyword difficulty for 'ssh client'?"</em> or <em>"Show me my tracked keywords for [appId]"</em></p>
          </Step>
        </div>
      )}

      {/* Available tools */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Available MCP Tools</p>
        <div className="flex flex-wrap gap-1.5">
          {[
            'get_app_details', 'get_aso_score', 'get_keyword_rank', 'get_keyword_rank_history',
            'get_keyword_scores', 'get_keyword_suggestions', 'bulk_keyword_scores',
            'compare_competitors', 'get_keyword_gap', 'search_apps',
            'add_tracked_keyword', 'list_tracked_keywords', 'get_tracked_keywords_export',
            'add_competitor', 'list_competitors', 'get_aso_health_overview',
          ].map((t) => (
            <span key={t} className="text-xs font-mono bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-600">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
