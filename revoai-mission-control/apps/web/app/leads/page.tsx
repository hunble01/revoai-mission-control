'use client';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { SkeletonRows } from '../../components/ui/Skeleton';

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
  const [newLead, setNewLead] = useState({ campaignId: '', businessName: '', contactName: '', email: '', phone: '', linkedinUrl: '', city: '', notes: '' });
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState('NEW');
  const [bulkCampaignId, setBulkCampaignId] = useState('');
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [leadNotes, setLeadNotes] = useState('');
  const [enrichingSelected, setEnrichingSelected] = useState(false);

  const toast = (type: 'success' | 'error' | 'info' | 'warning', text: string) => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('app-toast', { detail: { type, text } }));
  };

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
      const msg = String(err?.message || '');
      setLeads([]);
      if (msg.includes('401')) setError('');
      else setError(msg || 'Failed to load leads');
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
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token, 'x-actor-role': 'admin' },
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
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token, 'x-actor-role': 'admin' },
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
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({
          campaignId: newLead.campaignId,
          businessName: newLead.businessName.trim(),
          contactName: newLead.contactName.trim() || undefined,
          email: newLead.email.trim(),
          phone: newLead.phone.trim() || undefined,
          linkedinUrl: newLead.linkedinUrl.trim() || undefined,
          region: newLead.city.trim() || undefined,
          notes: newLead.notes.trim() || undefined,
          status: 'NEW',
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message || `Failed to create lead (HTTP ${res.status})`);
      }
      setSaveMessage('Lead created.');
      setNewLead((curr) => ({ ...curr, businessName: '', contactName: '', email: '', phone: '', linkedinUrl: '', city: '', notes: '' }));
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
        method: 'POST', credentials: 'include', headers: { 'x-admin-token': token, 'x-actor-role': 'admin' },
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
          headers: { 'Content-Type': 'application/json', 'x-admin-token': token, 'x-actor-role': 'admin' },
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

  const enrichSelected = async () => {
    if (!selectedLeadIds.length) return;
    setEnrichingSelected(true);
    try {
      await Promise.all(selectedLeadIds.map((id) => fetch(`${base}/api/leads/${id}/enrich`, { method: 'POST', credentials: 'include', headers: { 'x-admin-token': token, 'x-actor-role': 'admin' } })));
      toast('success', `Enriched ${selectedLeadIds.length} leads`);
      await load();
    } catch {
      toast('error', 'Failed to enrich selected leads');
    } finally {
      setEnrichingSelected(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(leads.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const visibleLeads = leads.slice(start, start + pageSize);

  const campaignNameFor = (id?: string) => campaigns.find((c: any) => c.id === id)?.name || '—';
  const sourceTone = (s?: string) => {
    const x = String(s || '').toLowerCase();
    if (x.includes('research_agent') || x.includes('research')) return 'info';
    if (x.includes('csv')) return 'warning';
    if (x.includes('hunter')) return 'success';
    if (x.includes('apollo')) return 'info';
    return 'default';
  };
  const statusTone = (s?: string) => {
    const x = String(s || '').toUpperCase();
    if (x === 'ENRICHED' || x === 'RESEARCHED') return 'info';
    if (x === 'DRAFTED') return 'info';
    if (x === 'CONTACTED') return 'warning';
    if (x === 'REPLIED' || x === 'BOOKED') return 'success';
    if (x === 'LOST') return 'default';
    return 'default';
  };

  const kpis = [
    { label: 'Researched', key: 'RESEARCHED', color: 'var(--cyan)' },
    { label: 'Drafted', key: 'DRAFTED', color: 'var(--violet)' },
    { label: 'Contacted', key: 'CONTACTED', color: 'var(--amber)' },
    { label: 'Replied', key: 'REPLIED', color: 'var(--emerald)' },
    { label: 'Booked', key: 'BOOKED', color: 'var(--rose)' },
  ];

  return (
    <div className="dash-stack fade-in">
      <section className="page-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="page-eyebrow">PIPELINE / LEADS</div>
          <h2 className="page-title" style={{ margin: 0 }}>Lead Management</h2>
          <p className="page-desc">Review, enrich, route, and bulk-update sourced leads before outreach.</p>
        </div>
        <div className="table-toolbar" style={{ alignSelf: 'flex-start' }}>
          <Button variant="secondary" onClick={enrichSelected} disabled={!selectedLeadIds.length || enrichingSelected}>{enrichingSelected ? 'Enriching…' : '⊕ Enrich Selected'}</Button>
          <Button variant="primary" onClick={() => setShowAddLead(true)}>+ Add Lead</Button>
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {kpis.map((k) => (
          <div key={k.key} onClick={() => { setStatus(k.key); setPage(1); }} style={{ cursor: 'pointer', flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{leads.filter((l) => String(l.status || '').toUpperCase() === k.key).length}</div>
            <div className="text-xs mono text-dim" style={{ marginTop: 3 }}>{k.label.toUpperCase()}</div>
          </div>
        ))}
      </div>

      <Card title="Leads" subtitle="Live imported leads from /api/leads">
        <div className="table-toolbar" style={{ marginBottom: 12 }}>
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search leads" />
          <select className="ui-input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="NEW">NEW</option><option value="ENRICHED">ENRICHED</option><option value="RESEARCHED">RESEARCHED</option><option value="DRAFTED">DRAFTED</option><option value="CONTACTED">CONTACTED</option><option value="REPLIED">REPLIED</option><option value="BOOKED">BOOKED</option><option value="LOST">LOST</option>
          </select>
          <select className="ui-input" value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            <option value="10">10 / page</option><option value="25">25 / page</option><option value="50">50 / page</option>
          </select>
        </div>

        {selectedLeadIds.length > 0 && (
          <div className="table-toolbar" style={{ marginBottom: 12 }}>
            <span className="muted">{selectedLeadIds.length} leads selected</span>
            <select className="ui-input" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
              <option value="NEW">NEW</option><option value="ENRICHED">ENRICHED</option><option value="RESEARCHED">RESEARCHED</option><option value="DRAFTED">DRAFTED</option><option value="APPROVED">APPROVED</option><option value="CONTACTED">CONTACTED</option><option value="REPLIED">REPLIED</option><option value="BOOKED">BOOKED</option><option value="LOST">LOST</option>
            </select>
            <Button variant="secondary" onClick={applyBulkUpdates}>Apply Bulk Update</Button>
          </div>
        )}

        {loading ? <SkeletonRows rows={5} /> : error ? <p style={{ color: '#ff9b9b' }}>{error}</p> : !leads.length ? <p className="muted">No leads found.</p> : (
          <>
            {!!saveMessage && <p className="muted">{saveMessage}</p>}
            <Table>
              <thead>
                <tr>
                  <th><input type="checkbox" checked={visibleLeads.length > 0 && visibleLeads.every((l: any) => selectedLeadIds.includes(l.id))} onChange={(e) => {
                    if (e.target.checked) setSelectedLeadIds(Array.from(new Set([...selectedLeadIds, ...visibleLeads.map((l: any) => l.id)])) as string[]);
                    else setSelectedLeadIds(selectedLeadIds.filter((id) => !visibleLeads.some((l: any) => l.id === id)));
                  }} /></th>
                  <th>Business</th><th>Contact</th><th>Email</th><th>Phone</th><th>Campaign</th><th>Source</th><th>Fit</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleLeads.map((l: any) => (
                  <tr key={l.id} onClick={() => { setSelectedLead(l); setLeadNotes(l.notes || ''); }} style={{ cursor: 'pointer' }}>
                    <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedLeadIds.includes(l.id)} onChange={(e) => e.target.checked ? setSelectedLeadIds((c) => Array.from(new Set([...c, l.id])) as string[]) : setSelectedLeadIds((c) => c.filter((x) => x !== l.id))} /></td>
                    <td>{l.businessName || 'Unknown'}</td>
                    <td>{l.contactName || '—'}</td>
                    <td title={l.email || ''}>{l.email ? (l.email.length > 28 ? `${l.email.slice(0, 28)}…` : l.email) : '—'}</td>
                    <td>{l.phone || '—'}</td>
                    <td>{campaignNameFor(l.campaignId)}</td>
                    <td><Badge tone={sourceTone(l.source)}>{l.source || 'Manual'}</Badge></td>
                    <td><Badge tone={String(l.fitScore || '').toLowerCase() === 'high' ? 'success' : String(l.fitScore || '').toLowerCase() === 'medium' ? 'warning' : 'default'}>{l.fitScore || 'Low'}</Badge></td>
                    <td><Badge tone={statusTone(l.status)}>{l.status || 'NEW'}</Badge></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Button variant="secondary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => {
                        fetch(`${base}/api/drafts`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'x-admin-token': token }, body: JSON.stringify({ leadId: l.id }) })
                          .then((r) => { if (!r.ok) throw new Error(); toast('success', 'Draft created — review in Approvals'); })
                          .catch(() => toast('error', 'Failed to create draft'));
                      }}>Draft</Button>{' '}
                      <Button variant="secondary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => { setSelectedLead(l); setLeadNotes(l.notes || ''); }}>View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="table-toolbar" style={{ marginTop: 12 }}>
              <button className="ui-input" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>Prev</button>
              <span className="muted">Page {safePage} / {totalPages}</span>
              <button className="ui-input" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>Next</button>
            </div>
          </>
        )}
      </Card>

      {showAddLead && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 7000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 620, background: '#0D1117', border: '1px solid #1C2333', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #1C2333' }}><strong>Add Lead</strong></div>
            <div style={{ padding: 16, display: 'grid', gap: 10 }}>
              <Input value={newLead.businessName} onChange={(e) => setNewLead((n) => ({ ...n, businessName: e.target.value }))} placeholder="Business Name *" />
              <Input value={newLead.contactName} onChange={(e) => setNewLead((n) => ({ ...n, contactName: e.target.value }))} placeholder="Contact Name" />
              <Input value={newLead.email} onChange={(e) => setNewLead((n) => ({ ...n, email: e.target.value }))} placeholder="Email *" />
              <Input value={newLead.phone} onChange={(e) => setNewLead((n) => ({ ...n, phone: e.target.value }))} placeholder="Phone" />
              <Input value={newLead.linkedinUrl} onChange={(e) => setNewLead((n) => ({ ...n, linkedinUrl: e.target.value }))} placeholder="LinkedIn URL" />
              <Input value={newLead.city} onChange={(e) => setNewLead((n) => ({ ...n, city: e.target.value }))} placeholder="City" />
              <select className="ui-input" value={newLead.campaignId} onChange={(e) => setNewLead((n) => ({ ...n, campaignId: e.target.value }))}>
                <option value="">Select Campaign *</option>
                {campaigns.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <textarea className="ui-input" rows={3} value={newLead.notes} onChange={(e) => setNewLead((n) => ({ ...n, notes: e.target.value }))} placeholder="Notes" />
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid #1C2333', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="secondary" onClick={() => setShowAddLead(false)}>Cancel</Button>
              <Button variant="primary" onClick={createLead}>Create Lead</Button>
            </div>
          </div>
        </div>
      )}

      <>
        <div style={{ position: 'fixed', inset: 0, background: selectedLead ? 'rgba(0,0,0,0.4)' : 'transparent', zIndex: selectedLead ? 7999 : -1, pointerEvents: selectedLead ? 'auto' : 'none' }} onClick={() => setSelectedLead(null)} />
        <aside style={{ position: 'fixed', right: 0, top: 0, height: '100vh', width: 420, background: '#0D1117', borderLeft: '1px solid #1C2333', zIndex: 8000, display: 'flex', flexDirection: 'column', transform: selectedLead ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.25s ease' }}>
          <div style={{ padding: 16, borderBottom: '1px solid #1C2333', display: 'flex', justifyContent: 'space-between' }}>
            <div><div style={{ fontWeight: 700 }}>{selectedLead?.businessName || 'Unknown'}</div><div className="muted">{selectedLead?.contactName || '—'}</div></div>
            <Button variant="secondary" onClick={() => setSelectedLead(null)}>✕</Button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'grid', gap: 16 }}>
            <div>
              <div className="page-eyebrow">CONTACT INFO</div>
              <div>{selectedLead?.email || '—'}</div>
              <div>{selectedLead?.phone || '—'}</div>
              <div>{selectedLead?.linkedinUrl && String(selectedLead?.linkedinUrl).includes('linkedin.com/in/') ? <a href={selectedLead?.linkedinUrl} target="_blank">LinkedIn profile</a> : 'No profile found'}</div>
              <div>{selectedLead?.region || '—'}</div>
              <div>{campaignNameFor(selectedLead?.campaignId)}</div>
            </div>
            <div>
              <div className="page-eyebrow">DETAILS</div>
              <Badge tone={sourceTone(selectedLead?.source)}>{selectedLead?.source || 'Manual'}</Badge>{' '}
              <Badge tone={String(selectedLead?.fitScore || '').toLowerCase() === 'high' ? 'success' : String(selectedLead?.fitScore || '').toLowerCase() === 'medium' ? 'warning' : 'default'}>{selectedLead?.fitScore || 'Low'}</Badge>{' '}
              <Badge tone={statusTone(selectedLead?.status)}>{selectedLead?.status || 'NEW'}</Badge>
            </div>
            <div>
              <div className="page-eyebrow">NOTES</div>
              <textarea className="ui-input" rows={4} value={leadNotes} onChange={(e) => setLeadNotes(e.target.value)} onBlur={async () => {
                if (!selectedLead?.id) return;
                await fetch(`${base}/api/leads/${selectedLead.id}`, {
                  method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json', 'x-admin-token': token, 'x-actor-role': 'admin' }, body: JSON.stringify({ notes: leadNotes }),
                });
                setLeads((curr) => curr.map((l) => l.id === selectedLead.id ? { ...l, notes: leadNotes } : l));
              }} />
            </div>
            <div>
              <div className="page-eyebrow">TIMELINE</div>
              <div className="muted">Lead created • {selectedLead?.createdAt ? new Date(selectedLead.createdAt).toLocaleString() : '—'}</div>
              {String(selectedLead?.status || '').toUpperCase() !== 'NEW' && <div className="muted">Status changed • {selectedLead?.status}</div>}
            </div>
          </div>
          <div style={{ padding: 16, borderTop: '1px solid #1C2333', display: 'flex', gap: 8 }}>
            <Button variant="primary" onClick={() => selectedLead?.id && fetch(`${base}/api/drafts`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'x-admin-token': token }, body: JSON.stringify({ leadId: selectedLead.id }) }).then((r) => { if (!r.ok) throw new Error(); toast('success', 'Draft created — review in Approvals'); }).catch(() => toast('error', 'Draft failed'))}>Draft Outreach</Button>
            <Button variant="secondary" onClick={() => selectedLead?.id && enrichLead(selectedLead.id)}>Enrich</Button>
            <Button variant="ghost" style={{ border: '1px solid rgba(255,91,122,0.3)', color: '#FF5B7A' }} onClick={() => {
              if (!selectedLead?.id) return;
              if (!confirm('Delete this lead?')) return;
              fetch(`${base}/api/leads/${selectedLead.id}`, { method: 'DELETE', credentials: 'include', headers: { 'x-admin-token': token } })
                .then(() => {
                  setLeads((curr) => curr.filter((x) => x.id !== selectedLead.id));
                  setSelectedLead(null);
                  toast('success', 'Lead deleted');
                })
                .catch(() => toast('error', 'Delete failed'));
            }}>Delete</Button>
          </div>
        </aside>
      </>
    </div>
  );
}
