'use client';

import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

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
      const res = await fetch(`${base}/api/events/feed`, { headers: { 'x-admin-token': token } });
      if (!res.ok) throw new Error(`Failed to load feed (HTTP ${res.status})`);
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setEvents([]);
      setError(e?.message || 'Failed to load feed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitial();

    const socket = io(base, { transports: ['websocket'] });
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
    <div className="dash-stack">
      <h1>Live Activity Feed</h1>
      {error && <p style={{ color: '#ff9b9b' }}>{error}</p>}

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
        <button className="ui-input" onClick={() => setPaused((p) => !p)}>
          {paused ? 'Resume Live' : 'Pause Live'}
        </button>
        <span className="muted">Socket: {socketLive ? 'Live' : 'Disconnected'}</span>
      </div>

      {loading ? (
        <p className="muted">Loading feed...</p>
      ) : !filtered.length ? (
        <p className="muted">No events match the current filters.</p>
      ) : (
        <>
          <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
            <div className="ui-card" style={{ padding: 10 }}><strong>High</strong><div className="muted">{grouped.high.length} events</div></div>
            <div className="ui-card" style={{ padding: 10 }}><strong>Medium</strong><div className="muted">{grouped.medium.length} events</div></div>
            <div className="ui-card" style={{ padding: 10 }}><strong>Low</strong><div className="muted">{grouped.low.length} events</div></div>
          </div>

          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {filtered.slice(0, 200).map((e, idx) => (
              <li key={e.id ?? idx}>
                <code>{e.kind}</code> · {new Date(e.at).toLocaleString()} · severity:{' '}
                <strong>{e.severity}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
