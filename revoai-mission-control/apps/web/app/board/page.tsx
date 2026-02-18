'use client';
import { useEffect, useState } from 'react';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

export default function BoardPage() {
  const [tasks, setTasks] = useState<any[]>([]);

  const load = () => {
    fetch(`${base}/api/tasks`, { headers: { 'x-admin-token': token } })
      .then((r) => r.json())
      .then((d) => setTasks(d || []));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  const columns = ['BACKLOG', 'DOING', 'NEEDS_APPROVAL', 'DONE'];

  return (
    <div>
      <h1>Task Board</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {columns.map((col) => (
          <section key={col} style={{ background: '#131a2e', border: '1px solid #273056', borderRadius: 8, padding: 10 }}>
            <h3>{col.replace('_', ' ')}</h3>
            {tasks.filter((t: any) => t.columnName === col).map((t: any) => (
              <a key={t.id} href={`/tasks/${t.id}/replay`} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ background: '#0f1528', padding: 8, borderRadius: 6, marginBottom: 8 }}>
                  <strong>{t.title}</strong>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{t.priority}</div>
                </div>
              </a>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
