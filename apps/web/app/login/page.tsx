'use client';

import { useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@revoai.local');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error?.message || 'Invalid credentials');
        setLoading(false);
        return;
      }
      window.location.replace('/');
    } catch (err: any) {
      setError(err?.message || 'Network error');
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <form onSubmit={onSubmit} className="login-card">
        <div className="login-brand">
          <span className="login-dot" />
          <div>
            <div className="login-title">RevoAI</div>
            <div className="login-sub">Mission Control</div>
          </div>
        </div>

        <label className="login-field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </label>

        <label className="login-field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </label>

        {error && <div className="login-error">{error}</div>}

        <button className="login-submit" type="submit" disabled={loading || !password}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
