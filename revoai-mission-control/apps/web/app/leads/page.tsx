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
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('search', q.trim());
    if (status) params.set('status', status);
    const url = `${base}/api/leads${params.toString() ? `?${params.toString()}` : ''}`;
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
  }, [q, status]);

  const totalPages = Math.max(1, Math.ceil(leads.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const visibleLeads = leads.slice(start, start + pageSize);

  return (
    <Card title="Leads" subtitle="Live imported leads from /api/leads">
      <div className="table-toolbar" style={{ marginBottom: 12 }}>
        <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search leads" aria-label="Search leads" />
        <select className="ui-input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter status">
          <option value="">All statuses</option>
          <option value="NEW">NEW</option>
          <option value="ENRICHED">ENRICHED</option>
          <option value="DRAFTED">DRAFTED</option>
          <option value="APPROVED">APPROVED</option>
          <option value="CONTACTED">CONTACTED</option>
          <option value="REPLIED">REPLIED</option>
          <option value="BOOKED">BOOKED</option>
          <option value="LOST">LOST</option>
        </select>
        <select className="ui-input" value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} aria-label="Rows per page">
          <option value="10">10 / page</option>
          <option value="25">25 / page</option>
          <option value="50">50 / page</option>
        </select>
      </div>

      {loading ? (
        <p className="muted">Loading leads...</p>
      ) : error ? (
        <p style={{ color: '#ff9b9b' }}>{error}</p>
      ) : !leads.length ? (
        <p className="muted">No leads found. Import CSV from Campaigns → Upload Center.</p>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            Showing {leads.length ? start + 1 : 0}-{Math.min(start + pageSize, leads.length)} of {leads.length} leads
          </p>
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
              {visibleLeads.map((l: any) => (
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

          <div className="table-toolbar" style={{ marginTop: 12 }}>
            <button className="ui-input" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>
              Prev
            </button>
            <span className="muted">Page {safePage} / {totalPages}</span>
            <button className="ui-input" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
              Next
            </button>
          </div>
        </>
      )}
    </Card>
  );
}
