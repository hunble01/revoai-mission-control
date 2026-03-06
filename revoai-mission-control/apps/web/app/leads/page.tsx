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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const url = `${base}/api/leads${q ? `?search=${encodeURIComponent(q)}` : ''}`;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(url, { headers: { 'x-admin-token': token } });
      if (!res.ok) throw new Error(`Failed to load leads (HTTP ${res.status})`);
      const d = await res.json();
      setLeads(Array.isArray(d) ? d : []);
    } catch (err: any) {
      setLeads([]);
      setError(err?.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [q]);

  return (
    <Card title="Leads" subtitle="Live imported leads from /api/leads">
      <div className="table-toolbar" style={{ marginBottom: 12 }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search leads" aria-label="Search leads" />
      </div>

      {loading ? (
        <p className="muted">Loading leads...</p>
      ) : error ? (
        <p style={{ color: '#ff9b9b' }}>{error}</p>
      ) : !leads.length ? (
        <p className="muted">No leads found. Import CSV from Campaigns → Upload Center.</p>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 0 }}>Showing first {Math.min(leads.length, 10)} of {leads.length} leads</p>
          <Table>
            <thead>
              <tr>
                <th>Business</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Source</th>
                <th>Status</th>
                <th>Campaign</th>
              </tr>
            </thead>
            <tbody>
              {leads.slice(0, 10).map((l: any) => (
                <tr key={l.id}>
                  <td>{l.businessName || '—'}</td>
                  <td>{l.contactName || '—'}</td>
                  <td>{l.email || '—'}</td>
                  <td>{l.phone || '—'}</td>
                  <td>{l.source || '—'}</td>
                  <td><Badge tone={l.status === 'QUALIFIED' ? 'success' : 'default'}>{l.status || 'NEW'}</Badge></td>
                  <td>{l.campaignId || '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </Card>
  );
}
