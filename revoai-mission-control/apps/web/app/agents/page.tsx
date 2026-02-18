import { fetchJson } from '../../components/fetch-json';

export default async function AgentsPage() {
  const agents = await fetchJson('/agents').catch(() => []);
  return (
    <div>
      <h1>Agent Cards</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {agents.map((a: any) => (
          <div key={a.id} style={{ border: '1px solid #273056', borderRadius: 8, padding: 12 }}>
            <strong>{a.name}</strong>
            <div>Status: {a.status}</div>
            <div>Current Task: {a.currentTaskId || '—'}</div>
            <div>Last update: {a.lastUpdateAt || '—'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
