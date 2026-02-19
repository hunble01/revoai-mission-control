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
    const approved = drafts.filter((d) => d.status === 'APPROVED').length;
    const pending = drafts.filter((d) => d.status === 'PENDING_APPROVAL').length;
    const qualified = leads.filter((l) => String(l.status || '').toUpperCase() === 'QUALIFIED').length;
    return [
      { label: 'Total Leads', value: String(leads.length) },
      { label: 'Qualified Leads', value: String(qualified) },
      { label: 'Approved Drafts', value: String(approved) },
      { label: 'Pending Approvals', value: String(pending) },
    ];
  }, [leads, drafts]);

  return (
    <div className="dash-stack">
      <section className="kpi-grid">
        {kpis.map((k) => (
          <Card key={k.label}>
            <p className="kpi-title">{k.label}</p>
            <p className="kpi-value">{k.value}</p>
          </Card>
        ))}
      </section>

      <section className="split-panels">
        <Card title="Recent Leads" subtitle="Existing lead data">
          <Table>
            <thead>
              <tr>
                <th>Business</th>
                <th>Region</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.slice(0, 5).map((l: any) => (
                <tr key={l.id}>
                  <td>{l.businessName}</td>
                  <td>{l.region || '—'}</td>
                  <td><Badge>{l.status || '—'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card title="Recent Drafts" subtitle="Existing draft data">
          <Table>
            <thead>
              <tr>
                <th>Channel</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {drafts.slice(0, 5).map((d: any) => (
                <tr key={d.id}>
                  <td>{d.channel}</td>
                  <td>{d.draftType}</td>
                  <td>
                    <Badge tone={d.status === 'APPROVED' ? 'success' : 'default'}>{d.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </section>

      <Card title="Safety Status" subtitle="Current Mission Control safety settings">
        <Table>
          <tbody>
            <tr>
              <td>Dry Run</td>
              <td><Badge tone={safety?.dryRun ? 'success' : 'warning'}>{String(!!safety?.dryRun)}</Badge></td>
            </tr>
            <tr>
              <td>Email Enabled</td>
              <td><Badge>{String(!!safety?.outbound?.email)}</Badge></td>
            </tr>
            <tr>
              <td>Facebook Enabled</td>
              <td><Badge>{String(!!safety?.outbound?.facebook)}</Badge></td>
            </tr>
            <tr>
              <td>Instagram Enabled</td>
              <td><Badge>{String(!!safety?.outbound?.instagram)}</Badge></td>
            </tr>
            <tr>
              <td>LinkedIn Enabled</td>
              <td><Badge>{String(!!safety?.outbound?.linkedin)}</Badge></td>
            </tr>
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
