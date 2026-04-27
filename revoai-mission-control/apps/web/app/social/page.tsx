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

type PlatformMeta = {
  label: string;
  icon: string;
  letter: string;
  charLimit: number;
  tone: 'info' | 'warning' | 'success' | 'danger';
  color: string;
  gradient: string;
  glow: string;
};

const PLATFORM_META: Record<Channel, PlatformMeta> = {
  LINKEDIN: {
    label: 'LinkedIn', icon: '🔵', letter: 'in', charLimit: 3000, tone: 'info',
    color: '#0A7ABF',
    gradient: 'linear-gradient(135deg, #0A7ABF 0%, #0966A3 100%)',
    glow: 'rgba(10,122,191,0.35)',
  },
  FACEBOOK: {
    label: 'Facebook', icon: '🟦', letter: 'f', charLimit: 5000, tone: 'info',
    color: '#1877F2',
    gradient: 'linear-gradient(135deg, #1877F2 0%, #0866FF 100%)',
    glow: 'rgba(24,119,242,0.35)',
  },
  INSTAGRAM: {
    label: 'Instagram', icon: '🟪', letter: 'ig', charLimit: 2200, tone: 'warning',
    color: '#E1306C',
    gradient: 'linear-gradient(135deg, #FFD600 0%, #F77737 25%, #E1306C 50%, #C13584 75%, #833AB4 100%)',
    glow: 'rgba(225,48,108,0.35)',
  },
  YOUTUBE: {
    label: 'YouTube Short', icon: '🔴', letter: 'yt', charLimit: 100, tone: 'danger',
    color: '#FF0033',
    gradient: 'linear-gradient(135deg, #FF0033 0%, #CC0029 100%)',
    glow: 'rgba(255,0,51,0.35)',
  },
};

function PlatformChip({ channel, selected, onClick, size = 'md' }: { channel: Channel; selected?: boolean; onClick?: () => void; size?: 'sm' | 'md' | 'lg' }) {
  const m = PLATFORM_META[channel];
  const dim = size === 'lg' ? 44 : size === 'sm' ? 24 : 32;
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: size === 'lg' ? '10px 16px' : '6px 12px',
        borderRadius: size === 'lg' ? 14 : 999,
        border: '1px solid ' + (selected ? m.color : 'var(--border)'),
        background: selected ? `linear-gradient(135deg, ${m.color}22, ${m.color}11)` : 'rgba(255,255,255,0.02)',
        color: selected ? m.color : 'var(--text)',
        cursor: onClick ? 'pointer' : 'default',
        fontWeight: 600, fontSize: size === 'lg' ? 14 : 12,
        transition: 'all .18s',
        boxShadow: selected ? `0 0 24px ${m.glow}` : 'none',
      }}
    >
      <span style={{
        width: dim, height: dim, borderRadius: dim / 4,
        background: m.gradient,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 700, fontSize: dim * 0.4, fontFamily: '"JetBrains Mono", monospace',
        textTransform: 'lowercase', letterSpacing: '-0.04em',
        boxShadow: selected ? `0 4px 16px ${m.glow}` : '0 2px 8px rgba(0,0,0,0.4)',
      }}>{m.letter}</span>
      <span>{m.label}</span>
      {selected && <span style={{ color: m.color, fontSize: 14 }}>✓</span>}
    </button>
  );
}

const TABS = ['Overview', 'Write', 'Messages'] as const;
type Tab = typeof TABS[number];

