'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Table } from '../../components/ui/Table';

import { API_BASE, apiHeaders } from '../../lib/api';

function resolveContent(d: any): string {
  if (d.content) return d.content;
  if (Array.isArray(d.versions) && d.versions.length) {
    const sorted = [...d.versions].sort((a: any, b: any) => (b.versionNumber ?? 0) - (a.versionNumber ?? 0));
    return sorted[0]?.content || '';
  }
  return '';
}

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [sendHistory, setSendHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState('');
  const [channelFilter, setChannelFilter] = useState<'ALL' | 'EMAIL' | 'LINKEDIN'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'SENT' | 'REJECTED'>('ALL');

  const [showCompose, setShowCompose] = useState(false);
  const [compose, setCompose] = useState({ campaignId: '', leadId: '', channel: 'EMAIL', subject: '', content: '' });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<Record<string, string>>({});

  const toast = (type: 'success' | 'error' | 'info' | 'warning', text: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type, text } }));
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [approvedJson, sentJson, cJson, lJson, hJson] = await Promise.all([
        fetch(`${API_BASE}/api/drafts?status=APPROVED`, { credentials: 'include', headers: apiHeaders }).then((r) => r.json()).catch(() => []),
        fetch(`${API_BASE}/api/drafts?status=SENT`, { credentials: 'include', headers: apiHeaders }).then((r) => r.json()).catch(() => []),
        fetch(`${API_BASE}/api/campaigns`, { credentials: 'include', headers: apiHeaders }).then((r) => r.json()).catch(() => []),
        fetch(`${API_BASE}/api/leads`, { credentials: 'include', headers: apiHeaders }).then((r) => r.json()).catch(() => []),
        fetch(`${API_BASE}/api/drafts/send-history`, { credentials: 'include', headers: apiHeaders })
          .then((r) => (r.ok ? r.json().catch(() => []) : fetch(`${API_BASE}/api/drafts/email-send-history`, { credentials: 'include', headers: apiHeaders }).then((x) => x.json()).catch(() => [])))
          .catch(() => []),
      ]);

      setDrafts([
        ...(Array.isArray(approvedJson) ? approvedJson : []),
        ...(Array.isArray(sentJson) ? sentJson : []),
      ]);
      setCampaigns(Array.isArray(cJson) ? cJson : []);
      setLeads(Array.isArray(lJson) ? lJson : []);
      setSendHistory(Array.isArray(hJson) ? hJson : []);

      if (!compose.campaignId && Array.isArray(cJson) && cJson.length) {
        setCompose((curr) => ({ ...curr, campaignId: cJson[0].id }));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const leadsForCampaign = useMemo(
    () => leads.filter((l: any) => !compose.campaignId || l.campaignId === compose.campaignId),
    [leads, compose.campaignId],
  );

  const filtered = useMemo(() => {
    return drafts.filter((d: any) => {
      const text = `${d.subject || ''} ${resolveContent(d) || ''}`.toLowerCase();
      const queryOk = !q.trim() || text.includes(q.trim().toLowerCase());
      const channelOk = channelFilter === 'ALL' || String(d.channel || '').toUpperCase() === channelFilter;
      const status = String(d.status || '').toUpperCase();
      const statusOk = statusFilter === 'ALL' || status === statusFilter;
      return queryOk && channelOk && statusOk;
    });
  }, [drafts, q, channelFilter, statusFilter]);

  const approved = drafts.filter((d: any) => String(d.status || '').toUpperCase() === 'APPROVED').length;
  const sent = drafts.filter((d: any) => String(d.status || '').toUpperCase() === 'SENT').length;
  const rejected = drafts.filter((d: any) => String(d.status || '').toUpperCase() === 'REJECTED').length;

  const setLocalStatus = (id: string, status: string) => {
    setDrafts((curr) => curr.map((d: any) => (d.id === id ? { ...d, status } : d)));
  };

  const handleApiError = async (res: Response, fallback: string) => {
    const j = await res.json().catch(() => ({}));
    return j?.error?.message || j?.message || `${fallback} (HTTP ${res.status})`;
  };

  const rejectDraft = async (draft: any) => {
    try {
      const res = await fetch(`${API_BASE}/api/drafts/${draft.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: apiHeaders,
        body: JSON.stringify({ status: 'DRAFT' }),
      });
      if (!res.ok) throw new Error(await handleApiError(res, 'Reject failed'));
      setDrafts((curr) => curr.filter((d: any) => d.id !== draft.id));
      toast('success', 'Draft sent back to queue');
    } catch (e: any) {
      toast('error', e?.message || 'Reject failed');
    }
  };

  const sendDraft = async (draft: any) => {
    try {
      const isLinkedIn = String(draft.channel || '').toUpperCase() === 'LINKEDIN';
      const endpoint = isLinkedIn ? `${API_BASE}/api/drafts/${draft.id}/send-linkedin` : `${API_BASE}/api/drafts/${draft.id}/send-email`;
      const res = await fetch(endpoint, { method: 'POST', credentials: 'include', headers: apiHeaders });
      if (!res.ok) throw new Error(await handleApiError(res, 'Send failed'));
      setLocalStatus(draft.id, 'SENT');
      toast('success', 'Message sent successfully');
      await load();
    } catch (e: any) {
      toast('error', e?.message || 'Send failed');
    }
  };

  const saveEdit = async (draft: any) => {
    const content = editContent[draft.id] ?? resolveContent(draft) ?? '';
    try {
      const res = await fetch(`${API_BASE}/api/drafts/${draft.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: apiHeaders,
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error(await handleApiError(res, 'Save failed'));
      setDrafts((curr) => curr.map((d: any) => (d.id === draft.id ? { ...d, content } : d)));
      setEditingId(null);
      toast('success', 'Draft updated');
    } catch (e: any) {
      toast('error', e?.message || 'Save failed');
    }
  };

  const composeSave = async () => {
    try {
      const payload = {
        campaignId: compose.campaignId,
        leadId: compose.leadId || undefined,
        channel: compose.channel,
        draftType: 'OUTREACH',
        subject: compose.channel === 'EMAIL' ? compose.subject : undefined,
        content: compose.content,
        status: 'NEEDS_APPROVAL',
      };
      const res = await fetch(`${API_BASE}/api/drafts`, {
        method: 'POST',
        credentials: 'include',
        headers: apiHeaders,
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await handleApiError(res, 'Create failed'));
      setShowCompose(false);
      setCompose((curr) => ({ ...curr, leadId: '', subject: '', content: '' }));
      await load();
      toast('success', 'Draft saved to Approvals');
    } catch (e: any) {
      toast('error', e?.message || 'Create failed');
    }
  };

  const statusBadge = (status: string) => {
    const s = String(status || '').toUpperCase();
    if (s === 'APPROVED') return <Badge tone="success">APPROVED</Badge>;
    if (s === 'SENT') return <Badge tone="info">SENT</Badge>;
    if (s === 'REJECTED') return <Badge tone="danger">REJECTED</Badge>;
    return <Badge tone="default">{s || 'DRAFT'}</Badge>;
  };

  return (
    <div className="dash-stack fade-in">
      <section className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
        <div>
          <div className="page-eyebrow">PIPELINE / DRAFTS</div>
          <h2 className="page-title" style={{ margin: 0 }}>Drafts</h2>
          <p className="page-desc">Review and send approved outreach drafts.</p>
        </div>
        <div className="table-toolbar">
          <Button variant="secondary" onClick={() => setShowCompose(true)}>+ Compose</Button>
          <Button variant="secondary" onClick={load}>Refresh</Button>
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8 }}>
        <div className="ui-card" style={{ flex: 1, padding: 10 }}><div style={{ color: 'var(--emerald)', fontWeight: 700 }}>{approved}</div><div className="text-xs mono text-dim">APPROVED</div></div>
        <div className="ui-card" style={{ flex: 1, padding: 10 }}><div style={{ color: 'var(--cyan)', fontWeight: 700 }}>{sent}</div><div className="text-xs mono text-dim">SENT</div></div>
        <div className="ui-card" style={{ flex: 1, padding: 10 }}><div style={{ color: 'var(--rose)', fontWeight: 700 }}>{rejected}</div><div className="text-xs mono text-dim">REJECTED</div></div>
      </div>

      <Card title="Draft Queue" subtitle="Approved + sent outreach drafts">
        <div className="table-toolbar" style={{ marginBottom: 12 }}>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search content" />
          <select className="ui-input" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value as any)}>
            <option value="ALL">ALL</option><option value="EMAIL">EMAIL</option><option value="LINKEDIN">LINKEDIN</option>
          </select>
          <select className="ui-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
            <option value="ALL">ALL</option><option value="APPROVED">APPROVED</option><option value="SENT">SENT</option><option value="REJECTED">REJECTED</option>
          </select>
        </div>

        {loading ? <p className="muted">Loading…</p> : (
          <div style={{ display: 'grid', gap: 12 }}>
            {filtered.map((d: any) => {
              const lead = leads.find((l: any) => l.id === d.leadId);
              const campaign = campaigns.find((c: any) => c.id === d.campaignId);
              const status = String(d.status || '').toUpperCase();
              const isApproved = status === 'APPROVED';
              const isSent = status === 'SENT';
              const isEditing = editingId === d.id;
              const preview = resolveContent(d);

              return (
                <div key={d.id} className="ui-card" style={{ background: '#0D1117', border: '1px solid #1C2333', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <strong>{lead?.businessName || 'Unknown Business'} {lead?.contactName ? `• ${lead.contactName}` : ''}</strong>
                      <div className="muted" style={{ fontSize: 12 }}>{campaign?.name || 'No campaign'}</div>
                      {!preview ? (
                        <div className="muted" style={{ marginTop: 8, fontStyle: 'italic' }}>No message content yet</div>
                      ) : (
                        <div style={{ marginTop: 8, fontSize: 13, color: '#b7c3d5' }}>{preview.slice(0, 150)}{preview.length > 150 ? '…' : ''}</div>
                      )}
                    </div>
                    <Badge tone={String(d.channel || '').toUpperCase() === 'EMAIL' ? 'info' : 'violet' as any}>{String(d.channel || 'EMAIL').toUpperCase()}</Badge>
                  </div>

                  {isEditing && (
                    <textarea
                      className="ui-input"
                      rows={6}
                      value={editContent[d.id] ?? resolveContent(d) ?? ''}
                      onChange={(e) => setEditContent((curr) => ({ ...curr, [d.id]: e.target.value }))}
                      style={{ marginTop: 10 }}
                    />
                  )}

                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div>
                      {statusBadge(d.status)} <span className="muted">{d.createdAt ? new Date(d.createdAt).toLocaleString() : ''}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {!isEditing && <Button variant="secondary" onClick={() => { setEditingId(d.id); setEditContent((curr) => ({ ...curr, [d.id]: resolveContent(d) ?? '' })); }}>Edit</Button>}
                      {isEditing && <Button variant="secondary" onClick={() => saveEdit(d)}>Save</Button>}
                      {isEditing && <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>}

                      {isApproved && <Button variant="ghost" style={{ borderColor: 'rgba(255,91,122,.35)', color: 'var(--rose)' }} onClick={() => rejectDraft(d)}>Reject</Button>}

                      {isApproved && String(d.channel || '').toUpperCase() === 'EMAIL' && <Button variant="primary" onClick={() => sendDraft(d)}>Send Email</Button>}
                      {isApproved && String(d.channel || '').toUpperCase() === 'LINKEDIN' && <Button variant="ghost" onClick={() => sendDraft(d)}>Send LinkedIn</Button>}
                      {isSent && <span className="muted">Sent</span>}
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
                <td>{String(s.channel || 'EMAIL').toUpperCase()}</td>
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
              <select className="ui-input" value={compose.campaignId} onChange={(e) => setCompose((curr) => ({ ...curr, campaignId: e.target.value, leadId: '' }))}>
                <option value="">Select Campaign</option>
                {campaigns.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="ui-input" value={compose.leadId} onChange={(e) => setCompose((curr) => ({ ...curr, leadId: e.target.value }))}>
                <option value="">Select Lead</option>
                {leadsForCampaign.map((l: any) => <option key={l.id} value={l.id}>{l.businessName || 'Unknown'} {l.contactName ? `• ${l.contactName}` : ''}</option>)}
              </select>
              <div className="table-toolbar">
                <Button variant={compose.channel === 'EMAIL' ? 'primary' : 'secondary'} onClick={() => setCompose((curr) => ({ ...curr, channel: 'EMAIL' }))}>Email</Button>
                <Button variant={compose.channel === 'LINKEDIN' ? 'primary' : 'secondary'} onClick={() => setCompose((curr) => ({ ...curr, channel: 'LINKEDIN' }))}>LinkedIn</Button>
              </div>
              {compose.channel === 'EMAIL' && <Input value={compose.subject} onChange={(e) => setCompose((curr) => ({ ...curr, subject: e.target.value }))} placeholder="Subject" />}
              <textarea className="ui-input" rows={6} value={compose.content} onChange={(e) => setCompose((curr) => ({ ...curr, content: e.target.value }))} placeholder="Message body" />
              <p className="muted">This draft will be saved to Approvals (NEEDS_APPROVAL).</p>
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid #1C2333', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="secondary" onClick={() => setShowCompose(false)}>Cancel</Button>
              <Button variant="primary" onClick={composeSave}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
