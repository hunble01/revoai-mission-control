'use client';

import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SkeletonRows } from '../../components/ui/Skeleton';

import { API_BASE, apiHeaders } from '../../lib/api';

const severityFor = (type: string) => {
  const t = String(type || '').toLowerCase();
  if (t.includes('error') || t.includes('fail') || t.includes('reject')) return 'high';
  if (t.includes('approve') || t.includes('book') || t.includes('complete')) return 'low';
  return 'medium';
};

export default function FeedPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paused, setPaused] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [socketLive, setSocketLive] = useState(false);

  const loadInitial = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/events/feed`, { credentials: 'include', headers: apiHeaders });
      if (!res.ok) throw new Error(`Failed to load feed (HTTP ${res.status})`);
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch (e: any) {
      const msg = String(e?.message || '');
      setEvents([]);
      if (msg.includes('401')) {
        setError('');
      } else {
        setError(msg || 'Failed to load feed');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitial();

    const socket = io(API_BASE, { transports: ['websocket'] });
    socket.on('connect', () => setSocketLive(true));
    socket.on('disconnect', () => setSocketLive(false));
    socket.on('activity', (evt) => {
      if (paused) return;
      setEvents((prev) => [evt, ...prev].slice(0, 300));
    });

    return () => {
      socket.disconnect();
    };
  }, [paused]);

  const typedEvents = useMemo(() => {
    return events.map((e) => ({
      ...e,
      kind: e.eventType ?? e.type ?? 'unknown',
      severity: severityFor(e.eventType ?? e.type ?? ''),
      at: e.createdAt ?? e.timestamp,
    }));
  }, [events]);

  const filtered = useMemo(() => {
    return typedEvents.filter((e) => {
      if (typeFilter !== 'all' && e.kind !== typeFilter) return false;
      if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
      return true;
    });
  }, [typedEvents, typeFilter, severityFilter]);

  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = { high: [], medium: [], low: [] };
    filtered.forEach((e) => groups[e.severity]?.push(e));
    return groups;
  }, [filtered]);

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    typedEvents.forEach((e) => set.add(e.kind));
    return Array.from(set).sort();
  }, [typedEvents]);

  return (
    <div className="dash-stack fade-in">
      <section className="page-header">
        <div className="page-eyebrow">OPERATIONS / LIVE FEED</div>
        <h2 className="page-title" style={{ margin: 0 }}>Live Activity Feed</h2>
        <p className="page-desc">Track research, approvals, sends, and publish events in real time.</p>
      </section>

      {error && (
        <Card title="Feed Error" subtitle="Connection issue">
          <div className="table-toolbar" style={{ justifyContent: 'space-between' }}>
            <span className="badge error">{error}</span>
            <Button variant="secondary" onClick={() => loadInitial()}>Retry</Button>
          </div>
        </Card>
      )}

      <Card title="Filters" subtitle="Type, severity, and live toggle">
        <div className="table-toolbar">
          <select className="ui-input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All event types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select className="ui-input" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as any)}>
            <option value="all">All severity</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <Button variant="secondary" onClick={() => setPaused((p) => !p)}>
            {paused ? 'Resume Live' : 'Pause Live'}
          </Button>
          <Badge tone={socketLive ? 'success' : 'danger'}>Socket: {socketLive ? 'Live' : 'Disconnected'}</Badge>
          <span className="muted">New: RESEARCH_RUN_COMPLETE • POST_PUBLISHED • LINKEDIN_DM_SENT • POST_DRAFT_CREATED</span>
        </div>
      </Card>

      {loading ? (
        <Card title="Loading feed" subtitle="Fetching latest events">
          <SkeletonRows rows={5} />
        </Card>
      ) : !filtered.length ? (
        <Card title="No events yet" subtitle="Empty feed state">
          <div className="empty-state">
            <div className="empty-icon">◉</div>
            <div style={{ color: 'var(--text2)', fontWeight: 600, marginBottom: 6 }}>No events match current filters</div>
            <div>New events will appear here when activity is detected.</div>
          </div>
        </Card>
      ) : (
        <>
          <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
            <div className="kpi-card rose"><div className="kpi-label">High</div><div className="kpi-value amber">{grouped.high.length}</div><div className="kpi-delta">events</div></div>
            <div className="kpi-card cyan"><div className="kpi-label">Medium</div><div className="kpi-value cyan">{grouped.medium.length}</div><div className="kpi-delta">events</div></div>
            <div className="kpi-card emerald"><div className="kpi-label">Low</div><div className="kpi-value emerald">{grouped.low.length}</div><div className="kpi-delta">events</div></div>
          </div>

          <Card title="Event Stream" subtitle="Most recent first">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {filtered.slice(0, 200).map((e, idx) => (
                <li key={e.id ?? idx} style={{ marginBottom: 6 }}>
                  <span className="badge new">{e.kind}</span> <span className="mono text-xs text-dim">{new Date(e.at).toLocaleString()}</span> <span className={`badge ${e.severity === 'high' ? 'error' : e.severity === 'medium' ? 'pending' : 'active'}`}>{e.severity}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
