'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { CountUp } from '../../components/ui/CountUp';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AnalyticsPage() {
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [campaignId, setCampaignId] = useState('ALL');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [funnel, setFunnel] = useState<any>({});
  const [channels, setChannels] = useState<any>({});
  const [content, setContent] = useState<any[]>([]);
  const [daily, setDaily] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);

  const load = async () => {
    const qp = `?from=${from}&to=${to}${campaignId !== 'ALL' ? `&campaignId=${campaignId}` : ''}`;
    const [f, c, cp, d, cams, ls] = await Promise.all([
      fetch(`${base}/api/analytics/funnel${qp}`, { credentials: 'include' }).then((r) => r.json()).catch(() => ({})),
      fetch(`${base}/api/analytics/channels${qp}`, { credentials: 'include' }).then((r) => r.json()).catch(() => ({})),
      fetch(`${base}/api/analytics/content-performance${qp}`, { credentials: 'include' }).then((r) => r.json()).catch(() => ([])),
      fetch(`${base}/api/analytics/daily-activity${qp}`, { credentials: 'include' }).then((r) => r.json()).catch(() => ([])),
      fetch(`${base}/api/campaigns`, { credentials: 'include' }).then((r) => r.json()).catch(() => ([])),
      fetch(`${base}/api/leads`, { credentials: 'include' }).then((r) => r.json()).catch(() => ([])),
    ]);
    setFunnel(f || {}); setChannels(c || {}); setContent(Array.isArray(cp) ? cp : []); setDaily(Array.isArray(d) ? d : []); setCampaigns(Array.isArray(cams) ? cams : []); setLeads(Array.isArray(ls) ? ls : []);
  };

  useEffect(() => { load(); }, [from, to, campaignId]);

  const filteredLeads = useMemo(() => campaignId === 'ALL' ? leads : leads.filter((l: any) => l.campaignId === campaignId), [leads, campaignId]);
  const campaignPerf = useMemo(() => {
    const rows = campaigns.map((c: any) => {
      const l = leads.filter((x: any) => x.campaignId === c.id);
      const contacted = l.filter((x: any) => String(x.status || '').toUpperCase() === 'CONTACTED').length;
      const replied = l.filter((x: any) => String(x.status || '').toUpperCase() === 'REPLIED').length;
      const booked = l.filter((x: any) => String(x.status || '').toUpperCase() === 'BOOKED').length;
      const fitVals = l.map((x: any) => String(x.fitScore || '').toLowerCase() === 'high' ? 3 : String(x.fitScore || '').toLowerCase() === 'medium' ? 2 : 1);
      return { id: c.id, name: c.name, leads: l.length, contacted, replied, booked, replyRate: l.length ? Math.round((replied / l.length) * 100) : 0, convRate: l.length ? Math.round((booked / l.length) * 100) : 0, fitAvg: fitVals.length ? (fitVals.reduce((a, b) => a + b, 0) / fitVals.length).toFixed(2) : '0.00', niche: c.niche || 'General', angle: c.painPoint || c.yourOffer || 'General angle' };
    });
    return rows.sort((a, b) => b.replyRate - a.replyRate);
  }, [campaigns, leads]);

  const anglePerf = useMemo(() => campaignPerf.slice(0, 6).map((x) => ({ angle: x.angle, rate: x.replyRate })), [campaignPerf]);
  const nichePerf = useMemo(() => {
    const map: any = {};
    campaignPerf.forEach((c) => { map[c.niche] = map[c.niche] || { niche: c.niche, leads: 0, replied: 0 }; map[c.niche].leads += c.leads; map[c.niche].replied += c.replied; });
    return Object.values(map).map((x: any) => ({ ...x, rate: x.leads ? Math.round((x.replied / x.leads) * 100) : 0 })).sort((a: any, b: any) => b.rate - a.rate);
  }, [campaignPerf]);

  const exportCsv = async () => {
    try {
      const url = `${base}/api/analytics/export?from=${from}&to=${to}${campaignId !== 'ALL' ? `&campaignId=${campaignId}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const blob = await res.blob();
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'analytics.csv'; a.click();
        return;
      }
    } catch {}
    const csv = ['campaign,leads,contacted,replied,booked,reply_rate,conversion_rate', ...campaignPerf.map((r) => `${r.name},${r.leads},${r.contacted},${r.replied},${r.booked},${r.replyRate},${r.convRate}`)].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'analytics.csv'; a.click();
  };

  return <div className="dash-stack fade-in">
    <section className="page-header"><div className="page-eyebrow">SYSTEM / ANALYTICS</div><h2 className="page-title" style={{ margin: 0 }}>Analytics</h2></section>
    <div className="table-toolbar">
      <input className="ui-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      <input className="ui-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      {[['Today',0],['Last 7 Days',7],['Last 30 Days',30],['Last 90 Days',90],['All Time',-1]].map(([label, days]) => <Button key={String(label)} variant="secondary" onClick={() => { if (days === -1) { setFrom(''); setTo(''); } else { setTo(new Date().toISOString().slice(0,10)); setFrom(new Date(Date.now() - Number(days) * 86400000).toISOString().slice(0,10)); } }}>{label}</Button>)}
      <select className="ui-input" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}><option value="ALL">All Campaigns</option>{campaigns.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <Button variant="ghost" onClick={exportCsv}>Export CSV</Button>
    </div>
    {campaignId !== 'ALL' && <div className="muted">Viewing: {campaigns.find((c: any) => c.id === campaignId)?.name}</div>}

    <div className="kpi-grid mb-16">
      {[['Researched',funnel.researched||0,'cyan'],['Contacted',funnel.contacted||0,'amber'],['Replied',funnel.replied||0,'emerald'],['Booked',funnel.booked||0,'violet']].map(([label,val,color]) => <div key={String(label)} className={`kpi-card ${color}`}><div className="kpi-label">{String(label)}</div><div className={`kpi-value ${color}`}><CountUp value={Number(val)||0} /></div></div>)}
    </div>

    <Card title="Funnel" subtitle="Existing section"><Table><tbody>{Object.entries(funnel||{}).map(([k,v])=><tr key={k}><td>{k}</td><td>{String(v)}</td></tr>)}</tbody></Table></Card>
    <Card title="Channel Comparison" subtitle="Existing section"><Table><tbody>{['EMAIL','LINKEDIN','FACEBOOK'].map((k)=><tr key={k}><td>{k}</td><td>{channels?.[k]?.sent||0}</td><td>{channels?.[k]?.replied||0}</td></tr>)}</tbody></Table></Card>
    <Card title="Content Performance" subtitle="Existing section"><Table><tbody>{content.map((p:any)=><tr key={p.id}><td>{p.channel}</td><td>{p.status}</td><td>{p.bodyPreview||p.body}</td></tr>)}</tbody></Table></Card>
    <Card title="Daily Activity" subtitle="Existing section"><Table><tbody>{daily.map((d:any)=><tr key={d.date}><td>{d.date}</td><td>{d.sends}</td><td>{d.replies}</td><td>{d.bookings}</td></tr>)}</tbody></Table></Card>

    <Card title="Campaign Performance" subtitle="Campaign comparison">
      <Table><thead><tr><th>Campaign Name</th><th>Leads</th><th>Contacted</th><th>Replied</th><th>Booked</th><th>Reply Rate</th><th>Conversion Rate</th><th>Fit Score Avg</th></tr></thead><tbody>{campaignPerf.map((r)=> <tr key={r.id} onClick={()=>setCampaignId(r.id)} style={{cursor:'pointer'}}><td>{r.name}</td><td>{r.leads}</td><td>{r.contacted}</td><td>{r.replied}</td><td>{r.booked}</td><td>{r.replyRate}%</td><td>{r.convRate}%</td><td>{r.fitAvg}</td></tr>)}</tbody></Table>
    </Card>

    <Card title="What's Working" subtitle="Message angle performance">
      {!anglePerf.length ? <div className="muted">Run more outreach to see which angles perform best</div> : <div style={{ display: 'grid', gap: 8 }}>{anglePerf.map((a)=> <div key={a.angle} className="ui-card" style={{ padding: 10, display: 'flex', justifyContent: 'space-between' }}><span>{a.angle}</span><Badge tone="info">{a.rate}%</Badge></div>)}</div>}
    </Card>

    <Card title="Best Performing Niches" subtitle="Reply rate by industry">
      {!nichePerf.length ? <div className="muted">Not enough data yet</div> : <div style={{ display: 'grid', gap: 8 }}>{nichePerf.map((n:any)=> <div key={n.niche} className="ui-card" style={{ padding: 10, display: 'flex', justifyContent: 'space-between' }}><span>{n.niche}</span><Badge tone="success">{n.rate}%</Badge></div>)}</div>}
    </Card>
  </div>;
}
