'use client';

import { useEffect, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

export default function LinkedinPage() {
  const [status, setStatus] = useState<any>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [err, setErr] = useState('');

  const load = async () => {
    const headers = { 'x-admin-token': token };
    const [s, q, h] = await Promise.all([
      fetch(`${base}/api/linkedin/status`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => ({})),
      fetch(`${base}/api/linkedin-dm/queue`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => ([])),
      fetch(`${base}/api/linkedin-dm/history`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => ([])),
    ]);
    setStatus(s);
    setQueue(Array.isArray(q) ? q : []);
    setHistory(Array.isArray(h) ? h : []);
  };

  useEffect(() => { load().catch((e: any) => setErr(e?.message || 'Failed')); }, []);

  return (
    <div className="dash-stack">
      <section className="page-hero">
        <h3>LinkedIn Manager</h3>
        <p>OAuth, DM queue, quota, and send history.</p>
      </section>
      {err && <p style={{ color: '#ff9b9b' }}>{err}</p>}

      <Card title="Connection" subtitle="Token expiry countdown">
        <p className="muted">Connected: {String(!!status?.connected)}</p>
        <p className="muted">Expires in: {status?.expiresInSec != null ? `${Math.floor(status.expiresInSec / 3600)}h` : '—'}</p>
        <div className="table-toolbar">
          <Button variant="primary" onClick={async () => {
            const res = await fetch(`${base}/api/linkedin/oauth-start`, { credentials: 'include', headers: { 'x-admin-token': token } });
            const d = await res.json().catch(() => ({}));
            if (d?.authUrl) window.location.href = d.authUrl;
          }}>Connect LinkedIn</Button>
          <Badge tone="warning">Daily DM cap: 20</Badge>
        </div>
      </Card>

      <Card title="DM Queue" subtitle="Approve/send/reject">
        {queue.map((m: any) => (
          <div key={m.id} className="ui-card" style={{ padding: 10, marginBottom: 8 }}>
            <p style={{ marginTop: 0 }}>{m.messageBody}</p>
            <div className="table-toolbar">
              <Badge>{m.status}</Badge>
              <Button variant="primary" onClick={async () => { await fetch(`${base}/api/linkedin-dm/${m.id}/send`, { method: 'POST', credentials: 'include', headers: { 'x-admin-token': token } }); await load(); }}>Send</Button>
              <Button variant="ghost" onClick={async () => { await fetch(`${base}/api/linkedin-dm/${m.id}/reject`, { method: 'POST', credentials: 'include', headers: { 'x-admin-token': token } }); await load(); }}>Reject</Button>
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
