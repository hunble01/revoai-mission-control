'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { CountUp } from '../components/ui/CountUp';
import { SkeletonRows } from '../components/ui/Skeleton';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

export default function Home() {
  const [leads, setLeads] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [safety, setSafety] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [researchRuns, setResearchRuns] = useState<any[]>([]);
  const [sendHistory, setSendHistory] = useState<any[]>([]);
  const [lastRefresh, setLastRefresh] = useState<string>('—');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers = { 'x-admin-token': token };
    Promise.all([
      fetch(`${base}/api/leads`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => []),
      fetch(`${base}/api/drafts`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => []),
      fetch(`${base}/api/settings/safety`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => null),
      fetch(`${base}/api/alerts`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => ({ alerts: [] })),
      fetch(`${base}/api/research/runs`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => []),
      fetch(`${base}/api/drafts/email-send-history?limit=100`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => []),
    ]).then(([l, d, s, a, rr, sh]) => {
      setLeads(Array.isArray(l) ? l : []);
      setDrafts(Array.isArray(d) ? d : []);
      setSafety(s);
      setAlerts(Array.isArray(a?.alerts) ? a.alerts : []);
      setResearchRuns(Array.isArray(rr) ? rr : []);
      setSendHistory(Array.isArray(sh) ? sh : []);
      setLastRefresh(new Date().toLocaleTimeString());
    }).finally(() => setLoading(false));
  }, []);

  const kpis = useMemo(() => {
    const statusCount = (value: string) => leads.filter((l) => String(l.status || '').toUpperCase() === value).length;
    const approved = drafts.filter((d) => String(d.status || '').toUpperCase() === 'APPROVED').length;
    const needsApproval = drafts.filter((d) => String(d.status || '').toUpperCase() === 'NEEDS_APPROVAL').length;
    const socialDrafted = drafts.filter((d) => ['LINKEDIN', 'FACEBOOK'].includes(String(d.channel || '').toUpperCase()) && ['DRAFT', 'NEEDS_APPROVAL'].includes(String(d.status || '').toUpperCase())).length;
    const socialApproved = drafts.filter((d) => ['LINKEDIN', 'FACEBOOK'].includes(String(d.channel || '').toUpperCase()) && String(d.status || '').toUpperCase() === 'APPROVED').length;
    const socialScheduled = 0;

    return [
      { label: 'Total Leads', value: String(leads.length), meta: 'Inbound records' },
      { label: 'Research Leads Today', value: String(statusCount('RESEARCHED')), meta: 'Agent sourced' },
      { label: 'Posts Drafted', value: String(socialDrafted), meta: 'Content pipeline' },
      { label: 'Posts Approved', value: String(socialApproved), meta: 'Ready to publish' },
      { label: 'Posts Scheduled', value: String(socialScheduled), meta: 'Scheduled queue' },
      { label: 'Needs Approval', value: String(needsApproval), meta: 'Queue pressure' },
      { label: 'Approved Drafts', value: String(approved), meta: 'Ready to send' },
      { label: 'Booked', value: String(statusCount('BOOKED')), meta: 'Appointments won' },
    ];
  }, [leads, drafts]);

  return (
    <div className="dash-stack">
      <section className="page-header">
        <div className="page-eyebrow">MISSION CONTROL</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <h2 className="page-title" style={{ margin: 0 }}>Operations Overview</h2>
            <p className="page-desc">Live operational snapshot: lead flow, approval pressure, and channel safety from a single pane.</p>
          </div>
          <Badge tone="info">Last refresh: {lastRefresh}</Badge>
        </div>

        <div className="demo-steps" style={{ marginTop: 10 }}>
          <a className="demo-step active" href="/research">1. Research</a>
          <a className="demo-step" href="/leads">2. Leads</a>
          <a className="demo-step" href="/approvals">3. Approvals</a>
          <a className="demo-step" href="/content">4. Content</a>
          <a className="demo-step" href="/drafts">5. Send</a>
        </div>
      </section>

      {!!alerts.length && (
        <Card title="Operational Alerts" subtitle="Workflow-linked production watchlist">
          <div style={{ display: 'grid', gap: 6 }}>
            {alerts.map((a: any) => (
              <div key={a.key} className="muted">
                <strong style={{ color: a.status === 'warn' ? '#ffd479' : '#8ad6ff' }}>{a.key}</strong> — {a.message}
              </div>
            ))}
          </div>
        </Card>
      )}

      {loading ? (
        <Card title="Loading overview" subtitle="Fetching operational data">
          <SkeletonRows rows={5} />
        </Card>
      ) : (
      <>
      <Card title="Research Agent Status" subtitle="Last run and today discovery">
        <div className="table-toolbar" style={{ justifyContent: 'space-between' }}>
          <span className="muted">Last run: {researchRuns[0]?.createdAt ? new Date(researchRuns[0].createdAt).toLocaleString() : '—'}</span>
          <span className="muted">Leads found today: {leads.filter((l) => String(l.status || '').toUpperCase() === 'RESEARCHED').length}</span>
        </div>
      </Card>

      <section className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {kpis.map((k, i) => (
          <div key={k.label} className={`kpi-card ${i % 4 === 0 ? 'cyan' : i % 4 === 1 ? 'emerald' : i % 4 === 2 ? 'amber' : 'violet'}`}>
            <div className="kpi-label">{k.label}</div>
            <div className={`kpi-value ${i % 4 === 0 ? 'cyan' : i % 4 === 1 ? 'emerald' : i % 4 === 2 ? 'amber' : 'violet'}`}><CountUp value={Number(k.value) || 0} /></div>
            <div className="kpi-delta">{k.meta}</div>
          </div>
        ))}
      </section>

      <section className="split-panels">
        <Card title="Recent Leads" subtitle="Latest pipeline records">
          <Table>
            <thead>
              <tr>
                <th>Business</th>
                <th>Region</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.slice(0, 6).map((l: any) => (
                <tr key={l.id}>
                  <td>{l.businessName || '—'}</td>
                  <td>{l.region || '—'}</td>
                  <td><Badge tone={String(l.status || '').toUpperCase() === 'BOOKED' ? 'success' : 'default'}>{l.status || '—'}</Badge></td>
                </tr>
              ))}
              {!leads.length && (
                <tr>
                  <td colSpan={3} className="muted">No leads yet — import from Campaigns to start the pipeline.</td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>

        <Card title="Recent Drafts" subtitle="Approval workload and readiness">
          <Table>
            <thead>
              <tr>
                <th>Channel</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {drafts.slice(0, 6).map((d: any) => (
                <tr key={d.id}>
                  <td>{d.channel || '—'}</td>
                  <td>{d.draftType || '—'}</td>
                  <td>
                    <Badge tone={String(d.status || '').toUpperCase() === 'APPROVED' ? 'success' : String(d.status || '').toUpperCase() === 'NEEDS_APPROVAL' ? 'warning' : 'default'}>
                      {d.status || '—'}
                    </Badge>
                  </td>
                </tr>
              ))}
              {!drafts.length && (
                <tr>
                  <td colSpan={3} className="muted">No drafts yet — approvals queue will appear once drafts are generated.</td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
      </section>

      <Card title="Today's Activity Summary" subtitle="Sends, replies, bookings">
        <div className="table-toolbar" style={{ justifyContent: 'space-between' }}>
          <span className="muted">Sends today: {sendHistory.filter((s) => s.timestamp && new Date(s.timestamp).toDateString() === new Date().toDateString() && String(s.status).toLowerCase() === 'sent').length}</span>
          <span className="muted">Replies: {leads.filter((l) => String(l.status || '').toUpperCase() === 'REPLIED').length}</span>
          <span className="muted">Bookings: {leads.filter((l) => String(l.status || '').toUpperCase() === 'BOOKED').length}</span>
        </div>
      </Card>

      <Card title="Safety Status" subtitle="Outbound controls and runtime guardrails">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
          <div className="ui-card" style={{ padding: 10 }}>
            <p className="kpi-title">Dry Run</p>
            <Badge tone={safety?.dryRun ? 'success' : 'warning'}>{String(!!safety?.dryRun)}</Badge>
          </div>
          <div className="ui-card" style={{ padding: 10 }}>
            <p className="kpi-title">Email</p>
            <Badge tone={safety?.outbound?.email ? 'success' : 'danger'}>{String(!!safety?.outbound?.email)}</Badge>
          </div>
          <div className="ui-card" style={{ padding: 10 }}>
            <p className="kpi-title">Facebook</p>
            <Badge tone={safety?.outbound?.facebook ? 'success' : 'danger'}>{String(!!safety?.outbound?.facebook)}</Badge>
          </div>
          <div className="ui-card" style={{ padding: 10 }}>
            <p className="kpi-title">Instagram</p>
            <Badge tone={safety?.outbound?.instagram ? 'success' : 'danger'}>{String(!!safety?.outbound?.instagram)}</Badge>
          </div>
          <div className="ui-card" style={{ padding: 10 }}>
            <p className="kpi-title">LinkedIn</p>
            <Badge tone={safety?.outbound?.linkedin ? 'success' : 'danger'}>{String(!!safety?.outbound?.linkedin)}</Badge>
          </div>
        </div>

        <Table>
          <tbody>
            <tr>
              <td>Policy Mode</td>
              <td><Badge>{safety?.mode || 'safe'}</Badge></td>
            </tr>
            <tr>
              <td>Human Approval Required</td>
              <td><Badge tone="success">true</Badge></td>
            </tr>
          </tbody>
        </Table>
      </Card>
      </>
      )}
    </div>
  );
}
