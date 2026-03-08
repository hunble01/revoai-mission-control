'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

type Tab = 'leads' | 'content' | 'intel';

export default function ResearchPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [tab, setTab] = useState<Tab>('leads');
  const [leads, setLeads] = useState<any[]>([]);
  const [content, setContent] = useState<any[]>([]);
  const [intel, setIntel] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [exportCampaignId, setExportCampaignId] = useState('');
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedRun = useMemo(() => runs.find((r) => r.id === selectedRunId) || null, [runs, selectedRunId]);

  const loadRuns = async () => {
    const res = await fetch(`${base}/api/research/runs`, { credentials: 'include', headers: { 'x-admin-token': token } });
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(data?.error?.message || `Failed to load runs (HTTP ${res.status})`);
    const rows = Array.isArray(data) ? data : [];
    setRuns(rows);
    if (!selectedRunId && rows[0]?.id) setSelectedRunId(rows[0].id);
  };

  const loadDetail = async (runId: string) => {
    if (!runId) return;
    const headers = { 'x-admin-token': token };
    const [a, b, c] = await Promise.all([
      fetch(`${base}/api/research/runs/${runId}/leads`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => []),
      fetch(`${base}/api/research/runs/${runId}/content`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => []),
      fetch(`${base}/api/research/runs/${runId}/intel`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => []),
    ]);
    setLeads(Array.isArray(a) ? a : []);
    setContent(Array.isArray(b) ? b : []);
    setIntel(Array.isArray(c) ? c : []);
  };

  const loadCampaigns = async () => {
    const res = await fetch(`${base}/api/campaigns`, { credentials: 'include', headers: { 'x-admin-token': token } });
    const rows = await res.json().catch(() => []);
    const list = Array.isArray(rows) ? rows : [];
    setCampaigns(list);
    const active = list.find((c: any) => c.isActive) || list[0];
    if (active) setExportCampaignId(active.id);
  };

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([loadRuns(), loadCampaigns()])
      .catch((e: any) => setError(e?.message || 'Failed to load research hub'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedRunId) return;
    loadDetail(selectedRunId).catch(() => {
      setLeads([]);
      setContent([]);
      setIntel([]);
    });
  }, [selectedRunId]);

  const runNow = async () => {
    setRunning(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${base}/api/research/run`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ requestedBy: 'admin' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `Research run failed (HTTP ${res.status})`);
      setMessage('Research run completed.');
      await loadRuns();
      if (data?.id) {
        setSelectedRunId(data.id);
        await loadDetail(data.id);
      }
    } catch (e: any) {
      setError(e?.message || 'Research run failed');
    } finally {
      setRunning(false);
    }
  };

  const exportLeads = async () => {
    if (!selectedRunId) return;
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${base}/api/research/runs/${selectedRunId}/export-leads`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ campaignId: exportCampaignId || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `Export failed (HTTP ${res.status})`);
      setMessage(`Exported ${data?.exported || 0} leads to campaign.`);
    } catch (e: any) {
      setError(e?.message || 'Export failed');
    }
  };

  return (
    <div className="dash-stack">
      <section className="page-hero">
        <h3>Research Hub</h3>
        <p>Run daily deep research and review leads, content ideas, and competitor intel.</p>
      </section>

      {error && <p style={{ color: '#ff9b9b' }}>{error}</p>}
      {message && <p className="muted">{message}</p>}

      <div className="table-toolbar">
        <Button variant="primary" onClick={runNow} disabled={running}>{running ? 'Running…' : 'Run Research Now'}</Button>
        <select className="ui-input" value={exportCampaignId} onChange={(e) => setExportCampaignId(e.target.value)}>
          {campaigns.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Button variant="secondary" onClick={exportLeads} disabled={!selectedRunId}>Export to Campaign</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0,1fr)', gap: 12 }}>
        <Card title="Runs" subtitle="Latest research runs">
          {loading ? <p className="muted">Loading runs...</p> : (
            <div style={{ display: 'grid', gap: 8 }}>
              {runs.map((r: any) => (
                <button key={r.id} className="ui-input" style={{ textAlign: 'left' }} onClick={() => setSelectedRunId(r.id)}>
                  <strong>{r.status.toUpperCase()}</strong>
                  <div className="muted">{new Date(r.createdAt).toLocaleString()}</div>
                </button>
              ))}
              {!runs.length && <p className="muted">No runs yet.</p>}
            </div>
          )}
        </Card>

        <Card title="Run Detail" subtitle={selectedRun ? `${selectedRun.status} • ${new Date(selectedRun.createdAt).toLocaleString()}` : 'Select a run'}>
          <div className="table-toolbar" style={{ marginBottom: 10 }}>
            <Button variant={tab === 'leads' ? 'primary' : 'secondary'} onClick={() => setTab('leads')}>Leads ({leads.length})</Button>
            <Button variant={tab === 'content' ? 'primary' : 'secondary'} onClick={() => setTab('content')}>Content ({content.length})</Button>
            <Button variant={tab === 'intel' ? 'primary' : 'secondary'} onClick={() => setTab('intel')}>Intel ({intel.length})</Button>
          </div>

          {tab === 'leads' && (
            <Table>
              <thead><tr><th>Company</th><th>Contact</th><th>Email</th><th>Phone</th><th>LinkedIn</th></tr></thead>
              <tbody>
                {leads.map((l: any) => (
                  <tr key={l.id}><td>{l.companyName}</td><td>{l.contactName || '—'}</td><td>{l.email || '—'}</td><td>{l.phone || '—'}</td><td>{l.linkedinUrl || '—'}</td></tr>
                ))}
                {!leads.length && <tr><td colSpan={5} className="muted">No leads in this run.</td></tr>}
              </tbody>
            </Table>
          )}

          {tab === 'content' && (
            <Table>
              <thead><tr><th>Title</th><th>Summary</th><th>Video Angle</th></tr></thead>
              <tbody>
                {content.map((c: any) => (
                  <tr key={c.id}><td>{c.title}</td><td>{c.summary}</td><td>{c.videoAngle || '—'}</td></tr>
                ))}
                {!content.length && <tr><td colSpan={3} className="muted">No content ideas in this run.</td></tr>}
              </tbody>
            </Table>
          )}

          {tab === 'intel' && (
            <Table>
              <thead><tr><th>Competitor</th><th>Insight</th><th>Source</th></tr></thead>
              <tbody>
                {intel.map((i: any) => (
                  <tr key={i.id}><td>{i.competitor}</td><td>{i.insight}</td><td>{i.sourceUrl || '—'}</td></tr>
                ))}
                {!intel.length && <tr><td colSpan={3} className="muted">No intel in this run.</td></tr>}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
