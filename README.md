**SOFTWARE REQUIREMENTS SPECIFICATION**

**ASO Intelligence Platform**

App Store Optimization Web App + MCP Server

Version 1.0 • June 2026

Stack: Node.js (Express) + Firebase • MCP: Node.js + @modelcontextprotocol/sdk

# **1\. Introduction**

## **1.1 Purpose**

This document specifies the requirements for the ASO Intelligence Platform - a web application that provides Google Play Store ASO analysis, competitor tracking, keyword research, and an authenticated MCP server for AI agent integration. The system is designed to be built in a single-shot by an AI coding agent from this specification.

## **1.2 Scope**

The platform consists of two primary components:

- ASO Web App - a React-based dashboard for app store optimization analysis
- MCP Server - a Model Context Protocol server exposing all ASO tools to AI agents with authenticated access

Both components share a Firebase backend for storage and authentication.

## **1.3 Technology Stack**

| **Component**   | **Technology**                                                     |
| --------------- | ------------------------------------------------------------------ |
| Frontend        | React 18 + Vite + TailwindCSS                                      |
| Backend API     | Node.js + Express (REST API)                                       |
| Play Store Data | google-play-scraper (npm) + google-play-keywords (npm)             |
| ASO Scoring     | aso (npm) - keyword difficulty + traffic + suggestions             |
| MCP Server      | Node.js + @modelcontextprotocol/sdk                                |
| Database        | Firebase Firestore                                                 |
| Authentication  | Firebase Auth (email/password + API key for MCP)                   |
| Scheduling      | node-cron (daily keyword rank snapshots)                           |
| Local dev       | npm workspaces monorepo - packages/api, packages/web, packages/mcp |

## **1.4 Key npm Packages**

| **Package**               | **Purpose**                                                  |
| ------------------------- | ------------------------------------------------------------ |
| google-play-scraper       | Fetch app details, search results, reviews, developer apps   |
| google-play-keywords      | Keyword scores: difficulty, traffic, competitor suggest      |
| aso                       | Full ASO module: keyword suggestions, scores, app visibility |
| @modelcontextprotocol/sdk | MCP server implementation                                    |
| firebase-admin            | Server-side Firestore + Auth operations                      |
| firebase                  | Client-side Firebase SDK                                     |
| node-cron                 | Scheduled rank snapshot jobs                                 |
| express                   | REST API server                                              |
| cors + helmet             | Security middleware                                          |
| dotenv                    | Environment config                                           |

# **2\. System Architecture**

## **2.1 Monorepo Structure**

aso-platform/

packages/

api/ # Express REST API + scraping engine

src/

routes/ # keyword.js, app.js, competitor.js, aso.js

services/ # playstore.js, keywords.js, scoring.js

jobs/ # cron-rank-tracker.js

middleware/ # auth.js, rateLimit.js

index.js # Express app entry

web/ # React frontend

src/

pages/ # Dashboard, Keywords, Competitors, Settings

components/ # Charts, Tables, ScoreCard, KeywordBadge

hooks/ # useKeywords, useApp, useCompetitor

lib/ # firebase.js, api.js

mcp/ # MCP server

src/

index.js # MCP server entry

tools/ # All MCP tool handlers

auth/ # API key middleware

firebase/

firestore.rules # Security rules

firestore.indexes.json

.env.example

package.json # Workspace root

## **2.2 Data Flow**

| **Flow**           | **Path**                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------- |
| Keyword rank check | Web → API → google-play-scraper.search() → find position of appId → Firestore snapshot → Web |
| ASO score          | API → aso.scores(keyword) → aggregate difficulty + traffic + suggest → return score          |
| Competitor compare | API fetches both apps via gplay.app() → compares metadata → scores each field                |
| Daily cron         | node-cron fires 02:00 UTC → for each tracked keyword → fetch rank → store in Firestore       |
| MCP tool call      | AI agent → MCP server (stdio/HTTP) → API key auth → calls same services as REST API          |

