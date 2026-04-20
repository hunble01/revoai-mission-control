'use client';

import { useEffect, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

import { API_BASE, apiHeaders } from '../../lib/api';
import { ComingSoon } from '../../components/ComingSoon';

export default function FacebookPage() {
  const [status, setStatus] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [err, setErr] = useState('');

  const load = async () => {
    const headers = apiHeaders;
    const [s, p, i] = await Promise.all([
      fetch(`${API_BASE}/api/facebook/status`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => ({})),
      fetch(`${API_BASE}/api/social-posts?status=approved`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => ([])),
      fetch(`${API_BASE}/api/facebook/insights`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => ({})),
    ]);
    setStatus(s);
    setPosts((Array.isArray(p) ? p : []).filter((x: any) => String(x.channel) === 'FACEBOOK'));
    setInsights(i);
  };

  useEffect(() => { load().catch((e: any) => setErr(e?.message || 'Failed')); }, []);

  return (
    <div className="dash-stack fade-in">
      <section className="page-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="page-eyebrow">CHANNELS / FACEBOOK</div>
          <h2 className="page-title" style={{ margin: 0 }}>Facebook Manager</h2>
          <p className="page-desc">Meta Graph API connection, approval-gated publishing, and page insights.</p>
        </div>
        <div style={{ alignSelf: 'flex-start', marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: status?.connected ? 'rgba(16,214,138,.1)' : 'rgba(255,91,122,.1)', border: `1px solid ${status?.connected ? 'rgba(16,214,138,.25)' : 'rgba(255,91,122,.25)'}`, borderRadius: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: status?.connected ? 'var(--emerald)' : 'var(--rose)', boxShadow: `0 0 6px ${status?.connected ? 'var(--emerald)' : 'var(--rose)'}` }} />
            <span style={{ fontSize: 12, color: status?.connected ? 'var(--emerald)' : 'var(--rose)', fontWeight: 600 }}>{status?.connected ? 'Connected' : 'Disconnected'}</span>
            <span className="text-xs mono text-dim" style={{ marginLeft: 4 }}>token {status?.expiresInSec != null ? `${Math.floor(status.expiresInSec / 86400)}d` : '—'}</span>
          </div>
        </div>
      </section>
      <ComingSoon feature="Facebook posts + insights" needs="Meta Developer app credentials (FACEBOOK_CLIENT_ID/SECRET, FACEBOOK_PAGE_ID) and flipping FACEBOOK_STUB_MODE=0" />
      {err && <p style={{ color: '#ff9b9b' }}>{err}</p>}

      <div className="kpi-grid mb-16">
        {[
          { label: 'Approved Queue', value: String(posts.length), sub: 'ready to publish', color: 'cyan' },
          { label: 'Reach', value: String(insights?.reach ?? 0), sub: 'latest pull', color: 'emerald' },
          { label: 'Engagement', value: String(insights?.engagement ?? 0), sub: 'latest pull', color: 'amber' },
          { label: 'Followers Δ', value: String(insights?.followersDelta ?? 0), sub: 'latest pull', color: 'violet' },
        ].map((k) => (
          <div key={k.label} className={`kpi-card ${k.color}`}>
            <div className="kpi-label">{k.label}</div>
            <div className={`kpi-value ${k.color}`}>{k.value}</div>
            <div className="kpi-delta">{k.sub}</div>
          </div>
        ))}
      </div>

      <Card title="Connection" subtitle="Page token status">
        <p className="muted">Connected: {String(!!status?.connected)}</p>
        <p className="muted">Expires in: {status?.expiresInSec != null ? `${Math.floor(status.expiresInSec / 3600)}h` : '—'}</p>
        <div className="table-toolbar">
          <Button variant="primary" onClick={async () => {
            const res = await fetch(`${API_BASE}/api/facebook/oauth-start`, { credentials: 'include', headers: apiHeaders });
            const d = await res.json().catch(() => ({}));
            if (d?.authUrl) window.location.href = d.authUrl;
          }}>Connect Facebook</Button>
        </div>
      </Card>

      <Card title="Approved Queue" subtitle="Approval-gated publishing">
        {posts.map((p: any) => (
          <div key={p.id} className="post-card" style={{ marginBottom: 8 }}>
            <div className="flex gap-8 mb-8">
              <span className="badge new">FACEBOOK</span>
              <span className="badge active">{String(p.status || '').toUpperCase()}</span>
            </div>
            <div className="post-preview" style={{ WebkitLineClamp: 'unset' }}>{p.body}</div>
            <div className="table-toolbar">
              <Button variant="primary" onClick={async () => {
                await fetch(`${API_BASE}/api/facebook/publish`, {
                  method: 'POST',
                  credentials: 'include',
                  headers: apiHeaders,
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
