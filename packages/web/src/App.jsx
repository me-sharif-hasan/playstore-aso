import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './lib/firebase.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Keywords from './pages/Keywords.jsx';
import Competitors from './pages/Competitors.jsx';
import KeywordResearch from './pages/KeywordResearch.jsx';
import Settings from './pages/Settings.jsx';

function Layout({ children }) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const linkClass = ({ isActive }) =>
    `flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
    }`;

  return (
    <div className="flex h-screen">
      <aside className="w-56 bg-slate-900 flex flex-col shrink-0">
        <div className="px-4 py-5 border-b border-slate-700">
          <span className="text-white font-bold text-lg">ASO Intelligence</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavLink to="/" end className={linkClass}>Dashboard</NavLink>
          <NavLink to="/keywords" className={linkClass}>Keywords</NavLink>
          <NavLink to="/competitors" className={linkClass}>Competitors</NavLink>
          <NavLink to="/keyword-research" className={linkClass}>Research</NavLink>
          <NavLink to="/settings" className={linkClass}>Settings</NavLink>
        </nav>
        <div className="p-3 border-t border-slate-700">
          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-700"
          >
            Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u || null));
  }, []);

  if (user === undefined) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/" element={<ProtectedRoute user={user}><Dashboard /></ProtectedRoute>} />
        <Route path="/keywords" element={<ProtectedRoute user={user}><Keywords /></ProtectedRoute>} />
        <Route path="/competitors" element={<ProtectedRoute user={user}><Competitors /></ProtectedRoute>} />
        <Route path="/keyword-research" element={<ProtectedRoute user={user}><KeywordResearch /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute user={user}><Settings /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
