'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

import { API_BASE, apiHeaders } from '../../lib/api';

export default function AgentsPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [ideas, setIdeas] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [scheduler, setScheduler] = useState<any[]>([]);
  const [runningResearch, setRunningResearch] = useState(false);
  const [runningContent, setRunningContent] = useState(false);

  const load = async () => {
    const [r, i, s, j] = await Promise.all([
      fetch(`${API_BASE}/api/research/runs`, { credentials: 'include', headers: apiHeaders }).then((x) => x.json()).catch(() => []),
      fetch(`${API_BASE}/api/content/ideas`, { credentials: 'include', headers: apiHeaders }).then((x) => x.json()).catch(() => []),
      fetch(`${API_BASE}/api/settings`, { credentials: 'include', headers: apiHeaders }).then((x) => x.json()).catch(() => ({})),
      fetch(`${API_BASE}/api/scheduler/jobs`, { credentials: 'include', headers: apiHeaders }).then((x) => x.json()).catch(() => []),
    ]);
    setRuns(Array.isArray(r) ? r : []);
    setIdeas(Array.isArray(i) ? i : []);
    setSettings(s || {});
    setScheduler(Array.isArray(j) ? j : []);
  };

  useEffect(() => { load(); }, []);

  const lastResearchRun = runs[0];
  const lastContentRun = ideas[0];
  const researchStatus = (() => {
    if (!lastResearchRun?.createdAt) return 'muted';
    const h = (Date.now() - new Date(lastResearchRun.createdAt).getTime()) / 3600000;
    return h <= 24 ? 'success' : h <= 72 ? 'warning' : 'default';
  })();
  const contentStatus = (() => {
    if (!lastContentRun?.createdAt) return 'default';
    const h = (Date.now() - new Date(lastContentRun.createdAt).getTime()) / 3600000;
    return h <= 24 ? 'success' : h <= 72 ? 'warning' : 'default';
  })();

  const history = useMemo(() => {
    const r = runs.slice(0, 10).map((x: any) => ({ type: 'Research', at: x.createdAt, summary: x.status, count: x?.metadata?.counts?.leads || 0 }));
    const c = ideas.slice(0, 10).map((x: any) => ({ type: 'Content', at: x.createdAt, summary: x.headline || x.angle, count: 1 }));
    return [...r, ...c].sort((a, b) => +new Date(b.at || 0) - +new Date(a.at || 0)).slice(0, 10);
  }, [runs, ideas]);

  return (
    <div className="dash-stack fade-in">
      <section className="page-header"><div className="page-eyebrow">OPERATIONS / AGENTS</div><h2 className="page-title" style={{ margin: 0 }}>Agents</h2><p className="page-desc">AI agents that power your research and content pipeline</p></section>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: '#0D1117', border: '1px solid #1C2333', borderLeft: '2px solid #00C9FF', borderRadius: 8, padding: 20 }}>
          <div style={{ borderBottom: '1px solid #1C2333', paddingBottom: 12, marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}><strong>🤖 Research Agent</strong><Badge tone={researchStatus as any}>●</Badge></div>
          <p className="muted">Finds and enriches leads based on your campaign filters using your configured data sources</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, background: '#080B12', borderRadius: 6, padding: 12 }}>
            <div><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--cyan)' }}>{runs.reduce((n, r: any) => n + Number(r?.metadata?.counts?.leads || 0), 0)}</div><div className="text-xs mono text-dim">Total Leads Found</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--emerald)' }}>{lastResearchRun?.createdAt ? new Date(lastResearchRun.createdAt).toLocaleDateString() : '—'}</div><div className="text-xs mono text-dim">Last Run</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--violet)' }}>{runs.length ? Math.round(runs.reduce((n, r: any) => n + Number(r?.metadata?.counts?.leads || 0), 0) / runs.length) : 0}</div><div className="text-xs mono text-dim">Avg per Run</div></div>
          </div>
          <div className="muted" style={{ marginTop: 10 }}>Last run details: {lastResearchRun?.createdAt ? new Date(lastResearchRun.createdAt).toLocaleString() : '—'} • {lastResearchRun?.campaignName || 'Generic'} • {(lastResearchRun?.sourcesUsed || []).join(', ') || '—'}</div>
          <div className="muted">Next Scheduled Run: {scheduler.find((j: any) => j.jobType === 'RESEARCH_RUN')?.nextRunHuman || '—'}</div>
          <div className="muted">Configuration summary: {(settings?.campaigns || []).length || 0} active campaigns • sources configured</div>
          <div className="table-toolbar" style={{ marginTop: 10 }}>
            <Button variant="primary" onClick={async () => { setRunningResearch(true); await fetch(`${API_BASE}/api/research/runs`, { method: 'POST', credentials: 'include', headers: apiHeaders, body: JSON.stringify({}) }); await load(); setRunningResearch(false); }}>{runningResearch ? 'Running...' : 'Run Now'}</Button>
            <Button variant="ghost" onClick={() => window.location.href = '/research'}>View All Runs</Button>
            <Button variant="ghost" onClick={() => window.location.href = '/settings'}>Configure</Button>
          </div>
        </div>

        <div style={{ background: '#0D1117', border: '1px solid #1C2333', borderLeft: '2px solid #9B72FF', borderRadius: 8, padding: 20 }}>
          <div style={{ borderBottom: '1px solid #1C2333', paddingBottom: 12, marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}><strong>✨ Content Agent</strong><Badge tone={contentStatus as any}>●</Badge></div>
          <p className="muted">Monitors your content sources, generates post ideas, and drafts outreach messages using your campaign angle settings</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, background: '#080B12', borderRadius: 6, padding: 12 }}>
            <div><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--cyan)' }}>{ideas.length}</div><div className="text-xs mono text-dim">Posts Generated</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--amber)' }}>{ideas.length}</div><div className="text-xs mono text-dim">Ideas Pending</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--violet)' }}>{lastContentRun?.createdAt ? new Date(lastContentRun.createdAt).toLocaleDateString() : '—'}</div><div className="text-xs mono text-dim">Last Run</div></div>
          </div>
          <div className="muted" style={{ marginTop: 10 }}>Next Scheduled Run: {scheduler.find((j: any) => String(j.jobType || '').includes('POST'))?.nextRunHuman || '—'}</div>
          <div className="muted">Configuration summary: {(settings?.content_intelligence?.contentTopics || []).length} topics • {(settings?.content_intelligence?.youtubeChannels || []).length} YouTube • {(settings?.competitors || []).length} competitors</div>
          <div className="table-toolbar" style={{ marginTop: 10 }}>
            <Button variant="primary" onClick={async () => { setRunningContent(true); await fetch(`${API_BASE}/api/content/generate-ideas`, { method: 'POST', credentials: 'include', headers: apiHeaders }); await load(); setRunningContent(false); }}>{runningContent ? 'Running...' : 'Run Now'}</Button>
            <Button variant="ghost" onClick={() => window.location.href = '/content-calendar?tab=ideas'}>View Ideas</Button>
            <Button variant="ghost" onClick={() => window.location.href = '/settings'}>Configure</Button>
          </div>
        </div>
      </div>

      <div className="ui-card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Agent Run History</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          {history.map((h, i) => <div key={i} className="ui-card" style={{ padding: 10, display: 'flex', justifyContent: 'space-between' }}><div><Badge tone={h.type === 'Research' ? 'info' : 'violet' as any}>{h.type}</Badge> <span className="muted">{h.summary}</span></div><div className="muted">{h.at ? new Date(h.at).toLocaleString() : '—'} • {h.count}</div></div>)}
        </div>
      </div>
    </div>
  );
}
