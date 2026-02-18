import { fetchJson } from '../../components/fetch-json';

export default async function SchedulerPage() {
  const jobs = await fetchJson('/scheduler/jobs').catch(() => []);
  const safety = await fetchJson('/settings/safety').catch(() => ({}));

  return (
    <div>
      <h1>Scheduler + Safety</h1>
      <p>Timezone: America/Toronto</p>
      <pre>{JSON.stringify(safety, null, 2)}</pre>
      <h3>Jobs</h3>
      <ul>
        {jobs.map((j: any) => (
          <li key={j.id}>{j.name} ({j.cronExpr}) [{j.enabled ? 'enabled' : 'disabled'}]</li>
        ))}
      </ul>
    </div>
  );
}
