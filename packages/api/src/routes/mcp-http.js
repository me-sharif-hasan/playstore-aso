import { Router } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TOOL_DEFINITIONS, toolHandlers } from '../../mcp/src/tools/index.js';
import { verifyApiKey } from '../../mcp/src/auth/index.js';

const router = Router();

function createMcpServer(apiKeyFromHeader) {
  const server = new Server(
    { name: 'aso-intelligence', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOL_DEFINITIONS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    // Accept api_key from tool args OR from Authorization header
    const apiKey = args?.api_key || apiKeyFromHeader;
    await verifyApiKey(apiKey, name);
    const handler = toolHandlers[name];
    if (!handler) throw new Error(`Unknown tool: ${name}`);
    return handler({ ...args, api_key: apiKey });
  });

  return server;
}

// Stateless: new transport per request
router.all('/', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const apiKeyFromHeader = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : undefined;

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = createMcpServer(apiKeyFromHeader);

    res.on('close', () => { server.close().catch(() => {}); });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error('[mcp-http]', e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

export default router;
