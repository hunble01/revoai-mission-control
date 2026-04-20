'use client';

import { useEffect, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CountUp } from '../../components/ui/CountUp';

import { API_BASE, apiHeaders } from '../../lib/api';
import { ComingSoon } from '../../components/ComingSoon';

export default function LinkedinPage() {
  const [status, setStatus] = useState<any>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [err, setErr] = useState('');

  const load = async () => {
    const headers = apiHeaders;
    const [s, q, h] = await Promise.all([
      fetch(`${API_BASE}/api/linkedin/status`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => ({})),
      fetch(`${API_BASE}/api/linkedin-dm/queue`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => ([])),
      fetch(`${API_BASE}/api/linkedin-dm/history`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => ([])),
    ]);
    setStatus(s);
    setQueue(Array.isArray(q) ? q : []);
    setHistory(Array.isArray(h) ? h : []);
  };

  useEffect(() => { load().catch((e: any) => setErr(e?.message || 'Failed')); }, []);

  return (
    <div className="dash-stack fade-in">
      <section className="page-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="page-eyebrow">CHANNELS / LINKEDIN</div>
          <h2 className="page-title" style={{ margin: 0 }}>LinkedIn Manager</h2>
          <p className="page-desc">OAuth, DM queue, daily cap, and reply tracking.</p>
        </div>
        <div style={{ alignSelf: 'flex-start', marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'rgba(16,214,138,.1)', border: '1px solid rgba(16,214,138,.25)', borderRadius: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--emerald)', boxShadow: '0 0 6px var(--emerald)' }} />
            <span style={{ fontSize: 12, color: 'var(--emerald)', fontWeight: 600 }}>Connected via Unipile</span>
            <span className="text-xs mono text-dim" style={{ marginLeft: 4 }}>token expires {status?.expiresInSec != null ? `${Math.floor(status.expiresInSec / 86400)}d` : '—'}</span>
          </div>
        </div>
      </section>
      <ComingSoon feature="LinkedIn posts + DMs" needs="LinkedIn Developer app credentials (LINKEDIN_CLIENT_ID/SECRET) and flipping LINKEDIN_STUB_MODE=0 — DMs additionally need Unipile's UNIPILE_API_KEY" />
      {err && <p style={{ color: '#ff9b9b' }}>{err}</p>}

      <div className="kpi-grid mb-16">
        {[
          { label: 'DMs Today', value: queue.filter((m) => m.status === 'sent').length, sub: 'of 20 daily limit', color: 'cyan' },
          { label: 'Queue', value: queue.length, sub: 'awaiting send', color: 'amber' },
          { label: 'Replies', value: history.filter((m) => !!m.replyReceivedAt).length, sub: 'this week', color: 'emerald' },
          { label: 'Connected', value: status?.connected ? 1 : 0, sub: status?.connected ? 'provider online' : 'provider offline', color: 'violet' },
        ].map((k) => (
          <div key={k.label} className={`kpi-card ${k.color}`}>
            <div className="kpi-label">{k.label}</div>
            <div className={`kpi-value ${k.color}`}><CountUp value={Number(k.value) || 0} /></div>
            <div className="kpi-delta">{k.sub}</div>
          </div>
        ))}
      </div>

      <Card title="Connection" subtitle="Token expiry countdown">
        <p className="muted">Connected: {String(!!status?.connected)}</p>
        <p className="muted">Expires in: {status?.expiresInSec != null ? `${Math.floor(status.expiresInSec / 3600)}h` : '—'}</p>
        <div className="table-toolbar">
          <Button variant="primary" onClick={async () => {
            const res = await fetch(`${API_BASE}/api/linkedin/oauth-start`, { credentials: 'include', headers: apiHeaders });
            const d = await res.json().catch(() => ({}));
            if (d?.authUrl) window.location.href = d.authUrl;
          }}>Connect LinkedIn</Button>
          <Badge tone="warning">Daily DM cap: 20</Badge>
        </div>
      </Card>

      <Card title="DM Queue" subtitle="Approve/send/reject">
        {queue.map((m: any) => (
          <div key={m.id} className="post-card" style={{ marginBottom: 8 }}>
            <div className="flex gap-8 mb-8">
              <span className={`badge ${m.status === 'approved' ? 'active' : 'pending'}`}>{String(m.status || '').toUpperCase()}</span>
              <span className="text-xs mono text-dim ml-auto">{m.createdAt ? new Date(m.createdAt).toLocaleString() : '—'}</span>
            </div>
            <div className="post-preview" style={{ WebkitLineClamp: 'unset' }}>{m.messageBody}</div>
            <div className="table-toolbar">
              <Button variant="primary" onClick={async () => { await fetch(`${API_BASE}/api/linkedin-dm/${m.id}/send`, { method: 'POST', credentials: 'include', headers: apiHeaders }); await load(); }}>↗️ Send via LinkedIn</Button>
              <Button variant="ghost" onClick={async () => { await fetch(`${API_BASE}/api/linkedin-dm/${m.id}/reject`, { method: 'POST', credentials: 'include', headers: apiHeaders }); await load(); }}>Reject</Button>
            </div>
          </div>
        ))}
        {!queue.length && <p className="muted">No queued messages.</p>}
      </Card>

      <Card title="Sent History" subtitle="Reply tracking">
        {history.map((m: any) => (
          <div key={m.id} className="table-toolbar" style={{ marginBottom: 6 }}>
            <span className="muted">{m.sentAt ? new Date(m.sentAt).toLocaleString() : '—'}</span>
            <span>{m.messageBody.slice(0, 60)}</span>
            <Badge tone={m.replyReceivedAt ? 'success' : 'default'}>{m.replyReceivedAt ? 'Replied' : 'No Reply'}</Badge>
          </div>
        ))}
        {!history.length && <p className="muted">No sent history.</p>}
      </Card>
    </div>
  );
}
