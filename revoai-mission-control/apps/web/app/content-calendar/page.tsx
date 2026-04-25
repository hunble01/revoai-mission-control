'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ContentCalendarPage() {
  const [tab, setTab] = useState<'calendar'|'ideas'|'intel'|'trends'>('calendar');
  const [trends, setTrends] = useState<any[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [draftingTrendId, setDraftingTrendId] = useState<string | null>(null);
  const [trendChannel, setTrendChannel] = useState('LINKEDIN');
  const [posts, setPosts] = useState<any[]>([]);
  const [ideas, setIdeas] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [lastRun, setLastRun] = useState<string>('');
  const [composeIdea, setComposeIdea] = useState<any | null>(null);
  const [compose, setCompose] = useState<any>({ platform: 'BOTH', content: '', hashtags: [], postNow: true, scheduledDate: '', scheduledTime: '09:00' });
  const [competitorId, setCompetitorId] = useState('');
  const [competitorIntel, setCompetitorIntel] = useState<any>(null);

  const loadCalendar = async () => {
    const [pRes, iRes, sRes] = await Promise.all([
      fetch(`${base}/api/social-posts`, { credentials: 'include' }),
      fetch(`${base}/api/content/ideas`, { credentials: 'include' }),
      fetch(`${base}/api/settings`, { credentials: 'include' }),
    ]);
    const pJson = await pRes.json().catch(()=>[]);
    const iJson = await iRes.json().catch(()=>[]);
    const sJson = await sRes.json().catch(()=>({}));
    setPosts(Array.isArray(pJson) ? pJson : []);
    setIdeas(Array.isArray(iJson) ? iJson : []);
    setSettings(sJson || {});
  };

  useEffect(() => { loadCalendar().catch(()=>{}); }, []);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const t = sp.get('tab');
    if (t === 'ideas' || t === 'intel' || t === 'calendar' || t === 'trends') setTab(t);
    const c = sp.get('competitorId');
    if (c) setCompetitorId(c);
  }, []);

  const runIdeas = async () => {
    await fetch(`${base}/api/content/generate-ideas`, { method: 'POST', credentials: 'include' });
    setLastRun(new Date().toLocaleString());
    const start = Date.now();
    const iv = setInterval(async () => {
      const res = await fetch(`${base}/api/content/ideas`, { credentials: 'include' });
      const rows = await res.json().catch(()=>[]);
      setIdeas(Array.isArray(rows)?rows:[]);
      if (Date.now()-start > 30000) clearInterval(iv);
    }, 5000);
  };

  const createPost = async () => {
    const scheduledAt = compose.postNow ? null : `${compose.scheduledDate}T${compose.scheduledTime}:00`;
    await fetch(`${base}/api/social-posts`, { method:'POST', credentials:'include', headers:{'content-type':'application/json'}, body:JSON.stringify({ platform: compose.platform, content: compose.content, scheduledAt, hashtags: compose.hashtags, status: compose.postNow ? 'approved' : 'scheduled' })});
    setComposeIdea(null);
    await loadCalendar();
  };

  const refreshIntel = async () => {
    const competitors = settings?.competitors || [];
    const c = competitors.find((x:any, i:number) => String(i) === competitorId) || competitors[0];
    if (!c) return;
    const run = await fetch(`${base}/api/research/competitor-intel`, { method:'POST', credentials:'include', headers:{'content-type':'application/json'}, body:JSON.stringify({ competitorId, competitor: c })}).then(r=>r.json());
    const start = Date.now();
    const iv = setInterval(async () => {
      const rows = await fetch(`${base}/api/research/competitor-intel/${competitorId}`, { credentials:'include' }).then(r=>r.json()).catch(()=>null);
      if (rows) setCompetitorIntel(rows);
      if (Date.now()-start > 30000) clearInterval(iv);
    }, 5000);
    return run;
  };

  const sourceSummary = useMemo(() => {
    const ci = settings?.content_intelligence || {};
    return [
      `Google News: ${ci.newsSources?.googleNews ? 'Active' : 'Off'}`,
      `YouTube: ${(ci.youtubeChannels || []).length} channels`,
      `Reddit: ${ci.newsSources?.reddit ? 'Active' : 'Off'}`,
      `LinkedIn Trending: ${ci.newsSources?.linkedinTrending ? 'Active' : 'Off'}`,
      `Twitter/X: ${ci.newsSources?.twitterTrends ? 'Active' : 'Off'}`,
    ];
  }, [settings]);

  return (
    <div className="dash-stack fade-in">
      <section className="page-header">
        <div className="page-eyebrow">INTELLIGENCE / CONTENT CALENDAR</div>
        <h2 className="page-title" style={{ margin: 0 }}>Content Calendar</h2>
        <p className="page-desc">Claude-generated post ideas from your campaign niche + brand voice. Schedule to LinkedIn or Facebook.</p>
      </section>

      <div className="table-toolbar">
        <Button variant={tab==='calendar'?'primary':'secondary'} onClick={()=>setTab('calendar')}>Calendar</Button>
        <Button variant={tab==='ideas'?'primary':'secondary'} onClick={()=>setTab('ideas')}>Content Ideas</Button>
        <Button variant={tab==='trends'?'primary':'secondary'} onClick={async ()=>{
          setTab('trends');
          if (trends.length === 0) {
            setTrendsLoading(true);
            try {
              const r = await fetch(`${base}/api/trends?limit=30`, { credentials: 'include' });
              const j = r.ok ? await r.json() : [];
              setTrends(Array.isArray(j) ? j : []);
            } finally { setTrendsLoading(false); }
          }
        }}>🔥 Trends</Button>
        <Button variant={tab==='intel'?'primary':'secondary'} onClick={()=>setTab('intel')}>Competitor Intel</Button>
      </div>

      {tab === 'trends' && (
        <Card title="Trending — Hacker News, r/smallbusiness, Google News" subtitle="One click drafts a brand-voice post commenting on the story.">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={async () => {
              setTrendsLoading(true);
              try {
                const niche = settings?.brand?.niche || '';
                await fetch(`${base}/api/trends/refresh`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ niche }) });
                const r = await fetch(`${base}/api/trends?limit=30`, { credentials: 'include' });
                const j = r.ok ? await r.json() : [];
                setTrends(Array.isArray(j) ? j : []);
              } finally { setTrendsLoading(false); }
            }} disabled={trendsLoading}>
              {trendsLoading ? 'Refreshing…' : '🔄 Refresh trends'}
            </Button>
            <span className="muted text-xs">Draft for:</span>
            <select value={trendChannel} onChange={(e) => setTrendChannel(e.target.value)} style={{ background: 'rgba(17,24,39,.65)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}>
              <option value="LINKEDIN">LinkedIn</option>
              <option value="FACEBOOK">Facebook</option>
              <option value="INSTAGRAM">Instagram</option>
              <option value="YOUTUBE">YouTube short</option>
            </select>
          </div>
          {trends.length === 0 ? (
            <div className="muted" style={{ padding: 16, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 8 }}>
              No trends yet. Click Refresh to pull from Hacker News + Reddit + Google News.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {trends.map((t: any) => (
                <div key={t.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                    <Badge tone={t.source === 'hacker_news' ? 'warning' : t.source === 'reddit' ? 'info' : 'default' as any}>
                      {t.source === 'hacker_news' ? '🟧 HN' : t.source === 'reddit' ? '🟦 Reddit' : '📰 News'}
                    </Badge>
                    {typeof t.score === 'number' && <span className="muted text-xs mono">↑ {t.score}</span>}
                    {t.draftedAt && <Badge tone="success">drafted</Badge>}
                    <span className="muted text-xs">{t.publishedAt ? new Date(t.publishedAt).toLocaleString() : ''}</span>
                  </div>
                  <a href={t.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>{t.title}</a>
                  {t.summary && <div className="muted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>{String(t.summary).slice(0, 280)}{t.summary.length > 280 ? '…' : ''}</div>}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <Button variant="primary" disabled={draftingTrendId === t.id} onClick={async () => {
                      setDraftingTrendId(t.id);
                      try {
                        const r = await fetch(`${base}/api/trends/${t.id}/draft-post`, {
                          method: 'POST', credentials: 'include',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ channel: trendChannel }),
                        });
                        const j = await r.json();
                        if (!r.ok) throw new Error(j?.error?.message || 'Draft failed');
                        setTrends((prev) => prev.map((x: any) => x.id === t.id ? { ...x, draftedAt: new Date().toISOString() } : x));
                        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', text: `${trendChannel} draft saved — review at /social Queue` } }));
                      } catch (e: any) {
                        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', text: e?.message || 'Draft failed' } }));
                      } finally { setDraftingTrendId(null); }
                    }}>{draftingTrendId === t.id ? 'Drafting…' : '✍️ Draft a post about this'}</Button>
                    <Button variant="ghost" onClick={async () => {
                      await fetch(`${base}/api/trends/${t.id}`, { method: 'DELETE', credentials: 'include' });
                      setTrends((prev) => prev.filter((x: any) => x.id !== t.id));
                    }}>Dismiss</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'calendar' && (
        <Card title="Calendar" subtitle="Existing scheduled/posted social content">
          <div style={{ display:'grid', gap:8 }}>{posts.map((p:any)=><div key={p.id} className="ui-card" style={{padding:12}}><Badge tone={String(p.channel)==='LINKEDIN'?'violet':'info' as any}>{String(p.channel||'').toUpperCase()}</Badge> <span className="muted">{p.status}</span><div style={{marginTop:6}}>{p.body}</div></div>)}</div>
        </Card>
      )}

      {tab === 'ideas' && (
        <>
          <Card title="Source Summary" subtitle="Content intelligence source status">
            <div className="table-toolbar">{sourceSummary.map((s)=> <Badge key={s} tone="default">{s}</Badge>)}</div>
            <div className="table-toolbar" style={{ marginTop: 8 }}><Button variant="primary" onClick={runIdeas}>Run Content Agent</Button><span className="muted">Last run: {lastRun || '—'}</span></div>
          </Card>
          <div style={{ display:'grid', gap:12 }}>
            {ideas.length === 0 && (
              <div style={{ background: '#0D1117', border: '1px dashed #1C2333', borderRadius: 8, padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>💡</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>No content ideas yet</div>
                <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
                  Click <strong>Run Content Agent</strong> above to generate 6 AI post ideas from your active campaign's niche, pain point, and offer. Drafts can be turned into LinkedIn / Facebook posts.
                </div>
              </div>
            )}
            {ideas.map((i:any)=><div key={i.id} style={{ background:'#0D1117', border:'1px solid #1C2333', borderRadius:8, padding:16 }}>
              <div style={{display:'flex',justifyContent:'space-between'}}><Badge tone={i.platform==='LINKEDIN'?'violet':i.platform==='FACEBOOK'?'info':'default' as any}>{i.platform}</Badge><Badge tone={i.contentType==='Educational'?'info':i.contentType==='Social Proof'?'success':i.contentType==='Engagement'?'warning':'danger'}>{i.contentType}</Badge></div>
              <div style={{fontWeight:700, marginTop:8}}>{i.headline || i.angle}</div>
              <div style={{fontSize:10, fontFamily:'JetBrains Mono, monospace', color:'#7B8799'}}>From: {i.source}</div>
              <div className="muted" style={{marginTop:6}}>{new Date(i.createdAt).toLocaleString()}</div>
              <div className="table-toolbar" style={{marginTop:8}}>
                <Button variant="secondary" onClick={()=>{ setComposeIdea(i); setCompose((c:any)=>({...c, content:i.aiDraft||i.angle||'', platform:i.platform||'BOTH', hashtags:['#leadgen','#bookedappointments','#speedtolead']})); }}>Create Post</Button>
                <Button variant="ghost" onClick={async()=>{ await fetch(`${base}/api/content/ideas/${i.id}`,{method:'DELETE',credentials:'include'}); setIdeas((rows)=>rows.filter((x:any)=>x.id!==i.id)); }}>Dismiss</Button>
              </div>
            </div>)}
          </div>
        </>
      )}

      {tab === 'intel' && (
        <>
          <Card title="Competitor Intel" subtitle="Monitor competitor content + discover gaps">
            <div className="table-toolbar">
              <select className="ui-input" value={competitorId} onChange={(e)=>setCompetitorId(e.target.value)}>
                <option value="">Select competitor</option>
                {(settings?.competitors || []).map((c:any, i:number)=><option key={`${c.name}_${i}`} value={String(i)}>{c.name}</option>)}
              </select>
              <Button variant="primary" onClick={refreshIntel}>Refresh Intel</Button>
            </div>
            {!settings?.competitors?.length && <p className="muted">No competitors configured. Go to Settings → Competitor Monitoring.</p>}
          </Card>

          {competitorIntel && <Card title={competitorIntel.competitorName} subtitle={`Last updated ${new Date(competitorIntel.lastUpdated).toLocaleString()}`}>
            <div className="table-toolbar"><Badge tone="default">{competitorIntel.postingFrequency || '—'}</Badge>{(competitorIntel.topTopics||[]).map((t:string)=><Badge key={t} tone="info">{t}</Badge>)}</div>
            <div style={{display:'grid',gap:8, marginTop:8}}>{(competitorIntel.recentPosts||[]).map((p:any,idx:number)=><div key={idx} className="ui-card" style={{padding:10}}><Badge tone={p.platform==='LINKEDIN'?'violet':'info' as any}>{p.platform}</Badge><div style={{marginTop:6}}>{String(p.excerpt||'').slice(0,200)}</div><Button variant="secondary" onClick={()=>{ setTab('ideas'); setComposeIdea({ aiDraft:`Better angle on: ${p.excerpt}` }); setCompose((c:any)=>({...c, content:`Better angle on: ${p.excerpt}`})); }}>Create Better Version</Button></div>)}</div>
            <div className="table-toolbar" style={{marginTop:8}}>{(competitorIntel.contentGaps||[]).map((g:string)=><Button key={g} variant="ghost" onClick={()=>{ setTab('ideas'); setComposeIdea({ aiDraft:`Post idea — fill the content gap: ${g}` }); setCompose((c:any)=>({...c, content:`Post idea — fill the content gap: ${g}`})); }}>+ {g} Create Post</Button>)}</div>
          </Card>}
        </>
      )}

      {composeIdea && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:7000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ width:'100%', maxWidth:980, background:'#0D1117', border:'1px solid #1C2333', borderRadius:8, overflow:'hidden' }}>
            <div style={{ padding:'14px 16px', borderBottom:'1px solid #1C2333' }}><strong>Post Composer</strong></div>
            <div style={{ padding:16, display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:12 }}>
              <div style={{display:'grid',gap:8}}>
                <div className="table-toolbar"><Button variant={compose.platform==='LINKEDIN'?'primary':'secondary'} onClick={()=>setCompose((c:any)=>({...c,platform:'LINKEDIN'}))}>LinkedIn</Button><Button variant={compose.platform==='FACEBOOK'?'primary':'secondary'} onClick={()=>setCompose((c:any)=>({...c,platform:'FACEBOOK'}))}>Facebook</Button><Button variant={compose.platform==='BOTH'?'primary':'secondary'} onClick={()=>setCompose((c:any)=>({...c,platform:'BOTH'}))}>Both</Button></div>
                <textarea className="ui-input" rows={6} value={compose.content} onChange={(e)=>setCompose((c:any)=>({...c,content:e.target.value}))} />
                <div className="text-xs mono" style={{ color: compose.content.length > (compose.platform==='LINKEDIN'?3000:63206) ? 'var(--rose)' : compose.content.length > (compose.platform==='LINKEDIN'?2400:50564) ? 'var(--amber)' : 'var(--emerald)' }}>{compose.content.length} / {compose.platform==='LINKEDIN'?3000:63206}</div>
                <Button variant={compose.postNow?'primary':'secondary'} onClick={()=>setCompose((c:any)=>({...c,postNow:!c.postNow}))}>{compose.postNow?'Post now':'Schedule for later'}</Button>
                {!compose.postNow && <div className="table-toolbar"><input className="ui-input" type="date" value={compose.scheduledDate} onChange={(e)=>setCompose((c:any)=>({...c,scheduledDate:e.target.value}))} /><input className="ui-input" type="time" value={compose.scheduledTime} onChange={(e)=>setCompose((c:any)=>({...c,scheduledTime:e.target.value}))} /></div>}
                <div className="table-toolbar">{(compose.hashtags||[]).map((h:string)=><Button key={h} variant="ghost" onClick={()=>setCompose((c:any)=>({...c,hashtags:Array.from(new Set([...(c.hashtags||[]), h]))}))}>{h}</Button>)}</div>
              </div>
              <div className="ui-card" style={{padding:12}}><div className="muted">Preview</div><div style={{marginTop:8,whiteSpace:'pre-wrap'}}>{compose.content}</div></div>
            </div>
            <div style={{ padding:'12px 16px', borderTop:'1px solid #1C2333', display:'flex', justifyContent:'flex-end', gap:8 }}><Button variant="secondary" onClick={()=>setComposeIdea(null)}>Cancel</Button><Button variant="primary" onClick={createPost}>Save to Calendar</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
