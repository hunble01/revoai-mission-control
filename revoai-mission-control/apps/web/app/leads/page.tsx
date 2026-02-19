'use client';
import { useEffect, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Table } from '../../components/ui/Table';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [q, setQ] = useState('');

  const load = () => {
    const url = `${base}/api/leads${q ? `?search=${encodeURIComponent(q)}` : ''}`;
    fetch(url, { headers: { 'x-admin-token': token } })
      .then((r) => r.json())
      .then((d) => setLeads(d || []));
  };

  useEffect(() => {
    load();
  }, [q]);

  return (
    <Card title="Leads" subtitle="Prospect list and qualification status">
      <div className="table-toolbar" style={{ marginBottom: 12 }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search leads" aria-label="Search leads" />
      </div>

      <Table>
        <thead>
          <tr>
            <th>Business</th>
            <th>Region</th>
            <th>Score</th>
            <th>Status</th>
            <th>Campaign</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l: any) => (
            <tr key={l.id}>
              <td>{l.businessName}</td>
              <td>{l.region || '—'}</td>
              <td>{l.scoreOverride || l.leadScore || '—'}</td>
              <td><Badge tone={l.status === 'QUALIFIED' ? 'success' : 'default'}>{l.status}</Badge></td>
              <td>{l.campaignId || '—'}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
