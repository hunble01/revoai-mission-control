'use client';

import { useEffect, useMemo, useState } from 'react';
import { postJson } from '../../components/fetch-json';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

const cronLike = /^([*\d/,\-]+\s){4}[*\d/,\-]+$/;

export default function SchedulerPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [safety, setSafety] = useState<any>({});
  const [runs, setRuns] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newCron, setNewCron] = useState('0 9 * * *');
  const [newCampaignId, setNewCampaignId] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [j, s, r] = await Promise.all([
        fetch(`${base}/api/scheduler/jobs`, { credentials: 'include', headers: { 'x-admin-token': token } }).then((x) => x.json()),
        fetch(`${base}/api/settings/safety`, { credentials: 'include', headers: { 'x-admin-token': token } }).then((x) => x.json()),
        fetch(`${base}/api/scheduler/runs`, { credentials: 'include', headers: { 'x-admin-token': token } }).then((x) => x.json()),
      ]);
      setJobs(Array.isArray(j) ? j : []);
      setSafety(s || {});
      setRuns(Array.isArray(r) ? r : []);
    } catch (e: any) {
      setJobs([]);
      setRuns([]);
      setError(e?.message || 'Failed to load scheduler state');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const runNow = async (id: string) => {
    setError('');
    setMsg('');
    setSavingId(id);
    try {
      await postJson(`/scheduler/jobs/${id}/run-now`);
      setMsg('Job run triggered.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Run now failed');
    } finally {
      setSavingId(null);
    }
  };

  const toggleEnabled = async (job: any) => {
    setError('');
    setMsg('');
    setSavingId(job.id);
    try {
      await fetch(`${base}/api/scheduler/jobs/${job.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          'x-admin-token': token,
          'x-actor-role': 'admin',
        },
        body: JSON.stringify({ enabled: !job.enabled }),
      });
      setMsg(`Job ${job.name} ${job.enabled ? 'disabled' : 'enabled'}.`);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to toggle job');
    } finally {
      setSavingId(null);
    }
  };

  const createJob = async () => {
    setError('');
    setMsg('');
    if (!newName.trim()) {
      setError('Job name is required.');
      return;
    }
    if (!cronLike.test(newCron.trim())) {
      setError('Cron expression must have 5 fields (basic validation).');
      return;
    }

    try {
      await fetch(`${base}/api/scheduler/jobs`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          'x-admin-token': token,
          'x-actor-role': 'admin',
        },
        body: JSON.stringify({
          name: newName.trim(),
          cronExpr: newCron.trim(),
          timezone: 'America/Toronto',
          enabled: true,
          campaignId: newCampaignId || undefined,
          config: {},
        }),
      });
      setMsg('Scheduler job created.');
      setNewName('');
      setNewCron('0 9 * * *');
      setNewCampaignId('');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to create job');
    }
  };

  const seed = async () => {
    try {
      const out = await postJson('/seed/load');
      setMsg(`Seed loaded: campaign ${out.campaign?.name}`);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Seed failed');
    }
  };

  const runStats = useMemo(() => {
    const total = runs.length;
    const completed = runs.filter((r) => r.status === 'completed').length;
    const failed = runs.filter((r) => r.status === 'failed').length;
    return { total, completed, failed };
  }, [runs]);

  return (
    <div className="dash-stack">
      <h1>Scheduler + Safety</h1>
      <button onClick={seed}>Load Seed Data</button>
      {msg && <p className="muted">{msg}</p>}
      {error && <p style={{ color: '#ff9b9b' }}>{error}</p>}

      {loading ? (
        <p>Loading scheduler state...</p>
      ) : (
        <>
          <div className="ui-card" style={{ padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Job Lifecycle Controls</h3>
            <div className="table-toolbar" style={{ marginBottom: 8 }}>
              <input className="ui-input" placeholder="Job name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <input className="ui-input" placeholder="Cron (e.g. 0 9 * * *)" value={newCron} onChange={(e) => setNewCron(e.target.value)} />
              <input className="ui-input" placeholder="Campaign ID (optional)" value={newCampaignId} onChange={(e) => setNewCampaignId(e.target.value)} />
              <button className="ui-input" onClick={createJob}>Create Job</button>
            </div>
            <p className="muted" style={{ margin: 0 }}>Timezone: America/Toronto · Dry-run safety: {String(!!safety?.dryRun)}</p>
          </div>

          <h3>Jobs</h3>
          {!jobs.length ? (
            <p>No scheduler jobs found.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {jobs.map((j: any) => (
                <div key={j.id} className="ui-card" style={{ padding: 10, display: 'grid', gap: 6 }}>
                  <strong>{j.name}</strong>
                  <div className="muted">Cron: {j.cronExpr} · {j.enabled ? 'enabled' : 'disabled'}</div>
                  <div className="muted">Campaign: {j.campaignId || 'active campaign fallback'}</div>
                  <div className="table-toolbar">
                    <button className="ui-input" disabled={savingId === j.id} onClick={() => runNow(j.id)}>Run now</button>
                    <button className="ui-input" disabled={savingId === j.id} onClick={() => toggleEnabled(j)}>{j.enabled ? 'Disable' : 'Enable'}</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3>Recent Runs</h3>
          <div className="table-toolbar">
            <span className="muted">Total: {runStats.total}</span>
            <span className="muted">Completed: {runStats.completed}</span>
            <span className="muted">Failed: {runStats.failed}</span>
          </div>
          {!runs.length ? (
            <p>No scheduler runs yet.</p>
          ) : (
            <ul>
              {runs.slice(0, 15).map((r: any) => (
                <li key={r.id}>{r.status} · {new Date(r.startedAt).toLocaleString()} · job {r.jobId}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
