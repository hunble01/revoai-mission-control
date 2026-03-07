'use client';

import { useEffect, useMemo, useState } from 'react';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

const columns = ['BACKLOG', 'DOING', 'NEEDS_APPROVAL', 'DONE'] as const;

type Task = {
  id: string;
  title: string;
  description?: string;
  columnName: string;
  priority?: string;
  campaignId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export default function BoardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [replay, setReplay] = useState<any[]>([]);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayError, setReplayError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${base}/api/tasks`, { headers: { 'x-admin-token': token } });
      if (!res.ok) throw new Error(`Failed to load tasks (HTTP ${res.status})`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setTasks(list);
      if (!selectedTaskId && list[0]?.id) setSelectedTaskId(list[0].id);
    } catch (e: any) {
      setTasks([]);
      setError(e?.message || 'Failed to load task board');
    } finally {
      setLoading(false);
    }
  };

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) || null,
    [tasks, selectedTaskId],
  );

  const loadReplay = async (taskId: string) => {
    setReplayLoading(true);
    setReplayError('');
    try {
      const res = await fetch(`${base}/api/tasks/${taskId}/replay`, {
        headers: { 'x-admin-token': token, 'x-actor-role': 'admin' },
      });
      if (!res.ok) throw new Error(`Failed replay load (HTTP ${res.status})`);
      const data = await res.json();
      setReplay(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setReplay([]);
      setReplayError(e?.message || 'Failed to load replay events');
    } finally {
      setReplayLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedTaskId) loadReplay(selectedTaskId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTaskId]);

  const moveTask = async (task: Task, target: string) => {
    setSaving(true);
    setMessage('');
    setError('');
    const prev = tasks;
    setTasks((curr) => curr.map((t) => (t.id === task.id ? { ...t, columnName: target } : t)));
    try {
      const res = await fetch(`${base}/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-admin-token': token,
          'x-actor-role': 'admin',
        },
        body: JSON.stringify({ columnName: target }),
      });
      if (!res.ok) throw new Error(`Task move failed (HTTP ${res.status})`);
      setMessage(`Moved task to ${target}.`);
      await load();
      await loadReplay(task.id);
    } catch (e: any) {
      setTasks(prev);
      setError(e?.message || 'Task move failed');
    } finally {
      setSaving(false);
    }
  };

  const nextMoves = (col: string) => {
    if (col === 'BACKLOG') return ['DOING'];
    if (col === 'DOING') return ['NEEDS_APPROVAL', 'BACKLOG'];
    if (col === 'NEEDS_APPROVAL') return ['DOING', 'DONE'];
    return [];
  };

  return (
    <div className="dash-stack">
      <h1>Task Board</h1>
      {error && <p style={{ color: '#ff9b9b' }}>{error}</p>}
      {message && <p className="muted">{message}</p>}

      {loading ? (
        <p className="muted">Loading task board...</p>
      ) : !tasks.length ? (
        <p className="muted">No tasks found.</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {columns.map((col) => (
              <section key={col} className="ui-card" style={{ padding: 10 }}>
                <h3>{col.replace('_', ' ')}</h3>
                {tasks.filter((t) => t.columnName === col).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTaskId(t.id)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      background: selectedTaskId === t.id ? '#1a2242' : '#0f1528',
                      border: '1px solid #273056',
                      color: 'inherit',
                      padding: 8,
                      borderRadius: 6,
                      marginBottom: 8,
                      cursor: 'pointer',
                    }}
                  >
                    <strong>{t.title}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>{t.priority || 'med'}</div>
                  </button>
                ))}
              </section>
            ))}
          </div>

          <section className="ui-card" style={{ marginTop: 12, padding: 12 }}>
            <h3>Task Detail Panel</h3>
            {!selectedTask ? (
              <p className="muted">Select a task to inspect details.</p>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
                  <div>
                    <p className="kpi-title">Title</p>
                    <p>{selectedTask.title}</p>
                  </div>
                  <div>
                    <p className="kpi-title">Task ID</p>
                    <p style={{ fontFamily: 'monospace' }}>{selectedTask.id}</p>
                  </div>
                  <div>
                    <p className="kpi-title">Column</p>
                    <p>{selectedTask.columnName}</p>
                  </div>
                  <div>
                    <p className="kpi-title">Priority</p>
                    <p>{selectedTask.priority || 'med'}</p>
                  </div>
                </div>

                <div className="table-toolbar" style={{ marginTop: 8 }}>
                  {nextMoves(selectedTask.columnName).map((target) => (
                    <button
                      key={target}
                      className="ui-input"
                      onClick={() => moveTask(selectedTask, target)}
                      disabled={saving}
                    >
                      Move to {target.replace('_', ' ')}
                    </button>
                  ))}
                  <button className="ui-input" onClick={() => loadReplay(selectedTask.id)} disabled={replayLoading}>
                    Refresh Replay
                  </button>
                </div>

                <h4 style={{ marginTop: 12 }}>Replay (in-page)</h4>
                {replayError && <p style={{ color: '#ff9b9b' }}>{replayError}</p>}
                {replayLoading ? (
                  <p className="muted">Loading replay...</p>
                ) : !replay.length ? (
                  <p className="muted">No replay events for this task yet.</p>
                ) : (
                  <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid #273056', borderRadius: 8 }}>
                    <table className="ui-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>By</th>
                          <th>Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {replay.map((evt: any) => (
                          <tr key={String(evt.id)}>
                            <td>{evt.eventType}</td>
                            <td>{evt.createdBy || evt.agentId || 'system'}</td>
                            <td>{evt.createdAt ? new Date(evt.createdAt).toLocaleString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
