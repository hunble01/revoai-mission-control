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

  const tabIcons: Record<Tab, string> = { Compose: '✍️', Queue: '📋', Calendar: '📅', DMs: '💬', Analytics: '📊' };
  const tabCounts: Record<Tab, number> = {
    Compose: 0,
    Queue: posts.length,
    Calendar: posts.filter((p) => p.status === 'scheduled').length,
    DMs: liDms.length + metaDms.length,
    Analytics: 0,
  };

  return (
    <div className="dash-stack fade-in">
      {/* Aurora hero */}
      <section style={{
        position: 'relative', overflow: 'hidden',
        borderRadius: 18, padding: '28px 28px 24px',
        background: 'radial-gradient(120% 140% at 0% 0%, rgba(225,48,108,0.18), transparent 50%), radial-gradient(120% 140% at 100% 100%, rgba(10,122,191,0.22), transparent 55%), linear-gradient(180deg, #0F1320 0%, #0B0F1B 100%)',
        border: '1px solid rgba(155,114,255,0.18)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}>
        {/* Floating platform ribbon */}
        <div aria-hidden style={{ position: 'absolute', top: 22, right: 28, display: 'flex', gap: 6, opacity: 0.6 }}>
          {(['LINKEDIN', 'FACEBOOK', 'INSTAGRAM', 'YOUTUBE'] as Channel[]).map((c, i) => {
            const m = PLATFORM_META[c];
            return (
              <span key={c} style={{
                width: 28, height: 28, borderRadius: 8,
                background: m.gradient,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: 11, fontFamily: '"JetBrains Mono", monospace',
                textTransform: 'lowercase', letterSpacing: '-0.04em',
                transform: `translateY(${i % 2 === 0 ? -2 : 2}px)`,
                boxShadow: `0 4px 12px ${m.glow}`,
              }}>{m.letter}</span>
            );
          })}
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderRadius: 999, background: 'rgba(155,114,255,0.12)', border: '1px solid rgba(155,114,255,0.3)', marginBottom: 12 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: '#9B72FF', boxShadow: '0 0 10px #9B72FF' }} />
          <span style={{ fontSize: 11, color: '#9B72FF', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.12em', textTransform: 'uppercase' }}>SOCIAL COMMAND CENTER</span>
        </div>

        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, background: 'linear-gradient(90deg, #E8EDF5 0%, #9B72FF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          One place. Every platform.
        </h1>
        <p style={{ margin: '10px 0 0', maxWidth: 720, color: '#A8B2C5', fontSize: 14, lineHeight: 1.6 }}>
          Write a post once and send it to LinkedIn, Facebook, Instagram, and YouTube. Schedule it for the right time. Catch trending stories. Get Claude to draft replies for every comment and DM. All from here.
        </p>

        {/* Quick action strip */}
        <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
          <button onClick={() => setTab('Compose')} style={{
            padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #9B72FF 0%, #6B4FE8 100%)',
            color: '#fff', fontWeight: 700, fontSize: 13,
            boxShadow: '0 8px 24px rgba(155,114,255,0.35)',
          }}>✍️ New post</button>
          <button onClick={() => { setTab('Calendar'); }} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>📅 See calendar</button>
          <button onClick={() => setTab('DMs')} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>💬 Messages {tabCounts.DMs > 0 ? `(${tabCounts.DMs})` : ''}</button>
        </div>
      </section>

      {/* Plain-English feature strip */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        {[
          { icon: '✍️', accent: '#9B72FF', title: 'Write once, post everywhere', body: 'Pick the platforms, write your post, click Cast. Every platform gets its own version automatically.' },
          { icon: '⏰', accent: '#00C9FF', title: 'Schedule it for later', body: 'Set a date and time. Posts auto-publish when the moment hits — no extra clicks.' },
          { icon: '🧠', accent: '#10D68A', title: 'Claude proofreads everything', body: 'Brand-voice lint catches off-tone words. The AI review button flags weak hooks and missing CTAs.' },
          { icon: '🔥', accent: '#F5A623', title: 'Catch trending stories', body: 'Pulls Hacker News, Reddit, Google News. One click drafts your take on a hot story.' },
          { icon: '💬', accent: '#FF5B7A', title: 'Reply faster', body: 'Paste any comment or DM. Claude tells you the intent and drafts your response.' },
          { icon: '📊', accent: '#0A7ABF', title: 'Track it all', body: 'Live funnel of posts, DMs, and replies across every platform.' },
        ].map((f) => (
          <div key={f.title} style={{
            border: '1px solid var(--border)', borderRadius: 12, padding: 14,
            background: `radial-gradient(120% 140% at 0% 0%, ${f.accent}10, transparent 55%), linear-gradient(180deg, #0F1320 0%, #0B0F1B 100%)`,
            transition: 'transform .18s, border-color .18s',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = f.accent + '55'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${f.accent}18`, border: `1px solid ${f.accent}40`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 10 }}>{f.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)', marginBottom: 4 }}>{f.title}</div>
            <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>{f.body}</div>
          </div>
        ))}
      </section>

      {/* Autopilot panel */}
      {autopilot && (() => {
        const cfg = autopilot.config || {};
        const enabled = !!cfg.enabled;
        return (
          <section style={{
            position: 'relative', overflow: 'hidden',
            border: `1px solid ${enabled ? 'rgba(16,214,138,0.4)' : 'rgba(245,166,35,0.3)'}`,
            borderRadius: 14, padding: 18,
            background: enabled
              ? 'radial-gradient(120% 140% at 0% 0%, rgba(16,214,138,0.10), transparent 55%), linear-gradient(180deg, #0F1320 0%, #0B0F1B 100%)'
              : 'radial-gradient(120% 140% at 0% 0%, rgba(245,166,35,0.06), transparent 55%), linear-gradient(180deg, #0F1320 0%, #0B0F1B 100%)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div className="page-eyebrow" style={{ color: enabled ? '#10D68A' : '#F5A623', marginBottom: 4 }}>⚡ AUTOPILOT</div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                  {enabled ? 'Running on autopilot' : 'Autopilot is paused'}
                </h3>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 12.5 }}>
                  {enabled
                    ? `Auto-generates ${cfg.postsPerDay} post/day · ${cfg.mixProductPct}% RevoAI / ${100 - cfg.mixProductPct}% trends · ${cfg.autoImage ? 'with images' : 'text only'} · drafts ${cfg.autoApprove ? 'auto-publish' : 'wait for your approval'}`
                    : 'Turn on to auto-generate daily product-focused posts.'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant={enabled ? 'ghost' : 'primary'} onClick={() => updateAutopilot({ enabled: !enabled })}>
                  {enabled ? 'Pause' : '▶ Turn on'}
                </Button>
                <Button variant="primary" disabled={autopilotRunning} onClick={runAutopilotNow}>
                  {autopilotRunning ? 'Running…' : '✨ Run now'}
                </Button>
              </div>
            </div>

            {enabled && (
              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                  <div className="muted text-xs" style={{ marginBottom: 4 }}>Posts per day</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[1, 2, 3, 5].map((n) => (
                      <button key={n} onClick={() => updateAutopilot({ postsPerDay: n })} style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid ' + (cfg.postsPerDay === n ? '#10D68A' : 'var(--border)'), background: cfg.postsPerDay === n ? 'rgba(16,214,138,0.12)' : 'transparent', color: cfg.postsPerDay === n ? '#10D68A' : 'var(--text)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{n}</button>
                    ))}
                  </div>
                </div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                  <div className="muted text-xs" style={{ marginBottom: 4 }}>Mix · {cfg.mixProductPct}% RevoAI / {100 - cfg.mixProductPct}% trends</div>
                  <input type="range" min={0} max={100} step={10} value={cfg.mixProductPct} onChange={(e) => updateAutopilot({ mixProductPct: Number(e.target.value) })} style={{ width: '100%' }} />
                </div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                  <div className="muted text-xs" style={{ marginBottom: 4 }}>Platforms</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {(['LINKEDIN', 'FACEBOOK', 'INSTAGRAM', 'YOUTUBE'] as Channel[]).map((p) => {
                      const m = PLATFORM_META[p];
                      const on = (cfg.platforms || []).includes(p);
                      return (
                        <button key={p} onClick={() => {
                          const list = on ? cfg.platforms.filter((x: string) => x !== p) : [...(cfg.platforms || []), p];
                          if (list.length > 0) updateAutopilot({ platforms: list });
                        }} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid ' + (on ? m.color : 'var(--border)'), background: on ? `${m.color}18` : 'transparent', color: on ? m.color : 'var(--muted)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>{m.label}</button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!cfg.autoImage} onChange={(e) => updateAutopilot({ autoImage: e.target.checked })} />
                    🎨 Auto-generate image per post
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!cfg.autoApprove} onChange={(e) => updateAutopilot({ autoApprove: e.target.checked })} />
                    ⚡ Auto-publish (skip review)
                  </label>
                </div>
              </div>
            )}

            {enabled && autopilot.nextPlatform && (
              <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(16,214,138,0.06)', border: '1px solid rgba(16,214,138,0.2)', fontSize: 12 }}>
                <span className="muted">Next post: </span>
                <strong style={{ color: '#10D68A' }}>{autopilot.nextPlatform}</strong>
                <span className="muted"> at </span>
                <strong style={{ color: 'var(--text)' }}>{new Date(autopilot.nextWindowAtIso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</strong>
                <span className="muted"> · today: {autopilot.todayCount}/{cfg.postsPerDay}</span>
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

      {tab === 'Compose' && (
        <Card title="✍️ Compose" subtitle="Pick the platforms, write the post, schedule or save as draft. Each platform gets its own version, linked together.">
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
      )}

      {tab === 'Queue' && (
        <Card title="Queue" subtitle={`${posts.length} total · ${posts.filter((p) => p.status === 'scheduled').length} scheduled · ${posts.filter((p) => p.status === 'posted').length} posted`}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <Button variant="ghost" onClick={exportPostsCsv} disabled={posts.length === 0}>⬇ Export CSV</Button>
          </div>
          {loading ? <div className="muted">Loading…</div> : posts.length === 0 ? (
            <div className="muted" style={{ padding: 24, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 8 }}>No social posts yet. Use Compose above.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {posts.map((p) => {
                const m = PLATFORM_META[p.channel as Channel] || PLATFORM_META.LINKEDIN;
                const scheduledAtLocal = p.scheduledAt ? new Date(p.scheduledAt).toLocaleString() : null;
                return (
                  <div key={p.id} style={{
                    border: `1px solid ${m.color}33`, borderLeft: `4px solid ${m.color}`,
                    borderRadius: 10, padding: 12, display: 'grid', gap: 8,
                    background: `linear-gradient(135deg, ${m.color}08 0%, transparent 60%), rgba(13,17,23,0.5)`,
                    transition: 'transform .15s, box-shadow .15s',
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${m.glow}`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <PlatformChip channel={p.channel as Channel} size="sm" />
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
        <Card title="📅 14-Day Calendar" subtitle="Every scheduled post shown on the day it'll fire.">
          <div style={{ display: 'grid', gap: 6 }}>
            {calendarDays.map((d) => {
              const isToday = d.date === new Date().toISOString().slice(0, 10);
              const dayChip = new Date(d.date).toLocaleDateString([], { weekday: 'short' });
              const dayNum = new Date(d.date).getDate();
              return (
                <div key={d.date} style={{
                  display: 'grid', gridTemplateColumns: '70px 1fr', gap: 12,
                  padding: '12px', borderRadius: 10,
                  border: isToday ? '1px solid rgba(155,114,255,0.4)' : '1px solid var(--border)',
                  background: isToday ? 'rgba(155,114,255,0.06)' : 'rgba(13,17,23,0.4)',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <div style={{ fontSize: 10, color: isToday ? '#9B72FF' : 'var(--muted)', fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{dayChip}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: isToday ? '#9B72FF' : 'var(--text)', lineHeight: 1 }}>{dayNum}</div>
                    {isToday && <div style={{ fontSize: 9, color: '#9B72FF', fontWeight: 700 }}>TODAY</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', minHeight: 36 }}>
                    {d.posts.length === 0 ? (
                      <span className="muted text-xs" style={{ fontStyle: 'italic' }}>nothing scheduled</span>
                    ) : d.posts.map((p) => {
                      const m = PLATFORM_META[p.channel as Channel] || PLATFORM_META.LINKEDIN;
                      return (
                        <span key={p.id} title={p.body} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '6px 10px', borderRadius: 8,
                          background: `linear-gradient(135deg, ${m.color}20 0%, ${m.color}08 100%)`,
                          border: `1px solid ${m.color}40`, fontSize: 12,
                        }}>
                          <span style={{ width: 18, height: 18, borderRadius: 4, background: m.gradient, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', textTransform: 'lowercase', letterSpacing: '-0.04em' }}>{m.letter}</span>
                          <span className="mono text-xs" style={{ color: m.color }}>{new Date(p.scheduledAt!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                          <span style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.body.slice(0, 50)}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {tab === 'DMs' && (
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

      {tab === 'Analytics' && (
        <div className="dash-stack">
          {analyticsSummary && (
            <Card title="📊 Last 30 days at a glance" subtitle="Everything you've sent across LinkedIn, Facebook, Instagram, and YouTube.">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                {[
                  { k: 'Total posts', v: analyticsSummary.totals.posts, accent: '#9B72FF', desc: 'across all platforms' },
                  { k: 'Published', v: analyticsSummary.totals.posted, accent: '#10D68A', desc: 'live and out the door' },
                  { k: 'Scheduled', v: analyticsSummary.totals.scheduled, accent: '#00C9FF', desc: 'firing automatically' },
                  { k: 'Drafts', v: analyticsSummary.totals.drafts, accent: '#F5A623', desc: 'awaiting your review' },
                  { k: 'LinkedIn DMs', v: analyticsSummary.totals.linkedinDms, accent: '#0A7ABF', desc: 'sent or queued' },
                  { k: 'Meta DMs', v: analyticsSummary.totals.metaDms, accent: '#1877F2', desc: 'FB + IG combined' },
                  { k: 'Replies analyzed', v: analyticsSummary.totals.socialReplies, accent: '#FF5B7A', desc: 'Claude classified' },
                ].map((s) => (
                  <div key={s.k} style={{
                    position: 'relative', overflow: 'hidden',
                    border: `1px solid ${s.accent}33`, borderRadius: 12, padding: 14,
                    background: `radial-gradient(120% 140% at 0% 0%, ${s.accent}10, transparent 55%), linear-gradient(180deg, #0F1320 0%, #0B0F1B 100%)`,
                  }}>
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: `linear-gradient(90deg, transparent, ${s.accent}, transparent)` }} />
                    <div style={{ fontSize: 32, fontWeight: 800, color: s.accent, lineHeight: 1, marginBottom: 4 }}>{s.v}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{s.k}</div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{s.desc}</div>
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
