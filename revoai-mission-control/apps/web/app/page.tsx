'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

export default function Home() {
  const [leads, setLeads] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [safety, setSafety] = useState<any>(null);

  useEffect(() => {
    const headers = { 'x-admin-token': token };
    Promise.all([
      fetch(`${base}/api/leads`, { headers }).then((r) => r.json()).catch(() => []),
      fetch(`${base}/api/drafts`, { headers }).then((r) => r.json()).catch(() => []),
      fetch(`${base}/api/settings/safety`, { headers }).then((r) => r.json()).catch(() => null),
    ]).then(([l, d, s]) => {
      setLeads(Array.isArray(l) ? l : []);
      setDrafts(Array.isArray(d) ? d : []);
      setSafety(s);
    });
  }, []);

  const kpis = useMemo(() => {
    const statusCount = (value: string) => leads.filter((l) => String(l.status || '').toUpperCase() === value).length;
    const approved = drafts.filter((d) => String(d.status || '').toUpperCase() === 'APPROVED').length;
    const needsApproval = drafts.filter((d) => String(d.status || '').toUpperCase() === 'NEEDS_APPROVAL').length;

    return [
      { label: 'Total Leads', value: String(leads.length), meta: 'Inbound records' },
      { label: 'Qualified', value: String(statusCount('QUALIFIED')), meta: 'High intent' },
      { label: 'Contacted', value: String(statusCount('CONTACTED')), meta: 'Active follow-up' },
      { label: 'Booked', value: String(statusCount('BOOKED')), meta: 'Appointments won' },
      { label: 'Approved Drafts', value: String(approved), meta: 'Ready to send' },
      { label: 'Needs Approval', value: String(needsApproval), meta: 'Queue pressure' },
    ];
  }, [leads, drafts]);

  return (
    <div className="dash-stack">
      <section className="page-hero" style={{ paddingBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <h3>Mission Control Overview</h3>
            <p>Live operational snapshot: lead flow, approval pressure, and channel safety from a single pane.</p>
          </div>
          <Badge tone="info">Last refresh: {new Date().toLocaleTimeString()}</Badge>
        </div>

        <div className="demo-steps" style={{ marginTop: 10 }}>
          <a className="demo-step active" href="/campaigns">1. Import (Campaigns)</a>
          <a className="demo-step" href="/leads">2. Leads</a>
          <a className="demo-step" href="/approvals">3. Approvals</a>
          <a className="demo-step" href="/campaigns">4. Campaign Loop</a>
        </div>
      </section>

      <section className="kpi-grid" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
        {kpis.map((k) => (
          <Card key={k.label}>
            <p className="kpi-title">{k.label}</p>
            <p className="kpi-value" style={{ fontSize: 30 }}>{k.value}</p>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>{k.meta}</p>
          </Card>
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
              <td><Badge tone={safety?.requireApproval ? 'warning' : 'default'}>{String(!!safety?.requireApproval)}</Badge></td>
            </tr>
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