# **3\. Firebase Firestore Schema**

## **3.1 Collections**

| **Collection**      | **Document ID**      | **Fields**                                                                                |
| ------------------- | -------------------- | ----------------------------------------------------------------------------------------- |
| users               | Firebase UID         | email, createdAt, plan, mcpApiKey (hashed), apps\[\]                                      |
| apps                | appId (package name) | appId, title, icon, owner (uid), competitors\[\], createdAt, lastUpdated                  |
| keywords            | auto-id              | appId, keyword, country, lang, createdAt, owner (uid)                                     |
| keyword_snapshots   | auto-id              | keywordId, appId, position, date (timestamp), country, competitor_positions: {appId: pos} |
| keyword_scores      | keyword+country hash | keyword, country, difficulty, traffic, suggest, calculatedAt, ttl                         |
| mcp_clients         | clientId             | name, apiKeyHash, owner (uid), permissions\[\], createdAt, lastUsed                       |
| competitor_analysis | auto-id              | appId, competitorId, scores{}, runAt, owner                                               |

## **3.2 Firestore Rules (firestore.rules)**

rules_version = '2';

service cloud.firestore {

match /databases/{database}/documents {

match /users/{userId} {

allow read, write: if request.auth.uid == userId;

}

match /apps/{appId} {

allow read, write: if request.auth != null &&

resource.data.owner == request.auth.uid;

}

match /keywords/{kwId} {

allow read, write: if request.auth != null &&

resource.data.owner == request.auth.uid;

}

match /keyword_snapshots/{snapId} {

allow read: if request.auth != null;

allow write: if false; // server-only

}

}

}

# **4\. REST API Specification (packages/api)**

## **4.1 Base Configuration**

| **Field**        | **Value**                                                           |
| ---------------- | ------------------------------------------------------------------- |
| Base URL (local) | <http://localhost:3001/api>                                         |
| Auth header      | Authorization: Bearer &lt;Firebase ID token&gt;                     |
| Rate limit       | 60 requests/minute per IP (Play Store scraping is throttled)        |
| Response format  | { success: bool, data: any, error?: string }                        |
| Caching          | Firestore TTL cache: keyword_scores cached 24hrs, app metadata 6hrs |

## **4.2 App Endpoints**

| **Method + Path**                  | **Body / Params** | **Description**                            |
| ---------------------------------- | ----------------- | ------------------------------------------ |
| GET /app/:appId                    | country?, lang?   | Fetch full app metadata from Play Store    |
| POST /app/add                      | { appId }         | Add app to user tracking list in Firestore |
| GET /app/:appId/competitors        | \-                | List tracked competitors for this app      |
| POST /app/:appId/competitor        | { competitorId }  | Add competitor app to track                |
| DELETE /app/:appId/competitor/:cId | \-                | Remove competitor                          |

## **4.3 Keyword Endpoints**

| **Method + Path**                    | **Body / Params**                 | **Description**                                          |
| ------------------------------------ | --------------------------------- | -------------------------------------------------------- |
| GET /keywords/:appId                 | \-                                | List all tracked keywords for app                        |
| POST /keywords                       | { appId, keyword, country, lang } | Add keyword to track                                     |
| DELETE /keywords/:kwId               | \-                                | Remove tracked keyword                                   |
| GET /keywords/:kwId/rank             | country?, lang?                   | Get current rank of appId for this keyword (live scrape) |
| GET /keywords/:kwId/history          | days? (default 30)                | Get rank history snapshots from Firestore                |
| GET /keywords/:kwId/competitor-ranks | \-                                | Get ranks for all competitors on this keyword            |

## **4.4 Keyword Research Endpoints**

