'use client';
import { useEffect, useState } from 'react';
import { postJson } from '../../components/fetch-json';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    const url = `${base}/api/drafts${q ? `?search=${encodeURIComponent(q)}` : ''}`;
    fetch(url, { headers: { 'x-admin-token': token } })
      .then((r) => r.json())
      .then((d) => setDrafts(d || []));
  };

  useEffect(() => { load(); }, [q]);

  const markSent = async (id: string) => {
    setErr('');
    try {
      await postJson(`/drafts/${id}/mark-sent-manual`);
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <div>
      <h1>Drafts</h1>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search drafts" />
      {err && <p style={{ color: 'tomato' }}>{err}</p>}
      <ul>
        {drafts.map((d: any) => (
          <li key={d.id}>
            {d.channel} · {d.draftType} · {d.status} · v{d.currentVersion}
            {d.channel === 'LINKEDIN' && d.status === 'APPROVED' && (
              <button style={{ marginLeft: 8 }} onClick={() => markSent(d.id)}>Mark as Sent (manual)</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