export default function SocialHubPage() {
  const [tab, setTab] = useState<Tab>('Overview');
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
  const [aiIssues, setAiIssues] = useState<Array<{ rule: string; severity: string; message: string }>>([]);
  const [aiReviewing, setAiReviewing] = useState(false);
  const [suggestingTags, setSuggestingTags] = useState(false);

  // Analytics
  const [insights, setInsights] = useState<Record<string, any>>({});
  const [analyticsSummary, setAnalyticsSummary] = useState<any>(null);
  const [ytStats, setYtStats] = useState<any>(null);

  // A/B variants
  const [variants, setVariants] = useState<string[]>([]);
  const [generatingVariants, setGeneratingVariants] = useState(false);

  // Topic-to-post quick draft
  const [topicInput, setTopicInput] = useState('');
  const [topicPlatform, setTopicPlatform] = useState<Channel>('LINKEDIN');
  const [topicGenerating, setTopicGenerating] = useState(false);

  // Image generation
  const [imageOpen, setImageOpen] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageSize, setImageSize] = useState<'1024x1024' | '1024x1792' | '1792x1024'>('1024x1024');
  const [imageGenerating, setImageGenerating] = useState(false);
  const [imageRefining, setImageRefining] = useState(false);
  const [imageResult, setImageResult] = useState<{ url: string; source: string; costCents: number | null; prompt: string } | null>(null);
  const [bestTimes, setBestTimes] = useState<Record<string, { suggestion: string; nextWindowAtIso: string }>>({});

  // DMs
  const [liDms, setLiDms] = useState<any[]>([]);
  const [metaDms, setMetaDms] = useState<any[]>([]);

  const toast = (type: 'success' | 'error' | 'info' | 'warning', text: string) => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('app-toast', { detail: { type, text } }));
  };

  const downloadCsv = (filename: string, headers: string[], rows: any[][]) => {
    const escape = (cell: any) => {
      const s = String(cell ?? '');
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPostsCsv = () => {
    const headers = ['id', 'channel', 'status', 'scheduledAt', 'postedAt', 'externalPostId', 'groupId', 'body', 'mediaUrl', 'createdAt'];
    const rows = posts.map((p) => [p.id, p.channel, p.status, p.scheduledAt || '', p.postedAt || '', p.externalPostId || '', p.groupId || '', p.body || '', p.mediaUrl || '', p.createdAt]);
    downloadCsv(`social-posts-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    toast('success', `${rows.length} rows exported`);
  };

  const exportDmsCsv = () => {
    const headers = ['id', 'channel', 'status', 'sentAt', 'recipient', 'body', 'createdAt'];
    const liRows = liDms.map((m) => [m.id, 'LINKEDIN', m.status, m.sentAt || '', '', m.messageBody || '', m.createdAt]);
    const metaRows = metaDms.map((m) => [m.id, m.channel, m.status, m.sentAt || '', m.recipientHandle || '', m.messageBody || '', m.createdAt]);
    downloadCsv(`social-dms-${new Date().toISOString().slice(0, 10)}.csv`, headers, [...liRows, ...metaRows]);
    toast('success', `${liRows.length + metaRows.length} DMs exported`);
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

  useEffect(() => { loadPosts(); loadBestTimes(); loadAutopilot(); }, []);

  // Autopilot
  const [autopilot, setAutopilot] = useState<any | null>(null);
  const [autopilotRunning, setAutopilotRunning] = useState(false);
  const [autopilotExpanded, setAutopilotExpanded] = useState(false);
  const loadAutopilot = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/social-autopilot/status`, { credentials: 'include', headers: apiHeaders });
      if (r.ok) setAutopilot(await r.json());
    } catch { /* silent */ }
  };
  const updateAutopilot = async (patch: any) => {
    try {
      const r = await fetch(`${API_BASE}/api/social-autopilot/config`, {
        method: 'POST', credentials: 'include', headers: apiHeaders,
        body: JSON.stringify(patch),
      });
      if (r.ok) {
        const cfg = await r.json();
        setAutopilot((prev: any) => ({ ...(prev || {}), config: cfg }));
        toast('success', 'Autopilot settings saved');
      }
    } catch (e: any) { toast('error', e?.message || 'Save failed'); }
  };
  const runAutopilotNow = async () => {
    setAutopilotRunning(true);
    try {
      const r = await fetch(`${API_BASE}/api/social-autopilot/run-now`, {
        method: 'POST', credentials: 'include', headers: apiHeaders,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || j?.skipped || 'Run failed');
      if (j?.ok) {
        toast('success', `Drafted ${j.platform} ${j.mix} post — review in Queue`);
        await loadPosts();
        await loadAutopilot();
      } else if (j?.skipped) {
        toast('warning', `Skipped: ${j.skipped}`);
      } else {
        toast('error', j?.error || 'Run failed');
      }
    } catch (e: any) { toast('error', e?.message || 'Run failed'); }
    finally { setAutopilotRunning(false); }
  };
  useEffect(() => { if (tab === 'Overview') loadInsights(); }, [tab]);
  useEffect(() => { if (tab === 'Messages') loadDms(); }, [tab]);

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
      setTab('Overview');
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

  const tabIcons: Record<Tab, string> = { Overview: '🏠', Write: '✍️', Messages: '💬' };
  const tabCounts: Record<Tab, number> = {
    Overview: 0,
    Write: 0,
    Messages: liDms.length + metaDms.length,
  };

  return (
    <div className="dash-stack fade-in">
      {/* Slim hero */}
      <section style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
        padding: '16px 20px', borderRadius: 14,
        background: 'radial-gradient(120% 140% at 0% 0%, rgba(155,114,255,0.10), transparent 55%), linear-gradient(180deg, #0F1320 0%, #0B0F1B 100%)',
        border: '1px solid rgba(155,114,255,0.18)',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em', background: 'linear-gradient(90deg, #E8EDF5 0%, #9B72FF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Social Hub
          </h1>
          <p className="muted" style={{ margin: '2px 0 0', fontSize: 12.5 }}>
            {autopilot?.config?.enabled ? `Autopilot is ON · next post ${new Date(autopilot.nextWindowAtIso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : 'Write, schedule, autopilot it.'}
          </p>
        </div>
        <button onClick={() => setTab('Write')} style={{
          padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #9B72FF 0%, #6B4FE8 100%)',
          color: '#fff', fontWeight: 700, fontSize: 13,
          boxShadow: '0 6px 20px rgba(155,114,255,0.35)',
        }}>✍️ New post</button>
      </section>

      {/* Autopilot status bar — single row by default, expand for controls */}
      {autopilot && (() => {
        const cfg = autopilot.config || {};
        const enabled = !!cfg.enabled;
        const accent = enabled ? '#10D68A' : '#F5A623';
        return (
          <section style={{
            border: `1px solid ${accent}33`, borderRadius: 12, overflow: 'hidden',
            background: `linear-gradient(90deg, ${accent}10, transparent 70%), rgba(13,17,23,0.5)`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: accent }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: accent, boxShadow: enabled ? `0 0 12px ${accent}` : 'none', animation: enabled ? 'pulse 2s infinite' : 'none' }} />
                Autopilot {enabled ? 'ON' : 'OFF'}
              </span>
              <span className="muted" style={{ fontSize: 12, flex: 1 }}>
                {enabled
                  ? `${cfg.postsPerDay}/day · ${cfg.mixProductPct}% RevoAI · today ${autopilot.todayCount}/${cfg.postsPerDay}`
                  : 'Turn on to auto-generate daily posts about RevoAI.'}
              </span>
              <Button variant={enabled ? 'ghost' : 'primary'} onClick={() => updateAutopilot({ enabled: !enabled })}>
                {enabled ? 'Pause' : '▶ Turn on'}
              </Button>
              <Button variant={enabled ? 'primary' : 'ghost'} disabled={autopilotRunning} onClick={runAutopilotNow}>
                {autopilotRunning ? '…' : '✨ Run now'}
              </Button>
              <button onClick={() => setAutopilotExpanded((v) => !v)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--muted)', padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>
                {autopilotExpanded ? '▴ Less' : '▾ Settings'}
              </button>
            </div>

            {autopilotExpanded && (
              <div style={{ padding: '0 16px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div>
                  <div className="muted text-xs" style={{ marginBottom: 4 }}>Posts/day</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[1, 2, 3, 5].map((n) => (
                      <button key={n} onClick={() => updateAutopilot({ postsPerDay: n })} style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid ' + (cfg.postsPerDay === n ? accent : 'var(--border)'), background: cfg.postsPerDay === n ? `${accent}18` : 'transparent', color: cfg.postsPerDay === n ? accent : 'var(--text)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{n}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="muted text-xs" style={{ marginBottom: 4 }}>Mix · {cfg.mixProductPct}% RevoAI</div>
                  <input type="range" min={0} max={100} step={10} value={cfg.mixProductPct} onChange={(e) => updateAutopilot({ mixProductPct: Number(e.target.value) })} style={{ width: '100%' }} />
                </div>
                <div>
                  <div className="muted text-xs" style={{ marginBottom: 4 }}>Platforms</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {(['LINKEDIN', 'FACEBOOK', 'INSTAGRAM', 'YOUTUBE'] as Channel[]).map((p) => {
                      const m = PLATFORM_META[p];
                      const on = (cfg.platforms || []).includes(p);
                      return (
                        <button key={p} onClick={() => {
                          const list = on ? cfg.platforms.filter((x: string) => x !== p) : [...(cfg.platforms || []), p];
                          if (list.length > 0) updateAutopilot({ platforms: list });
                        }} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid ' + (on ? m.color : 'var(--border)'), background: on ? `${m.color}18` : 'transparent', color: on ? m.color : 'var(--muted)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>{m.label}</button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!cfg.autoImage} onChange={(e) => updateAutopilot({ autoImage: e.target.checked })} />
                    🎨 Auto-image
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!cfg.autoApprove} onChange={(e) => updateAutopilot({ autoApprove: e.target.checked })} />
                    ⚡ Auto-publish
                  </label>
                </div>
              </div>
            )}

            {autopilotExpanded && (
              <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div className="muted text-xs" style={{ marginBottom: 6 }}>📋 Topic queue · upcoming runs use these in order, then fall back to random angles</div>
                <textarea
                  value={(cfg.topicQueue || []).join('\n')}
                  onChange={(e) => updateAutopilot({ topicQueue: e.target.value.split('\n') })}
                  placeholder="One topic per line. e.g.&#10;Why missed calls cost local clinics more than they think&#10;We just shipped voice cloning&#10;Customer story: how a 4-chair barbershop saved 8 hrs/week"
                  style={{ width: '100%', minHeight: 80, background: 'rgba(17,24,39,.65)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, fontSize: 12.5, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 }}
                />
                {cfg.topicQueue && cfg.topicQueue.length > 0 && (
                  <div className="muted text-xs" style={{ marginTop: 6 }}>
                    {cfg.topicQueue.length} topic{cfg.topicQueue.length === 1 ? '' : 's'} queued · next run will cover: <strong style={{ color: accent }}>"{String(cfg.topicQueue[0] || '').slice(0, 80)}{String(cfg.topicQueue[0] || '').length > 80 ? '…' : ''}"</strong>
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })()}

      {/* Pill tabs */}
      <div style={{ display: 'flex', gap: 6, padding: 6, background: 'rgba(13,17,23,0.7)', border: '1px solid var(--border)', borderRadius: 14, flexWrap: 'wrap' }}>
        {TABS.map((t) => {
          const isActive = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: '1 1 auto', minWidth: 110,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px 16px',
                borderRadius: 10,
                border: 'none',
                background: isActive ? 'linear-gradient(135deg, rgba(155,114,255,0.25) 0%, rgba(107,79,232,0.18) 100%)' : 'transparent',
                color: isActive ? '#fff' : 'var(--muted)',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer', fontSize: 13,
                boxShadow: isActive ? '0 4px 16px rgba(155,114,255,0.25), inset 0 1px 0 rgba(255,255,255,0.06)' : 'none',
                transition: 'all .18s',
              }}
            >
              <span>{tabIcons[t]}</span>
              <span>{t}</span>
              {tabCounts[t] > 0 && (
                <span style={{ marginLeft: 4, padding: '1px 7px', borderRadius: 999, background: isActive ? '#9B72FF' : 'rgba(255,255,255,0.06)', color: isActive ? '#fff' : 'var(--muted)', fontSize: 10, fontWeight: 700 }}>{tabCounts[t]}</span>
              )}
            </button>
          );
        })}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {tab === 'Overview' && (
        <div className="dash-stack">
          {/* Connection note — explains how /social relates to /today */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 10,
            background: 'linear-gradient(90deg, rgba(0,201,255,0.08), transparent 70%)',
            border: '1px solid rgba(0,201,255,0.2)',
            fontSize: 12.5,
          }}>
            <span style={{ fontSize: 16 }}>💡</span>
            <span className="muted">
              <strong style={{ color: 'var(--text)' }}>Set it here, approve it on </strong>
              <a href="/today" style={{ color: '#00C9FF', textDecoration: 'none', fontWeight: 700 }}>/today</a>
              <strong style={{ color: 'var(--text)' }}>.</strong> This page is for tweaking autopilot, writing manual posts, and seeing what's running. Daily approvals happen on /today.
            </span>
          </div>

          {/* Mini calendar peek */}
          <Card title="📅 Coming up next 7 days" subtitle={`${calendarDays.slice(0, 7).reduce((acc, d) => acc + d.posts.length, 0)} posts scheduled`}>
            <div style={{ display: 'grid', gap: 6 }}>
              {calendarDays.slice(0, 7).map((d) => {
                const isToday = d.date === new Date().toISOString().slice(0, 10);
                const dayChip = new Date(d.date).toLocaleDateString([], { weekday: 'short' });
                const dayNum = new Date(d.date).getDate();
                return (
                  <div key={d.date} style={{
                    display: 'grid', gridTemplateColumns: '60px 1fr', gap: 12,
                    padding: '8px 12px', borderRadius: 8,
                    border: isToday ? '1px solid rgba(155,114,255,0.4)' : '1px solid var(--border)',
                    background: isToday ? 'rgba(155,114,255,0.06)' : 'transparent',
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ fontSize: 9, color: isToday ? '#9B72FF' : 'var(--muted)', fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{dayChip}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: isToday ? '#9B72FF' : 'var(--text)', lineHeight: 1 }}>{dayNum}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', minHeight: 30 }}>
                      {d.posts.length === 0 ? (
                        <span className="muted text-xs" style={{ fontStyle: 'italic' }}>—</span>
                      ) : d.posts.map((p) => {
                        const m = PLATFORM_META[p.channel as Channel] || PLATFORM_META.LINKEDIN;
                        return (
                          <span key={p.id} title={p.body} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '4px 8px', borderRadius: 6,
                            background: `${m.color}18`, border: `1px solid ${m.color}40`, fontSize: 11.5,
                          }}>
                            <span style={{ width: 14, height: 14, borderRadius: 3, background: m.gradient, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 8, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', textTransform: 'lowercase', letterSpacing: '-0.04em' }}>{m.letter}</span>
                            <span style={{ color: m.color, fontFamily: '"JetBrains Mono", monospace' }}>{new Date(p.scheduledAt!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Recent posts — last 6 visual cards */}
          <Card title="📋 Recent posts" subtitle={`${posts.length} total · ${posts.filter((p) => p.status === 'posted').length} live · ${posts.filter((p) => p.status === 'scheduled').length} scheduled · ${posts.filter((p) => p.status === 'draft').length} drafts`}>
            {posts.length === 0 ? (
              <div className="muted" style={{ padding: 20, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 8 }}>
                Nothing yet. Turn on autopilot above, or click <strong style={{ color: 'var(--text)' }}>Write</strong> to make one manually.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                {posts.slice(0, 6).map((p) => {
                  const m = PLATFORM_META[p.channel as Channel] || PLATFORM_META.LINKEDIN;
                  return (
                    <div key={p.id} style={{
                      border: `1px solid ${m.color}33`, borderLeft: `3px solid ${m.color}`,
                      borderRadius: 10, padding: 10,
                      background: `linear-gradient(135deg, ${m.color}08 0%, transparent 60%), rgba(13,17,23,0.5)`,
                    }}>
                      {p.mediaUrl && (
                        <img src={p.mediaUrl} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 6, marginBottom: 8, display: 'block' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      )}
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ width: 18, height: 18, borderRadius: 4, background: m.gradient, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', textTransform: 'lowercase', letterSpacing: '-0.04em' }}>{m.letter}</span>
                        <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: m.color, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{p.status}</span>
                        {p.scheduledAt && <span className="muted text-xs">{new Date(p.scheduledAt).toLocaleDateString([], { weekday: 'short', hour: 'numeric' })}</span>}
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--muted)' }}>
                        {String(p.body || '').slice(0, 110)}{(p.body || '').length > 110 ? '…' : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Compact analytics */}
          {analyticsSummary && (
            <Card title="📊 Last 30 days" subtitle="Quick numbers across every platform">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                {[
                  { k: 'Posts', v: analyticsSummary.totals.posts, accent: '#9B72FF' },
                  { k: 'Live', v: analyticsSummary.totals.posted, accent: '#10D68A' },
                  { k: 'Scheduled', v: analyticsSummary.totals.scheduled, accent: '#00C9FF' },
                  { k: 'Drafts', v: analyticsSummary.totals.drafts, accent: '#F5A623' },
                  { k: 'DMs', v: analyticsSummary.totals.linkedinDms + analyticsSummary.totals.metaDms, accent: '#0A7ABF' },
                  { k: 'Replies', v: analyticsSummary.totals.socialReplies, accent: '#FF5B7A' },
                ].map((s) => (
                  <div key={s.k} style={{ border: `1px solid ${s.accent}30`, borderRadius: 8, padding: 10, textAlign: 'center', background: `${s.accent}06` }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.accent, lineHeight: 1 }}>{s.v}</div>
                    <div className="muted text-xs" style={{ marginTop: 2 }}>{s.k}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === 'Write' && (
        <div className="dash-stack">

        {/* Topic → finished post */}
        <Card title="✨ Tell AI what to post about" subtitle="Type a topic. Claude writes the post, generates a matching image, drops it in your queue.">
          <div style={{ display: 'grid', gap: 10 }}>
            <textarea
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              placeholder="e.g. Why missed calls cost local clinics more than they think · Or: We just shipped voice cloning, talk about it."
              style={{ width: '100%', minHeight: 70, background: 'rgba(17,24,39,.65)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 }}
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="muted text-xs">For:</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['LINKEDIN', 'FACEBOOK', 'INSTAGRAM', 'YOUTUBE'] as Channel[]).map((p) => {
                  const m = PLATFORM_META[p];
                  const sel = topicPlatform === p;
                  return (
                    <button key={p} onClick={() => setTopicPlatform(p)} style={{
                      padding: '6px 10px', borderRadius: 6,
                      border: '1px solid ' + (sel ? m.color : 'var(--border)'),
                      background: sel ? `${m.color}18` : 'transparent',
                      color: sel ? m.color : 'var(--muted)',
                      cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
                    }}>{m.label}</button>
                  );
                })}
              </div>
              <Button variant="primary" disabled={!topicInput.trim() || topicGenerating} onClick={async () => {
                if (!topicInput.trim()) return;
                setTopicGenerating(true);
                try {
                  const res = await fetch(`${API_BASE}/api/social-autopilot/quick-draft`, {
                    method: 'POST', credentials: 'include', headers: apiHeaders,
                    body: JSON.stringify({ topic: topicInput.trim(), platform: topicPlatform, autoImage: true }),
                  });
                  const j = await res.json();
                  if (!res.ok || !j?.ok) throw new Error(j?.error || 'Generation failed');
                  toast('success', `Drafted ${topicPlatform} post — review in Overview or /today`);
                  setTopicInput('');
                  await loadPosts();
                } catch (e: any) {
                  toast('error', e?.message || 'Generation failed');
                } finally {
                  setTopicGenerating(false);
                }
              }}>{topicGenerating ? '✨ Writing…' : '✨ Generate post'}</Button>
              <span className="muted text-xs" style={{ marginLeft: 'auto' }}>or scroll down to write manually ↓</span>
            </div>
          </div>
        </Card>

        <Card title="✍️ Or write it yourself" subtitle="Pick platforms, write a post, schedule or save as draft. Each platform gets its own version.">
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <div className="page-eyebrow" style={{ marginBottom: 8 }}>WHERE TO POST</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {(Object.keys(PLATFORM_META) as Channel[]).map((c) => (
                  <PlatformChip key={c} channel={c} selected={selectedChannels.includes(c)} onClick={() => toggleChannel(c)} size="lg" />
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
              <div>
                <div className="page-eyebrow" style={{ marginBottom: 8 }}>YOUR POST</div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your post here. Claude proofreads as you type."
                  style={{ width: '100%', minHeight: 220, background: 'rgba(17,24,39,.65)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6 }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginTop: 8 }}>
                  {selectedChannels.map((c) => {
                    const m = PLATFORM_META[c];
                    const pct = Math.min(100, (body.length / m.charLimit) * 100);
                    const over = body.length > m.charLimit;
                    return (
                      <div key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: '"JetBrains Mono", monospace' }}>
                        <span style={{ width: 14, height: 14, borderRadius: 4, background: m.gradient }} />
                        <span style={{ color: over ? '#FF5B7A' : 'var(--muted)' }}>{body.length}/{m.charLimit}</span>
                        <span style={{ width: 50, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                          <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: over ? '#FF5B7A' : m.color, transition: 'width .2s' }} />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="page-eyebrow" style={{ marginBottom: 8 }}>LIVE PREVIEW</div>
                {selectedChannels.length === 0 ? (
                  <div style={{ padding: 24, border: '1px dashed var(--border)', borderRadius: 10, textAlign: 'center' }} className="muted">Pick a platform above to preview.</div>
                ) : (
                  <div style={{ display: 'grid', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                    {selectedChannels.map((c) => {
                      const m = PLATFORM_META[c];
                      return (
                        <div key={c} style={{
                          border: `1px solid ${m.color}33`, borderRadius: 10, padding: 12,
                          background: `linear-gradient(135deg, ${m.color}08 0%, transparent 60%), rgba(13,17,23,0.6)`,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ width: 32, height: 32, borderRadius: 8, background: m.gradient, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, fontFamily: '"JetBrains Mono", monospace', textTransform: 'lowercase', letterSpacing: '-0.04em' }}>{m.letter}</span>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700 }}>{m.label}</div>
                              <div className="muted" style={{ fontSize: 10 }}>preview · how it'll look</div>
                            </div>
                          </div>
                          <div style={{ fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: body ? 'var(--text)' : 'var(--muted)', fontStyle: body ? 'normal' : 'italic' }}>
                            {body || 'Your post will appear here as you type…'}
                            {hashtags.length > 0 && body && <div style={{ marginTop: 8, color: m.color, fontSize: 12 }}>{hashtags.join(' ')}</div>}
                          </div>
                          {mediaUrl && (
                            <div style={{ marginTop: 8, padding: 8, borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--border)', fontSize: 11 }} className="muted">🖼 {mediaUrl}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {issues.length > 0 && (
              <div style={{ background: 'rgba(255,193,7,.06)', border: '1px solid rgba(255,193,7,.28)', borderRadius: 8, padding: '10px 12px' }}>
                <div className="page-eyebrow" style={{ marginBottom: 6, color: '#FFB628' }}>BRAND VOICE</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }}>
                  {issues.map((i, idx) => <li key={idx}>{i.message}</li>)}
                </ul>
              </div>
            )}

            {aiIssues.length > 0 && (
              <div style={{ background: 'rgba(155,114,255,.06)', border: '1px solid rgba(155,114,255,.28)', borderRadius: 8, padding: '10px 12px' }}>
                <div className="page-eyebrow" style={{ marginBottom: 6, color: '#9B72FF' }}>🧐 AI REVIEW</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }}>
                  {aiIssues.map((i, idx) => <li key={idx}><strong style={{ color: '#9B72FF' }}>{i.rule.replace(/^ai_/, '').replace(/_/g, ' ')}:</strong> {i.message}</li>)}
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
              <Button variant="ghost" onClick={async () => {
                setImageOpen(true);
                if (!imagePrompt && body.trim()) {
                  setImageRefining(true);
                  try {
                    const res = await fetch(`${API_BASE}/api/images/refine-prompt`, {
                      method: 'POST', credentials: 'include', headers: apiHeaders,
                      body: JSON.stringify({ body, platform: selectedChannels[0] || 'LINKEDIN' }),
                    });
                    const j = await res.json();
                    if (j?.ok && j.prompt) setImagePrompt(j.prompt);
                  } catch { /* silent */ }
                  finally { setImageRefining(false); }
                }
              }}>🎨 Generate image</Button>
              <Button variant="ghost" onClick={async () => {
                if (!body.trim()) { toast('warning', 'Write something first'); return; }
                setAiReviewing(true);
                setAiIssues([]);
                try {
                  const ch = selectedChannels[0] || 'LINKEDIN';
                  const res = await fetch(`${API_BASE}/api/social-posts/ai-review`, {
                    method: 'POST', credentials: 'include', headers: apiHeaders,
                    body: JSON.stringify({ body, channel: ch }),
                  });
                  const j = await res.json();
                  if (j?.ok) {
                    setAiIssues(Array.isArray(j.issues) ? j.issues : []);
                    if (!j.issues || j.issues.length === 0) toast('success', 'Looks clean — no flags from AI review');
                  } else {
                    toast('error', 'AI review unavailable (no API key?)');
                  }
                } catch (e: any) {
                  toast('error', e?.message || 'AI review failed');
                } finally {
                  setAiReviewing(false);
                }
              }} disabled={aiReviewing || !body.trim()}>
                {aiReviewing ? 'Reviewing…' : '🧐 AI review'}
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
        </div>
      )}


      {tab === 'Messages' && (
        <div className="dash-stack">
          <Card title="💼 LinkedIn DM Queue" subtitle="20/day cap. If a lead unsubscribed from your email, we'll never DM them. Drafted DMs from /leads land here.">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <Button variant="ghost" onClick={exportDmsCsv} disabled={liDms.length === 0 && metaDms.length === 0}>⬇ Export all DMs CSV</Button>
            </div>
            {liDms.length === 0 ? (
              <div className="muted" style={{ padding: 16, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 8 }}>No queued LinkedIn DMs. Draft one from /leads (must have linkedinUrl).</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {liDms.map((m) => {
                  const liMeta = PLATFORM_META.LINKEDIN;
                  return (
                    <div key={m.id} style={{
                      border: `1px solid ${liMeta.color}33`, borderLeft: `4px solid ${liMeta.color}`,
                      borderRadius: 10, padding: 12,
                      background: `linear-gradient(135deg, ${liMeta.color}06 0%, transparent 60%), rgba(13,17,23,0.5)`,
                    }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                        <PlatformChip channel="LINKEDIN" size="sm" />
                        <Badge tone={m.status === 'approved' ? 'warning' : undefined}>{m.status}</Badge>
                        <span className="muted text-xs">{new Date(m.createdAt).toLocaleString()}</span>
                      </div>
                      <div style={{
                        whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6, marginBottom: 10,
                        padding: '10px 14px', borderRadius: 12,
                        background: 'rgba(255,255,255,0.03)', borderTopLeftRadius: 4,
                      }}>{m.messageBody}</div>
                      {m.status === 'queued' && <Button variant="primary" onClick={() => approveLiDm(m.id)}>✓ Approve</Button>}
                      {m.status === 'approved' && <Button variant="primary" onClick={() => sendLiDm(m.id)}>📤 Send DM now</Button>}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card title="📱 Facebook + Instagram DMs" subtitle="">
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
                    <div key={m.id} style={{
                      border: `1px solid ${meta.color}33`, borderLeft: `4px solid ${meta.color}`,
                      borderRadius: 10, padding: 12,
                      background: `linear-gradient(135deg, ${meta.color}06 0%, transparent 60%), rgba(13,17,23,0.5)`,
                    }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                        <PlatformChip channel={m.channel as Channel} size="sm" />
                        <Badge tone={m.status === 'approved' ? 'warning' : undefined}>{m.status}</Badge>
                        {m.recipientHandle && <span className="muted text-xs mono">@{m.recipientHandle}</span>}
                      </div>
                      <div style={{
                        whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6, marginBottom: 10,
                        padding: '10px 14px', borderRadius: 12,
                        background: 'rgba(255,255,255,0.03)', borderTopLeftRadius: 4,
                      }}>{m.messageBody}</div>
                      {m.status === 'queued' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button variant="primary" onClick={() => approveMetaDm(m.id)}>✓ Approve (then send manually)</Button>
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


      {imageOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)', zIndex: 10000, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto' }} onClick={() => setImageOpen(false)}>
          <div style={{
            width: 'min(720px, calc(100vw - 32px))', maxHeight: 'calc(100dvh - 32px)',
            display: 'flex', flexDirection: 'column',
            border: '1px solid rgba(155,114,255,0.3)', borderRadius: 16, overflow: 'hidden',
            background: 'radial-gradient(120% 140% at 0% 0%, rgba(225,48,108,0.08), transparent 50%), linear-gradient(180deg, #0F1320 0%, #0B0F1B 100%)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: 18, borderBottom: '1px solid var(--border)' }}>
              <div className="page-eyebrow" style={{ marginBottom: 4, color: '#9B72FF' }}>🎨 GENERATE IMAGE</div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Make an image for your post</h3>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 12.5 }}>Claude expands your post into a vivid prompt. Then DALL-E 3 generates the image.</p>
            </div>

            <div style={{ padding: 18, overflowY: 'auto', display: 'grid', gap: 14 }}>
              <div>
                <div className="page-eyebrow" style={{ marginBottom: 6 }}>IMAGE PROMPT</div>
                <textarea
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder={imageRefining ? 'Refining prompt from post body…' : 'Describe the image. Or click ✨ Refine from post.'}
                  style={{ width: '100%', minHeight: 100, background: 'rgba(17,24,39,.65)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <Button variant="ghost" onClick={async () => {
                    if (!body.trim()) { toast('warning', 'Write the post body first'); return; }
                    setImageRefining(true);
                    try {
                      const res = await fetch(`${API_BASE}/api/images/refine-prompt`, {
                        method: 'POST', credentials: 'include', headers: apiHeaders,
                        body: JSON.stringify({ body, platform: selectedChannels[0] || 'LINKEDIN' }),
                      });
                      const j = await res.json();
                      if (j?.ok && j.prompt) { setImagePrompt(j.prompt); toast('success', 'Prompt refined'); }
                    } catch (e: any) { toast('error', e?.message || 'Refine failed'); }
                    finally { setImageRefining(false); }
                  }} disabled={imageRefining}>{imageRefining ? 'Refining…' : '✨ Refine from post'}</Button>
                  <select value={imageSize} onChange={(e) => setImageSize(e.target.value as any)} style={{ background: 'rgba(17,24,39,.65)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
                    <option value="1024x1024">Square (1024×1024)</option>
                    <option value="1024x1792">Portrait (1024×1792 — IG / Reels)</option>
                    <option value="1792x1024">Landscape (1792×1024 — LI / FB)</option>
                  </select>
                </div>
              </div>

              {imageResult && (
                <div>
                  <div className="page-eyebrow" style={{ marginBottom: 6 }}>RESULT</div>
                  <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.4)' }}>
                    <img src={imageResult.url} alt="Generated" style={{ width: '100%', display: 'block' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 6 }}>
                      <span style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.7)', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: imageResult.source === 'stub' ? '#F5A623' : '#10D68A' }}>
                        {imageResult.source === 'stub' ? 'STUB · placeholder' : `DALL-E 3 · $${((imageResult.costCents || 0) / 100).toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <Button variant="primary" onClick={() => {
                      setMediaUrl(imageResult.url);
                      toast('success', 'Image attached to your post');
                      setImageOpen(false);
                    }}>📎 Use this image</Button>
                    <Button variant="ghost" onClick={() => { setImageResult(null); }}>🔄 Generate another</Button>
                    <a href={imageResult.url} target="_blank" rel="noreferrer"><Button variant="ghost">↗ Open</Button></a>
                  </div>
                </div>
              )}
            </div>

            <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
              <Button variant="ghost" onClick={() => setImageOpen(false)}>Close</Button>
              <Button variant="primary" disabled={!imagePrompt.trim() || imageGenerating} onClick={async () => {
                if (!imagePrompt.trim()) return;
                setImageGenerating(true);
                setImageResult(null);
                try {
                  const res = await fetch(`${API_BASE}/api/images/generate`, {
                    method: 'POST', credentials: 'include', headers: apiHeaders,
                    body: JSON.stringify({ prompt: imagePrompt, size: imageSize, platform: selectedChannels[0] || null }),
                  });
                  const j = await res.json();
                  if (!res.ok || !j?.ok) throw new Error(j?.error?.message || 'Generation failed');
                  setImageResult({ url: j.asset.url, source: j.asset.source, costCents: j.asset.costCents, prompt: j.asset.prompt });
                  toast('success', j.asset.source === 'stub' ? 'Stub image (no key)' : 'Image generated');
                } catch (e: any) {
                  toast('error', e?.message || 'Generation failed');
                } finally {
                  setImageGenerating(false);
                }
              }}>{imageGenerating ? '✨ Generating…' : '✨ Generate image'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
