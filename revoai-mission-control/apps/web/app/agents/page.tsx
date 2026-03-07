'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

const statusOptions = ['IDLE', 'RUNNING', 'PAUSED', 'BLOCKED'] as const;

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [agentsRes, tasksRes] = await Promise.all([
        fetch(`${base}/api/agents`, { credentials: 'include', headers: { 'x-admin-token': token } }),
        fetch(`${base}/api/tasks`, { credentials: 'include', headers: { 'x-admin-token': token } }),
      ]);
      if (!agentsRes.ok) throw new Error(`Failed to load agents (HTTP ${agentsRes.status})`);
      if (!tasksRes.ok) throw new Error(`Failed to load tasks (HTTP ${tasksRes.status})`);

      const agentsData = await agentsRes.json();
      const tasksData = await tasksRes.json();
      setAgents(Array.isArray(agentsData) ? agentsData : []);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
    } catch (e: any) {
      setAgents([]);
      setTasks([]);
      setError(e?.message || 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const healthSummary = useMemo(() => {
    const total = agents.length;
    const idle = agents.filter((a) => a.status === 'IDLE').length;
    const running = agents.filter((a) => a.status === 'RUNNING').length;
    const blocked = agents.filter((a) => a.status === 'BLOCKED').length;
    return { total, idle, running, blocked };
  }, [agents]);

  const patchAgent = async (id: string, body: any, successMsg: string) => {
    setSavingId(id);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${base}/api/agents/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          'x-admin-token': token,
          'x-actor-role': 'admin',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Failed to update agent (HTTP ${res.status})`);
      const updated = await res.json();
      setAgents((prev) => prev.map((a) => (a.id === id ? updated : a)));
      setMessage(successMsg);
    } catch (e: any) {
      setError(e?.message || 'Failed to update agent');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="dash-stack">
      <Card title="Agent Operations" subtitle="Health visibility + runtime controls">
        {error && <p style={{ color: '#ff9b9b' }}>{error}</p>}
        {message && <p className="muted">{message}</p>}

        {loading ? (
          <p className="muted">Loading agents...</p>
        ) : !agents.length ? (
          <p className="muted">No agents found.</p>
        ) : (
          <>
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
              <div className="ui-card" style={{ padding: 10 }}><strong>Total</strong><div className="muted">{healthSummary.total}</div></div>
              <div className="ui-card" style={{ padding: 10 }}><strong>Idle</strong><div className="muted">{healthSummary.idle}</div></div>
              <div className="ui-card" style={{ padding: 10 }}><strong>Running</strong><div className="muted">{healthSummary.running}</div></div>
              <div className="ui-card" style={{ padding: 10 }}><strong>Blocked</strong><div className="muted">{healthSummary.blocked}</div></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12, marginTop: 10 }}>
              {agents.map((a: any) => (
                <div key={a.id} className="ui-card" style={{ padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong>{a.name}</strong>
                    <span className="muted">{a.status}</span>
                  </div>

                  <div className="muted" style={{ marginTop: 6 }}>Current Task: {a.currentTaskId || '—'}</div>
                  <div className="muted">Last update: {a.lastUpdateAt ? new Date(a.lastUpdateAt).toLocaleString() : '—'}</div>

                  <div className="table-toolbar" style={{ marginTop: 8 }}>
                    <select
                      className="ui-input"
                      defaultValue={a.status}
                      disabled={savingId === a.id}
                      onChange={(e) => patchAgent(a.id, { status: e.target.value, lastUpdateAt: new Date().toISOString() }, `Updated ${a.name} status.`)}
                    >
                      {statusOptions.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>

                    <select
                      className="ui-input"
                      value={a.currentTaskId || ''}
                      disabled={savingId === a.id}
                      onChange={(e) => patchAgent(a.id, { currentTaskId: e.target.value || null, lastUpdateAt: new Date().toISOString() }, `Updated ${a.name} task assignment.`)}
                    >
                      <option value="">No task</option>
                      {tasks.slice(0, 100).map((t: any) => (
                        <option key={t.id} value={t.id}>{t.title} ({t.columnName})</option>
                      ))}
                    </select>

                    <Button
                      variant="secondary"
                      disabled={savingId === a.id}
                      onClick={() => patchAgent(a.id, { status: 'IDLE', currentTaskId: null, lastUpdateAt: new Date().toISOString() }, `Reset ${a.name} to idle.`)}
                    >
                      Reset to Idle
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
