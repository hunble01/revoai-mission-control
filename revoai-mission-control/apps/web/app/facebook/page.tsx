'use client';

import { useEffect, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

export default function FacebookPage() {
  const [status, setStatus] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [err, setErr] = useState('');

  const load = async () => {
    const headers = { 'x-admin-token': token };
    const [s, p, i] = await Promise.all([
      fetch(`${base}/api/facebook/status`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => ({})),
      fetch(`${base}/api/social-posts?status=approved`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => ([])),
      fetch(`${base}/api/facebook/insights`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => ({})),
    ]);
    setStatus(s);
    setPosts((Array.isArray(p) ? p : []).filter((x: any) => String(x.channel) === 'FACEBOOK'));
    setInsights(i);
  };

  useEffect(() => { load().catch((e: any) => setErr(e?.message || 'Failed')); }, []);

  return (
    <div className="dash-stack">
      <section className="page-hero">
        <h3>Facebook Manager</h3>
        <p>OAuth, post queue, publish, and insights.</p>
      </section>
      {err && <p style={{ color: '#ff9b9b' }}>{err}</p>}

      <Card title="Connection" subtitle="Page token status">
        <p className="muted">Connected: {String(!!status?.connected)}</p>
        <p className="muted">Expires in: {status?.expiresInSec != null ? `${Math.floor(status.expiresInSec / 3600)}h` : '—'}</p>
        <div className="table-toolbar">
          <Button variant="primary" onClick={async () => {
            const res = await fetch(`${base}/api/facebook/oauth-start`, { credentials: 'include', headers: { 'x-admin-token': token } });
            const d = await res.json().catch(() => ({}));
            if (d?.authUrl) window.location.href = d.authUrl;
          }}>Connect Facebook</Button>
        </div>
      </Card>

      <Card title="Approved Queue" subtitle="Approval-gated publishing">
        {posts.map((p: any) => (
          <div key={p.id} className="ui-card" style={{ padding: 10, marginBottom: 8 }}>
            <p style={{ marginTop: 0 }}>{p.body}</p>
            <div className="table-toolbar">
              <Badge>{p.status}</Badge>
              <Button variant="primary" onClick={async () => {
                await fetch(`${base}/api/facebook/publish`, {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'content-type': 'application/json', 'x-admin-token': token },
                  body: JSON.stringify({ socialPostId: p.id, mode: 'socialPost' }),
                });
                await load();
              }}>Publish</Button>
            </div>
          </div>
        ))}
        {!posts.length && <p className="muted">No approved Facebook posts queued.</p>}
      </Card>

      <Card title="Insights" subtitle="Reach + engagement baseline">
        <div className="table-toolbar">
          <span className="muted">Reach: {insights?.reach ?? '—'}</span>
          <span className="muted">Engagement: {insights?.engagement ?? '—'}</span>
          <span className="muted">Followers Δ: {insights?.followersDelta ?? '—'}</span>
        </div>
      </Card>
    </div>
  );
}
