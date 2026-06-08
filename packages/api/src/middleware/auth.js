import { admin } from '../lib/firebase.js';

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing auth token' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (e) {
    console.error('[auth] Token verification failed:', e.message);
    return res.status(401).json({ success: false, error: 'Invalid auth token' });
  }
}
