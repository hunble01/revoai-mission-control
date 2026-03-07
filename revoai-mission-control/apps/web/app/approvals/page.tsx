'use client';
import { useEffect, useState } from 'react';
import { postJson } from '../../components/fetch-json';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

export default function ApprovalsPage() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [inlineEdit, setInlineEdit] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${base}/api/drafts?status=NEEDS_APPROVAL`, { headers: { 'x-admin-token': token } });
      const d = await res.json();
      setDrafts(Array.isArray(d) ? d : []);
    } catch {
      setDrafts([]);
      setErr('Failed to load approvals queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  async function act(id: string, action: string) {
    setErr('');
    setMessage('');
    setActingId(id);
    try {
      if (action === 'approve') await postJson(`/drafts/${id}/approve`, { notes: notes[id] || '' });
      if (action === 'reject') await postJson(`/drafts/${id}/reject`, { notes: notes[id] || '' });
      if (action === 'request-changes') await postJson(`/drafts/${id}/request-changes`, { notes: notes[id] || '' });
      if (action === 'approve-with-notes') await postJson(`/drafts/${id}/approve-with-notes`, { notes: notes[id] || '' });
      if (action === 'edit-inline-approve') {
        await postJson(`/drafts/${id}/edit-inline-approve`, {
          notes: notes[id] || '',
          content: inlineEdit[id] || '',
        });
      }
      setMessage('Decision saved and queue refreshed.');
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="dash-stack">
      <Card title="Approval Inbox" subtitle="Admin-gated actions with audit logging">
        {err && <p className="error-text">{err}</p>}
        {!!message && <p className="muted">{message}</p>}
        <p className="muted" style={{ marginTop: 0 }}>
          Queue size: <strong style={{ color: 'var(--text)' }}>{drafts.length}</strong> {loading ? '• Refreshing…' : ''}
        </p>
        <div className="table-toolbar" style={{ marginTop: 8 }}>
          <Button variant="secondary" onClick={load} disabled={loading || !!actingId}>Refresh queue</Button>
        </div>
      </Card>

      {drafts.map((d) => (
        <Card key={d.id} title={`${d.channel} • ${d.draftType}`} subtitle={`Version v${d.currentVersion}`}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <Badge tone="warning">{d.status}</Badge>
            <Badge>Task {d.taskId?.slice?.(0, 8) || '—'}</Badge>
          </div>

          <label className="muted" style={{ display: 'block', marginBottom: 6 }}>Notes</label>
          <textarea
            className="ui-textarea"
            placeholder="Add approval notes..."
            value={notes[d.id] || ''}
            onChange={(e) => setNotes((s) => ({ ...s, [d.id]: e.target.value }))}
          />

          <label className="muted" style={{ display: 'block', margin: '10px 0 6px' }}>Inline edit content (optional)</label>
          <textarea
            className="ui-textarea"
            placeholder="Edit content here before inline approve..."
            value={inlineEdit[d.id] || ''}
            onChange={(e) => setInlineEdit((s) => ({ ...s, [d.id]: e.target.value }))}
          />

          <div className="table-toolbar" style={{ marginTop: 10 }}>
            <Button variant="primary" onClick={() => act(d.id, 'approve')} disabled={actingId === d.id}>Approve</Button>
            <Button variant="ghost" onClick={() => act(d.id, 'request-changes')} disabled={actingId === d.id}>Request changes</Button>
            <Button variant="secondary" onClick={() => act(d.id, 'approve-with-notes')} disabled={actingId === d.id}>Approve with notes</Button>
            <Button variant="secondary" onClick={() => act(d.id, 'edit-inline-approve')} disabled={actingId === d.id}>Inline edit + approve</Button>
            <Button variant="ghost" onClick={() => act(d.id, 'reject')} disabled={actingId === d.id}>Reject</Button>
          </div>
        </Card>
      ))}

      {!drafts.length && <Card subtitle="No drafts currently need approval." />}
    </div>
  );
}
