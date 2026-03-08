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
  const [tab, setTab] = useState<'OUTREACH' | 'SOCIAL' | 'ALL'>('ALL');
  const [channelFilter, setChannelFilter] = useState<'ALL' | 'EMAIL' | 'LINKEDIN' | 'FACEBOOK'>('ALL');

  const load = async () => {
    setLoading(true);
    try {
      const [draftRes, socialRes] = await Promise.all([
        fetch(`${base}/api/drafts?status=NEEDS_APPROVAL`, { credentials: 'include', headers: { 'x-admin-token': token } }),
        fetch(`${base}/api/social-posts?status=needs_approval`, { credentials: 'include', headers: { 'x-admin-token': token } }),
      ]);
      const d = await draftRes.json().catch(() => []);
      const s = await socialRes.json().catch(() => []);
      const mappedSocial = (Array.isArray(s) ? s : []).map((p: any) => ({
        id: p.id,
        channel: p.channel,
        draftType: 'social_post',
        status: String(p.status || '').toUpperCase(),
        currentVersion: 1,
        taskId: null,
        isSocialPost: true,
        content: p.body,
      }));
      setDrafts([...(Array.isArray(d) ? d : []), ...mappedSocial]);
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

  const visibleDrafts = drafts.filter((d) => {
    const ch = String(d.channel || '').toUpperCase();
    if (tab === 'OUTREACH' && !['EMAIL', 'LINKEDIN'].includes(ch)) return false;
    if (tab === 'SOCIAL' && !['FACEBOOK', 'LINKEDIN'].includes(ch)) return false;
    if (channelFilter !== 'ALL' && ch !== channelFilter) return false;
    return true;
  });

  async function act(id: string, action: string) {
    setErr('');
    setMessage('');
    setActingId(id);
    try {
      const item = drafts.find((x) => x.id === id);
      if (item?.isSocialPost) {
        if (action === 'approve') await postJson(`/social-posts/${id}/approve`, {});
        if (action === 'reject') {
          await postJson(`/social-posts/${id}/feedback`, { notes: notes[id] || '' });
          await postJson(`/social-posts/${id}/reject`, { notes: notes[id] || '' });
        }
        if (action === 'request-changes') await postJson(`/social-posts/${id}/feedback`, { notes: notes[id] || '' });
        if (action === 'approve-with-notes') await postJson(`/social-posts/${id}/approve`, {});
        if (action === 'edit-inline-approve') {
          await postJson(`/social-posts/${id}`, {
            body: inlineEdit[id] || item?.content || '',
            status: 'approved',
          }, 'PATCH');
        }
      } else {
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
      <section className="page-hero">
        <h3>Approval Decisions</h3>
        <p>Third demo stage: process queued drafts, make decisions, and confirm queue refresh + audit trail.</p>
        <div className="demo-steps">
          <span className="demo-step">1. Import</span>
          <span className="demo-step">2. Leads</span>
          <span className="demo-step active">3. Approvals</span>
          <span className="demo-step">4. Campaign Loop</span>
        </div>
      </section>

      <Card title="Approval Inbox" subtitle="Admin-gated actions with audit logging">
        <div className="table-toolbar" style={{ marginBottom: 10 }}>
          <Button variant={tab === 'OUTREACH' ? 'primary' : 'secondary'} onClick={() => setTab('OUTREACH')}>Outreach Drafts</Button>
          <Button variant={tab === 'SOCIAL' ? 'primary' : 'secondary'} onClick={() => setTab('SOCIAL')}>Social Posts</Button>
          <Button variant={tab === 'ALL' ? 'primary' : 'secondary'} onClick={() => setTab('ALL')}>All</Button>
        </div>
        <div className="table-toolbar" style={{ marginBottom: 10 }}>
          {(['ALL', 'EMAIL', 'LINKEDIN', 'FACEBOOK'] as const).map((c) => (
            <Button key={c} variant={channelFilter === c ? 'primary' : 'secondary'} onClick={() => setChannelFilter(c)}>{c}</Button>
          ))}
        </div>
        {err && <p className="error-text">{err}</p>}
        {!!message && <p className="muted">{message}</p>}
        <p className="muted" style={{ marginTop: 0 }}>
          Queue size: <strong style={{ color: 'var(--text)' }}>{visibleDrafts.length}</strong> {loading ? '• Refreshing…' : ''}
        </p>
        <div className="table-toolbar" style={{ marginTop: 8 }}>
          <Button variant="secondary" onClick={load} disabled={loading || !!actingId}>Refresh queue</Button>
        </div>
      </Card>

      {visibleDrafts.map((d) => (
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

          <div className="ui-card" style={{ padding: 10, marginTop: 8 }}>
            <p className="muted" style={{ margin: 0 }}>Post preview</p>
            <p style={{ margin: '6px 0 0' }}>{inlineEdit[d.id] || '(no preview content)'}</p>
          </div>

          <div className="table-toolbar" style={{ marginTop: 10 }}>
            <Button variant="primary" onClick={() => act(d.id, 'approve')} disabled={actingId === d.id}>Approve</Button>
            <Button variant="ghost" onClick={() => act(d.id, 'request-changes')} disabled={actingId === d.id}>Request changes</Button>
            <Button variant="secondary" onClick={() => act(d.id, 'approve-with-notes')} disabled={actingId === d.id}>Approve with notes</Button>
            <Button variant="secondary" onClick={() => act(d.id, 'edit-inline-approve')} disabled={actingId === d.id}>Inline edit + approve</Button>
            <Button variant="ghost" onClick={() => act(d.id, 'reject')} disabled={actingId === d.id}>Reject</Button>
            <Button variant="secondary" onClick={() => setMessage(`Snoozed ${d.id.slice(0, 8)} for 1 hour.`)}>Snooze 1hr</Button>
          </div>
        </Card>
      ))}

      {!drafts.length && <Card subtitle="No drafts currently need approval." />}
    </div>
  );
}