| **Method + Path**         | **Body / Params**        | **Description**                                                 |
| ------------------------- | ------------------------ | --------------------------------------------------------------- |
| GET /keyword/scores       | keyword, country?        | Get difficulty + traffic score for a keyword (cached 24hrs)     |
| GET /keyword/suggest      | keyword, appId, country? | Get keyword suggestions from autocomplete + competitor analysis |
| GET /keyword/volume       | keyword, country?        | Estimate search volume / traffic score (0-100)                  |
| GET /keyword/difficulty   | keyword, country?        | Get competition difficulty score (0-100)                        |
| POST /keyword/bulk-scores | { keywords: string\[\] } | Get scores for multiple keywords in one call                    |

## **4.5 Competitor Analysis Endpoints**

| **Method + Path**           | **Body / Params**             | **Description**                                   |
| --------------------------- | ----------------------------- | ------------------------------------------------- |
| GET /competitor/compare     | appId, competitorId, country? | Full side-by-side comparison of two apps          |
| GET /competitor/keyword-gap | appId, competitorId           | Keywords competitor ranks for that appId doesn't  |
| GET /competitor/aso-score   | appId                         | Calculate realtime ASO score for this app (0-100) |

# **5\. Scoring Engine**

## **5.1 Keyword Rank Detection**

Uses google-play-scraper.search({ term, num: 250 }) and iterates results to find the index of the target appId. Returns position 1-250 or null if not found. Results stored as keyword_snapshots documents.

## **5.2 Keyword Difficulty Score (0-100)**

Uses google-play-keywords scores() function. Factors:

- Top 10 app install counts (higher = harder)
- Top 10 app rating counts (higher = harder)
- Number of apps with keyword in title
- Average ratings of top 10 apps

Score is inverted: 100 = very competitive, 0 = easy to rank.

## **5.3 Keyword Traffic Score (0-100)**

Uses google-play-keywords scores() function. Factors:

- Autocomplete suggestion position (earlier = more traffic)
- Number of ranked apps also in category charts
- Install counts of top ranking apps
- Keyword length (shorter = more traffic assumed)

## **5.4 ASO Score (0-100)**

Composite score calculated from these weighted factors:

| **Factor**                | **Weight + Method**                                  |
| ------------------------- | ---------------------------------------------------- |
| Title keyword match       | 20% - does primary keyword appear in title?          |
| Short description density | 15% - keyword frequency in short desc (target: 1-2x) |
| Description density       | 15% - keyword frequency in full desc (target: 4-8x)  |
| Rating score              | 15% - (stars / 5) \* 100, weighted by review count   |
| Install velocity          | 10% - estimated from installs string                 |
| Update recency            | 10% - last update within 90 days = full score        |
| Review count              | 10% - log scale, 1000+ reviews = max                 |
| Screenshots count         | 5% - 8 screenshots = max score                       |

# **6\. Web Application (packages/web)**

## **6.1 Pages and Components**

| **Page / Route**  | **Content**                                                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| / (Dashboard)     | ASO score card, score trend chart (7-day), top keyword positions, insights feed, competitor overview widget                                    |
| /keywords         | Tracked keywords table with position, change (+/-), difficulty bar, traffic bar, 7-day trend sparkline. Add/remove keywords. Bulk score check. |
| /competitors      | Add competitor by appId. Side-by-side comparison table: title, rating, reviews, installs, last update, ASO score. Keyword gap analysis table.  |
| /keyword-research | Search box. Returns keyword list with difficulty, traffic, priority score. Filter by difficulty range. Export CSV.                             |
| /settings         | App management (add/remove tracked apps). MCP API key generation and management. Account settings.                                             |

## **6.2 Key Components**

