import { fetchJson } from '../../components/fetch-json';

export default async function AuditPage() {
  const logs = await fetchJson('/audit?limit=200').catch(() => []);
  return (
    <div>
      <h1>Audit Log (Append-only)</h1>
      <ul>
        {logs.map((l: any) => (
          <li key={String(l.id)}>{l.action} · {l.resourceType}:{l.resourceId}</li>
        ))}
      </ul>
    </div>
  );
}
