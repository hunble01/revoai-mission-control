'use client';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { API_BASE, apiHeaders } from '../../lib/api';

type Channel = 'LINKEDIN' | 'FACEBOOK' | 'INSTAGRAM' | 'YOUTUBE';
type SocialPost = {
  id: string;
  channel: Channel;
  body: string;
  status: string;
  scheduledAt: string | null;
  postedAt: string | null;
  externalPostId: string | null;
  groupId?: string | null;
  mediaUrl?: string | null;
  createdAt: string;
};

const PLATFORM_META: Record<Channel, { label: string; icon: string; charLimit: number; tone: 'info' | 'warning' | 'success' | 'danger' }> = {
  LINKEDIN: { label: 'LinkedIn', icon: '🔵', charLimit: 3000, tone: 'info' },
  FACEBOOK: { label: 'Facebook', icon: '🟦', charLimit: 5000, tone: 'info' },
  INSTAGRAM: { label: 'Instagram', icon: '🟪', charLimit: 2200, tone: 'warning' },
  YOUTUBE: { label: 'YouTube Short', icon: '🔴', charLimit: 100, tone: 'danger' },
};

const TABS = ['Compose', 'Queue', 'Calendar', 'DMs', 'Analytics'] as const;
type Tab = typeof TABS[number];

