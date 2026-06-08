import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { apiRateLimit } from './middleware/rateLimit.js';
import { requireAuth } from './middleware/auth.js';
import { requireMcpKey } from './middleware/mcpAuth.js';
import appRoutes from './routes/app.js';
import keywordRoutes from './routes/keyword.js';
import competitorRoutes from './routes/competitor.js';
import asoRoutes from './routes/aso.js';
import actionsRoutes from './routes/actions.js';
import mcpHttpRoutes from './routes/mcp-http.js';
import { router as oauthRouter, oauthMetaHandler } from './routes/oauth.js';
import { startRankTracker } from './jobs/cron-rank-tracker.js';

const app = express();
const PORT = process.env.API_PORT || 3001;

app.set('trust proxy', 1); // behind Nginx
app.use(morgan('dev'));
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(apiRateLimit);

app.use('/api/app', requireAuth, appRoutes);
app.use('/api/keywords', requireAuth, keywordRoutes);
app.use('/api/keyword', requireAuth, keywordRoutes);
app.use('/api/competitor', requireAuth, competitorRoutes);
app.use('/api/aso', requireAuth, asoRoutes);

// ChatGPT Actions routes — authenticated via MCP API key (Bearer token)
app.use('/actions', requireMcpKey, actionsRoutes);

// Native MCP over HTTP (StreamableHTTP transport) — for ChatGPT, Claude.ai, Cursor
// Auth: pass api_key in tool args OR Authorization: Bearer <mcp-key> header
app.use('/mcp', mcpHttpRoutes);

// OAuth 2.0 authorization server
app.get('/.well-known/oauth-authorization-server', oauthMetaHandler);
app.use('/oauth', oauthRouter);

// OpenAPI spec for ChatGPT Actions import (public)
app.get('/openapi.json', (req, res) => {
  res.json({
    openapi: '3.1.0',
    info: { title: 'ASO Intelligence API', version: '1.0.0', description: 'App Store Optimization tools: keyword ranks, scores, competitor analysis' },
    servers: [{ url: 'https://aso-be.iishanto.com' }],
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: 'http', scheme: 'bearer', description: 'MCP API key from aso.iishanto.com/settings' },
      },
    },
    security: [{ ApiKeyAuth: [] }],
    paths: {
      '/actions/apps': {
        get: {
          operationId: 'listTrackedApps',
          summary: 'List all apps the user has added for tracking, with their competitors',
          responses: { '200': { description: 'List of tracked apps with appId, title, icon, competitors array' } },
        },
      },
      '/actions/app/{appId}': {
        get: {
          operationId: 'getAppDetails',
          summary: 'Get app details from Google Play Store',
          parameters: [
            { name: 'appId', in: 'path', required: true, schema: { type: 'string' }, description: 'Package name e.g. com.example.app' },
            { name: 'country', in: 'query', schema: { type: 'string', default: 'us' } },
          ],
          responses: { '200': { description: 'App metadata' } },
        },
      },
      '/actions/keyword/scores': {
        get: {
          operationId: 'getKeywordScores',
          summary: 'Get difficulty and traffic scores for a keyword (0-100)',
          parameters: [
            { name: 'keyword', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'country', in: 'query', schema: { type: 'string', default: 'us' } },
          ],
          responses: { '200': { description: 'Difficulty and traffic scores' } },
        },
      },
      '/actions/keyword/suggest': {
        get: {
          operationId: 'getKeywordSuggestions',
          summary: 'Get keyword suggestions based on autocomplete',
          parameters: [
            { name: 'keyword', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'appId', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'country', in: 'query', schema: { type: 'string', default: 'us' } },
          ],
          responses: { '200': { description: 'Keyword suggestions list' } },
        },
      },
      '/actions/keyword/bulk-scores': {
        post: {
          operationId: 'bulkKeywordScores',
          summary: 'Get difficulty+traffic scores for multiple keywords at once',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['keywords'],
                  properties: {
                    keywords: { type: 'array', items: { type: 'string' }, maxItems: 20 },
                    country: { type: 'string', default: 'us' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Scores for each keyword' } },
        },
      },
      '/actions/keyword/rank': {
        get: {
          operationId: 'getKeywordRank',
          summary: 'Get live Play Store rank for an app on a keyword',
          parameters: [
            { name: 'appId', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'keyword', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'country', in: 'query', schema: { type: 'string', default: 'us' } },
          ],
          responses: { '200': { description: 'Position in search results' } },
        },
      },
      '/actions/keywords/{appId}': {
        get: {
          operationId: 'listTrackedKeywords',
          summary: 'List all tracked keywords with latest positions for an app',
          parameters: [
            { name: 'appId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Keywords with position, difficulty, traffic' } },
        },
      },
      '/actions/competitor/compare': {
        get: {
          operationId: 'compareCompetitors',
          summary: 'Side-by-side comparison of two apps',
          parameters: [
            { name: 'appId', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'competitorId', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'country', in: 'query', schema: { type: 'string', default: 'us' } },
          ],
          responses: { '200': { description: 'Comparison data' } },
        },
      },
    },
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, error: err.message });
});

startRankTracker();

app.listen(PORT, () => {
  console.log(`ASO API running on http://localhost:${PORT}`);
});

export default app;
