'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function EmailPage() {
  const [tab, setTab] = useState<'history'|'templates'|'settings'>('history');
  const [history, setHistory] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({ fromName: '', fromEmail: '', replyToEmail: '', dailySendLimit: 50 });
  const [modal, setModal] = useState(false);
  const [tpl, setTpl] = useState<any>({ name: '', tags: [], subject: '', body: '' });

  useEffect(() => {
    (async () => {
      const [h, s] = await Promise.all([
        fetch(`${base}/api/drafts/email-send-history`, { credentials: 'include' }).then((r) => r.json()).catch(() => []),
        fetch(`${base}/api/settings`, { credentials: 'include' }).then((r) => r.json()).catch(() => ({})),
      ]);
      setHistory(Array.isArray(h) ? h : []);
      setTemplates(Array.isArray((s as any)?.emailTemplates) ? (s as any).emailTemplates : []);
      setSettings((prev: any) => ({ ...prev, ...((s as any)?.emailSettings || {}) }));
    })();
  }, []);

  const kpi = useMemo(() => {
    const sent = history.length;
    const opened = history.filter((x: any) => x.openedAt).length;
    const replied = history.filter((x: any) => x.repliedAt).length;
    const bounced = history.filter((x: any) => String(x.status || '').toLowerCase().includes('bounce') || String(x.status || '').toLowerCase().includes('fail')).length;
    return { sent, openRate: sent ? Math.round((opened / sent) * 100) : 0, replyRate: sent ? Math.round((replied / sent) * 100) : 0, bounced };
  }, [history]);

  return <div className="dash-stack fade-in">
    <section className="page-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
      <div><div className="page-eyebrow">CHANNELS / EMAIL</div><h2 className="page-title" style={{ margin: 0 }}>Email</h2><p className="page-desc">Manage your email outreach, templates, and delivery history</p></div>
      <div className="table-toolbar"><Button variant="ghost" onClick={() => setModal(true)}>+ New Template</Button><Button variant="ghost">Send Test Email</Button></div>
    </section>

    <div style={{ display: 'flex', gap: 8 }}>
      <div className="ui-card" style={{ flex: 1, padding: 10 }}><div style={{ color: 'var(--cyan)', fontWeight: 700 }}>{kpi.sent}</div><div className="text-xs mono text-dim">Total Sent</div></div>
      <div className="ui-card" style={{ flex: 1, padding: 10 }}><div style={{ color: 'var(--emerald)', fontWeight: 700 }}>{kpi.openRate}%</div><div className="text-xs mono text-dim">Open Rate</div></div>
      <div className="ui-card" style={{ flex: 1, padding: 10 }}><div style={{ color: 'var(--violet)', fontWeight: 700 }}>{kpi.replyRate}%</div><div className="text-xs mono text-dim">Reply Rate</div></div>
      <div className="ui-card" style={{ flex: 1, padding: 10 }}><div style={{ color: 'var(--rose)', fontWeight: 700 }}>{kpi.bounced}</div><div className="text-xs mono text-dim">Bounced</div></div>
    </div>

    <div className="table-toolbar"><Button variant={tab==='history'?'primary':'secondary'} onClick={() => setTab('history')}>Sent History</Button><Button variant={tab==='templates'?'primary':'secondary'} onClick={() => setTab('templates')}>Templates</Button><Button variant={tab==='settings'?'primary':'secondary'} onClick={() => setTab('settings')}>Settings</Button></div>

    {tab === 'history' && <Card title="Sent History" subtitle="Email send history"><table className="ui-table"><thead><tr><th>Recipient</th><th>Subject line</th><th>Campaign</th><th>Status</th><th>Sent At</th><th>Opened At</th><th>Replied</th></tr></thead><tbody>{history.slice(0,25).map((h:any,i:number)=><tr key={h.id||i}><td>{h.to||h.email||'—'}</td><td>{h.subject||'—'}</td><td>{h.campaignName||'—'}</td><td><Badge tone={String(h.status||'').toLowerCase().includes('bounce')?'danger':'info' as any}>{String(h.status||'SENT').toUpperCase()}</Badge></td><td>{h.sentAt?new Date(h.sentAt).toLocaleString():'—'}</td><td>{h.openedAt?new Date(h.openedAt).toLocaleString():'—'}</td><td><Badge tone={h.repliedAt?'success':'default'}>{h.repliedAt?'Yes':'No'}</Badge></td></tr>)}</tbody></table></Card>}

    {tab === 'templates' && <Card title="Templates" subtitle="Email template library"><div className="table-toolbar" style={{ justifyContent:'flex-end' }}><Button variant="primary" onClick={() => setModal(true)}>+ New Template</Button></div><div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>{templates.map((t:any,i:number)=><div key={i} className="ui-card" style={{ background:'#0D1117', border:'1px solid #1C2333', borderRadius:8, padding:16 }}><strong>{t.name}</strong> <Badge tone="info">EMAIL</Badge><div className="muted">{String(t.subject||'').slice(0,100)} {String(t.body||'').slice(0,100)}</div><div className="table-toolbar"><Button variant="secondary" onClick={()=>{setTpl(t);setModal(true);}}>Edit</Button><Button variant="secondary" onClick={()=>setTemplates((arr)=>[...arr,{...t,name:`${t.name} Copy`}])}>Duplicate</Button><Button variant="ghost" onClick={()=>setTemplates((arr)=>arr.filter((_:any,idx:number)=>idx!==i))}>Delete</Button></div></div>)}</div></Card>}

    {tab === 'settings' && <Card title="Email Settings" subtitle="Delivery config"><div style={{ display:'grid', gap:8 }}><input className="ui-input" placeholder="From Name" value={settings.fromName||''} onChange={(e)=>setSettings((s:any)=>({...s,fromName:e.target.value}))} /><input className="ui-input" placeholder="From Email" value={settings.fromEmail||''} onChange={(e)=>setSettings((s:any)=>({...s,fromEmail:e.target.value}))} /><input className="ui-input" placeholder="Reply-To" value={settings.replyToEmail||''} onChange={(e)=>setSettings((s:any)=>({...s,replyToEmail:e.target.value}))} /><input className="ui-input" type="number" value={settings.dailySendLimit||50} onChange={(e)=>setSettings((s:any)=>({...s,dailySendLimit:Number(e.target.value)}))} /><Button variant="primary" onClick={async()=>{await fetch(`${base}/api/settings`,{method:'PATCH',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({emailSettings:settings,emailTemplates:templates})});}}>Save Email Settings</Button></div></Card>}

    {modal && <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:7000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}><div style={{ width:'100%', maxWidth:860, background:'#0D1117', border:'1px solid #1C2333', borderRadius:8 }}><div style={{ padding:'12px 16px', borderBottom:'1px solid #1C2333' }}><strong>Template</strong></div><div style={{ padding:16, display:'grid', gap:8 }}><input className="ui-input" placeholder="Template Name" value={tpl.name||''} onChange={(e)=>setTpl((t:any)=>({...t,name:e.target.value}))} /><input className="ui-input" placeholder="Tags comma separated" value={(tpl.tags||[]).join(',')} onChange={(e)=>setTpl((t:any)=>({...t,tags:e.target.value.split(',').map((x:string)=>x.trim()).filter(Boolean)}))} /><div className="table-toolbar"><Button variant="ghost" onClick={()=>setTpl((t:any)=>({...t,subject:`${t.subject||''} {{first_name}}`}))}>{'{first_name}'}</Button><Button variant="ghost" onClick={()=>setTpl((t:any)=>({...t,subject:`${t.subject||''} {{business_name}}`}))}>{'{business_name}'}</Button><Button variant="ghost" onClick={()=>setTpl((t:any)=>({...t,subject:`${t.subject||''} {{city}}`}))}>{'{city}'}</Button><Button variant="ghost" onClick={()=>setTpl((t:any)=>({...t,subject:`${t.subject||''} {{niche}}`}))}>{'{niche}'}</Button></div><input className="ui-input" placeholder="Subject" value={tpl.subject||''} onChange={(e)=>setTpl((t:any)=>({...t,subject:e.target.value}))} /><textarea className="ui-input" rows={8} value={tpl.body||''} onChange={(e)=>setTpl((t:any)=>({...t,body:e.target.value}))} /><div className="ui-card" style={{ padding:10 }}><div className="muted">Preview</div><div>{String(tpl.subject||'').replace('{{first_name}}','Michael')}</div><div style={{ whiteSpace:'pre-wrap' }}>{String(tpl.body||'').replace('{{first_name}}','Michael')}</div></div></div><div style={{ padding:'12px 16px', borderTop:'1px solid #1C2333', display:'flex', justifyContent:'flex-end', gap:8 }}><Button variant="secondary" onClick={()=>setModal(false)}>Cancel</Button><Button variant="primary" onClick={async()=>{const next=[...templates.filter((x:any)=>x.name!==tpl.name),tpl]; setTemplates(next); await fetch(`${base}/api/settings`,{method:'PATCH',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({emailTemplates:next})}); setModal(false);}}>Save Template</Button></div></div></div>}
  </div>;
}
