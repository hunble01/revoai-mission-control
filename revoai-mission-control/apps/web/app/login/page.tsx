'use client';

import { useState } from 'react';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const bootstrap = async () => {
    setErr('');
    setMsg('');
    setLoading(true);
    try {
      const res = await fetch(`${base}/api/auth/bootstrap`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Bootstrap failed');
      setMsg(data.created ? 'Bootstrap admin created.' : 'Bootstrap admin already exists.');
    } catch (e: any) {
      setErr(e?.message || 'Bootstrap failed');
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    setErr('');
    setMsg('');
    setLoading(true);
    try {
      const res = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Login failed');
      setMsg('Logged in. Redirecting...');
      setTimeout(() => {
        window.location.href = '/';
      }, 300);
    } catch (e: any) {
      setErr(e?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dash-stack" style={{ maxWidth: 560, margin: '40px auto' }}>
      <section className="page-hero">
        <h3>Mission Control Login</h3>
        <p>Session-based authentication is required.</p>
      </section>
      <div className="ui-card" style={{ padding: 14, display: 'grid', gap: 10 }}>
        {msg && <p className="muted">{msg}</p>}
        {err && <p style={{ color: '#ff9b9b' }}>{err}</p>}
        <input className="ui-input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="ui-input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="table-toolbar">
          <button className="ui-input" disabled={loading} onClick={login}>Login</button>
          <button className="ui-input" disabled={loading} onClick={bootstrap}>Bootstrap Admin</button>
        </div>
      </div>
    </div>
  );
}
