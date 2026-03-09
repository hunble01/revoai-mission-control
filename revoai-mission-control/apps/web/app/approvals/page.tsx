'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ApprovalsPage() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [editContent, setEditContent] = useState<Record<string, string>>({});

  const toast = (type: 'success' | 'error' | 'info' | 'warning', text: string) => window.dispatchEvent(new CustomEvent('app-toast', { detail: { type, text } }));

  const load = async () => {
    const [d, c] = await Promise.all([
      fetch(`${base}/api/drafts?status=NEEDS_APPROVAL`, { credentials: 'include' }).then((r) => r.json()).catch(() => []),
      fetch(`${base}/api/campaigns`, { credentials: 'include' }).then((r) => r.json()).catch(() => []),
    ]);
    const rows = Array.isArray(d) ? d : [];
    console.log(`[Approvals] NEEDS_APPROVAL drafts returned: ${rows.length}`);
    setDrafts(rows);
    setCampaigns(Array.isArray(c) ? c : []);
  };

  useEffect(() => { load(); const iv = setInterval(load, 30000); return () => clearInterval(iv); }, []);

  const filtered = useMemo(() => drafts.filter((d: any) => (`${d.subject || ''} ${d.content || ''}`).toLowerCase().includes(q.toLowerCase())), [drafts, q]);

  const approve = async (d: any) => {
    const res = await fetch(`${base}/api/drafts/${d.id}/approve`, { method: 'POST', credentials: 'include' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return toast('error', j?.error?.message || `Approve failed (${res.status})`);
    setDrafts((curr) => curr.filter((x: any) => x.id !== d.id));
    toast('success', 'Approved — ready to send in Drafts');
  };

  const reject = async (d: any) => {
    const reason = (rejectReason[d.id] || '').trim() || 'Rejected';
    const res = await fetch(`${base}/api/drafts/${d.id}/reject`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return toast('error', j?.error?.message || `Reject failed (${res.status})`);
    await fetch(`${base}/api/drafts/${d.id}/request-changes`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason }) });
    setDrafts((curr) => curr.filter((x: any) => x.id !== d.id));
    toast('success', 'Draft sent for rewrite — check back in a moment');
  };

  const saveAndApprove = async (d: any) => {
    const content = editContent[d.id] ?? d.content ?? '';
    await fetch(`${base}/api/drafts/${d.id}`, { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content }) });
    const res = await fetch(`${base}/api/drafts/${d.id}/edit-inline-approve`, { method: 'POST', credentials: 'include' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return toast('error', j?.error?.message || `Edit & approve failed (${res.status})`);
    setDrafts((curr) => curr.filter((x: any) => x.id !== d.id));
    toast('success', 'Approved — ready to send in Drafts');
  };

  return <div className="dash-stack fade-in">
    <section className="page-header" style={{ display: 'flex', justifyContent: 'space-between' }}><div><div className="page-eyebrow">PIPELINE / APPROVALS</div><h2 className="page-title" style={{ margin: 0 }}>Approvals</h2></div><Badge tone="warning">{filtered.length} pending</Badge></section>
    <div className="table-toolbar"><input className="ui-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search drafts" /><Button variant="secondary" onClick={load}>Refresh Queue</Button></div>

    {!!selected.length && <div className="table-toolbar"><Button variant="ghost" style={{ borderColor: 'rgba(16,214,138,.35)', color: 'var(--emerald)' }} onClick={() => Promise.all(filtered.filter((x: any) => selected.includes(x.id)).map(approve)).then(() => setSelected([]))}>Approve All Selected</Button><Button variant="ghost" style={{ borderColor: 'rgba(255,91,122,.35)', color: 'var(--rose)' }} onClick={() => Promise.all(filtered.filter((x: any) => selected.includes(x.id)).map(reject)).then(() => setSelected([]))}>Reject All Selected</Button></div>}

    <div style={{ display: 'grid', gap: 12 }}>
      {filtered.map((d: any) => {
        const campaign = campaigns.find((c: any) => c.id === d.campaignId);
        const isEditing = !!editing[d.id];
        return <div key={d.id} className="ui-card" style={{ background: '#0D1117', border: '1px solid #1C2333', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={selected.includes(d.id)} onChange={(e) => e.target.checked ? setSelected((c) => c.includes(d.id) ? c : [...c, d.id]) : setSelected((c) => c.filter((x) => x !== d.id))} /><strong>{d.lead?.businessName || 'Draft'}</strong></label>
            <div style={{ display: 'flex', gap: 6 }}><Badge tone={String(d.channel || '').toUpperCase() === 'EMAIL' ? 'info' : 'violet' as any}>{String(d.channel || '').toUpperCase()}</Badge><Badge tone="default">{campaign?.name || 'No campaign'}</Badge></div>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto', background: '#080B12', padding: 12, borderRadius: 4, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, marginTop: 8, whiteSpace: 'pre-wrap' }}>{isEditing ? <textarea className="ui-input" rows={8} value={editContent[d.id] ?? d.content ?? ''} onChange={(e) => setEditContent((c) => ({ ...c, [d.id]: e.target.value }))} /> : (d.content || 'No content')}</div>
          <div className="table-toolbar" style={{ marginTop: 8 }}>
            {!isEditing && <Button variant="secondary" onClick={() => { setEditing((m) => ({ ...m, [d.id]: true })); setEditContent((c) => ({ ...c, [d.id]: d.content || '' })); }}>Edit & Approve</Button>}
            {isEditing && <Button variant="primary" onClick={() => saveAndApprove(d)}>Save & Approve</Button>}
            {isEditing && <Button variant="ghost" onClick={() => setEditing((m) => ({ ...m, [d.id]: false }))}>Cancel</Button>}
            <Button variant="ghost" style={{ borderColor: 'rgba(16,214,138,.35)', color: 'var(--emerald)' }} onClick={() => approve(d)}>Approve</Button>
            <input className="ui-input" placeholder="Reason" value={rejectReason[d.id] || ''} onChange={(e) => setRejectReason((r) => ({ ...r, [d.id]: e.target.value }))} />
            <Button variant="ghost" style={{ borderColor: 'rgba(255,91,122,.35)', color: 'var(--rose)' }} onClick={() => reject(d)}>Reject</Button>
          </div>
        </div>;
      })}
    </div>
  </div>;
}
