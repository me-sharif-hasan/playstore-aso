import crypto from 'crypto';
import { db } from '../lib/firebase.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

const PERMISSIONS_ALL = [
  'get_app_details', 'get_aso_score', 'get_keyword_rank', 'get_keyword_rank_history',
  'get_keyword_scores', 'get_keyword_suggestions', 'bulk_keyword_scores',
  'compare_competitors', 'get_keyword_gap', 'search_apps',
  'add_tracked_keyword', 'list_tracked_keywords', 'add_competitor',
  'list_competitors', 'get_aso_health_overview',
];

function hashKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

export async function verifyApiKey(apiKey, toolName) {
  if (!apiKey) {
    throw new McpError(ErrorCode.InvalidRequest, 'api_key is required');
  }

  const envKey = process.env.MCP_DEFAULT_API_KEY;
  if (envKey && apiKey === envKey) return true;

  const hash = hashKey(apiKey);
  const snap = await db.collection('mcp_clients').where('apiKeyHash', '==', hash).limit(1).get();

  if (snap.empty) {
    throw new McpError(ErrorCode.InvalidRequest, 'Invalid API key');
  }

  const client = snap.docs[0].data();
  const permissions = client.permissions || PERMISSIONS_ALL;

  if (!permissions.includes(toolName)) {
    throw new McpError(ErrorCode.InvalidRequest, `API key does not have permission for: ${toolName}`);
  }

  await snap.docs[0].ref.update({ lastUsed: new Date() });
  return true;
}
