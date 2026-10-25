'use client';
import { useEffect, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { SkeletonRows } from '../../components/ui/Skeleton';

import { API_BASE, apiHeaders } from '../../lib/api';

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
  const [replyAssistOpen, setReplyAssistOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyAnalysis, setReplyAnalysis] = useState<any | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [applyingAction, setApplyingAction] = useState<string | null>(null);
  const [replyHistory, setReplyHistory] = useState<any[]>([]);
  const [leadNotes, setLeadNotes] = useState('');
  const [enrichingSelected, setEnrichingSelected] = useState(false);

  const toast = (type: 'success' | 'error' | 'info' | 'warning', text: string) => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('app-toast', { detail: { type, text } }));
  };

  const load = async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('search', q.trim());
    if (status) params.set('status', status);
    const url = `${API_BASE}/api/leads${params.toString() ? `?${params.toString()}` : ''}`;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(url, { credentials: 'include', headers: apiHeaders });
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
    fetch(`${API_BASE}/api/campaigns`, { credentials: 'include', headers: apiHeaders })
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
      const res = await fetch(`${API_BASE}/api/leads/${leadId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: apiHeaders,
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
      const res = await fetch(`${API_BASE}/api/leads/${leadId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: apiHeaders,
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
      const res = await fetch(`${API_BASE}/api/leads`, {
        method: 'POST',
        credentials: 'include',
        headers: apiHeaders,
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
      const res = await fetch(`${API_BASE}/api/leads/${leadId}/enrich`, {
        method: 'POST', credentials: 'include', headers: apiHeaders,
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
        await fetch(`${API_BASE}/api/leads/${id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: apiHeaders,
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

  const createDraftForLead = async (lead: any) => {
    try {
      const draftRes = await fetch(`${API_BASE}/api/leads/${lead.id}/generate-draft`, {
        method: 'POST',
        credentials: 'include',
        headers: apiHeaders,
        body: JSON.stringify({ channel: lead.preferredChannel || 'EMAIL' }),
      });
      const draftData = await draftRes.json().catch(() => ({}));
      if (!draftRes.ok) throw new Error(draftData?.error?.message || draftData?.message || `Draft failed (HTTP ${draftRes.status})`);

      await load();
      if (selectedLead?.id === lead.id) {
        setSelectedLead((curr: any) => (curr ? { ...curr, status: 'DRAFTED' } : curr));
      }
      toast('success', 'Draft generated — review in Approvals');
    } catch (e: any) {
      toast('error', e?.message || 'Draft failed');
    }
  };

  const enrichSelected = async () => {
    if (!selectedLeadIds.length) return;
    setEnrichingSelected(true);
    try {
      await Promise.all(selectedLeadIds.map((id) => fetch(`${API_BASE}/api/leads/${id}/enrich`, { method: 'POST', credentials: 'include', headers: apiHeaders })));
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
          <Button variant="secondary" style={{ border: '1px solid rgba(10,122,191,0.4)', color: '#0A7ABF' }} disabled={!selectedLeadIds.length} onClick={async () => {
            if (!selectedLeadIds.length) return;
            if (!confirm(`Draft LinkedIn DMs for ${selectedLeadIds.length} selected lead${selectedLeadIds.length === 1 ? '' : 's'}? Skips leads without a LinkedIn URL, leads already in the queue, and anyone email-unsubscribed.`)) return;
            try {
              const res = await fetch(`${API_BASE}/api/leads/bulk-draft-linkedin-dm`, {
                method: 'POST', credentials: 'include', headers: apiHeaders,
                body: JSON.stringify({ leadIds: selectedLeadIds }),
              });
              const j = await res.json();
              if (!res.ok) throw new Error(j?.error?.message || 'Bulk draft failed');
              toast('success', `Drafted ${j.drafted} · skipped ${j.skipped_no_linkedin + j.skipped_suppressed + j.skipped_already_queued + j.skipped_done}${j.failed ? ` · failed ${j.failed}` : ''} — review in /social DMs`);
            } catch (e: any) {
              toast('error', e?.message || 'Bulk draft failed');
            }
          }}>💼 Draft LinkedIn DMs</Button>
          <Button variant="ghost" onClick={() => {
            const rows = (selectedLeadIds.length ? leads.filter((l: any) => selectedLeadIds.includes(l.id)) : leads);
            const cols = ['businessName','contactName','contactRole','email','phone','website','status','fitScore','source','region','campaignId','createdAt'];
            const escape = (v: any) => { const s = String(v ?? '').replace(/"/g, '""'); return /[",\n]/.test(s) ? `"${s}"` : s; };
            const csv = [cols.join(','), ...rows.map((r: any) => cols.map((c) => escape(r[c])).join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `leads-${new Date().toISOString().slice(0,10)}.csv`;
            a.click(); URL.revokeObjectURL(url);
            toast('success', `Exported ${rows.length} lead${rows.length === 1 ? '' : 's'}`);
          }}>⬇ Export CSV</Button>
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
                      <Button variant="secondary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => createDraftForLead(l)}>Draft</Button>{' '}
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 7000, display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: 16, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ width: '100%', maxWidth: 620, maxHeight: 'calc(100dvh - 32px)', margin: 'auto', display: 'flex', flexDirection: 'column', background: '#0D1117', border: '1px solid #1C2333', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ flexShrink: 0, padding: '14px 16px', borderBottom: '1px solid #1C2333' }}><strong>Add Lead</strong></div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: 16, display: 'grid', gap: 10 }}>
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
        <aside style={{ position: 'fixed', right: 0, top: 0, height: '100dvh', width: 'min(420px, 100vw)', background: '#0D1117', borderLeft: '1px solid #1C2333', zIndex: 8000, display: 'flex', flexDirection: 'column', transform: selectedLead ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.25s ease' }}>
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
            {(() => {
              // Parse enrichment data stashed by LLM enrichment into sourceDetail JSON
              let enrichment: any = {};
              try { enrichment = JSON.parse(String(selectedLead?.sourceDetail || '{}')); } catch {}
              const hasEnrichment =
                (Array.isArray(enrichment?.services) && enrichment.services.length) ||
                enrichment?.painHint || enrichment?.trustMarker;
              if (!hasEnrichment) return null;
              return (
                <div style={{ background: 'rgba(156,175,136,0.06)', border: '1px solid rgba(156,175,136,0.2)', borderRadius: 12, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div className="page-eyebrow" style={{ margin: 0 }}>AI ENRICHMENT</div>
                    <Badge tone="success">{enrichment?.enrichedBy || 'llm+website'}</Badge>
                  </div>
                  {Array.isArray(enrichment?.services) && enrichment.services.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div className="text-xs mono muted" style={{ marginBottom: 4, letterSpacing: '0.1em' }}>SERVICES</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {enrichment.services.map((s: string, i: number) => (
                          <span key={i} style={{ background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)', padding: '3px 10px', borderRadius: 999, fontSize: 11, color: '#D4AF37' }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {enrichment?.painHint && (
                    <div style={{ marginBottom: 8 }}>
                      <div className="text-xs mono muted" style={{ marginBottom: 4, letterSpacing: '0.1em' }}>PAIN SIGNAL</div>
                      <div style={{ fontSize: 13, lineHeight: 1.5, color: '#E6EDF3' }}>{enrichment.painHint}</div>
                    </div>
                  )}
                  {enrichment?.trustMarker && (
                    <div>
                      <div className="text-xs mono muted" style={{ marginBottom: 4, letterSpacing: '0.1em' }}>TRUST MARKER</div>
                      <div style={{ fontSize: 13, lineHeight: 1.5, color: '#E6EDF3' }}>{enrichment.trustMarker}</div>
                    </div>
                  )}
                </div>
              );
            })()}
            {selectedLead?.followUpStage > 0 && selectedLead?.followUpStage < 99 && (
              <div style={{ background: 'rgba(0,201,255,0.06)', border: '1px solid rgba(0,201,255,0.22)', borderRadius: 12, padding: 14 }}>
                <div className="page-eyebrow">SEQUENCE</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  <Badge tone="info">Stage {selectedLead.followUpStage} of 3</Badge>{' '}
                  {selectedLead?.lastOutboundAt && (
                    <span className="muted text-xs mono">
                      last sent {new Date(selectedLead.lastOutboundAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            )}
            {selectedLead?.followUpStage === 99 && selectedLead?.sequencePausedReason && (
              <div className="muted text-xs mono">Sequence paused: {selectedLead.sequencePausedReason}</div>
            )}
            <div>
              <div className="page-eyebrow">NOTES</div>
              <textarea className="ui-input" rows={4} value={leadNotes} onChange={(e) => setLeadNotes(e.target.value)} onBlur={async () => {
                if (!selectedLead?.id) return;
                await fetch(`${API_BASE}/api/leads/${selectedLead.id}`, {
                  method: 'PATCH', credentials: 'include', headers: apiHeaders, body: JSON.stringify({ notes: leadNotes }),
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
          <div style={{ padding: 16, borderTop: '1px solid #1C2333', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={() => selectedLead?.id && createDraftForLead(selectedLead)}>Draft Outreach</Button>
            <Button variant="secondary" onClick={() => selectedLead?.id && enrichLead(selectedLead.id)}>Enrich</Button>
            {selectedLead?.linkedinUrl && (
              <Button
                variant="secondary"
                style={{ border: '1px solid rgba(0,119,181,0.4)', color: '#0A7ABF' }}
                onClick={async () => {
                  if (!selectedLead?.id) return;
                  try {
                    const res = await fetch(`${API_BASE}/api/leads/${selectedLead.id}/draft-linkedin-dm`, {
                      method: 'POST', credentials: 'include', headers: apiHeaders,
                    });
                    const j = await res.json();
                    if (!res.ok) throw new Error(j?.error?.message || 'DM draft failed');
                    toast('success', 'LinkedIn DM drafted and queued — review at /linkedin');
                  } catch (e: any) {
                    toast('error', e?.message || 'Failed to draft DM');
                  }
                }}
              >💼 Draft LinkedIn DM</Button>
            )}
            <Button
              variant="secondary"
              style={{ border: '1px solid rgba(155,114,255,0.4)', color: '#9B72FF' }}
              onClick={async () => {
                setReplyText('');
                setReplyAnalysis(null);
                setReplyAssistOpen(true);
                if (selectedLead?.id) {
                  try {
                    const res = await fetch(`${API_BASE}/api/leads/${selectedLead.id}/reply-analyses?limit=10`, { credentials: 'include', headers: apiHeaders });
                    if (res.ok) setReplyHistory(await res.json());
                    else setReplyHistory([]);
                  } catch { setReplyHistory([]); }
                }
              }}
            >💬 Help with reply</Button>
            {String(selectedLead?.status || '').toUpperCase() !== 'REPLIED' && (
              <Button
                variant="secondary"
                style={{ border: '1px solid rgba(156,175,136,0.4)', color: '#9CAF88' }}
                onClick={async () => {
                  if (!selectedLead?.id) return;
                  try {
                    const res = await fetch(`${API_BASE}/api/followup/lead/${selectedLead.id}/pause`, {
                      method: 'POST', credentials: 'include', headers: apiHeaders, body: JSON.stringify({ reason: 'replied' }),
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const next = { ...selectedLead, status: 'REPLIED', followUpStage: 99, sequencePausedReason: 'replied' };
                    setSelectedLead(next);
                    setLeads((curr) => curr.map((x) => x.id === next.id ? next : x));
                    toast('success', 'Marked as replied — sequence paused');
                  } catch (e: any) {
                    toast('error', e?.message || 'Failed to mark as replied');
                  }
                }}
              >
                ✓ Mark as Replied
              </Button>
            )}
            <Button variant="ghost" style={{ border: '1px solid rgba(255,91,122,0.3)', color: '#FF5B7A' }} onClick={() => {
              if (!selectedLead?.id) return;
              if (!confirm('Delete this lead?')) return;
              fetch(`${API_BASE}/api/leads/${selectedLead.id}`, { method: 'DELETE', credentials: 'include', headers: apiHeaders })
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

      {replyAssistOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 10000, padding: 16, display: 'flex', alignItems: 'stretch', justifyContent: 'center', overflowY: 'auto' }} onClick={() => setReplyAssistOpen(false)}>
          <div style={{ width: 'min(640px, calc(100vw - 32px))', maxHeight: 'calc(100dvh - 32px)', margin: 'auto', display: 'flex', flexDirection: 'column', border: '1px solid #1C2333', background: '#0D1117', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,.5)', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 18 }}>
              <div className="page-eyebrow">💬 Reply Intelligence</div>
              <h3 style={{ margin: '6px 0 4px' }}>{selectedLead?.businessName || 'Lead'}</h3>
              <p className="muted" style={{ marginTop: 0, marginBottom: 14, fontSize: 13, lineHeight: 1.5 }}>
                Paste their reply below. Claude classifies their intent and drafts a response in your founder voice.
              </p>
              <textarea value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Paste the email reply here..."
                style={{ width: '100%', minHeight: 140, background: 'rgba(17,24,39,.65)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />

              {replyAnalysis && (
                <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Badge tone={
                      replyAnalysis.intent === 'interested' ? 'success' :
                      replyAnalysis.intent === 'objection' || replyAnalysis.intent === 'question' ? 'warning' :
                      replyAnalysis.intent === 'not_interested' || replyAnalysis.intent === 'unsubscribe' ? 'danger' :
                      'info'
                    }>{String(replyAnalysis.intent).replace(/_/g, ' ')}</Badge>
                    <span className="muted text-xs mono">confidence: {Math.round((replyAnalysis.confidence || 0) * 100)}%</span>
                    <span className="muted text-xs mono">action: {String(replyAnalysis.recommendedAction).replace(/_/g, ' ')}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 12, fontStyle: 'italic' }}>{replyAnalysis.reasoning}</div>
                  {replyAnalysis.suggestedResponse && (
                    <div>
                      <div className="page-eyebrow" style={{ marginBottom: 6 }}>SUGGESTED RESPONSE</div>
                      <div style={{ background: 'rgba(0,201,255,.04)', border: '1px solid rgba(0,201,255,.18)', borderRadius: 8, padding: 14, whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.55 }}>
                        {replyAnalysis.suggestedResponse}
                      </div>
                      <div className="table-toolbar" style={{ marginTop: 8 }}>
                        <Button variant="primary" onClick={() => {
                          navigator.clipboard.writeText(replyAnalysis.suggestedResponse).then(() => toast('success', 'Copied to clipboard'));
                        }}>📋 Copy response</Button>
                      </div>
                    </div>
                  )}

                  {replyAnalysis.id && !replyAnalysis.appliedAction && (() => {
                    const applyAction = async (action: string, confirmText?: string) => {
                      if (!selectedLead?.id || !replyAnalysis?.id) return;
                      if (confirmText && !confirm(confirmText)) return;
                      setApplyingAction(action);
                      try {
                        const res = await fetch(`${API_BASE}/api/leads/${selectedLead.id}/reply-action`, {
                          method: 'POST', credentials: 'include', headers: apiHeaders,
                          body: JSON.stringify({ analysisId: replyAnalysis.id, action }),
                        });
                        const j = await res.json();
                        if (!res.ok) throw new Error(j?.error?.message || 'Action failed');
                        setReplyAnalysis({ ...replyAnalysis, appliedAction: action, appliedAt: new Date().toISOString() });
                        if (action === 'pause_sequence') {
                          const next = { ...selectedLead, status: 'REPLIED', followUpStage: 99, sequencePausedReason: 'replied' };
                          setSelectedLead(next);
                          setLeads((curr) => curr.map((x) => x.id === next.id ? next : x));
                        } else if (action === 'mark_unsubscribed' || action === 'mark_bounced') {
                          const next = { ...selectedLead, status: 'LOST', followUpStage: 99, sequencePausedReason: 'unsubscribed' };
                          setSelectedLead(next);
                          setLeads((curr) => curr.map((x) => x.id === next.id ? next : x));
                        }
                        toast('success', `Applied: ${action.replace(/_/g, ' ')}`);
                      } catch (e: any) {
                        toast('error', e?.message || 'Failed to apply action');
                      } finally {
                        setApplyingAction(null);
                      }
                    };
                    const rec = String(replyAnalysis.recommendedAction || '');
                    const recommendedKey = rec === 'reply_now' || rec === 'reply_after_check'
                      ? 'pause_sequence'
                      : (rec === 'pause_sequence' || rec === 'mark_unsubscribed' || rec === 'no_action' ? rec : null);
                    return (
                      <div>
                        <div className="page-eyebrow" style={{ marginBottom: 6 }}>APPLY</div>
                        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                          Run a follow-up action on this lead. Sending the response is still manual — use Copy above.
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Button
                            variant={recommendedKey === 'pause_sequence' ? 'primary' : 'secondary'}
                            disabled={!!applyingAction}
                            onClick={() => applyAction('pause_sequence')}
                          >{applyingAction === 'pause_sequence' ? 'Applying…' : '✓ Mark as Replied + pause sequence'}</Button>
                          <Button
                            variant={recommendedKey === 'mark_unsubscribed' ? 'primary' : 'secondary'}
                            disabled={!!applyingAction}
                            onClick={() => applyAction('mark_unsubscribed', 'Suppress this email and stop all future outreach? This is hard to undo.')}
                          >{applyingAction === 'mark_unsubscribed' ? 'Applying…' : '🚫 Unsubscribe + suppress'}</Button>
                          <Button
                            variant="ghost"
                            disabled={!!applyingAction}
                            onClick={() => applyAction('mark_bounced', 'Mark this address as bounced? It will be added to the suppression list.')}
                          >{applyingAction === 'mark_bounced' ? 'Applying…' : '↩ Mark bounced'}</Button>
                        </div>
                      </div>
                    );
                  })()}

                  {replyAnalysis.appliedAction && (
                    <div className="muted" style={{ fontSize: 12, fontStyle: 'italic', padding: '8px 10px', background: 'rgba(20,200,150,0.08)', border: '1px solid rgba(20,200,150,0.2)', borderRadius: 6 }}>
                      ✓ Applied: {String(replyAnalysis.appliedAction).replace(/_/g, ' ')}
                    </div>
                  )}
                </div>
              )}

              {!replyAnalysis && replyHistory.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <div className="page-eyebrow" style={{ marginBottom: 8 }}>RECENT REPLY ANALYSES</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {replyHistory.slice(0, 5).map((h: any) => (
                      <div key={h.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, fontSize: 12.5 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
                          <Badge tone={
                            h.intent === 'interested' ? 'success' :
                            h.intent === 'objection' || h.intent === 'question' ? 'warning' :
                            h.intent === 'not_interested' || h.intent === 'unsubscribe' ? 'danger' :
                            'info'
                          }>{String(h.intent).replace(/_/g, ' ')}</Badge>
                          <span className="muted text-xs mono">{Math.round((h.confidence || 0) * 100)}%</span>
                          <span className="muted text-xs">{new Date(h.createdAt).toLocaleString()}</span>
                          {h.appliedAction && (
                            <span className="text-xs" style={{ color: '#14C896' }}>✓ {String(h.appliedAction).replace(/_/g, ' ')}</span>
                          )}
                        </div>
                        <div className="muted" style={{ fontSize: 11.5, fontStyle: 'italic' }}>{h.reasoning}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid #1C2333' }}>
              <Button variant="ghost" onClick={() => setReplyAssistOpen(false)}>Close</Button>
              <Button variant="primary" disabled={!replyText.trim() || analyzing}
                onClick={async () => {
                  if (!selectedLead?.id || !replyText.trim()) return;
                  setAnalyzing(true);
                  setReplyAnalysis(null);
                  try {
                    const res = await fetch(`${API_BASE}/api/leads/${selectedLead.id}/reply-assist`, {
                      method: 'POST', credentials: 'include', headers: apiHeaders, body: JSON.stringify({ replyText }),
                    });
                    const j = await res.json();
                    if (!res.ok) throw new Error(j?.error?.message || 'Analysis failed');
                    setReplyAnalysis(j);
                  } catch (e: any) {
                    toast('error', e?.message || 'Analysis failed');
                  } finally {
                    setAnalyzing(false);
                  }
                }}
              >{analyzing ? 'Analyzing…' : '🧠 Analyze with Claude'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
