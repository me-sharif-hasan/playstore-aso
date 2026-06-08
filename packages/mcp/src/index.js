import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { verifyApiKey } from './auth/index.js';
import { TOOL_DEFINITIONS, toolHandlers } from './tools/index.js';

const server = new Server(
  { name: 'aso-intelligence', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOL_DEFINITIONS,
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  const apiKey = args?.api_key || process.env.MCP_DEFAULT_API_KEY;
  await verifyApiKey(apiKey, name);

  const handler = toolHandlers[name];
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }

  return await handler(args);
});

const transport = new StdioServerTransport();
await server.connect(transport);
