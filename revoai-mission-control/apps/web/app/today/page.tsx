'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { API_BASE, apiHeaders } from '../../lib/api';

type Summary = {
  generatedAt: string;
  counts: {
    draftsPending: number;
    socialDraftsPending: number;
    socialScheduledNext24: number;
    pendingReplies: number;
    leadsNeedingDraft: number;
    followupsDueSoon: number;
    sentLast24: number;
    socialPostedLast24: number;
    campaignsScheduled: number;
    newLeadsLast24: number;
  };
  lists: {
    drafts: any[];
    socialDrafts: any[];
    socialScheduled: any[];
    replies: any[];
    leadsToWork: any[];
    scheduledCampaigns: any[];
  };
};

export default function TodayPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toast = (type: 'success' | 'error' | 'info' | 'warning', text: string) => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('app-toast', { detail: { type, text } }));
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/today/summary`, { credentials: 'include', headers: apiHeaders });
      if (!res.ok) throw new Error(`Failed to load (HTTP ${res.status})`);
      setData(await res.json());
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, []);

  const approveDraft = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/drafts/${id}/approve`, { method: 'POST', credentials: 'include', headers: apiHeaders });
      toast('success', 'Approved');
      load();
    } catch (e: any) { toast('error', e?.message || 'Approve failed'); }
  };

  const approveAndQueue = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/drafts/${id}/approve`, { method: 'POST', credentials: 'include', headers: apiHeaders });
      await fetch(`${API_BASE}/api/drafts/${id}/queue-send`, { method: 'POST', credentials: 'include', headers: apiHeaders }).catch(() => null);
      toast('success', 'Approved + queued');
      load();
    } catch (e: any) { toast('error', e?.message || 'Approve+queue failed'); }
  };

  const [editing, setEditing] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const startEdit = (p: any) => { setEditing(p.id); setEditBody(p.body || ''); };
  const cancelEdit = () => { setEditing(null); setEditBody(''); };
  const saveEdit = async (id: string) => {
    setSavingEdit(true);
    try {
      const res = await fetch(`${API_BASE}/api/social-posts/${id}`, {
        method: 'PATCH', credentials: 'include', headers: apiHeaders,
        body: JSON.stringify({ body: editBody }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast('success', 'Saved');
      setEditing(null);
      load();
    } catch (e: any) { toast('error', e?.message || 'Save failed'); }
    finally { setSavingEdit(false); }
  };

  const approveSocial = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/social-posts/${id}/approve`, { method: 'POST', credentials: 'include', headers: apiHeaders });
      toast('success', 'Social approved');
      load();
    } catch (e: any) { toast('error', e?.message || 'Approve failed'); }
  };

  const totalAttention = data ? data.counts.draftsPending + data.counts.socialDraftsPending + data.counts.pendingReplies + data.counts.leadsNeedingDraft : 0;
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="dash-stack fade-in">
      {error && <div className="error-banner">{error}</div>}

      {data && (
        <>
          {/* Hero — single focal point */}
          <section style={{
            position: 'relative', overflow: 'hidden',
            padding: '32px 28px', borderRadius: 18,
            background: totalAttention > 0
              ? 'radial-gradient(120% 140% at 0% 0%, rgba(155,114,255,0.18), transparent 55%), radial-gradient(120% 140% at 100% 100%, rgba(0,201,255,0.10), transparent 55%), linear-gradient(180deg, #0F1320 0%, #0B0F1B 100%)'
              : 'radial-gradient(120% 140% at 0% 0%, rgba(16,214,138,0.14), transparent 55%), linear-gradient(180deg, #0F1320 0%, #0B0F1B 100%)',
            border: `1px solid ${totalAttention > 0 ? 'rgba(155,114,255,0.22)' : 'rgba(16,214,138,0.22)'}`,
            boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
          }}>
            <div style={{ fontSize: 11, color: '#9B72FF', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>
              {greeting}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 64, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.04em',
                background: totalAttention > 0
                  ? 'linear-gradient(135deg, #9B72FF 0%, #00C9FF 100%)'
                  : 'linear-gradient(135deg, #10D68A 0%, #14C896 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>{totalAttention}</span>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
                {totalAttention === 0 ? 'Inbox zero. Nothing waits on you.' : `thing${totalAttention === 1 ? '' : 's'} need${totalAttention === 1 ? 's' : ''} you today`}
              </h1>
            </div>
            <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>
              {data.counts.sentLast24} email{data.counts.sentLast24 === 1 ? '' : 's'} sent · {data.counts.socialPostedLast24} post{data.counts.socialPostedLast24 === 1 ? '' : 's'} live · {data.counts.newLeadsLast24} new lead{data.counts.newLeadsLast24 === 1 ? '' : 's'} today · auto-refresh every 30s
            </p>
          </section>

          {/* Compact metrics — 4 only, only when relevant */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            {[
              { k: 'Drafts', v: data.counts.draftsPending, href: '/approvals', accent: '#FFB628', show: data.counts.draftsPending > 0 },
              { k: 'Social drafts', v: data.counts.socialDraftsPending, href: '/social', accent: '#9B72FF', show: data.counts.socialDraftsPending > 0 },
              { k: 'Replies', v: data.counts.pendingReplies, href: '/leads', accent: '#FF5B7A', show: data.counts.pendingReplies > 0 },
              { k: 'Leads to work', v: data.counts.leadsNeedingDraft, href: '/leads', accent: '#14C896', show: data.counts.leadsNeedingDraft > 0 },
              { k: 'Scheduled', v: data.counts.socialScheduledNext24, href: '/social', accent: '#00C9FF', show: data.counts.socialScheduledNext24 > 0 },
            ].filter((s) => s.show).map((s) => (
              <Link key={s.k} href={s.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{
                  border: `1px solid ${s.accent}40`, borderLeft: `3px solid ${s.accent}`,
                  borderRadius: 8, padding: '10px 14px', background: `${s.accent}08`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  cursor: 'pointer', transition: 'transform .15s',
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateX(2px)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateX(0)')}>
                  <div className="muted text-xs" style={{ fontWeight: 600 }}>{s.k}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.accent }}>{s.v}</div>
                </div>
              </Link>
            ))}
          </div>

          {data.counts.draftsPending > 0 && (
            <Card title="📝 Drafts awaiting approval" subtitle="Approve + queue ships them via Resend.">
              <div style={{ display: 'grid', gap: 8 }}>
                {data.lists.drafts.map((d: any) => (
                  <div key={d.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <Badge tone={d.channel === 'EMAIL' ? 'info' : 'warning'}>{d.channel}</Badge>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{d.subject || '(no subject)'}</span>
                      <span className="muted text-xs">{new Date(d.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, marginBottom: 6, whiteSpace: 'pre-wrap' }}>
                      {String(d.content || '').slice(0, 220)}{(d.content || '').length > 220 ? '…' : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Button variant="primary" onClick={() => approveAndQueue(d.id)}>✓ Approve & Queue</Button>
                      <Button variant="ghost" onClick={() => approveDraft(d.id)}>Approve only</Button>
                      <Link href="/approvals"><Button variant="ghost">Review →</Button></Link>
                    </div>
                  </div>
                ))}
                {data.counts.draftsPending > 5 && (
                  <Link href="/approvals" style={{ textDecoration: 'none' }}>
                    <div className="muted text-xs" style={{ textAlign: 'center', padding: 8 }}>+ {data.counts.draftsPending - 5} more in /approvals →</div>
                  </Link>
                )}
              </div>
            </Card>
          )}

          {data.counts.socialDraftsPending > 0 && (() => {
            const autopilotDrafts = data.lists.socialDrafts.filter((p: any) => (p as any).engagementStats?.autopilot === true || (p as any).sourceType === 'autopilot');
            const otherDrafts = data.lists.socialDrafts.filter((p: any) => !((p as any).engagementStats?.autopilot === true || (p as any).sourceType === 'autopilot'));
            return (
              <>
                {autopilotDrafts.length > 0 && (
                  <Card title="⚡ Autopilot drafts ready for your review" subtitle="Auto-generated by your daily autopilot. Approve to schedule, reject to discard.">
                    <div style={{ display: 'grid', gap: 8 }}>
                      {autopilotDrafts.map((p: any) => {
                        const stats = (p as any).engagementStats || {};
                        return (
                          <div key={p.id} style={{
                            border: '1px solid rgba(16,214,138,0.3)', borderLeft: '4px solid #10D68A',
                            borderRadius: 10, padding: 12,
                            background: 'linear-gradient(135deg, rgba(16,214,138,0.06) 0%, transparent 60%), rgba(13,17,23,0.5)',
                          }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                              <Badge tone="success">⚡ AUTOPILOT</Badge>
                              <Badge tone="info">{p.channel}</Badge>
                              {stats.angle && <span className="muted text-xs mono">{stats.angle}</span>}
                              {stats.mix && <span className="muted text-xs">{stats.mix}</span>}
                            </div>
                            {(p as any).mediaUrl && (
                              <div style={{ position: 'relative', marginBottom: 8 }}>
                                <img src={(p as any).mediaUrl} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 8, display: 'block' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                                <button onClick={async (e) => {
                                  e.preventDefault();
                                  const btn = e.currentTarget;
                                  btn.disabled = true; btn.textContent = '✨ Replacing…';
                                  try {
                                    const r = await fetch(`${API_BASE}/api/social-posts/${p.id}/regenerate-image`, { method: 'POST', credentials: 'include', headers: apiHeaders });
                                    const j = await r.json();
                                    if (!r.ok) throw new Error(j?.error?.message || 'Replace failed');
                                    toast('success', 'New image generated');
                                    load();
                                  } catch (e: any) { toast('error', e?.message || 'Replace failed'); }
                                }} style={{ position: 'absolute', top: 8, right: 8, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>🔄 Replace image</button>
                              </div>
                            )}
                            {editing === p.id ? (
                              <>
                                <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} style={{ width: '100%', minHeight: 140, background: 'rgba(17,24,39,.65)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.55, marginBottom: 8 }} />
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <Button variant="primary" disabled={savingEdit} onClick={() => saveEdit(p.id)}>{savingEdit ? 'Saving…' : '💾 Save'}</Button>
                                  <Button variant="ghost" onClick={cancelEdit}>Cancel</Button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 8, whiteSpace: 'pre-wrap' }}>{String(p.body || '').slice(0, 320)}{(p.body || '').length > 320 ? '…' : ''}</div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  <Button variant="primary" onClick={() => approveSocial(p.id)}>✓ Approve & Schedule</Button>
                                  <Button variant="ghost" onClick={() => startEdit(p)}>✏️ Edit</Button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}
                {otherDrafts.length > 0 && (
                  <Card title="📣 Social posts awaiting approval">
                    <div style={{ display: 'grid', gap: 8 }}>
                      {otherDrafts.map((p: any) => (
                        <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                            <Badge tone="info">{p.channel}</Badge>
                            {p.groupId && <span className="muted text-xs mono">grp · {String(p.groupId).slice(-6)}</span>}
                          </div>
                          <div style={{ fontSize: 12.5, lineHeight: 1.5, marginBottom: 6, whiteSpace: 'pre-wrap' }}>{String(p.body || '').slice(0, 220)}{(p.body || '').length > 220 ? '…' : ''}</div>
                          <Button variant="primary" onClick={() => approveSocial(p.id)}>✓ Approve</Button>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            );
          })()}

          {data.counts.socialScheduledNext24 > 0 && (
            <Card title="⏰ Firing in next 24 hours" subtitle="SocialPublishCron auto-publishes these at scheduledAt.">
              <div style={{ display: 'grid', gap: 6 }}>
                {data.lists.socialScheduled.map((p: any) => (
                  <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
                    <Badge tone="info">{p.channel}</Badge>
                    <span className="muted text-xs mono">{new Date(p.scheduledAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                    <span style={{ fontSize: 12.5, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.body}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {data.counts.pendingReplies > 0 && (
            <Card title="💬 Replies analyzed but no action yet">
              <div style={{ display: 'grid', gap: 8 }}>
                {data.lists.replies.map((r: any) => (
                  <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <Badge tone={r.intent === 'interested' ? 'success' : r.intent === 'objection' || r.intent === 'question' ? 'warning' : r.intent === 'not_interested' || r.intent === 'unsubscribe' ? 'danger' : 'info'}>{String(r.intent).replace(/_/g, ' ')}</Badge>
                      <span className="muted text-xs">{Math.round((r.confidence || 0) * 100)}%</span>
                      <span className="muted text-xs">{r.subjectType}</span>
                      <span className="muted text-xs">{new Date(r.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="muted" style={{ fontSize: 12.5, fontStyle: 'italic', marginBottom: 6 }}>{r.reasoning}</div>
                    <Link href={r.subjectType === 'lead' ? `/leads` : '/social'}><Button variant="ghost">Open →</Button></Link>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {data.counts.leadsNeedingDraft > 0 && (
            <Card title="🎯 Leads waiting on a draft" subtitle="In NEW / ENRICHED / RESEARCHED state — no outreach yet.">
              <div style={{ display: 'grid', gap: 6 }}>
                {data.lists.leadsToWork.map((l: any) => (
                  <Link key={l.id} href="/leads" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 8px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                      <Badge>{l.status}</Badge>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{l.businessName}</span>
                      {l.niche && <span className="muted text-xs">· {l.niche}</span>}
                      {l.region && <span className="muted text-xs">· {l.region}</span>}
                      {l.fitScore && <span className="muted text-xs mono" style={{ marginLeft: 'auto' }}>fit {l.fitScore}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {data.counts.campaignsScheduled > 0 && (
            <Card title="📅 Campaign autoruns next 7 days">
              <div style={{ display: 'grid', gap: 6 }}>
                {data.lists.scheduledCampaigns.map((c: any) => (
                  <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</span>
                    <span className="muted text-xs">{c.niche}</span>
                    <span className="muted text-xs mono" style={{ marginLeft: 'auto' }}>{new Date(c.scheduledAutorunAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

        </>
      )}

      {!data && loading && <div className="muted">Loading…</div>}
    </div>
  );
}
