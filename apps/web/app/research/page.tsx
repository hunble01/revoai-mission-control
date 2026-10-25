'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Table } from '../../components/ui/Table';
import { API_BASE, apiHeaders } from '../../lib/api';
import { ComingSoon } from '../../components/ComingSoon';

export default function ResearchPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [tab, setTab] = useState<'leads' | 'content' | 'intel'>('leads');
  const [leads, setLeads] = useState<any[]>([]);
  const [content, setContent] = useState<any[]>([]);
  const [intel, setIntel] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [settings, setSettings] = useState<any>({});
  const [search, setSearch] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [promoting, setPromoting] = useState(false);

  const loadRuns = async () => {
    const res = await fetch(`${API_BASE}/api/research/runs`, { credentials: 'include', headers: apiHeaders });
    const rows = await res.json().catch(() => []);
    const list = Array.isArray(rows) ? rows : [];
    setRuns(list);
    if (!selectedRunId && list[0]?.id) setSelectedRunId(list[0].id);
  };

  const loadDetail = async (id: string) => {
    if (!id) return;
    const [a, b, c, s, m] = await Promise.all([
      fetch(`${API_BASE}/api/research/runs/${id}/leads`, { credentials: 'include', headers: apiHeaders }).then((r) => r.json()).catch(() => []),
      fetch(`${API_BASE}/api/research/runs/${id}/content`, { credentials: 'include', headers: apiHeaders }).then((r) => r.json()).catch(() => []),
      fetch(`${API_BASE}/api/research/runs/${id}/intel`, { credentials: 'include', headers: apiHeaders }).then((r) => r.json()).catch(() => []),
      fetch(`${API_BASE}/api/settings`, { credentials: 'include', headers: apiHeaders }).then((r) => r.json()).catch(() => ({})),
      fetch(`${API_BASE}/api/research/runs/${id}/summary`, { credentials: 'include', headers: apiHeaders }).then((r) => r.json()).catch(() => null),
    ]);
    setLeads(Array.isArray(a) ? a : []);
    setContent(Array.isArray(b) ? b : []);
    setIntel(Array.isArray(c) ? c : []);
    setSettings(s || {});
    setSummary(m || null);
    setSelectedLeadIds([]);
    setSelectedLead(null);
  };

  useEffect(() => { loadRuns().catch(() => {}); }, []);
  useEffect(() => { if (selectedRunId) loadDetail(selectedRunId).catch(() => {}); }, [selectedRunId]);

  const topCompetitors = useMemo(() => (settings?.competitors || []).slice(0, 3), [settings]);
  const trendingTopics = useMemo(() => (settings?.content_intelligence?.contentTopics || []).slice(0, 8), [settings]);

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l: any) =>
      [l.companyName, l.contactName, l.email, l.phone, l.source].some((x) => String(x || '').toLowerCase().includes(q)),
    );
  }, [leads, search]);

  const bulkPromote = async (action: 'APPROVE' | 'REJECT' | 'SNOOZE') => {
    if (!selectedRunId || !selectedLeadIds.length) return;
    setPromoting(true);
    try {
      await fetch(`${API_BASE}/api/research/runs/${selectedRunId}/promote`, {
        method: 'POST',
        credentials: 'include',
        headers: apiHeaders,
        body: JSON.stringify({ action, leadIds: selectedLeadIds }),
      });
      await loadDetail(selectedRunId);
    } finally {
      setPromoting(false);
    }
  };

  return (
    <div className="dash-stack fade-in">
      <section className="page-header"><div className="page-eyebrow">INTELLIGENCE / RESEARCH</div><h2 className="page-title" style={{ margin: 0 }}>Research Hub</h2></section>
      <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0,1fr)', gap: 12 }}>
        <Card title="Runs" subtitle="Latest research runs">
          <div style={{ display: 'grid', gap: 8 }}>{runs.map((r: any) => <button key={r.id} className={`research-run ${selectedRunId === r.id ? 'active' : ''}`} onClick={() => setSelectedRunId(r.id)}><div className="run-header"><div style={{ fontSize: 12, fontWeight: 600 }}>{new Date(r.createdAt).toLocaleString()}</div><span className="badge active">{String(r.status || '').toUpperCase()}</span></div></button>)}</div>
        </Card>

        <div style={{ display: 'grid', gap: 12 }}>
          <Card title="Funnel from this research run" subtitle="What Places API returned → what became leads → drafts → sends">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 8 }}>
              <div className="ui-card" style={{ padding: 10 }}>
                <div className="kpi-title" style={{ fontSize: 10, color: '#7C8599', letterSpacing: '.1em', textTransform: 'uppercase' }}>🔍 Discovered</div>
                <div className="kpi-value cyan" style={{ fontSize: 24 }}>{summary?.counts?.leads ?? 0}</div>
                <div className="muted text-xs mono">{summary?.counts?.withPhone ?? 0} w/ phone · {summary?.counts?.withWebsite ?? 0} w/ website</div>
              </div>
              <div className="ui-card" style={{ padding: 10 }}>
                <div className="kpi-title" style={{ fontSize: 10, color: '#7C8599', letterSpacing: '.1em', textTransform: 'uppercase' }}>→ Promoted</div>
                <div className="kpi-value emerald" style={{ fontSize: 24 }}>{summary?.counts?.promoted ?? 0}</div>
                <div className="muted text-xs mono">into Lead table</div>
              </div>
              <div className="ui-card" style={{ padding: 10 }}>
                <div className="kpi-title" style={{ fontSize: 10, color: '#7C8599', letterSpacing: '.1em', textTransform: 'uppercase' }}>🧠 Enriched</div>
                <div className="kpi-value violet" style={{ fontSize: 24 }}>{summary?.counts?.enriched ?? 0}</div>
                <div className="muted text-xs mono">website scraped</div>
              </div>
              <div className="ui-card" style={{ padding: 10 }}>
                <div className="kpi-title" style={{ fontSize: 10, color: '#7C8599', letterSpacing: '.1em', textTransform: 'uppercase' }}>✍️ Drafted</div>
                <div className="kpi-value amber" style={{ fontSize: 24 }}>{summary?.counts?.drafted ?? 0}</div>
                <div className="muted text-xs mono">AI cold emails</div>
              </div>
              <div className="ui-card" style={{ padding: 10 }}>
                <div className="kpi-title" style={{ fontSize: 10, color: '#7C8599', letterSpacing: '.1em', textTransform: 'uppercase' }}>📮 Sent</div>
                <div className="kpi-value" style={{ fontSize: 24, color: '#FF5B7A' }}>{summary?.counts?.sent ?? 0}</div>
                <div className="muted text-xs mono">via Resend</div>
              </div>
            </div>
            <p className="muted" style={{ marginTop: 10, fontSize: 11.5 }}>
              Places API returns phone + website, not email. Emails come from AI enrichment after promotion. If "Enriched" shows a number but "Drafted" is lower, the gap = leads where Claude couldn't find a visible email on the website.
            </p>
          </Card>

          <Card title="Run Detail" subtitle={selectedRunId || 'Select a run'}>
            <div className="table-toolbar" style={{ marginBottom: 10 }}>
              <Button variant={tab === 'leads' ? 'primary' : 'secondary'} onClick={() => setTab('leads')}>Leads</Button>
              <Button variant={tab === 'content' ? 'primary' : 'secondary'} onClick={() => setTab('content')}>Content</Button>
              <Button variant={tab === 'intel' ? 'primary' : 'secondary'} onClick={() => setTab('intel')}>Intel</Button>
            </div>

            {tab === 'leads' && (
              <>
                <div className="table-toolbar" style={{ marginBottom: 10 }}>
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search company/contact/email" />
                  <Button variant="primary" onClick={() => bulkPromote('APPROVE')} disabled={!selectedLeadIds.length || promoting}>Approve</Button>
                  <Button variant="secondary" onClick={() => bulkPromote('SNOOZE')} disabled={!selectedLeadIds.length || promoting}>Snooze</Button>
                  <Button variant="ghost" onClick={() => bulkPromote('REJECT')} disabled={!selectedLeadIds.length || promoting}>Reject</Button>
                </div>
                <Table>
                  <thead><tr><th><input type="checkbox" checked={filteredLeads.length > 0 && filteredLeads.every((l: any) => selectedLeadIds.includes(l.id))} onChange={(e) => setSelectedLeadIds(e.target.checked ? filteredLeads.map((l: any) => l.id) : [])} /></th><th>Company</th><th>Contact</th><th>Email</th><th>Phone</th><th>Source</th><th>Fit</th></tr></thead>
                  <tbody>
                    {filteredLeads.map((l: any) => (
                      <tr key={l.id} onClick={() => setSelectedLead(l)} style={{ cursor: 'pointer' }}>
                        <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedLeadIds.includes(l.id)} onChange={(e) => e.target.checked ? setSelectedLeadIds((x) => Array.from(new Set([...x, l.id])) as string[]) : setSelectedLeadIds((x) => x.filter((id) => id !== l.id))} /></td>
                        <td>{l.companyName}</td><td>{l.contactName || '—'}</td><td>{l.email || '—'}</td><td>{l.phone || '—'}</td><td><Badge>{l.source || l.sourceType || '—'}</Badge></td><td><Badge tone={l.fitScore === 'High' ? 'success' : l.fitScore === 'Medium' ? 'warning' : 'default'}>{l.fitScore || 'Low'}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </>
            )}

            {tab === 'content' && <Table><thead><tr><th>Title</th><th>Summary</th></tr></thead><tbody>{content.map((c: any) => <tr key={c.id}><td>{c.title}</td><td>{c.summary}</td></tr>)}</tbody></Table>}

            {tab === 'intel' && (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
                  {topCompetitors.map((c: any, i: number) => <div key={`${c.name}_${i}`} className="ui-card" style={{ padding: 12, borderLeft: '3px solid var(--violet)' }}>
                    <div style={{ fontWeight: 700 }}>{c.name}</div>
                    <div className="muted text-xs mono">Top topic: speed-to-lead</div>
                    <Button variant="secondary" onClick={() => router.push(`/content-calendar?tab=intel&competitorId=${i}`)}>View Full Intel</Button>
                  </div>)}
                </div>
                <Card title="Trending topics this week" subtitle="From content intelligence sources">
                  <div className="table-toolbar">{trendingTopics.map((t: string) => <Badge key={t} tone="info">{t}</Badge>)}</div>
                  <div className="table-toolbar" style={{ marginTop: 8 }}><Button variant="primary" onClick={() => router.push('/content-calendar?tab=ideas')}>Generate Post Ideas</Button></div>
                </Card>
                <Table><thead><tr><th>Competitor</th><th>Insight</th><th>Source</th></tr></thead><tbody>{intel.map((i: any) => <tr key={i.id}><td>{i.competitor}</td><td>{i.insight}</td><td>{i.sourceUrl || '—'}</td></tr>)}</tbody></Table>
              </div>
            )}
          </Card>
        </div>
      </div>

      {selectedLead && (
        <aside style={{ position: 'fixed', right: 0, top: 0, width: 'min(360px, 100vw)', height: '100dvh', background: '#0D1117', borderLeft: '1px solid #1C2333', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flexShrink: 0, padding: 16, borderBottom: '1px solid #1C2333', display: 'flex', justifyContent: 'space-between' }}><strong>{selectedLead.companyName}</strong><Button variant="secondary" onClick={() => setSelectedLead(null)}>✕</Button></div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: 16 }}>
            <div className="muted">Contact: {selectedLead.contactName || '—'}</div>
            <div className="muted">Email: {selectedLead.email || '—'}</div>
            <div className="muted">Phone: {selectedLead.phone || '—'}</div>
            <div className="muted">LinkedIn: {selectedLead.linkedinUrl || '—'}</div>
            <div className="muted">Source: {selectedLead.source || selectedLead.sourceType || '—'}</div>
            <div style={{ marginTop: 12 }}>
              <Button variant="primary" onClick={() => { setSelectedLeadIds([selectedLead.id]); bulkPromote('APPROVE'); }}>Approve</Button>{' '}
              <Button variant="secondary" onClick={() => { setSelectedLeadIds([selectedLead.id]); bulkPromote('SNOOZE'); }}>Snooze</Button>{' '}
              <Button variant="ghost" onClick={() => { setSelectedLeadIds([selectedLead.id]); bulkPromote('REJECT'); }}>Reject</Button>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
