'use client';
import { useEffect, useState } from 'react';
import { postJson } from '../../components/fetch-json';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

export default function ApprovalsPage() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [inlineEdit, setInlineEdit] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');

  const load = () => {
    fetch(`${base}/api/drafts?status=NEEDS_APPROVAL`, { headers: { 'x-admin-token': token } })
      .then((r) => r.json())
      .then((d) => setDrafts(d || []));
  };

  useEffect(() => { load(); }, []);

  async function act(id: string, action: string) {
    setErr('');
    try {
      if (action === 'approve') await postJson(`/drafts/${id}/approve`, { notes: notes[id] || '' });
      if (action === 'reject') await postJson(`/drafts/${id}/reject`, { notes: notes[id] || '' });
      if (action === 'request-changes') await postJson(`/drafts/${id}/request-changes`, { notes: notes[id] || '' });
      if (action === 'approve-with-notes') await postJson(`/drafts/${id}/approve-with-notes`, { notes: notes[id] || '' });
      if (action === 'edit-inline-approve') await postJson(`/drafts/${id}/edit-inline-approve`, { notes: notes[id] || '', content: inlineEdit[id] || '' });
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div>
      <h1>Approval Inbox</h1>
      {err && <p style={{ color: 'tomato' }}>{err}</p>}
      <p>All actions are admin-gated and write events/audit entries.</p>
      <div style={{ display: 'grid', gap: 12 }}>
        {drafts.map((d) => (
          <div key={d.id} style={{ border: '1px solid #273056', borderRadius: 8, padding: 12 }}>
            <strong>{d.channel} · {d.draftType}</strong>
            <div>Status: {d.status} · v{d.currentVersion}</div>
            <textarea
              placeholder="notes"
              value={notes[d.id] || ''}
              onChange={(e) => setNotes((s) => ({ ...s, [d.id]: e.target.value }))}
              style={{ width: '100%', marginTop: 8 }}
            />
            <textarea
              placeholder="inline edited content (for edit-inline-approve)"
              value={inlineEdit[d.id] || ''}
              onChange={(e) => setInlineEdit((s) => ({ ...s, [d.id]: e.target.value }))}
              style={{ width: '100%', marginTop: 8 }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button onClick={() => act(d.id, 'approve')}>Approve</button>
              <button onClick={() => act(d.id, 'reject')}>Reject</button>
              <button onClick={() => act(d.id, 'request-changes')}>Request changes</button>
              <button onClick={() => act(d.id, 'approve-with-notes')}>Approve with notes</button>
              <button onClick={() => act(d.id, 'edit-inline-approve')}>Inline edit + approve</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
