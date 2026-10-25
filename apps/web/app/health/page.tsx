'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const REQUIRED = ['Database','Email Service (SendGrid)','LinkedIn (Unipile)','Research Agent','Content Agent','Scheduler'];

export default function HealthPage() {
  const [services, setServices] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => { (async () => {
    const health = await fetch(`${base}/api/health`, { credentials: 'include' }).then(r => r.json()).catch(() => ({}));
    const rows = Array.isArray(health?.services) ? health.services : [];
    const merged = REQUIRED.map((name) => rows.find((x: any) => x.name === name) || { name, status: 'Unknown' });
    setServices(merged);
    const hist = await fetch(`${base}/api/health/history`, { credentials: 'include' }).then(r => r.json()).catch(() => []);
    setEvents(Array.isArray(hist) ? hist.slice(0,10) : []);
  })(); }, []);

  const overall = useMemo(() => {
    if (services.some((s: any) => String(s.status).toLowerCase() === 'down')) return { text: 'Service Disruption', tone: 'danger' };
    if (services.some((s: any) => String(s.status).toLowerCase() === 'degraded')) return { text: 'Degraded Performance', tone: 'warning' };
    return { text: 'All Systems Operational', tone: 'success' };
  }, [services]);

  return <div className="dash-stack fade-in">
    <section className="page-header"><div className="page-eyebrow">SYSTEM / HEALTH</div><h2 className="page-title" style={{ margin: 0 }}>System Health</h2></section>
    <div style={{ width: '100%', padding: '14px 20px', borderRadius: 8, marginBottom: 20, background: overall.tone === 'success' ? 'rgba(16,214,138,.12)' : overall.tone === 'warning' ? 'rgba(245,166,35,.12)' : 'rgba(255,91,122,.12)' }}><strong>{overall.text}</strong></div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {services.map((s: any) => {
        const st = String(s.status || 'Unknown');
        const tone: any = st.toLowerCase() === 'healthy' ? 'success' : st.toLowerCase() === 'degraded' ? 'warning' : st.toLowerCase() === 'down' ? 'danger' : 'default';
        return <div key={s.name} style={{ background: '#0D1117', border: '1px solid #1C2333', borderLeft: `2px solid ${tone === 'success' ? '#10D68A' : tone === 'warning' ? '#F5A623' : tone === 'danger' ? '#FF5B7A' : '#7B8799'}`, borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>{s.name}</strong><Badge tone={tone}>{st}</Badge></div>
          <div className="muted">{s.responseTime ? `${s.responseTime}ms` : '—'}</div>
          <div className="muted">Last checked: {s.lastChecked ? new Date(s.lastChecked).toLocaleString() : '—'}</div>
          {st.toLowerCase() !== 'healthy' && s.error && <div style={{ color: '#ff9b9b' }}>{s.error}</div>}
        </div>;
      })}
    </div>

    <Card title="Recent Events" subtitle="Latest health check events">
      {!events.length ? <div className="muted">No recent health events.</div> : <div style={{ display: 'grid', gap: 8 }}>{events.map((e: any, i: number) => <div key={i} className="ui-card" style={{ padding: 10 }}>{new Date(e.timestamp || e.createdAt || Date.now()).toLocaleString()} • {e.service} • {e.status} • {e.detail || '—'}</div>)}</div>}
    </Card>
  </div>;
}
