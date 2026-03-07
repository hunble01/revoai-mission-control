'use client';

import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${base}/api/agents`, { headers: { 'x-admin-token': token } });
      if (!res.ok) throw new Error(`Failed to load agents (HTTP ${res.status})`);
      const data = await res.json();
      setAgents(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setAgents([]);
      setError(e?.message || 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="dash-stack">
      <Card title="Agent Cards" subtitle="Current AI agent runtime state">
        {loading ? (
          <p className="muted">Loading agents...</p>
        ) : error ? (
          <p style={{ color: '#ff9b9b' }}>{error}</p>
        ) : !agents.length ? (
          <p className="muted">No agents found.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            {agents.map((a: any) => (
              <div key={a.id} className="ui-card" style={{ padding: 12 }}>
                <strong>{a.name}</strong>
                <div className="muted">Status: {a.status}</div>
                <div className="muted">Current Task: {a.currentTaskId || '—'}</div>
                <div className="muted">Last update: {a.lastUpdateAt || '—'}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
