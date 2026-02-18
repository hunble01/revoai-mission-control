import { fetchJson } from '../../components/fetch-json';

export default async function BoardPage() {
  const tasks = await fetchJson('/tasks').catch(() => []);
  const columns = ['BACKLOG', 'DOING', 'NEEDS_APPROVAL', 'DONE'];

  return (
    <div>
      <h1>Task Board</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {columns.map((col) => (
          <section key={col} style={{ background: '#131a2e', border: '1px solid #273056', borderRadius: 8, padding: 10 }}>
            <h3>{col.replace('_', ' ')}</h3>
            {tasks.filter((t: any) => t.columnName === col).map((t: any) => (
              <div key={t.id} style={{ background: '#0f1528', padding: 8, borderRadius: 6, marginBottom: 8 }}>
                <strong>{t.title}</strong>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{t.priority}</div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
