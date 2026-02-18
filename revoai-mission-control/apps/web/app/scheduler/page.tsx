'use client';
import { useEffect, useState } from 'react';
import { postJson } from '../../components/fetch-json';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

export default function SchedulerPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [safety, setSafety] = useState<any>({});
  const [runs, setRuns] = useState<any[]>([]);
  const [msg, setMsg] = useState('');

  const load = async () => {
    const [j, s, r] = await Promise.all([
      fetch(`${base}/api/scheduler/jobs`, { headers: { 'x-admin-token': token } }).then((x) => x.json()),
      fetch(`${base}/api/settings/safety`, { headers: { 'x-admin-token': token } }).then((x) => x.json()),
      fetch(`${base}/api/scheduler/runs`, { headers: { 'x-admin-token': token } }).then((x) => x.json()),
    ]);
    setJobs(j || []);
    setSafety(s || {});
    setRuns(r || []);
  };

  useEffect(() => { load(); }, []);

  const runNow = async (id: string) => {
    await postJson(`/scheduler/jobs/${id}/run-now`);
    await load();
  };

  const seed = async () => {
    const out = await postJson('/seed/load');
    setMsg(`Seed loaded: campaign ${out.campaign?.name}`);
    await load();
  };

  return (
    <div>
      <h1>Scheduler + Safety</h1>
      <button onClick={seed}>Load Seed Data</button>
      {msg && <p>{msg}</p>}
      <p>Timezone: America/Toronto</p>
      <pre>{JSON.stringify(safety, null, 2)}</pre>
      <h3>Jobs</h3>
      <ul>
        {jobs.map((j: any) => (
          <li key={j.id}>
            {j.name} ({j.cronExpr}) [{j.enabled ? 'enabled' : 'disabled'}]
            <button style={{ marginLeft: 8 }} onClick={() => runNow(j.id)}>Run now (dry-run)</button>
          </li>
        ))}
      </ul>
      <h3>Recent Runs</h3>
      <ul>
        {runs.slice(0, 10).map((r: any) => (
          <li key={r.id}>{r.status} · {new Date(r.startedAt).toLocaleString()}</li>
        ))}
      </ul>
    </div>
  );
}