| **Component**        | **Description**                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| ASOScoreCard         | Circular gauge 0-100, color-coded (red &lt; 40, amber 40-70, green &gt; 70), trend arrow                  |
| KeywordTable         | Sortable by position/difficulty/traffic. Row color: green #1-3, amber #4-10, gray > 10. Change badge +/-. |
| CompetitorCompare    | Two-column card layout. Green = you win, red = they win per metric.                                       |
| RankHistoryChart     | Line chart (recharts). One line per tracked keyword. 7/14/30 day toggle.                                  |
| KeywordResearchPanel | Search input → debounced API call → table with difficulty bar and traffic bar.                            |
| MCPKeyManager        | Show/hide API key. Copy button. Revoke and regenerate. Permission checkboxes.                             |

## **6.3 Auth Flow**

- User lands on /login - Firebase email/password auth
- On success - Firebase ID token stored in memory (not localStorage)
- All API calls include Authorization: Bearer &lt;token&gt; header
- Token refreshed automatically by Firebase SDK every hour

# **7\. MCP Server (packages/mcp)**

## **7.1 Overview**

The MCP server exposes all ASO Intelligence tools to AI agents. It supports stdio transport for local use (Claude Code, Claude Desktop, Cursor, etc.) and HTTP transport for remote access. Authentication is via API key stored in Firestore mcp_clients collection.

## **7.2 Authentication**

Every tool call must include an api_key argument OR the server is configured with a default API key via environment variable. The middleware:

- Extracts api_key from tool call arguments
- Hashes it with SHA-256
- Looks up hash in Firestore mcp_clients collection
- Checks permissions\[\] array for the requested tool
- Rejects with McpError(ErrorCode.InvalidRequest) if invalid

API keys are generated in the web app Settings page and stored as SHA-256 hashes in Firestore.

## **7.3 MCP Server Entry (packages/mcp/src/index.js)**

import { Server } from '@modelcontextprotocol/sdk/server/index.js';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server(

{ name: 'aso-intelligence', version: '1.0.0' },

{ capabilities: { tools: {} } }

);

// Register all tools (see 7.4)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: ALL_TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {

const { name, arguments: args } = req.params;

await verifyApiKey(args.api_key); // throws if invalid

return await toolHandlers\[name\](args);

});

const transport = new StdioServerTransport();

await server.connect(transport);

## **7.4 MCP Tools - Complete List**

| **Tool Name**            | **Arguments**                          | **Description**                                                               |
| ------------------------ | -------------------------------------- | ----------------------------------------------------------------------------- |
| get_app_details          | api_key, appId, country?               | Fetch full app metadata from Play Store                                       |
| get_aso_score            | api_key, appId, keyword, country?      | Calculate ASO score 0-100 for app+keyword                                     |
| get_keyword_rank         | api_key, appId, keyword, country?      | Get app position for a keyword (live)                                         |
| get_keyword_rank_history | api_key, appId, keyword, days?         | Get historical rank snapshots                                                 |
| get_keyword_scores       | api_key, keyword, country?             | Get difficulty + traffic scores                                               |
| get_keyword_suggestions  | api_key, keyword, appId, country?      | Get keyword suggestions                                                       |
| bulk_keyword_scores      | api_key, keywords\[\], country?        | Scores for multiple keywords                                                  |
| compare_competitors      | api_key, appId, competitorId, country? | Full competitor comparison                                                    |
| get_keyword_gap          | api_key, appId, competitorId           | Keywords competitor ranks for that app doesn't                                |
| search_apps              | api_key, term, country?                | Search Play Store, return ranked results                                      |
| add_tracked_keyword      | api_key, appId, keyword, country?      | Add keyword to tracking in Firestore                                          |
| list_tracked_keywords    | api_key, appId                         | List all tracked keywords with latest positions                               |
| add_competitor           | api_key, appId, competitorId           | Add competitor to track                                                       |
| list_competitors         | api_key, appId                         | List competitors with latest comparison data                                  |
| get_aso_health_overview  | api_key, appId                         | Full ASO health report: score, keyword positions, top issues, recommendations |

## **7.5 MCP Client Config (for Claude Desktop / Claude Code)**

