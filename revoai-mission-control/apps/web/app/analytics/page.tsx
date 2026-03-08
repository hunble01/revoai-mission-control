'use client';

import { useEffect, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

export default function AnalyticsPage() {
  const [funnel, setFunnel] = useState<any>(null);
  const [channels, setChannels] = useState<any>(null);
  const [content, setContent] = useState<any[]>([]);
  const [daily, setDaily] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [csv, setCsv] = useState<string>('');

  const load = async () => {
    const headers = { 'x-admin-token': token };
    const [f, c, cp, d] = await Promise.all([
      fetch(`${base}/api/analytics/funnel`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => ({})),
      fetch(`${base}/api/analytics/channels`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => ({})),
      fetch(`${base}/api/analytics/content-performance`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => ([])),
      fetch(`${base}/api/analytics/daily-activity?days=14`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => ([])),
    ]);
    setFunnel(f);
    setChannels(c);
    setContent(Array.isArray(cp) ? cp : []);
    setDaily(Array.isArray(d) ? d : []);
  };

  useEffect(() => {
    load().catch((e: any) => setErr(e?.message || 'Failed to load analytics'));
  }, []);

  return (
    <div className="dash-stack">
      <section className="page-hero">
        <h3>Analytics</h3>
        <p>Funnel, channel comparison, content performance, and daily activity.</p>
      </section>
      {err && <p style={{ color: '#ff9b9b' }}>{err}</p>}

      <Card title="Funnel" subtitle="Researched → Contacted → Replied → Booked → Closed">
        <div className="table-toolbar" style={{ justifyContent: 'space-between' }}>
          <Badge>Researched: {funnel?.researched ?? 0}</Badge>
          <Badge>Contacted: {funnel?.contacted ?? 0}</Badge>
          <Badge>Replied: {funnel?.replied ?? 0}</Badge>
          <Badge tone="success">Booked: {funnel?.booked ?? 0}</Badge>
          <Badge tone="warning">Closed: {funnel?.closed ?? 0}</Badge>
        </div>
      </Card>

      <Card title="Channel Comparison" subtitle="Email vs LinkedIn vs Facebook">
        <Table>
          <thead><tr><th>Channel</th><th>Sent</th><th>Replied</th></tr></thead>
          <tbody>
            {['EMAIL', 'LINKEDIN', 'FACEBOOK'].map((k) => (
              <tr key={k}><td>{k}</td><td>{channels?.[k]?.sent || 0}</td><td>{channels?.[k]?.replied || 0}</td></tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card title="Content Performance" subtitle="Posted content and engagement">
        <Table>
          <thead><tr><th>Channel</th><th>Status</th><th>Posted At</th><th>Preview</th></tr></thead>
          <tbody>
            {content.map((p: any) => (
              <tr key={p.id}><td>{p.channel}</td><td>{p.status}</td><td>{p.postedAt ? new Date(p.postedAt).toLocaleString() : '—'}</td><td>{p.bodyPreview}</td></tr>
            ))}
            {!content.length && <tr><td colSpan={4} className="muted">No content performance data yet.</td></tr>}
          </tbody>
        </Table>
      </Card>

      <Card title="Daily Activity" subtitle="Sends, replies, bookings over time">
        <Table>
          <thead><tr><th>Date</th><th>Sends</th><th>Replies</th><th>Bookings</th></tr></thead>
          <tbody>
            {daily.map((d: any) => (
              <tr key={d.date}><td>{d.date}</td><td>{d.sends}</td><td>{d.replies}</td><td>{d.bookings}</td></tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card title="Export" subtitle="Export analytics to CSV">
        <div className="table-toolbar">
          <Button variant="primary" onClick={async () => {
            const res = await fetch(`${base}/api/analytics/export.csv`, { credentials: 'include', headers: { 'x-admin-token': token } });
            const d = await res.json().catch(() => ({}));
            setCsv(String(d?.csv || ''));
          }}>Export CSV</Button>
        </div>
        {!!csv && <pre style={{ whiteSpace: 'pre-wrap' }}>{csv}</pre>}
      </Card>
    </div>
  );
}
