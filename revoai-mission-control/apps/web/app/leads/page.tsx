'use client';
import { useEffect, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';

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
  const [savingLeadId, setSavingLeadId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [showAddLead, setShowAddLead] = useState(false);
  const [newLead, setNewLead] = useState({ campaignId: '', businessName: '', email: '' });
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState('NEW');
  const [bulkCampaignId, setBulkCampaignId] = useState('');

  const load = async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('search', q.trim());
    if (status) params.set('status', status);
    const url = `${base}/api/leads${params.toString() ? `?${params.toString()}` : ''}`;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(url, { credentials: 'include', headers: { 'x-admin-token': token } });
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

  useEffect(() => {
    fetch(`${base}/api/campaigns`, { credentials: 'include', headers: { 'x-admin-token': token } })
      .then((r) => r.json())
      .then((d) => {
        const rows = Array.isArray(d) ? d : [];
        setCampaigns(rows);
        const active = rows.find((c: any) => c.isActive) || rows[0];
        if (active) {
          setNewLead((curr) => ({ ...curr, campaignId: curr.campaignId || active.id }));
          setBulkCampaignId((curr) => curr || active.id);
        }
      })
      .catch(() => setCampaigns([]));
  }, []);

  const updateLeadStatus = async (leadId: string, nextStatus: string) => {
    const prev = leads;
    setSaveMessage('');
    setSavingLeadId(leadId);

    setLeads((curr) => curr.map((l: any) => (l.id === leadId ? { ...l, status: nextStatus } : l)));

    try {
      const res = await fetch(`${base}/api/leads/${leadId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
          'x-actor-role': 'admin',
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error(`Failed to update lead status (HTTP ${res.status})`);
      setSaveMessage('Status updated.');
    } catch (err: any) {
      setLeads(prev);
      setSaveMessage(err?.message || 'Failed to update status.');
    } finally {
      setSavingLeadId(null);
    }
  };

  const updatePreferredChannel = async (leadId: string, preferredChannel: 'EMAIL' | 'LINKEDIN') => {
    const prev = leads;
    setSaveMessage('');
    setSavingLeadId(leadId);
    setLeads((curr) => curr.map((l: any) => (l.id === leadId ? { ...l, preferredChannel } : l)));
    try {
      const res = await fetch(`${base}/api/leads/${leadId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
          'x-actor-role': 'admin',
        },
        body: JSON.stringify({ preferredChannel }),
      });
      if (!res.ok) throw new Error(`Failed to update preferred channel (HTTP ${res.status})`);
      setSaveMessage('Preferred channel updated.');
    } catch (err: any) {
      setLeads(prev);
      setSaveMessage(err?.message || 'Failed to update preferred channel.');
    } finally {
      setSavingLeadId(null);
    }
  };

  const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || '').trim());

  const createLead = async () => {
    setSaveMessage('');
    setError('');
    if (!isUuid(newLead.campaignId) || !newLead.businessName.trim() || !newLead.email.trim()) {
      setError('Valid Campaign, Business Name, and Email are required.');
      return;
    }
    try {
      const res = await fetch(`${base}/api/leads`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
        body: JSON.stringify({
          campaignId: newLead.campaignId,
          businessName: newLead.businessName.trim(),
          email: newLead.email.trim(),
          status: 'NEW',
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message || `Failed to create lead (HTTP ${res.status})`);
      }
      setSaveMessage('Lead created.');
      setNewLead((curr) => ({ ...curr, businessName: '', email: '' }));
      setShowAddLead(false);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to create lead');
    }
  };

  const enrichLead = async (leadId: string) => {
    setSaveMessage('');
    setError('');
    try {
      const res = await fetch(`${base}/api/leads/${leadId}/enrich`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-admin-token': token, 'x-actor-role': 'admin' },
      });
      if (!res.ok) throw new Error(`Failed to enrich lead (HTTP ${res.status})`);
      setSaveMessage('Lead enriched.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to enrich lead');
    }
  };

  const applyBulkUpdates = async () => {
    if (!selectedLeadIds.length) return;
    setSaveMessage('');
    setError('');
    try {
      await Promise.all(selectedLeadIds.map(async (id) => {
        await fetch(`${base}/api/leads/${id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-token': token,
            'x-actor-role': 'admin',
          },
          body: JSON.stringify({ status: bulkStatus, campaignId: bulkCampaignId || undefined }),
        });
      }));
      setSaveMessage(`Updated ${selectedLeadIds.length} leads.`);
      setSelectedLeadIds([]);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Bulk update failed');
    }
  };

  const totalPages = Math.max(1, Math.ceil(leads.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const visibleLeads = leads.slice(start, start + pageSize);

  return (
    <div className="dash-stack">
      <section className="page-hero">
        <h3>Leads Qualification & Routing</h3>
        <p>Second demo stage: review imported leads, filter, and update status with immediate feedback.</p>
        <div className="demo-steps">
          <span className="demo-step">1. Import</span>
          <span className="demo-step active">2. Leads</span>
          <span className="demo-step">3. Approvals</span>
          <span className="demo-step">4. Campaign Loop</span>
        </div>
      </section>

      <Card title="Leads" subtitle="Live imported leads from /api/leads">
      <div className="table-toolbar" style={{ marginBottom: 12 }}>
        <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search leads" aria-label="Search leads" />
        <select className="ui-input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter status">
          <option value="">All statuses</option>
          <option value="NEW">NEW</option>
          <option value="ENRICHED">ENRICHED</option>
          <option value="DRAFTED">DRAFTED</option>
          <option value="APPROVED">APPROVED</option>
          <option value="RESEARCHED">RESEARCHED</option>
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
        <Button variant="primary" onClick={() => setShowAddLead((v) => !v)}>
          {showAddLead ? 'Cancel' : 'Add Lead'}
        </Button>
      </div>

      {showAddLead && (
        <div className="table-toolbar" style={{ marginBottom: 12 }}>
          <select className="ui-input" value={newLead.campaignId} onChange={(e) => setNewLead((curr) => ({ ...curr, campaignId: e.target.value }))}>
            {campaigns.length === 0 && <option value="">No campaign available</option>}
            {campaigns.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <Input value={newLead.businessName} onChange={(e) => setNewLead((curr) => ({ ...curr, businessName: e.target.value }))} placeholder="Business name" />
          <Input value={newLead.email} onChange={(e) => setNewLead((curr) => ({ ...curr, email: e.target.value }))} placeholder="Email" />
          <Button
            variant="primary"
            onClick={createLead}
            disabled={!isUuid(newLead.campaignId) || !newLead.businessName.trim() || !newLead.email.trim()}
          >
            Create
          </Button>
        </div>
      )}

      <div className="table-toolbar" style={{ marginBottom: 12 }}>
        <span className="muted">Selected: {selectedLeadIds.length}</span>
        <select className="ui-input" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
          <option value="NEW">NEW</option>
          <option value="ENRICHED">ENRICHED</option>
          <option value="RESEARCHED">RESEARCHED</option>
          <option value="DRAFTED">DRAFTED</option>
          <option value="APPROVED">APPROVED</option>
          <option value="CONTACTED">CONTACTED</option>
          <option value="REPLIED">REPLIED</option>
          <option value="BOOKED">BOOKED</option>
          <option value="LOST">LOST</option>
        </select>
        <select className="ui-input" value={bulkCampaignId} onChange={(e) => setBulkCampaignId(e.target.value)}>
          {campaigns.map((c: any) => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </select>
        <Button variant="secondary" onClick={applyBulkUpdates} disabled={!selectedLeadIds.length}>Apply Bulk Update</Button>
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
          {!!saveMessage && <p className="muted" style={{ marginTop: 6 }}>{saveMessage}</p>}
          <Table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={visibleLeads.length > 0 && visibleLeads.every((l: any) => selectedLeadIds.includes(l.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const merged = Array.from(new Set([...selectedLeadIds, ...visibleLeads.map((l: any) => l.id)]));
                        setSelectedLeadIds(merged as string[]);
                      } else {
                        setSelectedLeadIds(selectedLeadIds.filter((id) => !visibleLeads.some((l: any) => l.id === id)));
                      }
                    }}
                  />
                </th>
                <th>Business</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Source</th>
                <th>LinkedIn</th>
                <th>Preferred</th>
                <th>Status</th>
                <th>Update</th>
                <th>Enrich</th>
                <th>Campaign</th>
              </tr>
            </thead>
            <tbody>
              {visibleLeads.map((l: any) => (
                <tr key={l.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.includes(l.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedLeadIds((curr) => Array.from(new Set([...curr, l.id])) as string[]);
                        else setSelectedLeadIds((curr) => curr.filter((id) => id !== l.id));
                      }}
                    />
                  </td>
                  <td>{l.businessName || '—'}</td>
                  <td>{l.contactName || '—'}</td>
                  <td>{l.email || '—'}</td>
                  <td>{l.phone || '—'}</td>
                  <td><Badge tone={(String(l.source || '').toLowerCase().includes('research') || String(l.source || '').toLowerCase().includes('agent')) ? 'info' : (String(l.source || '').toLowerCase().includes('csv') ? 'warning' : 'default')}>{l.source || 'Manual'}</Badge></td>
                  <td>{l.linkedinUrl || '—'}</td>
                  <td>
                    <select
                      className="ui-input"
                      aria-label={`Preferred channel for ${l.businessName || l.id}`}
                      value={l.preferredChannel || 'EMAIL'}
                      disabled={savingLeadId === l.id}
                      onChange={(e) => updatePreferredChannel(l.id, e.target.value as 'EMAIL' | 'LINKEDIN')}
                    >
                      <option value="EMAIL">EMAIL</option>
                      <option value="LINKEDIN">LINKEDIN</option>
                    </select>
                  </td>
                  <td><Badge tone={l.status === 'QUALIFIED' ? 'success' : 'default'}>{l.status || 'NEW'}</Badge></td>
                  <td>
                    <select
                      className="ui-input"
                      aria-label={`Update status for ${l.businessName || l.id}`}
                      value={l.status || 'NEW'}
                      disabled={savingLeadId === l.id}
                      onChange={(e) => updateLeadStatus(l.id, e.target.value)}
                    >
                      <option value="NEW">NEW</option>
                      <option value="ENRICHED">ENRICHED</option>
                      <option value="RESEARCHED">RESEARCHED</option>
                      <option value="DRAFTED">DRAFTED</option>
                      <option value="APPROVED">APPROVED</option>
                      <option value="CONTACTED">CONTACTED</option>
                      <option value="REPLIED">REPLIED</option>
                      <option value="BOOKED">BOOKED</option>
                      <option value="LOST">LOST</option>
                    </select>
                  </td>
                  <td><Button variant="secondary" onClick={() => enrichLead(l.id)}>Enrich</Button></td>
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
    </div>
  );
}