{

"aso-intelligence": {

"command": "node",

"args": \["/path/to/aso-platform/packages/mcp/src/index.js"\],

"env": {

"MCP_API_KEY": "your-api-key-here",

"FIREBASE_SERVICE_ACCOUNT": "/path/to/serviceAccount.json",

"API_BASE_URL": "<http://localhost:3001/api>"

}

}

}

When MCP_API_KEY is set in env, all tool calls use it automatically - no need to pass api_key in each call.

# **8\. Environment Configuration**

## **8.1 .env.example (root)**

\# Firebase (Admin SDK - for API + MCP)

FIREBASE_SERVICE_ACCOUNT_PATH=./firebase/serviceAccount.json

FIREBASE_PROJECT_ID=your-project-id

\# Firebase (Client SDK - for Web)

VITE_FIREBASE_API_KEY=xxx

VITE_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com

VITE_FIREBASE_PROJECT_ID=your-project-id

\# API Server

API_PORT=3001

API_RATE_LIMIT_PER_MIN=60

\# MCP Server

MCP_DEFAULT_API_KEY= # optional: skip auth in dev

MCP_API_BASE_URL=<http://localhost:3001/api>

# **9\. Local Development Setup**

## **9.1 Prerequisites**

- Node.js 20+
- npm 10+
- Firebase project with Firestore + Auth enabled
- Firebase service account JSON downloaded

## **9.2 Install + Run**

git clone &lt;repo&gt;

cd aso-platform

npm install # installs all workspace packages

cp .env.example .env # fill in your Firebase config

\# Terminal 1 - API server

npm run dev:api # starts on :3001

\# Terminal 2 - Web app

npm run dev:web # starts on :5173

\# MCP server (run when needed)

npm run start:mcp # stdio mode

## **9.3 package.json (root) Scripts**

"scripts": {

"dev:api": "npm run dev --workspace=packages/api",

"dev:web": "npm run dev --workspace=packages/web",

"start:mcp": "node packages/mcp/src/index.js",

"install:all": "npm install"

}

# **10\. Implementation Notes for AI Agent**

## **10.1 Build Order**

- Set up monorepo structure and package.json workspaces
- Initialize Firebase Admin SDK in packages/api/src/lib/firebase.js
- Build PlayStore service (packages/api/src/services/playstore.js) wrapping google-play-scraper
- Build Keywords service (packages/api/src/services/keywords.js) wrapping aso + google-play-keywords
- Build all Express routes
- Add node-cron job for daily rank snapshots
- Build MCP server with all 15 tools
- Build React frontend pages and components
- Write Firestore security rules
- Test end-to-end with appId: com.iishanto.servermanager

## **10.2 Critical Implementation Details**

- google-play-scraper throttles at ~10 req/sec. Add 1000ms delay between bulk calls.
- Keyword rank detection: search({ term, num: 250, fullDetail: false }) then find index of appId in results array. Position = index + 1.
- ASO score must be recalculated on every request - do NOT cache it (it changes with metadata updates).
- keyword_scores CAN be cached 24hrs in Firestore since they change slowly.
- MCP server uses stdio transport by default. HTTP transport can be added later for remote access.
- Never store raw API keys - always SHA-256 hash before storing in Firestore.
- The aso package internally uses google-play-scraper. Pass { throttle: 10 } to aso client constructor to avoid 503s.

## **10.3 Testing the MCP Server**

After setup, test with MCP Inspector:

npx @modelcontextprotocol/inspector node packages/mcp/src/index.js

This opens a browser UI where you can call each tool and inspect responses.

## **10.4 One-Shot Test Prompt for AI Agent**

After building, verify the full stack works with this single prompt to the MCP:

"Using the ASO Intelligence MCP, give me a full analysis of

com.iishanto.servermanager. Include its ASO score, current rank

for keywords \[ssh client, server admin, free vps\], keyword

difficulty and traffic for each, and 5 keyword suggestions."

_End of SRS - ASO Intelligence Platform v1.0_