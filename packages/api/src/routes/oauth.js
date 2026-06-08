import { Router } from 'express';
import { db } from '../lib/firebase.js';
import { requireAuth } from '../middleware/auth.js';
import { createHash, randomBytes, randomUUID } from 'crypto';

export const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://aso.iishanto.com';
const BACKEND_URL = process.env.BACKEND_URL || 'https://aso-be.iishanto.com';

function sha256(str) {
  return createHash('sha256').update(str).digest('hex');
}

function randomHex(bytes = 32) {
  return randomBytes(bytes).toString('hex');
}

// ── Client Registration (requires Firebase auth) ──────────────────────────────
router.post('/clients', requireAuth, async (req, res) => {
  try {
    const { name, redirect_uris } = req.body;
    const uid = req.user?.uid;
    if (!name || !redirect_uris?.length) return res.status(400).json({ error: 'name and redirect_uris required' });

    const clientId = randomUUID();
    const clientSecret = randomHex(32);

    await db.collection('oauth_clients').doc(clientId).set({
      clientId, clientSecretHash: sha256(clientSecret),
      owner: uid, name, redirectUris: redirect_uris,
      createdAt: new Date(),
    });

    res.json({ client_id: clientId, client_secret: clientSecret, name, redirect_uris });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/clients', requireAuth, async (req, res) => {
  try {
    const uid = req.user?.uid;
    const snap = await db.collection('oauth_clients').where('owner', '==', uid).get();
    const clients = snap.docs.map((d) => {
      const { clientSecretHash, ...safe } = d.data();
      return safe;
    });
    res.json({ clients });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/clients/:clientId', requireAuth, async (req, res) => {
  try {
    const uid = req.user?.uid;
    const doc = await db.collection('oauth_clients').doc(req.params.clientId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    if (doc.data().owner !== uid) return res.status(403).json({ error: 'Forbidden' });
    await doc.ref.delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Authorize — redirect to frontend login page ───────────────────────────────
router.get('/authorize', (req, res) => {
  const { client_id, redirect_uri, response_type, state, code_challenge, code_challenge_method, scope } = req.query;
  if (!client_id || !redirect_uri) return res.status(400).send('client_id and redirect_uri required');
  const params = new URLSearchParams({
    client_id, redirect_uri,
    response_type: response_type || 'code',
    state: state || '',
    scope: scope || 'aso:read aso:write',
    code_challenge: code_challenge || '',
    code_challenge_method: code_challenge_method || '',
  });
  res.redirect(`${FRONTEND_URL}/oauth/authorize?${params}`);
});

// ── Callback — frontend POSTs Firebase token here to get auth code ─────────────
router.post('/callback', async (req, res) => {
  try {
    const { firebase_token, client_id, redirect_uri, state, code_challenge, code_challenge_method } = req.body;
    if (!firebase_token || !client_id || !redirect_uri) {
      return res.status(400).json({ error: 'firebase_token, client_id, redirect_uri required' });
    }
    const { getAuth } = await import('firebase-admin/auth');
    const decoded = await getAuth().verifyIdToken(firebase_token);
    const uid = decoded.uid;

    const clientDoc = await db.collection('oauth_clients').doc(client_id).get();
    if (!clientDoc.exists) return res.status(400).json({ error: 'Unknown client_id' });
    const client = clientDoc.data();
    if (!client.redirectUris.includes(redirect_uri)) {
      return res.status(400).json({ error: 'redirect_uri not allowed' });
    }

    const code = randomHex(24);
    await db.collection('oauth_codes').doc(code).set({
      code, uid, clientId: client_id, redirectUri: redirect_uri,
      codeChallenge: code_challenge || null,
      codeChallengeMethod: code_challenge_method || null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const callbackUrl = new URL(redirect_uri);
    callbackUrl.searchParams.set('code', code);
    if (state) callbackUrl.searchParams.set('state', state);
    res.json({ redirect_url: callbackUrl.toString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Token endpoint ────────────────────────────────────────────────────────────
router.post('/token', async (req, res) => {
  try {
    const { grant_type, code, client_id, client_secret, redirect_uri, code_verifier } = req.body;
    if (grant_type !== 'authorization_code') {
      return res.status(400).json({ error: 'unsupported_grant_type' });
    }
    if (!code || !client_id || !redirect_uri) {
      return res.status(400).json({ error: 'code, client_id, redirect_uri required' });
    }

    const clientDoc = await db.collection('oauth_clients').doc(client_id).get();
    if (!clientDoc.exists) return res.status(401).json({ error: 'invalid_client' });
    const client = clientDoc.data();
    if (client_secret && client.clientSecretHash !== sha256(client_secret)) {
      return res.status(401).json({ error: 'invalid_client' });
    }

    const codeDoc = await db.collection('oauth_codes').doc(code).get();
    if (!codeDoc.exists) return res.status(400).json({ error: 'invalid_grant' });
    const codeData = codeDoc.data();
    if (codeData.clientId !== client_id || codeData.redirectUri !== redirect_uri) {
      return res.status(400).json({ error: 'invalid_grant' });
    }
    const expiresAt = codeData.expiresAt?.toDate ? codeData.expiresAt.toDate() : new Date(codeData.expiresAt);
    if (expiresAt < new Date()) return res.status(400).json({ error: 'invalid_grant', error_description: 'Code expired' });

    if (codeData.codeChallenge) {
      if (!code_verifier) return res.status(400).json({ error: 'invalid_grant', error_description: 'code_verifier required' });
      const challenge = createHash('sha256').update(code_verifier).digest('base64url');
      if (challenge !== codeData.codeChallenge) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE failed' });
      }
    }

    await codeDoc.ref.delete();

    const uid = codeData.uid;
    const keyName = `ChatGPT OAuth (${client.name})`;
    const existingSnap = await db.collection('mcp_clients')
      .where('owner', '==', uid).where('oauthClientId', '==', client_id).limit(1).get();

    let accessToken;
    if (!existingSnap.empty && existingSnap.docs[0].data().rawKey) {
      accessToken = existingSnap.docs[0].data().rawKey;
      await existingSnap.docs[0].ref.update({ lastUsed: new Date() });
    } else {
      if (!existingSnap.empty) await existingSnap.docs[0].ref.delete();
      accessToken = await createMcpToken(uid, keyName, client_id);
    }

    res.json({ access_token: accessToken, token_type: 'bearer', scope: 'aso:read aso:write' });
  } catch (e) {
    console.error('[oauth/token]', e.message);
    res.status(500).json({ error: 'server_error', error_description: e.message });
  }
});

async function createMcpToken(uid, name, oauthClientId) {
  const rawKey = randomHex(32);
  await db.collection('mcp_clients').add({
    name, apiKeyHash: sha256(rawKey), rawKey,
    owner: uid, oauthClientId,
    permissions: [
      'get_app_details', 'get_aso_score', 'get_keyword_rank', 'get_keyword_rank_history',
      'get_keyword_scores', 'get_keyword_suggestions', 'bulk_keyword_scores',
      'compare_competitors', 'get_keyword_gap', 'search_apps',
      'add_tracked_keyword', 'list_tracked_keywords', 'add_competitor',
      'list_competitors', 'get_aso_health_overview', 'list_tracked_apps', 'get_tracked_keywords_export',
    ],
    createdAt: new Date(), lastUsed: null,
  });
  return rawKey;
}

// ── Metadata (exported separately for root mount) ─────────────────────────────
export function oauthMetaHandler(req, res) {
  res.json({
    issuer: BACKEND_URL,
    authorization_endpoint: `${BACKEND_URL}/oauth/authorize`,
    token_endpoint: `${BACKEND_URL}/oauth/token`,
    registration_endpoint: `${BACKEND_URL}/oauth/clients`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    scopes_supported: ['aso:read', 'aso:write'],
  });
}
