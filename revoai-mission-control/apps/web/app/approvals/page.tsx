'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Tab = 'OUTREACH' | 'SOCIAL' | 'ALL';

export default function ApprovalsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>('ALL');
  const [channelFilter, setChannelFilter] = useState<'ALL' | 'EMAIL' | 'LINKEDIN' | 'FACEBOOK'>('ALL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [editContent, setEditContent] = useState<Record<string, string>>({});

  const toast = (type: 'success' | 'error' | 'info' | 'warning', text: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type, text } }));
    }
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [draftRes, socialRes] = await Promise.all([
        fetch(`${base}/api/drafts?status=NEEDS_APPROVAL`, { credentials: 'include' }),
        fetch(`${base}/api/social-posts?status=needs_approval`, { credentials: 'include' }),
      ]);

      const draftJson = await draftRes.json().catch(() => []);
      const socialJson = await socialRes.json().catch(() => []);

      const draftItems = Array.isArray(draftJson) ? draftJson : [];
      const socialItems = (Array.isArray(socialJson) ? socialJson : []).map((p: any) => ({
        id: p.id,
        isSocialPost: true,
        channel: String(p.channel || 'LINKEDIN').toUpperCase(),
        status: 'NEEDS_APPROVAL',
        subject: p.title || '',
        content: p.body || '',
        createdAt: p.createdAt,
        campaignId: null,
        leadId: null,
      }));

      setItems([...draftItems, ...socialItems]);
    } catch (e: any) {
      setItems([]);
      setError(e?.message || 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  const filtered = useMemo(() => {
    return items.filter((d: any) => {
      const isSocial = !!d.isSocialPost;
      if (tab === 'OUTREACH' && isSocial) return false;
      if (tab === 'SOCIAL' && !isSocial) return false;
      if (channelFilter !== 'ALL' && String(d.channel || '').toUpperCase() !== channelFilter) return false;
      return true;
    });
  }, [items, tab, channelFilter]);

  const pendingCount = filtered.filter((d: any) => String(d.status || '').toUpperCase() === 'NEEDS_APPROVAL').length;

  const approve = async (d: any) => {
    try {
      const endpoint = d.isSocialPost ? `${base}/api/social-posts/${d.id}/approve` : `${base}/api/drafts/${d.id}/approve`;
      const res = await fetch(endpoint, { method: 'POST', credentials: 'include' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message || `Approve failed (${res.status})`);
      setItems((curr) => curr.map((x: any) => (x.id === d.id ? { ...x, status: 'APPROVED' } : x)));
      toast('success', 'Approved');
    } catch (e: any) {
      toast('error', e?.message || 'Approve failed');
    }
  };

  const editAndApprove = async (d: any) => {
    try {
      const content = editContent[d.id] ?? d.content;
      if (d.isSocialPost) {
        await fetch(`${base}/api/social-posts/${d.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ body: content }),
        });
      } else {
        await fetch(`${base}/api/drafts/${d.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ content }),
        });
      }
      await approve(d);
    } catch (e: any) {
      toast('error', e?.message || 'Edit & approve failed');
    }
  };

  const reject = async (d: any) => {
    try {
      const reason = rejectReason[d.id] || 'Rejected';
      const endpoint = d.isSocialPost ? `${base}/api/social-posts/${d.id}/feedback` : `${base}/api/drafts/${d.id}/reject`;
      const body = d.isSocialPost ? { notes: reason } : { reason };
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message || `Reject failed (${res.status})`);
      setItems((curr) => curr.map((x: any) => (x.id === d.id ? { ...x, status: 'REJECTED' } : x)));
      toast('success', 'Rejected');
    } catch (e: any) {
      toast('error', e?.message || 'Reject failed');
    }
  };

  const sendNow = async (d: any) => {
    if (d.isSocialPost) return;
    try {
      const endpoint = String(d.channel || '').toUpperCase() === 'LINKEDIN'
        ? `${base}/api/drafts/${d.id}/send-linkedin`
        : `${base}/api/drafts/${d.id}/send-email`;
      const res = await fetch(endpoint, { method: 'POST', credentials: 'include' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message || `Send failed (${res.status})`);
      setItems((curr) => curr.map((x: any) => (x.id === d.id ? { ...x, status: 'SENT' } : x)));
      toast('success', 'Sent');
    } catch (e: any) {
      toast('error', e?.message || 'Send failed');
    }
  };

  const bulkApprove = async () => {
    await Promise.all(filtered.filter((d: any) => selectedIds.includes(d.id)).map((d: any) => approve(d)));
    setSelectedIds([]);
  };

  const bulkReject = async () => {
    await Promise.all(filtered.filter((d: any) => selectedIds.includes(d.id)).map((d: any) => reject(d)));
    setSelectedIds([]);
  };

  return (
    <div className="dash-stack fade-in">
      <section className="page-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="page-eyebrow">PIPELINE / APPROVALS</div>
          <h2 className="page-title" style={{ margin: 0 }}>Approvals</h2>
        </div>
        <div className="table-toolbar">
          <Button variant="secondary" onClick={load}>Refresh Queue</Button>
          <Badge tone="warning">{pendingCount} pending</Badge>
        </div>
      </section>

      <div className="table-toolbar">
        <Button variant={tab === 'OUTREACH' ? 'primary' : 'secondary'} onClick={() => setTab('OUTREACH')}>Outreach Drafts</Button>
        <Button variant={tab === 'SOCIAL' ? 'primary' : 'secondary'} onClick={() => setTab('SOCIAL')}>Social Posts</Button>
        <Button variant={tab === 'ALL' ? 'primary' : 'secondary'} onClick={() => setTab('ALL')}>All</Button>
      </div>

      <div className="table-toolbar">
        {(['ALL', 'EMAIL', 'LINKEDIN', 'FACEBOOK'] as const).map((c) => (
          <button
            key={c}
            className="ui-btn"
            onClick={() => setChannelFilter(c)}
            style={{ border: '1px solid #243044', background: channelFilter === c ? 'rgba(0,201,255,.12)' : 'transparent' }}
          >
            {c}
          </button>
        ))}
      </div>

      {selectedIds.length > 0 && (
        <div className="table-toolbar">
          <Button variant="ghost" style={{ borderColor: 'rgba(16,214,138,.35)', color: 'var(--emerald)' }} onClick={bulkApprove}>Approve All Selected</Button>
          <Button variant="ghost" style={{ borderColor: 'rgba(255,91,122,.35)', color: 'var(--rose)' }} onClick={bulkReject}>Reject All Selected</Button>
        </div>
      )}

      {loading ? (
        <p className="muted">Loading queue…</p>
      ) : error ? (
        <p style={{ color: '#ff9b9b' }}>{error}</p>
      ) : filtered.length === 0 ? (
        <div className="ui-card" style={{ padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 26, marginBottom: 10 }}>🗂️</div>
          <div style={{ fontWeight: 700 }}>No drafts waiting for approval</div>
          <div className="muted">Drafts created from Leads or Drafts compose appear here.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map((d: any) => {
            const leadName = d.lead?.businessName || d.businessName || 'Unknown Business';
            const contact = d.lead?.contactName || d.contactName || '—';
            const channel = String(d.channel || 'EMAIL').toUpperCase();
            const campaign = d.campaign?.name || d.campaignName || '—';
            const isApproved = String(d.status || '').toUpperCase() === 'APPROVED';
            const isPending = String(d.status || '').toUpperCase() === 'NEEDS_APPROVAL';
            const content = editContent[d.id] ?? d.content ?? '';

            return (
              <div
                key={d.id}
                className="ui-card"
                style={{
                  background: '#0D1117',
                  border: '1px solid #1C2333',
                  borderRadius: 8,
                  padding: 16,
                  display: 'grid',
                  gridTemplateColumns: '3fr 2fr',
                  gap: 12,
                }}
              >
                <div>
                  <div className="table-toolbar" style={{ justifyContent: 'space-between' }}>
                    <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(d.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds((curr) => Array.from(new Set([...curr, d.id])));
                          else setSelectedIds((curr) => curr.filter((x) => x !== d.id));
                        }}
                      />
                      <strong>{leadName}</strong>
                    </label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Badge tone={channel === 'EMAIL' ? 'info' : 'violet' as any}>{channel}</Badge>
                      <Badge tone="default">{campaign}</Badge>
                    </div>
                  </div>

                  {channel === 'EMAIL' && <div className="muted" style={{ marginTop: 6 }}>{d.subject || 'No subject'}</div>}
                  <textarea
                    className="ui-input"
                    rows={6}
                    value={content}
                    onChange={(e) => setEditContent((curr) => ({ ...curr, [d.id]: e.target.value }))}
                    style={{ marginTop: 8 }}
                  />
                  <div className="muted" style={{ marginTop: 8 }}>
                    {contact} • {d.createdAt ? new Date(d.createdAt).toLocaleString() : ''}
                  </div>
                </div>

                <div>
                  <div style={{ marginBottom: 10 }}>
                    <Badge tone={isPending ? 'warning' : isApproved ? 'success' : String(d.status || '').toUpperCase() === 'REJECTED' ? 'danger' : 'default'}>
                      {String(d.status || 'UNKNOWN').toUpperCase()}
                    </Badge>
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <Button variant="ghost" style={{ borderColor: 'rgba(16,214,138,.35)', color: 'var(--emerald)' }} onClick={() => approve(d)}>Approve & Queue</Button>
                    <Button variant="secondary" onClick={() => editAndApprove(d)}>Edit & Approve</Button>
                    <input
                      className="ui-input"
                      placeholder="Rejection reason"
                      value={rejectReason[d.id] || ''}
                      onChange={(e) => setRejectReason((curr) => ({ ...curr, [d.id]: e.target.value }))}
                    />
                    <Button variant="ghost" style={{ borderColor: 'rgba(255,91,122,.35)', color: 'var(--rose)' }} onClick={() => reject(d)}>Reject</Button>
                    {isApproved && <Button variant="primary" onClick={() => sendNow(d)}>Send Now</Button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
