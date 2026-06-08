import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../lib/firebase.js';

const BACKEND = import.meta.env.VITE_API_URL || 'https://aso-be.iishanto.com';
const googleProvider = new GoogleAuthProvider();

export default function OAuthAuthorize() {
  const [params] = useSearchParams();
  const clientId = params.get('client_id');
  const redirectUri = params.get('redirect_uri');
  const state = params.get('state') || '';
  const codeChallenge = params.get('code_challenge') || '';
  const codeChallengeMethod = params.get('code_challenge_method') || '';

  const [user, setUser] = useState(undefined); // undefined = loading
  const [clientName, setClientName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  // Fetch client name for display
  useEffect(() => {
    if (!clientId) return;
    fetch(`${BACKEND}/.well-known/oauth-authorization-server`)
      .then((r) => r.json())
      .catch(() => null);
    // Client name comes from Firestore — fetch via a public endpoint
    // We show the client_id if name unavailable; for now decode from URL
    setClientName(params.get('app_name') || 'ChatGPT');
  }, [clientId]);

  const handleLogin = async (e) => {
    e?.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  const handleAllow = async () => {
    if (!user || !clientId || !redirectUri) return;
    setAuthorizing(true);
    setError('');
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`${BACKEND}/oauth/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebase_token: idToken,
          client_id: clientId,
          redirect_uri: redirectUri,
          state,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authorization failed');
      window.location.href = data.redirect_url;
    } catch (err) {
      setError(err.message);
      setAuthorizing(false);
    }
  };

  const handleDeny = () => {
    const url = new URL(redirectUri);
    url.searchParams.set('error', 'access_denied');
    if (state) url.searchParams.set('state', state);
    window.location.href = url.toString();
  };

  if (!clientId || !redirectUri) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
          <p className="text-red-500 font-medium">Invalid authorization request.</p>
          <p className="text-gray-500 text-sm mt-2">Missing client_id or redirect_uri.</p>
        </div>
      </div>
    );
  }

  if (user === undefined) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">ASO Intelligence</h1>
          <p className="text-sm text-gray-500 mt-1">
            <strong className="text-gray-700">{clientName}</strong> wants to access your ASO data
          </p>
        </div>

        {/* Permissions box */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">This will allow access to</p>
          <ul className="space-y-1.5 text-sm text-gray-700">
            {['Your tracked apps and competitors', 'Keyword rankings and history', 'ASO scores and analysis'].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {user ? (
          /* Already logged in — show allow/deny */
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl mb-4">
              {user.photoURL && <img src={user.photoURL} className="w-8 h-8 rounded-full" alt="" />}
              <div>
                <p className="text-sm font-medium text-gray-800">{user.displayName || user.email}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
            </div>
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            <button
              onClick={handleAllow}
              disabled={authorizing}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {authorizing && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {authorizing ? 'Authorizing…' : 'Allow Access'}
            </button>
            <button
              onClick={handleDeny}
              disabled={authorizing}
              className="w-full py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-medium border border-gray-300 rounded-xl transition-colors"
            >
              Deny
            </button>
          </div>
        ) : (
          /* Not logged in — show login form */
          <div className="space-y-4">
            <p className="text-sm text-gray-600 text-center mb-2">Sign in to authorize {clientName}</p>
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium text-gray-700 disabled:opacity-60"
            >
              <svg className="w-5 h-5" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                <path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z" />
                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
              </svg>
              Continue with Google
            </button>
            <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div><div className="relative flex justify-center text-xs text-gray-400 bg-white px-2">or</div></div>
            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Email" required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Password" required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                type="submit" disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-60"
              >
                {loading ? 'Signing in…' : 'Sign In & Authorize'}
              </button>
            </form>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mt-4">
          Your data is only shared with authorized apps.
        </p>
      </div>
    </div>
  );
}