export default function SocialHubPage() {
  const [tab, setTab] = useState<Tab>('Compose');
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Compose state
  const [selectedChannels, setSelectedChannels] = useState<Channel[]>(['LINKEDIN']);
  const [body, setBody] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [issues, setIssues] = useState<Array<{ rule: string; severity: string; message: string }>>([]);
  const [suggestingTags, setSuggestingTags] = useState(false);

  // Analytics
  const [insights, setInsights] = useState<Record<string, any>>({});
  const [analyticsSummary, setAnalyticsSummary] = useState<any>(null);
  const [ytStats, setYtStats] = useState<any>(null);

  // A/B variants
  const [variants, setVariants] = useState<string[]>([]);
  const [generatingVariants, setGeneratingVariants] = useState(false);
  const [bestTimes, setBestTimes] = useState<Record<string, { suggestion: string; nextWindowAtIso: string }>>({});

  // DMs
  const [liDms, setLiDms] = useState<any[]>([]);
  const [metaDms, setMetaDms] = useState<any[]>([]);

  const toast = (type: 'success' | 'error' | 'info' | 'warning', text: string) => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('app-toast', { detail: { type, text } }));
  };

  const loadPosts = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/social-posts`, { credentials: 'include', headers: apiHeaders });
      if (!res.ok) throw new Error(`Failed to load (HTTP ${res.status})`);
      const arr = await res.json();
      setPosts(Array.isArray(arr) ? arr : []);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const loadInsights = async () => {
    try {
      const [fb, ig, summary, yt] = await Promise.all([
        fetch(`${API_BASE}/api/facebook/insights`, { credentials: 'include', headers: apiHeaders }).then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/api/instagram/insights`, { credentials: 'include', headers: apiHeaders }).then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/api/social-posts/analytics-summary`, { credentials: 'include', headers: apiHeaders }).then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/api/youtube/stats`, { credentials: 'include', headers: apiHeaders }).then((r) => r.ok ? r.json() : null).catch(() => null),
      ]);
      setInsights({ FACEBOOK: fb, INSTAGRAM: ig });
      setAnalyticsSummary(summary);
      setYtStats(yt);
    } catch {
      setInsights({});
    }
  };

  const loadDms = async () => {
    try {
      const [li, fb, ig] = await Promise.all([
        fetch(`${API_BASE}/api/linkedin-dm/queue`, { credentials: 'include', headers: apiHeaders }).then((r) => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API_BASE}/api/meta-dm/queue?channel=FACEBOOK`, { credentials: 'include', headers: apiHeaders }).then((r) => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API_BASE}/api/meta-dm/queue?channel=INSTAGRAM`, { credentials: 'include', headers: apiHeaders }).then((r) => r.ok ? r.json() : []).catch(() => []),
      ]);
      setLiDms(Array.isArray(li) ? li : []);
      setMetaDms([...(Array.isArray(fb) ? fb : []), ...(Array.isArray(ig) ? ig : [])]);
    } catch { /* silent */ }
  };

  const loadBestTimes = async () => {
    const channels: Channel[] = ['LINKEDIN', 'FACEBOOK', 'INSTAGRAM', 'YOUTUBE'];
    const out: Record<string, { suggestion: string; nextWindowAtIso: string }> = {};
    await Promise.all(channels.map(async (c) => {
      try {
        const res = await fetch(`${API_BASE}/api/social-posts/best-time?channel=${c}`, { credentials: 'include', headers: apiHeaders });
        if (res.ok) out[c] = await res.json();
      } catch { /* silent */ }
    }));
    setBestTimes(out);
  };

  useEffect(() => { loadPosts(); loadBestTimes(); }, []);
  useEffect(() => { if (tab === 'Analytics') loadInsights(); }, [tab]);
  useEffect(() => { if (tab === 'DMs') loadDms(); }, [tab]);

  const generateVariants = async () => {
    if (!body.trim()) { toast('warning', 'Write something first'); return; }
    setGeneratingVariants(true);
    setVariants([]);
    try {
      const ch = selectedChannels[0] || 'LINKEDIN';
      const res = await fetch(`${API_BASE}/api/social-posts/variants`, {
        method: 'POST', credentials: 'include', headers: apiHeaders,
        body: JSON.stringify({ body, channel: ch }),
      });
      const j = await res.json();
      if (j?.ok && Array.isArray(j.variants) && j.variants.length) {
        setVariants(j.variants);
        toast('success', `${j.variants.length} variants generated`);
      } else {
        toast('error', 'Variant generation failed');
      }
    } catch (e: any) {
      toast('error', e?.message || 'Variant generation failed');
    } finally {
      setGeneratingVariants(false);
    }
  };

  const approveLiDm = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/linkedin-dm/${id}/approve`, { method: 'POST', credentials: 'include', headers: apiHeaders });
      await loadDms();
      toast('success', 'Approved');
    } catch (e: any) { toast('error', e?.message || 'Approve failed'); }
  };

  const sendLiDm = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/linkedin-dm/${id}/send`, { method: 'POST', credentials: 'include', headers: apiHeaders });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error?.message || 'Send failed');
      await loadDms();
      toast('success', 'DM sent');
    } catch (e: any) { toast('error', e?.message || 'Send failed'); }
  };

  const approveMetaDm = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/meta-dm/${id}/approve`, { method: 'POST', credentials: 'include', headers: apiHeaders });
      await loadDms();
      toast('success', 'Approved — send manually from Pages inbox within the 24h window');
    } catch (e: any) { toast('error', e?.message || 'Approve failed'); }
  };

  const rejectMetaDm = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/meta-dm/${id}/reject`, { method: 'POST', credentials: 'include', headers: apiHeaders });
      await loadDms();
      toast('success', 'Rejected');
    } catch (e: any) { toast('error', e?.message || 'Reject failed'); }
  };

  // Brand-voice lint — debounced
  useEffect(() => {
    if (!body.trim()) { setIssues([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/social-posts/validate-brand-voice`, {
          method: 'POST', credentials: 'include', headers: apiHeaders,
          body: JSON.stringify({ body }),
        });
        const j = await res.json();
        setIssues(Array.isArray(j?.issues) ? j.issues : []);
      } catch { /* silent */ }
    }, 500);
    return () => clearTimeout(t);
  }, [body]);

  const toggleChannel = (c: Channel) => {
    setSelectedChannels((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  };

  const cast = async () => {
    if (selectedChannels.length === 0) { toast('warning', 'Pick at least one platform'); return; }
    if (!body.trim()) { toast('warning', 'Write something to post'); return; }
    setPosting(true);
    try {
      const finalBody = hashtags.length ? `${body.trim()}\n\n${hashtags.join(' ')}` : body.trim();
      const res = await fetch(`${API_BASE}/api/social-posts/bulk`, {
        method: 'POST', credentials: 'include', headers: apiHeaders,
        body: JSON.stringify({
          channels: selectedChannels,
          body: finalBody,
          mediaUrl: mediaUrl.trim() || null,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          hashtags,
          status: scheduledAt ? 'scheduled' : 'draft',
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error?.message || `HTTP ${res.status}`);
      toast('success', `Cast to ${selectedChannels.length} platform${selectedChannels.length > 1 ? 's' : ''}${scheduledAt ? ' (scheduled)' : ' (draft)'}`);
      setBody('');
      setMediaUrl('');
      setScheduledAt('');
      setHashtags([]);
      setIssues([]);
      await loadPosts();
      setTab('Queue');
    } catch (e: any) {
      toast('error', e?.message || 'Cast failed');
    } finally {
      setPosting(false);
    }
  };

  const suggestHashtags = async () => {
    if (!body.trim()) { toast('warning', 'Write the post body first'); return; }
    setSuggestingTags(true);
    try {
      const res = await fetch(`${API_BASE}/api/content/suggest-hashtags`, {
        method: 'POST', credentials: 'include', headers: apiHeaders,
        body: JSON.stringify({ body }),
      });
      const j = await res.json();
      if (j?.ok && Array.isArray(j.hashtags)) {
        setHashtags(j.hashtags);
        toast('success', `${j.hashtags.length} hashtags suggested`);
      } else {
        toast('error', j?.error || 'Hashtag suggestion failed');
      }
    } catch (e: any) {
      toast('error', e?.message || 'Hashtag suggestion failed');
    } finally {
      setSuggestingTags(false);
    }
  };

  const approveAndQueue = async (postId: string, scheduledAt?: string | null) => {
    try {
      await fetch(`${API_BASE}/api/social-posts/${postId}/approve`, { method: 'POST', credentials: 'include', headers: apiHeaders });
      if (scheduledAt) {
        await fetch(`${API_BASE}/api/social-posts/${postId}/schedule`, {
          method: 'POST', credentials: 'include', headers: apiHeaders,
          body: JSON.stringify({ scheduledAt }),
        });
      }
      await loadPosts();
      toast('success', 'Approved' + (scheduledAt ? ' + scheduled' : ''));
    } catch (e: any) {
      toast('error', e?.message || 'Approve failed');
    }
  };

  const reject = async (postId: string) => {
    try {
      await fetch(`${API_BASE}/api/social-posts/${postId}/reject`, { method: 'POST', credentials: 'include', headers: apiHeaders });
      await loadPosts();
      toast('success', 'Rejected — back to draft');
    } catch (e: any) {
      toast('error', e?.message || 'Reject failed');
    }
  };

  const calendarDays = useMemo(() => {
    const days: { date: string; label: string; posts: SocialPost[] }[] = [];
    const start = new Date(); start.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      days.push({
        date: key,
        label,
        posts: posts.filter((p) => p.scheduledAt && p.scheduledAt.slice(0, 10) === key),
      });
    }
    return days;
  }, [posts]);

  return (
    <div className="dash-stack fade-in">
      <section className="page-header">
        <div className="page-eyebrow">OPERATIONS / SOCIAL HUB</div>
        <h2 className="page-title" style={{ margin: 0 }}>Social Hub</h2>
        <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>Compose, schedule, and publish across LinkedIn, Facebook, Instagram, and YouTube — all in one place.</p>
      </section>

      <div className="table-toolbar" style={{ gap: 6, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid ' + (tab === t ? 'rgba(155,114,255,0.55)' : 'var(--border)'),
              background: tab === t ? 'rgba(155,114,255,0.12)' : 'transparent',
              color: tab === t ? '#9B72FF' : 'var(--text)',
              fontWeight: tab === t ? 700 : 500,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >{t}</button>
        ))}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {tab === 'Compose' && (
        <Card title="Compose" subtitle="Pick one or more platforms. Each gets its own SocialPost row, all linked by groupId.">
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(Object.keys(PLATFORM_META) as Channel[]).map((c) => {
                const sel = selectedChannels.includes(c);
                const m = PLATFORM_META[c];
                return (
                  <button
                    key={c}
                    onClick={() => toggleChannel(c)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 999,
                      border: '1px solid ' + (sel ? 'rgba(155,114,255,0.55)' : 'var(--border)'),
                      background: sel ? 'rgba(155,114,255,0.12)' : 'rgba(255,255,255,0.02)',
                      color: sel ? '#9B72FF' : 'var(--text)',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >{m.icon} {m.label}{sel ? ' ✓' : ''}</button>
                );
              })}
            </div>

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your post. Brand voice is checked as you type."
              style={{ width: '100%', minHeight: 180, background: 'rgba(17,24,39,.65)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
              {selectedChannels.map((c) => {
                const m = PLATFORM_META[c];
                const over = body.length > m.charLimit;
                return (
                  <span key={c} className="muted" style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: over ? '#FF5B7A' : undefined }}>
                    {m.icon} {body.length} / {m.charLimit}
                  </span>
                );
              })}
            </div>

            {issues.length > 0 && (
              <div style={{ background: 'rgba(255,193,7,.06)', border: '1px solid rgba(255,193,7,.28)', borderRadius: 8, padding: '10px 12px' }}>
                <div className="page-eyebrow" style={{ marginBottom: 6, color: '#FFB628' }}>BRAND VOICE</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }}>
                  {issues.map((i, idx) => <li key={idx}>{i.message}</li>)}
                </ul>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="page-eyebrow" style={{ display: 'block', marginBottom: 4 }}>MEDIA URL (optional, required for IG)</label>
                <input
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  style={{ width: '100%', background: 'rgba(17,24,39,.65)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
                />
              </div>
              <div>
                <label className="page-eyebrow" style={{ display: 'block', marginBottom: 4 }}>SCHEDULE FOR (leave blank = save draft)</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  style={{ width: '100%', background: 'rgba(17,24,39,.65)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button variant="ghost" onClick={suggestHashtags} disabled={suggestingTags || !body.trim()}>
                {suggestingTags ? 'Suggesting…' : '#️⃣ Suggest hashtags'}
              </Button>
              <Button variant="ghost" onClick={generateVariants} disabled={generatingVariants || !body.trim()}>
                {generatingVariants ? 'Generating…' : '🎲 Generate 3 alternates'}
              </Button>
              {selectedChannels[0] && bestTimes[selectedChannels[0]] && (
                <span className="muted text-xs" title={bestTimes[selectedChannels[0]].suggestion} style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(20,200,150,0.06)', border: '1px solid rgba(20,200,150,0.22)', color: '#14C896' }}>
                  ⏰ Next good window: {new Date(bestTimes[selectedChannels[0]].nextWindowAtIso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                  <button onClick={() => setScheduledAt(bestTimes[selectedChannels[0]].nextWindowAtIso.slice(0, 16))} style={{ marginLeft: 6, background: 'transparent', border: 'none', color: '#14C896', cursor: 'pointer', fontSize: 11, textDecoration: 'underline' }}>use it</button>
                </span>
              )}
              {hashtags.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {hashtags.map((h) => (
                    <span key={h} style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(0,201,255,.08)', border: '1px solid rgba(0,201,255,.22)', color: '#00C9FF', fontSize: 11.5 }}>{h}</span>
                  ))}
                  <button onClick={() => setHashtags([])} style={{ background: 'transparent', border: 'none', color: '#FF5B7A', cursor: 'pointer', fontSize: 11 }}>clear</button>
                </div>
              )}
            </div>

            {variants.length > 0 && (
              <div>
                <div className="page-eyebrow" style={{ marginBottom: 6 }}>ALTERNATES</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {variants.map((v, idx) => (
                    <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: 'rgba(255,255,255,0.01)' }}>
                      <div className="muted text-xs" style={{ marginBottom: 4 }}>Variant {idx + 1}</div>
                      <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.55, marginBottom: 6 }}>{v}</div>
                      <Button variant="ghost" onClick={() => { setBody(v); setVariants([]); toast('success', 'Loaded into composer'); }}>Use this one</Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="ghost" onClick={() => { setBody(''); setMediaUrl(''); setScheduledAt(''); setHashtags([]); setIssues([]); }}>Clear</Button>
              <Button variant="primary" onClick={cast} disabled={posting || !body.trim() || selectedChannels.length === 0}>
                {posting ? 'Casting…' : (scheduledAt ? `📅 Schedule ${selectedChannels.length} post${selectedChannels.length > 1 ? 's' : ''}` : `💾 Save ${selectedChannels.length} draft${selectedChannels.length > 1 ? 's' : ''}`)}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {tab === 'Queue' && (
        <Card title="Queue" subtitle={`${posts.length} total · ${posts.filter((p) => p.status === 'scheduled').length} scheduled · ${posts.filter((p) => p.status === 'posted').length} posted`}>
          {loading ? <div className="muted">Loading…</div> : posts.length === 0 ? (
            <div className="muted" style={{ padding: 24, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 8 }}>No social posts yet. Use Compose above.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {posts.map((p) => {
                const m = PLATFORM_META[p.channel as Channel] || PLATFORM_META.LINKEDIN;
                const scheduledAtLocal = p.scheduledAt ? new Date(p.scheduledAt).toLocaleString() : null;
                return (
                  <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'grid', gap: 8, background: 'rgba(255,255,255,0.01)' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Badge tone={m.tone}>{m.icon} {m.label}</Badge>
                      <Badge tone={p.status === 'posted' ? 'success' : p.status === 'scheduled' ? 'info' : p.status === 'approved' ? 'warning' : undefined}>{p.status}</Badge>
                      {p.groupId && <span className="muted text-xs mono" title="Cross-platform group id">grp · {p.groupId.slice(-6)}</span>}
                      {scheduledAtLocal && <span className="muted text-xs">📅 {scheduledAtLocal}</span>}
                      {p.externalPostId && <span className="muted text-xs mono">ext · {p.externalPostId.slice(0, 16)}…</span>}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.55 }}>{p.body}</div>
                    {p.mediaUrl && <div className="muted text-xs">🖼 {p.mediaUrl}</div>}
                    {p.status === 'draft' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button variant="primary" onClick={() => approveAndQueue(p.id, p.scheduledAt)}>Approve {p.scheduledAt ? '+ schedule' : ''}</Button>
                        <Button variant="ghost" style={{ color: '#FF5B7A' }} onClick={() => reject(p.id)}>Reject</Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {tab === 'Calendar' && (
        <Card title="14-Day Calendar" subtitle="Scheduled posts shown by day. Drag-to-reschedule coming later.">
          <div style={{ display: 'grid', gap: 8 }}>
            {calendarDays.map((d) => (
              <div key={d.date} style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{d.label}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {d.posts.length === 0 ? (
                    <span className="muted text-xs" style={{ fontStyle: 'italic' }}>—</span>
                  ) : d.posts.map((p) => {
                    const m = PLATFORM_META[p.channel as Channel] || PLATFORM_META.LINKEDIN;
                    return (
                      <span key={p.id} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(155,114,255,.08)', border: '1px solid rgba(155,114,255,.22)', fontSize: 12 }}>
                        {m.icon} {new Date(p.scheduledAt!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {p.body.slice(0, 60)}{p.body.length > 60 ? '…' : ''}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'DMs' && (
        <div className="dash-stack">
          <Card title="LinkedIn DM Queue" subtitle="20/day cap enforced. Suppression-list aware. Drafted DMs from /leads land here.">
            {liDms.length === 0 ? (
              <div className="muted" style={{ padding: 16, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 8 }}>No queued LinkedIn DMs. Draft one from /leads (must have linkedinUrl).</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {liDms.map((m) => (
                  <div key={m.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <Badge tone="info">🔵 LinkedIn</Badge>
                      <Badge tone={m.status === 'approved' ? 'warning' : undefined}>{m.status}</Badge>
                      <span className="muted text-xs">{new Date(m.createdAt).toLocaleString()}</span>
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.55, marginBottom: 8 }}>{m.messageBody}</div>
                    {m.status === 'queued' && <Button variant="primary" onClick={() => approveLiDm(m.id)}>Approve</Button>}
                    {m.status === 'approved' && <Button variant="primary" onClick={() => sendLiDm(m.id)}>📤 Send DM</Button>}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Facebook + Instagram DM Queue" subtitle="">
            <div style={{ background: 'rgba(255,193,7,.06)', border: '1px solid rgba(255,193,7,.28)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
              <div className="page-eyebrow" style={{ color: '#FFB628', marginBottom: 4 }}>HONEST CONSTRAINT</div>
              <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
                Meta only allows DMs in the 24-hour window after a user messages your page first. Cold-DM automation isn't viable here.
                This queue is for warm-reply use only — approve a draft, then send manually from your Pages inbox within the 24h window.
              </div>
            </div>
            {metaDms.length === 0 ? (
              <div className="muted" style={{ padding: 16, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 8 }}>No queued Meta DMs.</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {metaDms.map((m) => {
                  const meta = m.channel === 'INSTAGRAM' ? PLATFORM_META.INSTAGRAM : PLATFORM_META.FACEBOOK;
                  return (
                    <div key={m.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                        <Badge tone={meta.tone}>{meta.icon} {meta.label}</Badge>
                        <Badge tone={m.status === 'approved' ? 'warning' : undefined}>{m.status}</Badge>
                        {m.recipientHandle && <span className="muted text-xs mono">@{m.recipientHandle}</span>}
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.55, marginBottom: 8 }}>{m.messageBody}</div>
                      {m.status === 'queued' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button variant="primary" onClick={() => approveMetaDm(m.id)}>Approve (then send manually)</Button>
                          <Button variant="ghost" style={{ color: '#FF5B7A' }} onClick={() => rejectMetaDm(m.id)}>Reject</Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'Analytics' && (
        <div className="dash-stack">
          {analyticsSummary && (
            <Card title="30-Day Cross-Platform Funnel" subtitle="All counts from the last 30 days.">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                {[
                  { k: 'Total Posts', v: analyticsSummary.totals.posts },
                  { k: 'Posted', v: analyticsSummary.totals.posted },
                  { k: 'Scheduled', v: analyticsSummary.totals.scheduled },
                  { k: 'Drafts', v: analyticsSummary.totals.drafts },
                  { k: 'LinkedIn DMs', v: analyticsSummary.totals.linkedinDms },
                  { k: 'Meta DMs', v: analyticsSummary.totals.metaDms },
                  { k: 'Replies analyzed', v: analyticsSummary.totals.socialReplies },
                ].map((s) => (
                  <div key={s.k} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>{s.v}</div>
                    <div className="muted text-xs">{s.k}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card title="Platform Insights" subtitle="Aggregated reach + engagement (real once OAuth connected; STUB badge otherwise).">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {(['FACEBOOK', 'INSTAGRAM'] as Channel[]).map((c) => {
                const m = PLATFORM_META[c];
                const data: any = insights[c];
                return (
                  <div key={c} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontWeight: 700 }}>{m.icon} {m.label}</div>
                      <Badge tone="warning">STUB</Badge>
                    </div>
                    {data ? (
                      <div className="muted" style={{ fontSize: 12, display: 'grid', gap: 4 }}>
                        {Object.entries(data).filter(([k]) => k !== 'raw').map(([k, v]) => (
                          <div key={k}><strong style={{ color: 'var(--text)' }}>{String(v)}</strong> {k.replace(/([A-Z])/g, ' $1').toLowerCase()}</div>
                        ))}
                      </div>
                    ) : <div className="muted">Not connected.</div>}
                  </div>
                );
              })}
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700 }}>{PLATFORM_META.LINKEDIN.icon} LinkedIn</div>
                  <Badge tone="info">DM Queue + Posts</Badge>
                </div>
                <div className="muted" style={{ fontSize: 12 }}>{analyticsSummary?.totals.linkedinDms ?? 0} DMs sent in 30 days. Insights API v2 deferred.</div>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700 }}>{PLATFORM_META.YOUTUBE.icon} YouTube</div>
                  <Badge tone={ytStats?.stub ? 'warning' : 'success'}>{ytStats?.stub ? 'STUB' : 'LIVE'}</Badge>
                </div>
                {ytStats ? (
                  <div className="muted" style={{ fontSize: 12, display: 'grid', gap: 4 }}>
                    <div><strong style={{ color: 'var(--text)' }}>{ytStats.subscriberCount}</strong> subscribers</div>
                    <div><strong style={{ color: 'var(--text)' }}>{ytStats.viewCount}</strong> total views</div>
                    <div><strong style={{ color: 'var(--text)' }}>{ytStats.videoCount}</strong> videos</div>
                  </div>
                ) : <div className="muted">Not connected.</div>}
              </div>
            </div>
          </Card>

          <Card title="Funnel — last 200 posts">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              {[
                { k: 'Drafts', v: posts.filter((p) => p.status === 'draft').length },
                { k: 'Approved', v: posts.filter((p) => p.status === 'approved').length },
                { k: 'Scheduled', v: posts.filter((p) => p.status === 'scheduled').length },
                { k: 'Posted', v: posts.filter((p) => p.status === 'posted').length },
              ].map((s) => (
                <div key={s.k} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{s.v}</div>
                  <div className="muted text-xs">{s.k}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
