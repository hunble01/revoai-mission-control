'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Table } from '../../components/ui/Table';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [sendHistory, setSendHistory] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [channel, setChannel] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [showCompose, setShowCompose] = useState(false);
  const [loading, setLoading] = useState(false);
  const [compose, setCompose] = useState<any>({ campaignId: '', leadId: '', channel: 'EMAIL', subject: '', content: '' });

  const toast = (type: 'success' | 'error' | 'info' | 'warning', text: string) => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('app-toast', { detail: { type, text } }));
  };

  const load = async () => {
    setLoading(true);
    try {
      const [dRes, cRes, lRes, hRes] = await Promise.all([
        fetch(`${base}/api/drafts`, { credentials: 'include' }),
        fetch(`${base}/api/campaigns`, { credentials: 'include' }),
        fetch(`${base}/api/leads`, { credentials: 'include' }),
        fetch(`${base}/api/drafts/send-history`, { credentials: 'include' }).catch(() => fetch(`${base}/api/drafts/email-send-history`, { credentials: 'include' })),
      ]);
      const [d, c, l, h] = await Promise.all([
        dRes.json().catch(() => []),
        cRes.json().catch(() => []),
        lRes.json().catch(() => []),
        hRes.json().catch(() => []),
      ]);
      setDrafts(Array.isArray(d) ? d : []);
      setCampaigns(Array.isArray(c) ? c : []);
      setLeads(Array.isArray(l) ? l : []);
      setSendHistory(Array.isArray(h) ? h : []);
      if (!compose.campaignId && Array.isArray(c) && c[0]?.id) setCompose((x: any) => ({ ...x, campaignId: c[0].id }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const leadsForCampaign = useMemo(() => leads.filter((l: any) => !compose.campaignId || l.campaignId === compose.campaignId), [leads, compose.campaignId]);

  const filtered = drafts.filter((d: any) => {
    const hitQ = !q.trim() || String(d.content || '').toLowerCase().includes(q.toLowerCase()) || String(d.subject || '').toLowerCase().includes(q.toLowerCase());
    const hitChannel = channel === 'ALL' || String(d.channel || '').toUpperCase() === channel;
    const normalized = String(d.status || '').toUpperCase();
    const mapped = normalized === 'NEEDS_APPROVAL' ? 'PENDING' : normalized;
    const hitStatus = status === 'ALL' || mapped === status;
    return hitQ && hitChannel && hitStatus;
  });

  const pending = drafts.filter((d: any) => String(d.status || '').toUpperCase() === 'NEEDS_APPROVAL').length;
  const approved = drafts.filter((d: any) => String(d.status || '').toUpperCase() === 'APPROVED').length;
  const sent = drafts.filter((d: any) => String(d.status || '').toUpperCase() === 'SENT').length;
  const rejected = drafts.filter((d: any) => String(d.status || '').toUpperCase() === 'REJECTED').length;

  const statusBadge = (s: string) => {
    const st = String(s || '').toUpperCase();
    if (st === 'NEEDS_APPROVAL' || st === 'PENDING') return <Badge tone="warning">PENDING</Badge>;
    if (st === 'APPROVED') return <Badge tone="success">APPROVED</Badge>;
    if (st === 'SENT') return <Badge tone="info">SENT</Badge>;
    if (st === 'REJECTED') return <Badge tone="danger">REJECTED</Badge>;
    return <Badge tone="default">{st || 'DRAFT'}</Badge>;
  };

  const doAction = async (id: string, action: 'approve' | 'reject' | 'send-email') => {
    try {
      const res = await fetch(`${base}/api/drafts/${id}/${action}`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' } });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message || `Action failed (${res.status})`);
      toast('success', action === 'send-email' ? 'Draft sent' : `Draft ${action}d`);
      await load();
    } catch (e: any) {
      toast('error', e?.message || 'Action failed');
    }
  };

  const createDraft = async () => {
    try {
      const payload = {
        campaignId: compose.campaignId,
        leadId: compose.leadId,
        channel: compose.channel,
        draftType: 'OUTREACH',
        subject: compose.channel === 'EMAIL' ? compose.subject : undefined,
        content: compose.content,
        status: 'NEEDS_APPROVAL',
      };
      const res = await fetch(`${base}/api/drafts`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message || `Create failed (${res.status})`);
      setShowCompose(false);
      setCompose({ campaignId: compose.campaignId, leadId: '', channel: 'EMAIL', subject: '', content: '' });
      toast('success', 'Draft created and queued for approval');
      await load();
    } catch (e: any) {
      toast('error', e?.message || 'Create failed');
    }
  };

  return (
    <div className="dash-stack fade-in">
      <section className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
        <div>
          <div className="page-eyebrow">PIPELINE / DRAFTS</div>
          <h2 className="page-title" style={{ margin: 0 }}>Drafts</h2>
          <p className="page-desc">Review and send approved outreach drafts</p>
        </div>
        <div className="table-toolbar">
          <Button variant="secondary" onClick={() => setShowCompose(true)}>+ Compose</Button>
          <Button variant="secondary" onClick={load}>Refresh</Button>
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8 }}>
        <div className="ui-card" style={{ flex: 1, padding: 10 }}><div style={{ color: 'var(--amber)', fontWeight: 700 }}>{pending}</div><div className="text-xs mono text-dim">PENDING</div></div>
        <div className="ui-card" style={{ flex: 1, padding: 10 }}><div style={{ color: 'var(--emerald)', fontWeight: 700 }}>{approved}</div><div className="text-xs mono text-dim">APPROVED</div></div>
        <div className="ui-card" style={{ flex: 1, padding: 10 }}><div style={{ color: 'var(--cyan)', fontWeight: 700 }}>{sent}</div><div className="text-xs mono text-dim">SENT</div></div>
        <div className="ui-card" style={{ flex: 1, padding: 10 }}><div style={{ color: 'var(--rose)', fontWeight: 700 }}>{rejected}</div><div className="text-xs mono text-dim">REJECTED</div></div>
      </div>

      <Card title="Draft Queue" subtitle="Pending + approved outreach drafts">
        <div className="table-toolbar" style={{ marginBottom: 12 }}>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search content" />
          <select className="ui-input" value={channel} onChange={(e) => setChannel(e.target.value)}><option>ALL</option><option>EMAIL</option><option>LINKEDIN</option></select>
          <select className="ui-input" value={status} onChange={(e) => setStatus(e.target.value)}><option>ALL</option><option>PENDING</option><option>APPROVED</option><option>SENT</option><option>REJECTED</option></select>
        </div>

        {loading ? <p className="muted">Loading…</p> : (
          <div style={{ display: 'grid', gap: 12 }}>
            {filtered.map((d: any) => {
              const lead = leads.find((l: any) => l.id === d.leadId);
              const campaign = campaigns.find((c: any) => c.id === d.campaignId);
              return (
                <div key={d.id} className="ui-card" style={{ background: '#0D1117', border: '1px solid #1C2333', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <strong>{lead?.businessName || 'Unknown Business'} {lead?.contactName ? `• ${lead.contactName}` : ''}</strong>
                      <div className="muted" style={{ fontSize: 12 }}>{campaign?.name || 'No campaign'}</div>
                    </div>
                    <Badge tone={String(d.channel || '').toUpperCase() === 'EMAIL' ? 'info' : 'violet' as any}>{String(d.channel || 'EMAIL').toUpperCase()}</Badge>
                  </div>
                  <div style={{ marginTop: 10, background: '#080B12', borderRadius: 4, padding: 12, fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>
                    {String(d.content || '').slice(0, 120)}{String(d.content || '').length > 120 ? '…' : ''}
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div>{statusBadge(d.status)} <span className="muted">{d.createdAt ? new Date(d.createdAt).toLocaleString() : ''}</span></div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button variant="secondary">View & Edit</Button>
                      {String(d.status || '').toUpperCase() === 'NEEDS_APPROVAL' && <Button variant="ghost" style={{ borderColor: 'rgba(16,214,138,.35)', color: 'var(--emerald)' }} onClick={() => doAction(d.id, 'approve')}>Approve</Button>}
                      {String(d.status || '').toUpperCase() === 'NEEDS_APPROVAL' && <Button variant="ghost" style={{ borderColor: 'rgba(255,91,122,.35)', color: 'var(--rose)' }} onClick={() => doAction(d.id, 'reject')}>Reject</Button>}
                      {String(d.status || '').toUpperCase() === 'APPROVED' && <Button variant="primary" onClick={() => doAction(d.id, 'send-email')}>Send</Button>}
                    </div>
                  </div>
                </div>
              );
            })}
            {!filtered.length && <p className="muted">No drafts found.</p>}
          </div>
        )}
      </Card>

      <Card title="Send History" subtitle="Recent outbound sends">
        <Table>
          <thead><tr><th>Recipient</th><th>Channel</th><th>Status</th><th>Sent At</th><th>Opened</th><th>Replied</th></tr></thead>
          <tbody>
            {sendHistory.map((s: any) => (
              <tr key={s.id || `${s.draftId}_${s.sentAt}`}>
                <td>{s.to || s.recipient || s.email || '—'}</td>
                <td>{(s.channel || 'EMAIL').toUpperCase()}</td>
                <td>{String(s.status || 'SENT').toUpperCase()}</td>
                <td>{s.sentAt ? new Date(s.sentAt).toLocaleString() : '—'}</td>
                <td>{s.openedAt ? 'Yes' : 'No'}</td>
                <td>{s.repliedAt ? 'Yes' : 'No'}</td>
              </tr>
            ))}
            {!sendHistory.length && <tr><td colSpan={6} className="muted">No send history yet.</td></tr>}
          </tbody>
        </Table>
      </Card>

      {showCompose && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 7000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 680, background: '#0D1117', border: '1px solid #1C2333', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #1C2333' }}><strong>Compose Draft</strong></div>
            <div style={{ padding: 16, display: 'grid', gap: 10 }}>
              <select className="ui-input" value={compose.campaignId} onChange={(e) => setCompose((x: any) => ({ ...x, campaignId: e.target.value, leadId: '' }))}>
                <option value="">Select Campaign</option>
                {campaigns.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="ui-input" value={compose.leadId} onChange={(e) => setCompose((x: any) => ({ ...x, leadId: e.target.value }))}>
                <option value="">Select Lead</option>
                {leadsForCampaign.map((l: any) => <option key={l.id} value={l.id}>{l.businessName || 'Unknown'} {l.contactName ? `• ${l.contactName}` : ''}</option>)}
              </select>
              <div className="table-toolbar">
                <Button variant={compose.channel === 'EMAIL' ? 'primary' : 'secondary'} onClick={() => setCompose((x: any) => ({ ...x, channel: 'EMAIL' }))}>Email</Button>
                <Button variant={compose.channel === 'LINKEDIN' ? 'primary' : 'secondary'} onClick={() => setCompose((x: any) => ({ ...x, channel: 'LINKEDIN' }))}>LinkedIn</Button>
              </div>
              {compose.channel === 'EMAIL' && <Input value={compose.subject} onChange={(e) => setCompose((x: any) => ({ ...x, subject: e.target.value }))} placeholder="Subject" />}
              <textarea className="ui-input" rows={6} value={compose.content} onChange={(e) => setCompose((x: any) => ({ ...x, content: e.target.value }))} placeholder="Message body" />
              <p className="muted">This draft will go to Approvals before sending</p>
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid #1C2333', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="secondary" onClick={() => setShowCompose(false)}>Cancel</Button>
              <Button variant="primary" onClick={createDraft}>Save to Approvals</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
