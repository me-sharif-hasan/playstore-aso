import { db } from '../lib/firebase.js';

async function sha256(str) {
  const { createHash } = await import('crypto');
  return createHash('sha256').update(str).digest('hex');
}

export async function requireMcpKey(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing API key' });
  }
  const rawKey = auth.slice(7).trim();
  try {
    const hash = await sha256(rawKey);
    const snap = await db.collection('mcp_clients').where('apiKeyHash', '==', hash).limit(1).get();
    if (snap.empty) return res.status(401).json({ success: false, error: 'Invalid API key' });
    const client = snap.docs[0];
    // Update lastUsed non-blocking
    client.ref.update({ lastUsed: new Date() }).catch(() => {});
    req.mcpClient = { id: client.id, ...client.data() };
    next();
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
