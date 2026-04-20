'use client';

import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { API_BASE, apiHeaders } from '../../lib/api';

const base = API_BASE;

function IntegrationsCard() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch(`${API_BASE}/api/settings/integrations`, { credentials: 'include', headers: apiHeaders })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {});
  }, []);
  if (!data) return null;
  return (
    <Card
      title="Integrations"
      subtitle={`${data.activeCount} active · ${data.missingCount} waiting on keys`}
    >
      <div style={{ display: 'grid', gap: 8 }}>
        {data.rows.map((r: any) => (
          <div
            key={r.key}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 12,
              padding: '12px 14px',
              background: r.status === 'active' ? 'rgba(95,122,78,0.06)' : 'rgba(184,154,106,0.05)',
              border: `1px solid ${r.status === 'active' ? 'rgba(95,122,78,0.25)' : 'rgba(184,154,106,0.22)'}`,
              borderRadius: 12,
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 14, color: '#2A2824' }}>
                {r.label}
              </div>
              <div style={{ fontSize: 12.5, color: '#6B6159', marginTop: 2 }}>{r.unlocks}</div>
              {r.status === 'missing' && (
                <div style={{ fontSize: 11, color: '#A8821C', marginTop: 4, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 0.4 }}>
                  Needs: {r.required.join(', ')}
                </div>
              )}
            </div>
            <Badge tone={r.status === 'active' ? 'success' : 'warning'}>
              {r.status === 'active' ? 'ACTIVE' : 'NEEDS KEYS'}
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('');
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <input
        className="ui-input"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const next = draft.trim();
            if (!next) return;
            onChange(Array.from(new Set([...value, next])));
            setDraft('');
          }
        }}
      />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {value.map((t) => (
          <span key={t} className="ui-btn" style={{ border: '1px solid #243044', background: 'transparent' }}>
            {t} <button onClick={() => onChange(value.filter((x) => x !== t))} style={{ marginLeft: 6 }}>×</button>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [brand, setBrand] = useState<any>({ yourName: '', yourTitle: '', companyName: '', phoneNumber: '', websiteUrl: '', logoData: '', signatureStyle: 'Professional' });

  const [ci, setCi] = useState<any>({
    contentTopics: [],
    contentExcludeTopics: [],
    newsSources: { googleNews: true, reddit: true, linkedinTrending: true, twitterTrends: false },
    youtubeChannels: [],
    youtubeSearchTerms: [],
    linkedinFrequency: 'EVERY_2_DAYS',
    linkedinDays: ['Mon', 'Wed', 'Fri'],
    facebookFrequency: 'EVERY_2_DAYS',
    facebookDays: ['Tue', 'Thu', 'Sat'],
    postTime: '09:00',
    offsetPlatforms: true,
  });
  const [ytDraft, setYtDraft] = useState('');
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [compDraft, setCompDraft] = useState({ name: '', linkedinUrl: '', facebookUrl: '' });
  const [safety, setSafety] = useState<any>({ outboundKillSwitches: { email: false, facebook: false, instagram: false, linkedin: false } });

  useEffect(() => {
    (async () => {
      const [settingsRes, brandRes] = await Promise.all([
        fetch(`${base}/api/settings`, { credentials: 'include', headers: apiHeaders }),
        fetch(`${base}/api/settings/brand`, { credentials: 'include', headers: apiHeaders }),
      ]);
      const s = await settingsRes.json().catch(() => ({}));
      const b = await brandRes.json().catch(() => ({}));
      if (s?.content_intelligence) setCi((prev: any) => ({ ...prev, ...s.content_intelligence }));
      if (Array.isArray(s?.competitors)) setCompetitors(s.competitors);
      setSafety({
        outboundKillSwitches: s?.outbound_kill_switches || { email: false, facebook: false, instagram: false, linkedin: false },
      });
      if (b && typeof b === 'object') setBrand((prev: any) => ({ ...prev, ...b }));
    })().catch(() => {});
  }, []);

  const saveContentIntelligence = async () => {
    setErr(''); setMsg('');
    const res = await fetch(`${base}/api/settings`, {
      method: 'PATCH', credentials: 'include', headers: apiHeaders, body: JSON.stringify(ci),
    });
    if (!res.ok) { setErr(`Failed to save content intelligence (HTTP ${res.status})`); return; }
    setMsg('Content Intelligence saved.');
  };

  const saveCompetitors = async () => {
    setErr(''); setMsg('');
    const res = await fetch(`${base}/api/settings`, {
      method: 'PATCH', credentials: 'include', headers: apiHeaders, body: JSON.stringify({ competitors }),
    });
    if (!res.ok) { setErr(`Failed to save competitors (HTTP ${res.status})`); return; }
    setMsg('Competitors saved.');
  };

  return (
    <div className="dash-stack fade-in">
      <section className="page-header"><div className="page-eyebrow">SYSTEM / SETTINGS</div><h2 className="page-title" style={{ margin: 0 }}>Settings</h2></section>
      {err && <p style={{ color: '#ff9b9b' }}>{err}</p>}
      {msg && <p className="muted">{msg}</p>}

      <IntegrationsCard />

      <Card title="Content Intelligence" subtitle="Configure monitoring + posting automation inputs">
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <div className="page-eyebrow">CONTENT TOPICS</div>
            <p className="muted">Keywords the AI monitors to find relevant content and generate post ideas</p>
            <TagInput value={ci.contentTopics} onChange={(v) => setCi((c: any) => ({ ...c, contentTopics: v }))} placeholder="local business growth, appointment booking, home services marketing" />
          </div>

          <div>
            <div className="page-eyebrow">EXCLUDE KEYWORDS</div>
            <p className="muted">Topics to ignore — keeps your content feed clean</p>
            <TagInput value={ci.contentExcludeTopics} onChange={(v) => setCi((c: any) => ({ ...c, contentExcludeTopics: v }))} placeholder="add keyword and press Enter" />
          </div>

          <div>
            <div className="page-eyebrow">NEWS SOURCES</div>
            <div className="table-toolbar">
              {[
                ['googleNews', 'Google News — Trending news by your topic keywords'],
                ['reddit', 'Reddit — Community discussions in relevant subreddits'],
                ['linkedinTrending', 'LinkedIn Trending — Top posts in your industry'],
                ['twitterTrends', 'Twitter/X Trends — Real-time trending topics'],
              ].map(([k, label]) => (
                <Button key={k} variant={ci.newsSources?.[k] ? 'primary' : 'secondary'} onClick={() => setCi((c: any) => ({ ...c, newsSources: { ...c.newsSources, [k]: !c.newsSources?.[k] } }))}>{label}</Button>
              ))}
            </div>
          </div>

          <div>
            <div className="page-eyebrow">YOUTUBE MONITORING</div>
            <p className="muted">The AI watches these channels, summarizes new videos, and turns insights into post ideas</p>
            <div className="table-toolbar">
              <input className="ui-input" value={ytDraft} onChange={(e) => setYtDraft(e.target.value)} placeholder="YouTube channel URL or name" />
              <Button variant="secondary" onClick={() => { const v = ytDraft.trim(); if (!v) return; setCi((c: any) => ({ ...c, youtubeChannels: [...(c.youtubeChannels || []), { name: v, url: v }] })); setYtDraft(''); }}>Add</Button>
            </div>
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              {(ci.youtubeChannels || []).map((ch: any, i: number) => (
                <div key={`${ch.url}_${i}`} className="ui-card" style={{ padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>{ch.name || ch.url}</strong><Button variant="ghost" onClick={() => setCi((c: any) => ({ ...c, youtubeChannels: c.youtubeChannels.filter((_: any, idx: number) => idx !== i) }))}>Remove</Button></div>
                  <div className="muted text-xs mono">{ch.url}</div>
                </div>
              ))}
            </div>
            <p className="muted" style={{ marginTop: 8 }}>Also search YouTube for these terms weekly</p>
            <TagInput value={ci.youtubeSearchTerms || []} onChange={(v) => setCi((c: any) => ({ ...c, youtubeSearchTerms: v }))} placeholder="local business marketing 2026, HVAC business tips" />
          </div>

          <div>
            <div className="page-eyebrow">POSTING SCHEDULE</div>
            <div className="table-toolbar">
              <select className="ui-input" value={ci.linkedinFrequency} onChange={(e) => setCi((c: any) => ({ ...c, linkedinFrequency: e.target.value }))}><option value="DAILY">Daily</option><option value="EVERY_2_DAYS">Every 2 days</option><option value="EVERY_3_DAYS">Every 3 days</option></select>
              <select className="ui-input" value={ci.facebookFrequency} onChange={(e) => setCi((c: any) => ({ ...c, facebookFrequency: e.target.value }))}><option value="DAILY">Daily</option><option value="EVERY_2_DAYS">Every 2 days</option><option value="EVERY_3_DAYS">Every 3 days</option></select>
              <input className="ui-input" type="time" value={ci.postTime} onChange={(e) => setCi((c: any) => ({ ...c, postTime: e.target.value }))} />
            </div>
            <div className="table-toolbar" style={{ marginTop: 8 }}>
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => <Button key={`li_${d}`} variant={ci.linkedinDays.includes(d) ? 'primary' : 'secondary'} onClick={() => setCi((c:any)=>({...c,linkedinDays:c.linkedinDays.includes(d)?c.linkedinDays.filter((x:string)=>x!==d):[...c.linkedinDays,d]}))}>LI {d}</Button>)}
            </div>
            <div className="table-toolbar" style={{ marginTop: 8 }}>
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => <Button key={`fb_${d}`} variant={ci.facebookDays.includes(d) ? 'primary' : 'secondary'} onClick={() => setCi((c:any)=>({...c,facebookDays:c.facebookDays.includes(d)?c.facebookDays.filter((x:string)=>x!==d):[...c.facebookDays,d]}))}>FB {d}</Button>)}
            </div>
            <Button variant={ci.offsetPlatforms ? 'primary' : 'secondary'} onClick={() => setCi((c: any) => ({ ...c, offsetPlatforms: !c.offsetPlatforms }))} style={{ marginTop: 8 }}>Offset LinkedIn and Facebook so something posts every day</Button>
          </div>

          <div className="table-toolbar" style={{ justifyContent: 'flex-end' }}><Button variant="primary" onClick={saveContentIntelligence}>Save Content Intelligence</Button></div>
        </div>
      </Card>

      <Card title="Competitor Monitoring" subtitle="The AI monitors these competitors and identifies content gaps and opportunities">
        <div className="table-toolbar">
          <input className="ui-input" placeholder="Competitor name" value={compDraft.name} onChange={(e)=>setCompDraft((c)=>({...c,name:e.target.value}))} />
          <input className="ui-input" placeholder="LinkedIn URL" value={compDraft.linkedinUrl} onChange={(e)=>setCompDraft((c)=>({...c,linkedinUrl:e.target.value}))} />
          <input className="ui-input" placeholder="Facebook URL" value={compDraft.facebookUrl} onChange={(e)=>setCompDraft((c)=>({...c,facebookUrl:e.target.value}))} />
          <Button variant="secondary" onClick={()=>{ if(!compDraft.name.trim()) return; setCompetitors((c)=>[...c,{...compDraft}]); setCompDraft({name:'',linkedinUrl:'',facebookUrl:''}); }}>Add</Button>
        </div>
        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          {competitors.map((c, i) => (
            <div key={`${c.name}_${i}`} className="ui-card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{c.name}</strong>
                <Button variant="ghost" onClick={() => setCompetitors((arr) => arr.filter((_, idx) => idx !== i))}>Remove</Button>
              </div>
              <div className="table-toolbar" style={{ marginTop: 6 }}>
                <Badge tone={c.linkedinUrl ? 'success' : 'default'}>LinkedIn</Badge>
                <Badge tone={c.facebookUrl ? 'success' : 'default'}>Facebook</Badge>
              </div>
            </div>
          ))}
        </div>
        <div className="table-toolbar" style={{ justifyContent: 'flex-end', marginTop: 8 }}><Button variant="primary" onClick={saveCompetitors}>Save Competitors</Button></div>
      </Card>

      <Card title="Outbound Kill Switches" subtitle="Instantly stop outbound by channel">
        <div style={{ display: 'grid', gap: 10 }}>
          {['email', 'facebook', 'instagram', 'linkedin'].map((k) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ textTransform: 'capitalize' }}>{k}</span>
              <button onClick={() => setSafety((s: any) => ({ ...s, outboundKillSwitches: { ...(s.outboundKillSwitches || {}), [k]: !(s.outboundKillSwitches || {})[k] } }))} style={{ width: 40, height: 22, borderRadius: 999, border: '1px solid #1C2333', background: (safety.outboundKillSwitches || {})[k] ? 'rgba(255,91,122,.2)' : '#0D1117' }}>
                <span style={{ display: 'block', width: 16, height: 16, borderRadius: 999, background: (safety.outboundKillSwitches || {})[k] ? '#FF5B7A' : '#7B8799', transform: `translateX(${(safety.outboundKillSwitches || {})[k] ? 16 : 0}px)`, transition: 'all .2s' }} />
              </button>
            </div>
          ))}
          <Button variant="primary" onClick={async () => { await fetch(`${base}/api/settings/safety`, { method: 'PATCH', credentials: 'include', headers: apiHeaders, body: JSON.stringify({ outboundKillSwitches: safety.outboundKillSwitches || {} }) }); setMsg('Kill switches updated.'); }}>Save Kill Switches</Button>
        </div>
      </Card>

      <Card title="Notifications" subtitle="Alert preferences">
        <div style={{ display: 'grid', gap: 10 }}>
          {[
            ['approvalNeeded', 'New lead requires approval'],
            ['sendFailure', 'Send failure alerts'],
            ['dailyDigest', 'Daily digest email'],
            ['newReply', 'New reply notification'],
            ['researchComplete', 'Research run complete'],
          ].map(([k, label]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{label}</span>
              <button onClick={() => setCi((c: any) => ({ ...c, notifications: { ...(c.notifications || {}), [k]: !(c.notifications || {})[k] } }))} style={{ width: 40, height: 22, borderRadius: 999, border: '1px solid #1C2333', background: (ci.notifications || {})[k] ? 'rgba(0,201,255,.2)' : '#0D1117' }}>
                <span style={{ display: 'block', width: 16, height: 16, borderRadius: 999, background: (ci.notifications || {})[k] ? '#00C9FF' : '#7B8799', transform: `translateX(${(ci.notifications || {})[k] ? 16 : 0}px)`, transition: 'all .2s' }} />
              </button>
            </div>
          ))}
          <Button variant="primary" onClick={async () => { await fetch(`${base}/api/settings`, { method: 'PATCH', credentials: 'include', headers: apiHeaders, body: JSON.stringify({ notificationSettings: ci.notifications || {} }) }); setMsg('Notifications saved.'); }}>Save Notifications</Button>
        </div>
      </Card>

      <Card title="Brand & Signature" subtitle="Default sender identity used by AI-generated outreach">
        <div className="table-toolbar" style={{ display: 'grid', gap: 8 }}>
          <input className="ui-input" placeholder="Your Name" value={brand.yourName || ''} onChange={(e) => setBrand((b: any) => ({ ...b, yourName: e.target.value }))} />
          <input className="ui-input" placeholder="Your Title" value={brand.yourTitle || ''} onChange={(e) => setBrand((b: any) => ({ ...b, yourTitle: e.target.value }))} />
          <input className="ui-input" placeholder="Company Name" value={brand.companyName || ''} onChange={(e) => setBrand((b: any) => ({ ...b, companyName: e.target.value }))} />
          <input className="ui-input" placeholder="Phone Number" value={brand.phoneNumber || ''} onChange={(e) => setBrand((b: any) => ({ ...b, phoneNumber: e.target.value }))} />
          <input className="ui-input" placeholder="Website URL" value={brand.websiteUrl || ''} onChange={(e) => setBrand((b: any) => ({ ...b, websiteUrl: e.target.value }))} />
          <Button variant="primary" onClick={async ()=>{ const res = await fetch(`${base}/api/settings/brand`, { method:'POST', credentials:'include', headers:apiHeaders, body:JSON.stringify(brand)}); if(!res.ok){setErr('Failed to save brand settings'); return;} setMsg('Brand settings saved.'); }}>Save Brand Settings</Button>
        </div>
      </Card>
    </div>
  );
}
