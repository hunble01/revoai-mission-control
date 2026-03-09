'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ResearchPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [tab, setTab] = useState<'leads'|'content'|'intel'>('leads');
  const [leads, setLeads] = useState<any[]>([]);
  const [content, setContent] = useState<any[]>([]);
  const [intel, setIntel] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});

  const loadRuns = async () => {
    const res = await fetch(`${base}/api/research/runs`, { credentials: 'include' });
    const rows = await res.json().catch(()=>[]);
    const list = Array.isArray(rows) ? rows : [];
    setRuns(list);
    if (!selectedRunId && list[0]?.id) setSelectedRunId(list[0].id);
  };

  const loadDetail = async (id: string) => {
    if (!id) return;
    const [a,b,c,s] = await Promise.all([
      fetch(`${base}/api/research/runs/${id}/leads`, { credentials:'include' }).then(r=>r.json()).catch(()=>[]),
      fetch(`${base}/api/research/runs/${id}/content`, { credentials:'include' }).then(r=>r.json()).catch(()=>[]),
      fetch(`${base}/api/research/runs/${id}/intel`, { credentials:'include' }).then(r=>r.json()).catch(()=>[]),
      fetch(`${base}/api/settings`, { credentials:'include' }).then(r=>r.json()).catch(()=>({})),
    ]);
    setLeads(Array.isArray(a)?a:[]);
    setContent(Array.isArray(b)?b:[]);
    setIntel(Array.isArray(c)?c:[]);
    setSettings(s||{});
  };

  useEffect(()=>{ loadRuns().catch(()=>{}); }, []);
  useEffect(()=>{ if(selectedRunId) loadDetail(selectedRunId).catch(()=>{}); }, [selectedRunId]);

  const topCompetitors = useMemo(() => (settings?.competitors || []).slice(0,3), [settings]);
  const trendingTopics = useMemo(() => (settings?.content_intelligence?.contentTopics || []).slice(0,8), [settings]);

  return (
    <div className="dash-stack fade-in">
      <section className="page-header"><div className="page-eyebrow">INTELLIGENCE / RESEARCH</div><h2 className="page-title" style={{ margin: 0 }}>Research Hub</h2></section>
      <div style={{ display:'grid', gridTemplateColumns:'320px minmax(0,1fr)', gap:12 }}>
        <Card title="Runs" subtitle="Latest research runs">
          <div style={{display:'grid',gap:8}}>{runs.map((r:any)=><button key={r.id} className={`research-run ${selectedRunId===r.id?'active':''}`} onClick={()=>setSelectedRunId(r.id)}><div className="run-header"><div style={{fontSize:12,fontWeight:600}}>{new Date(r.createdAt).toLocaleString()}</div><span className="badge active">{String(r.status||'').toUpperCase()}</span></div></button>)}</div>
        </Card>

        <Card title="Run Detail" subtitle={selectedRunId || 'Select a run'}>
          <div className="table-toolbar" style={{ marginBottom: 10 }}>
            <Button variant={tab==='leads'?'primary':'secondary'} onClick={()=>setTab('leads')}>Leads</Button>
            <Button variant={tab==='content'?'primary':'secondary'} onClick={()=>setTab('content')}>Content</Button>
            <Button variant={tab==='intel'?'primary':'secondary'} onClick={()=>setTab('intel')}>Intel</Button>
          </div>

          {tab==='leads' && <Table><thead><tr><th>Company</th><th>Contact</th><th>Email</th></tr></thead><tbody>{leads.map((l:any)=><tr key={l.id}><td>{l.companyName}</td><td>{l.contactName||'—'}</td><td>{l.email||'—'}</td></tr>)}</tbody></Table>}
          {tab==='content' && <Table><thead><tr><th>Title</th><th>Summary</th></tr></thead><tbody>{content.map((c:any)=><tr key={c.id}><td>{c.title}</td><td>{c.summary}</td></tr>)}</tbody></Table>}

          {tab==='intel' && (
            <div style={{display:'grid',gap:12}}>
              <div style={{display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:8}}>
                {topCompetitors.map((c:any, i:number)=><div key={`${c.name}_${i}`} className="ui-card" style={{padding:12,borderLeft:'3px solid var(--violet)'}}>
                  <div style={{fontWeight:700}}>{c.name}</div>
                  <div className="muted text-xs mono">Last post: recent</div>
                  <div className="muted text-xs mono">Posting: ~3x/week</div>
                  <div className="muted text-xs mono">Top topic: speed-to-lead</div>
                  <Button variant="secondary" onClick={()=>router.push(`/content-calendar?tab=intel&competitorId=${i}`)}>View Full Intel</Button>
                </div>)}
              </div>
              <Card title="Trending topics this week" subtitle="From content intelligence sources">
                <div className="table-toolbar">{trendingTopics.map((t:string)=><Badge key={t} tone="info">{t}</Badge>)}</div>
                <div className="table-toolbar" style={{marginTop:8}}><Button variant="primary" onClick={()=>router.push('/content-calendar?tab=ideas')}>Generate Post Ideas</Button></div>
              </Card>
              <Table><thead><tr><th>Competitor</th><th>Insight</th><th>Source</th></tr></thead><tbody>{intel.map((i:any)=><tr key={i.id}><td>{i.competitor}</td><td>{i.insight}</td><td>{i.sourceUrl||'—'}</td></tr>)}</tbody></Table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
