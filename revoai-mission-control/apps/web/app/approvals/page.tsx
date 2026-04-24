'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { API_BASE, apiHeaders } from '../../lib/api';

type ChannelFilter = 'ALL' | 'EMAIL' | 'LINKEDIN' | 'FACEBOOK';

function resolveContent(draft: any) {
  const versions = Array.isArray(draft?.versions) ? draft.versions : [];
  const current = versions.find((v: any) => v?.versionNumber === draft?.currentVersion);
  return (current?.content || draft?.content || '').trim();
}

export default function ApprovalsPage() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [editContent, setEditContent] = useState<Record<string, string>>({});
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('ALL');
  const [scheduleOpen, setScheduleOpen] = useState<Record<string, boolean>>({});
  const [scheduleAt, setScheduleAt] = useState<Record<string, string>>({});
  const [lastRefreshAt, setLastRefreshAt] = useState<number>(Date.now());
  const [refreshAgeSec, setRefreshAgeSec] = useState(0);

  const toast = (type: 'success' | 'error' | 'info' | 'warning', text: string) => {
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { type, text } }));
  };

  const load = async () => {
    const [d, c] = await Promise.all([
      fetch(`${API_BASE}/api/drafts?status=NEEDS_APPROVAL`, { credentials: 'include', headers: apiHeaders }).then((r) => r.json()).catch(() => []),
      fetch(`${API_BASE}/api/campaigns`, { credentials: 'include', headers: apiHeaders }).then((r) => r.json()).catch(() => []),
    ]);
    const rows = (Array.isArray(d) ? d : []).sort((a: any, b: any) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime());
    setDrafts(rows);
    setCampaigns(Array.isArray(c) ? c : []);
    setLastRefreshAt(Date.now());
    setRefreshAgeSec(0);
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      setRefreshAgeSec(Math.max(0, Math.floor((Date.now() - lastRefreshAt) / 1000)));
    }, 1000);
    return () => clearInterval(iv);
  }, [lastRefreshAt]);

  const counts = useMemo(() => {
    const byChannel = { EMAIL: 0, LINKEDIN: 0, FACEBOOK: 0 };
    drafts.forEach((d: any) => {
      const ch = String(d?.channel || '').toUpperCase();
      if (ch === 'EMAIL' || ch === 'LINKEDIN' || ch === 'FACEBOOK') byChannel[ch] += 1;
    });
    return {
      ALL: drafts.length,
      EMAIL: byChannel.EMAIL,
      LINKEDIN: byChannel.LINKEDIN,
      FACEBOOK: byChannel.FACEBOOK,
    };
  }, [drafts]);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return drafts
      .filter((d: any) => {
        if (channelFilter === 'ALL') return true;
        return String(d?.channel || '').toUpperCase() === channelFilter;
      })
      .filter((d: any) => {
        const hay = [
          d?.subject || '',
          d?.content || '',
          d?.lead?.businessName || '',
          d?.lead?.contactName || '',
          d?.lead?.email || '',
          d?.lead?.linkedinUrl || '',
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(s);
      });
  }, [drafts, q, channelFilter]);

  const approve = async (d: any) => {
    const res = await fetch(`${API_BASE}/api/drafts/${d.id}/approve`, { method: 'POST', credentials: 'include', headers: apiHeaders });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return toast('error', j?.error?.message || `Approve failed (${res.status})`);
    setDrafts((curr) => curr.filter((x: any) => x.id !== d.id));
    setSelected((curr) => curr.filter((x) => x !== d.id));
    toast('success', 'Approved — ready to send in Drafts');
  };

  const approveAndQueue = async (d: any) => {
    const res = await fetch(`${API_BASE}/api/drafts/${d.id}/approve`, { method: 'POST', credentials: 'include', headers: apiHeaders });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return toast('error', j?.error?.message || `Approve failed (${res.status})`);

    const qRes = await fetch(`${API_BASE}/api/drafts/${d.id}/queue-send`, { method: 'POST', credentials: 'include', headers: apiHeaders });
    const qj = await qRes.json().catch(() => ({}));
    if (!qRes.ok) return toast('error', qj?.error?.message || `Queue failed (${qRes.status})`);

    setDrafts((curr) => curr.filter((x: any) => x.id !== d.id));
    setSelected((curr) => curr.filter((x) => x !== d.id));
    toast('success', 'Approved and queued for send');
  };

  const approveAndSchedule = async (d: any) => {
    const localDt = (scheduleAt[d.id] || '').trim();
    if (!localDt) return toast('warning', 'Select a schedule time first');

    const isoDateString = new Date(localDt).toISOString();
    const patchRes = await fetch(`${API_BASE}/api/drafts/${d.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: apiHeaders,
      body: JSON.stringify({ scheduledSendAt: isoDateString }),
    });
    const patchJson = await patchRes.json().catch(() => ({}));
    if (!patchRes.ok) return toast('error', patchJson?.error?.message || `Schedule failed (${patchRes.status})`);

    const approveRes = await fetch(`${API_BASE}/api/drafts/${d.id}/approve`, {
      method: 'POST',
      credentials: 'include',
      headers: apiHeaders,
    });
    const approveJson = await approveRes.json().catch(() => ({}));
    if (!approveRes.ok) return toast('error', approveJson?.error?.message || `Approve failed (${approveRes.status})`);

    setDrafts((curr) => curr.filter((x: any) => x.id !== d.id));
    setSelected((curr) => curr.filter((x) => x !== d.id));
    toast('success', 'Scheduled + approved');
  };

  const reject = async (d: any) => {
    const reason = (rejectReason[d.id] || '').trim() || 'Rejected';
    const res = await fetch(`${API_BASE}/api/drafts/${d.id}/reject`, {
      method: 'POST',
      credentials: 'include',
      headers: apiHeaders,
      body: JSON.stringify({ reason }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return toast('error', j?.error?.message || `Reject failed (${res.status})`);

    await fetch(`${API_BASE}/api/drafts/${d.id}/request-changes`, {
      method: 'POST',
      credentials: 'include',
      headers: apiHeaders,
      body: JSON.stringify({ reason }),
    });

    setDrafts((curr) => curr.filter((x: any) => x.id !== d.id));
    setSelected((curr) => curr.filter((x) => x !== d.id));
    toast('success', 'Draft sent for rewrite — check back in a moment');
  };

  const saveAndApprove = async (d: any) => {
    const content = editContent[d.id] ?? resolveContent(d) ?? '';
    await fetch(`${API_BASE}/api/drafts/${d.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: apiHeaders,
      body: JSON.stringify({ content }),
    });

    const res = await fetch(`${API_BASE}/api/drafts/${d.id}/edit-inline-approve`, {
      method: 'POST',
      credentials: 'include',
      headers: apiHeaders,
      body: JSON.stringify({ content }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return toast('error', j?.error?.message || `Edit & approve failed (${res.status})`);

    setDrafts((curr) => curr.filter((x: any) => x.id !== d.id));
    setSelected((curr) => curr.filter((x) => x !== d.id));
    setEditing((m) => ({ ...m, [d.id]: false }));
    toast('success', 'Approved — ready to send in Drafts');
  };

  const channelStyles: Record<ChannelFilter, { border: string; color: string; badgeBg: string }> = {
    ALL: { border: 'rgba(0,201,255,.45)', color: '#00C9FF', badgeBg: 'rgba(0,201,255,.15)' },
    EMAIL: { border: 'rgba(0,201,255,.45)', color: '#00C9FF', badgeBg: 'rgba(0,201,255,.15)' },
    LINKEDIN: { border: 'rgba(155,114,255,.45)', color: '#9B72FF', badgeBg: 'rgba(155,114,255,.15)' },
    FACEBOOK: { border: 'rgba(74,144,217,.45)', color: '#4A90D9', badgeBg: 'rgba(74,144,217,.15)' },
  };

  const tabs: ChannelFilter[] = ['ALL', 'EMAIL', 'LINKEDIN', 'FACEBOOK'];

  return (
    <div className="dash-stack fade-in">
      <section className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="page-eyebrow">PIPELINE / APPROVALS</div>
          <h2 className="page-title" style={{ margin: 0 }}>Approvals</h2>
        </div>
        <div style={{ display: 'grid', justifyItems: 'end', gap: 6 }}>
          <Badge tone="warning">{filtered.length} pending</Badge>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#7B8799' }}>
            Last refreshed: {refreshAgeSec}s ago
          </div>
        </div>
      </section>

      <div className="table-toolbar" style={{ gap: 8, flexWrap: 'wrap' }}>
        {tabs.map((tab) => {
          const active = channelFilter === tab;
          const style = channelStyles[tab];
          return (
            <button
              key={tab}
              onClick={() => setChannelFilter(tab)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 8,
                border: `1px solid ${active ? style.border : '#1C2333'}`,
                background: active ? 'rgba(255,255,255,.02)' : 'transparent',
                color: active ? style.color : '#9AA5B1',
                cursor: 'pointer',
                fontFamily: 'Syne, sans-serif',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <span>{tab}</span>
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11,
                  padding: '2px 6px',
                  borderRadius: 999,
                  background: active ? style.badgeBg : '#121826',
                  color: active ? style.color : '#9AA5B1',
                }}
              >
                {counts[tab]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="table-toolbar">
        <input className="ui-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search drafts, lead, email, LinkedIn URL" />
        <Button variant="secondary" onClick={load}>Refresh Queue</Button>
      </div>

      {filtered.length > 0 && (
        <div className="table-toolbar" style={{ background: 'rgba(0,201,255,0.04)', border: '1px solid rgba(0,201,255,0.15)', padding: '8px 12px', borderRadius: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={selected.length === filtered.length && filtered.length > 0}
              ref={(el) => { if (el) el.indeterminate = selected.length > 0 && selected.length < filtered.length; }}
              onChange={(e) => setSelected(e.target.checked ? filtered.map((x: any) => x.id) : [])}
            />
            <span>{selected.length === 0 ? `Select all ${filtered.length}` : `${selected.length} selected`}</span>
          </label>
          {!!selected.length && (
            <>
              <span style={{ flex: 1 }} />
              <Button
                variant="primary"
                onClick={async () => {
                  const items = filtered.filter((x: any) => selected.includes(x.id));
                  let ok = 0, fail = 0;
                  for (const d of items) {
                    try {
                      const ar = await fetch(`${API_BASE}/api/drafts/${d.id}/approve`, { method: 'POST', credentials: 'include', headers: apiHeaders });
                      if (!ar.ok) throw new Error(`approve ${ar.status}`);
                      const qr = await fetch(`${API_BASE}/api/drafts/${d.id}/queue-send`, { method: 'POST', credentials: 'include', headers: apiHeaders });
                      if (!qr.ok) throw new Error(`queue ${qr.status}`);
                      ok += 1;
                      // Throttle ~250ms between requests so we don't hammer the API
                      await new Promise((r) => setTimeout(r, 250));
                    } catch {
                      fail += 1;
                    }
                  }
                  setDrafts((curr: any[]) => curr.filter((x: any) => !selected.includes(x.id)));
                  setSelected([]);
                  toast(fail === 0 ? 'success' : 'warning', `Queued ${ok} for send${fail ? ` · ${fail} failed` : ''}`);
                }}
              >
                ⚡ Approve & Queue {selected.length} for send
              </Button>
              <Button
                variant="ghost"
                style={{ borderColor: 'rgba(16,214,138,.35)', color: 'var(--emerald)' }}
                onClick={() => Promise.all(filtered.filter((x: any) => selected.includes(x.id)).map(approve)).then(() => setSelected([]))}
              >
                Approve only (no send)
              </Button>
              <Button
                variant="ghost"
                style={{ borderColor: 'rgba(255,91,122,.35)', color: 'var(--rose)' }}
                onClick={() => Promise.all(filtered.filter((x: any) => selected.includes(x.id)).map(reject)).then(() => setSelected([]))}
              >
                Reject {selected.length}
              </Button>
            </>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div
          className="ui-card"
          style={{
            background: '#0D1117',
            border: '1px solid #1C2333',
            borderRadius: 8,
            padding: '28px 16px',
            textAlign: 'center',
            color: '#9AA5B1',
          }}
        >
          <div style={{ fontSize: 22, color: 'var(--emerald)', marginBottom: 8 }}>✓</div>
          <div style={{ fontFamily: 'Syne, sans-serif' }}>All caught up — no drafts awaiting approval</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map((d: any) => {
            const campaign = campaigns.find((c: any) => c.id === d.campaignId);
            const isEditing = !!editing[d.id];
            const ch = String(d.channel || '').toUpperCase();
            const contactLine = ch === 'EMAIL' ? d?.lead?.email : ch === 'LINKEDIN' ? d?.lead?.linkedinUrl : d?.lead?.email || d?.lead?.linkedinUrl;
            const approvals = Array.isArray(d?.approvals) ? d.approvals : [];
            const history = approvals
              .filter((a: any) => String(a?.action || '').toUpperCase().includes('REJECT') || String(a?.action || '').toUpperCase().includes('REQUEST_CHANGES'))
              .sort((a: any, b: any) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime());

            return (
              <div key={d.id} className="ui-card" style={{ background: '#0D1117', border: '1px solid #1C2333', borderRadius: 8, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selected.includes(d.id)}
                      onChange={(e) =>
                        e.target.checked
                          ? setSelected((c) => (c.includes(d.id) ? c : [...c, d.id]))
                          : setSelected((c) => c.filter((x) => x !== d.id))
                      }
                    />
                    <div>
                      <div style={{ fontWeight: 700 }}>{d?.lead?.businessName || 'Unknown Business'}{d?.lead?.contactName ? ` — ${d.lead.contactName}` : ''}</div>
                      {!!contactLine && <div style={{ color: '#7B8799', fontSize: 12 }}>{contactLine}</div>}
                    </div>
                  </label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <Badge tone={ch === 'EMAIL' ? 'info' : 'violet' as any}>{ch}</Badge>
                    <Badge tone="default">{campaign?.name || 'No campaign'}</Badge>
                  </div>
                </div>

                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, color: '#7B8799', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
                  <span>Created: {d?.createdAt ? new Date(d.createdAt).toLocaleString() : '—'}</span>
                  <span>{d?.scheduledSendAt ? `Scheduled: ${new Date(d.scheduledSendAt).toLocaleString()}` : ''}</span>
                </div>
                {(() => {
                  let en: any = {};
                  try { en = JSON.parse(String(d?.lead?.sourceDetail || '{}')); } catch {}
                  if (!en?.painHint && !(Array.isArray(en?.services) && en.services.length)) return null;
                  return (
                    <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(156,175,136,0.06)', border: '1px solid rgba(156,175,136,0.22)', borderRadius: 6, fontSize: 12, lineHeight: 1.5 }}>
                      <div style={{ color: '#9CAF88', fontSize: 10, letterSpacing: '0.18em', fontWeight: 700, marginBottom: 4 }}>AI CONTEXT USED</div>
                      {en?.painHint && <div style={{ color: '#C8D6B1', marginBottom: 4 }}>↳ {en.painHint}</div>}
                      {Array.isArray(en?.services) && en.services.length > 0 && (
                        <div style={{ color: '#94A3B8', fontSize: 11 }}>{en.services.slice(0, 3).join(' · ')}</div>
                      )}
                    </div>
                  );
                })()}
                {d?.lead?.followUpStage > 0 && d?.lead?.followUpStage < 99 && (
                  <div style={{ marginTop: 6, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
                    <Badge tone="info">FOLLOW-UP #{d.lead.followUpStage}</Badge>
                  </div>
                )}

                <div
                  style={{
                    maxHeight: 200,
                    overflowY: 'auto',
                    background: '#080B12',
                    padding: 12,
                    borderRadius: 4,
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 12,
                    marginTop: 8,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {isEditing ? (
                    <textarea
                      className="ui-input"
                      rows={8}
                      value={editContent[d.id] ?? resolveContent(d)}
                      onChange={(e) => setEditContent((c) => ({ ...c, [d.id]: e.target.value }))}
                    />
                  ) : (
                    resolveContent(d) || 'No content'
                  )}
                </div>

                <div className="table-toolbar" style={{ marginTop: 8, alignItems: 'center' }}>
                  {!isEditing && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditing((m) => ({ ...m, [d.id]: true }));
                        setEditContent((c) => ({ ...c, [d.id]: resolveContent(d) || '' }));
                      }}
                    >
                      Edit & Approve
                    </Button>
                  )}
                  {isEditing && <Button variant="primary" onClick={() => saveAndApprove(d)}>Save & Approve</Button>}
                  {isEditing && <Button variant="ghost" onClick={() => setEditing((m) => ({ ...m, [d.id]: false }))}>Cancel</Button>}

                  <Button variant="ghost" style={{ borderColor: 'rgba(16,214,138,.35)', color: 'var(--emerald)' }} onClick={() => approve(d)}>Approve</Button>
                  <Button variant="ghost" style={{ borderColor: 'rgba(0,201,255,.35)', color: 'var(--cyan)' }} onClick={() => approveAndQueue(d)}>Approve & Queue</Button>

                  <Button
                    variant="ghost"
                    style={{ borderColor: 'rgba(255,184,77,.35)', color: '#FFB84D' }}
                    onClick={() => setScheduleOpen((m) => ({ ...m, [d.id]: !m[d.id] }))}
                  >
                    Approve & Schedule
                  </Button>

                  <input className="ui-input" placeholder="Reason" value={rejectReason[d.id] || ''} onChange={(e) => setRejectReason((r) => ({ ...r, [d.id]: e.target.value }))} />
                  <Button variant="ghost" style={{ borderColor: 'rgba(255,91,122,.35)', color: 'var(--rose)' }} onClick={() => reject(d)}>Reject</Button>
                </div>

                {scheduleOpen[d.id] && (
                  <div className="table-toolbar" style={{ marginTop: 8 }}>
                    <input
                      type="datetime-local"
                      className="ui-input"
                      value={scheduleAt[d.id] || ''}
                      onChange={(e) => setScheduleAt((m) => ({ ...m, [d.id]: e.target.value }))}
                    />
                    <Button
                      variant="ghost"
                      style={{ borderColor: 'rgba(255,184,77,.35)', color: '#FFB84D' }}
                      onClick={() => approveAndSchedule(d)}
                    >
                      Confirm Schedule + Approve
                    </Button>
                  </div>
                )}

                {history.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #1C2333', display: 'grid', gap: 4 }}>
                    {history.map((h: any) => (
                      <div key={h.id || `${h.action}_${h.createdAt}`} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#7B8799' }}>
                        ↩️ {String(h?.action || '').toUpperCase()} by admin — "{h?.notes || 'No note'}" — {h?.createdAt ? new Date(h.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown date'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
