'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../../../components/ui/Badge';
import { Card } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { Table } from '../../../../components/ui/Table';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

type ReplayPageProps = {
  params: { id: string };
};

export default function TaskReplayPage({ params }: ReplayPageProps) {
  const taskId = params.id;
  const [task, setTask] = useState<any | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = { 'x-admin-token': token, 'x-actor-role': 'admin' };
      const [allTasksRes, replayRes] = await Promise.all([
        fetch(`${base}/api/tasks`, { credentials: 'include', headers }),
        fetch(`${base}/api/tasks/${taskId}/replay`, { credentials: 'include', headers }),
      ]);

      if (!allTasksRes.ok) throw new Error(`Failed to load task list (HTTP ${allTasksRes.status})`);
      if (!replayRes.ok) throw new Error(`Failed to load replay events (HTTP ${replayRes.status})`);

      const allTasks = await allTasksRes.json();
      const replay = await replayRes.json();

      const found = Array.isArray(allTasks) ? allTasks.find((t: any) => t.id === taskId) : null;
      setTask(found || null);
      setEvents(Array.isArray(replay) ? replay : []);

      if (!found) {
        setError('Task not found in current board list; replay events may be historical only.');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load task replay');
      setTask(null);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const timeline = useMemo(() => {
    return events.map((evt, idx) => ({
      idx: idx + 1,
      id: String(evt.id ?? idx),
      eventType: evt.eventType || 'unknown',
      actor: evt.createdBy || evt.agentId || 'system',
      at: evt.createdAt ? new Date(evt.createdAt).toLocaleString() : '—',
      payload: evt.payload ?? {},
    }));
  }, [events]);

  return (
    <div className="dash-stack">
      <section className="page-hero">
        <h3>Task Replay</h3>
        <p>Review chronological task event history for operator debugging and decision traceability.</p>
        <div className="demo-steps">
          <a className="demo-step" href="/board">← Back to Board</a>
          <span className="demo-step active">Replay: {taskId.slice(0, 8)}…</span>
        </div>
      </section>

      <Card title="Task Context" subtitle="Current board snapshot for this task id">
        {loading ? (
          <p className="muted">Loading task context...</p>
        ) : task ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <div>
              <p className="kpi-title">Title</p>
              <p style={{ marginTop: 6 }}>{task.title}</p>
            </div>
            <div>
              <p className="kpi-title">Task ID</p>
              <p style={{ marginTop: 6, fontFamily: 'monospace' }}>{task.id}</p>
            </div>
            <div>
              <p className="kpi-title">Column</p>
              <Badge>{task.columnName}</Badge>
            </div>
            <div>
              <p className="kpi-title">Priority</p>
              <Badge tone={String(task.priority).toLowerCase() === 'high' ? 'warning' : 'default'}>{task.priority || 'med'}</Badge>
            </div>
          </div>
        ) : (
          <p className="muted">No current task row found for this id.</p>
        )}
      </Card>

      <Card title="Replay Timeline" subtitle={`Event count: ${timeline.length}`}>
        {error && <p style={{ color: '#ff9b9b' }}>{error}</p>}

        {!timeline.length ? (
          <p className="muted">No replay events found for this task yet.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>#</th>
                <th>Type</th>
                <th>Actor</th>
                <th>Time</th>
                <th>Payload</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((evt) => (
                <tr key={evt.id}>
                  <td>{evt.idx}</td>
                  <td><Badge>{evt.eventType}</Badge></td>
                  <td>{evt.actor}</td>
                  <td>{evt.at}</td>
                  <td>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(evt.payload, null, 2)}</pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        <div className="table-toolbar" style={{ marginTop: 12 }}>
          <Button variant="secondary" onClick={load} disabled={loading}>Refresh Replay</Button>
          <a href="/board" className="demo-step">Return to Board</a>
        </div>
      </Card>
    </div>
  );
}
