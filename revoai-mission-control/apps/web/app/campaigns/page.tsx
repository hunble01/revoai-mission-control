'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';

type SourceKey = 'apollo' | 'hunter' | 'gmaps' | 'linkedin' | 'web' | 'sheet';

type CampaignForm = {
  id?: string;
  name: string;
  status: 'Active' | 'Paused' | 'Archived';
  niche: string;
  subNiche: string;
  geographyCity: string;
  geographyRadius: string;
  geographyRegion: string;
  companySize: string[];
  revenueRange: string;
  contactType: string[];
  hasContactInfo: string[];
  defaultChannel: 'Email' | 'LinkedIn' | 'Both';
  dailySendLimit: number;
  notes: string;
  dataSources: Record<SourceKey, boolean>;
  sourcePriority: SourceKey[];
  spreadsheet: null | { fileName: string; headers: string[]; rows: string[][]; mapping: Record<string, string> };
  messaging: {
    painPoint: string;
    yourOffer: string;
    yourProof: string;
    emailSubject: string;
    emailBody: string;
    aiEmail: boolean;
    dmBody: string;
    aiDm: boolean;
    followupEnabled: boolean;
    followups: Array<{ delay: string; subject: string; body: string; ai: boolean }>;
    sendWindowFrom: string;
    sendWindowTo: string;
    sendDays: string[];
  };
};

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const vars = ['{{first_name}}','{{business_name}}','{{city}}','{{niche}}','{{pain_point}}','{{your_offer}}','{{your_name}}','{{your_company}}'];
const delayOptions = ['2 days', '3 days', '5 days', '7 days', '14 days'];
const dayOptions = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const mappingOptions = ['Company Name', 'Website URL', 'Contact Name', 'Email', 'Phone', 'LinkedIn URL', 'City', 'Notes', 'Skip'];

const nicheOptions = ['Any', 'Home Services', 'Dental', 'Medical Clinics', 'Legal', 'Real Estate', 'Financial Services', 'Restaurants', 'Retail', 'Fitness', 'Education', 'Rentals', 'Spas', 'Nail Salons', 'Barber Shops', 'Other'];
const statusOptions: Array<'Active' | 'Paused' | 'Archived'> = ['Active', 'Paused', 'Archived'];
const radiusOptions = ['Any', '10km', '25km', '50km', '100km'];
const revenueOptions = ['Any', 'Under $500k', '$500k-$2M', '$2M-$10M', '$10M+'];
const companySizes = ['Solo 1', 'Small 2-10', 'Medium 11-50', 'Growing 51-200', 'Enterprise 200+'];
const contactTypes = ['Owner/Founder', 'Manager', 'Any Decision Maker'];
const infoTypes = ['Has Email', 'Has Phone', 'Has LinkedIn', 'Has All'];
const channelOptions: Array<'Email' | 'LinkedIn' | 'Both'> = ['Email', 'LinkedIn', 'Both'];

const sourceDefs: Array<{ key: SourceKey; name: string; description: string; needsKey?: boolean; dot: string }> = [
  { key: 'apollo', name: 'Apollo.io', description: 'Rich B2B data', needsKey: true, dot: '#8B5CF6' },
  { key: 'hunter', name: 'Hunter.io', description: 'Email finder', needsKey: true, dot: '#10D68A' },
  { key: 'gmaps', name: 'Google Maps', description: 'Local business discovery', needsKey: true, dot: '#00C9FF' },
  { key: 'linkedin', name: 'LinkedIn Scraper', description: 'Company/contact discovery', dot: '#3B82F6' },
  { key: 'web', name: 'Web Scraper', description: 'Google/web discovery', dot: '#F5A623' },
  { key: 'sheet', name: 'Spreadsheet Upload', description: 'Use your own list', dot: '#7B8799' },
];

const inputStyle: React.CSSProperties = {
  background: '#0A0E17',
  border: '1px solid #1C2333',
  borderRadius: 4,
  padding: '8px 12px',
  color: 'var(--text)',
  width: '100%',
};

const emptyForm: CampaignForm = {
  name: '',
  status: 'Active',
  niche: 'Any',
  subNiche: '',
  geographyCity: '',
  geographyRadius: 'Any',
  geographyRegion: '',
  companySize: [],
  revenueRange: 'Any',
  contactType: [],
  hasContactInfo: [],
  defaultChannel: 'Email',
  dailySendLimit: 20,
  notes: '',
  dataSources: { apollo: false, hunter: false, gmaps: false, linkedin: false, web: false, sheet: false },
  sourcePriority: ['apollo', 'hunter', 'gmaps', 'linkedin', 'web', 'sheet'],
  spreadsheet: null,
  messaging: {
    painPoint: '',
    yourOffer: '',
    yourProof: '',
    emailSubject: 'Quick question for {{business_name}}',
    emailBody: '',
    aiEmail: true,
    dmBody: '',
    aiDm: true,
    followupEnabled: false,
    followups: [
      { delay: '3 days', subject: '', body: '', ai: true },
      { delay: '7 days', subject: '', body: '', ai: true },
      { delay: '14 days', subject: '', body: '', ai: true },
    ],
    sendWindowFrom: '09:00',
    sendWindowTo: '11:00',
    sendDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  },
};

function GhostButton({ children, onClick }: any) {
  return <button className="ui-btn" style={{ border: '1px solid #243044', color: 'var(--text2)', background: 'transparent' }} onClick={onClick}>{children}</button>;
}

function PrimaryButton({ children, onClick, disabled }: any) {
  return <button className="ui-btn" disabled={disabled} style={{ background: 'linear-gradient(135deg, #00C9FF, #0080FF)', color: '#fff', boxShadow: '0 0 16px rgba(0,201,255,0.25)', border: 'none' }} onClick={onClick}>{children}</button>;
}

function DangerButton({ children, onClick }: any) {
  return <button className="ui-btn" style={{ border: '1px solid rgba(255,91,122,0.3)', color: '#FF5B7A', background: 'transparent' }} onClick={onClick}>{children}</button>;
}

function AmberGhostButton({ children, onClick }: any) {
  return <button className="ui-btn" style={{ border: '1px solid rgba(245,166,35,0.3)', color: '#F5A623', background: 'transparent' }} onClick={onClick}>{children}</button>;
}

function Chip({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} style={{ background: 'rgba(0,201,255,0.1)', border: '1px solid rgba(0,201,255,0.2)', color: '#00C9FF', borderRadius: 12, padding: '3px 10px', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer' }}>{label}</button>;
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} style={{ width: 40, height: 22, borderRadius: 11, border: '1px solid #243044', background: on ? '#00C9FF' : '#1C2333', position: 'relative', transition: 'all .2s ease' }}>
      <span style={{ position: 'absolute', top: 1.5, left: on ? 20 : 2, width: 18, height: 18, borderRadius: 9, background: '#fff', transition: 'all .2s ease' }} />
    </button>
  );
}

function Group({ label, children }: any) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-dim)', marginBottom: 6 }}>{label}</div>
      <div style={{ background: '#0A0E17', border: '1px solid #1C2333', borderRadius: 6, padding: 14 }}>{children}</div>
    </div>
  );
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [importStep, setImportStep] = useState(1);
  const [editingCampaign, setEditingCampaign] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState<CampaignForm>(emptyForm);
  const [importCampaignId, setImportCampaignId] = useState('');
  const [importData, setImportData] = useState<any>(null);
  const [enrichMissing, setEnrichMissing] = useState(true);
  const [activeField, setActiveField] = useState<string>('');
  const fieldRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});

  useEffect(() => { setMounted(true); }, []);

  const toast = (type: 'success' | 'error', text: string) => {
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { type, text } }));
  };

  const loadCampaigns = async () => {
    const res = await fetch(`${base}/api/campaigns`, { credentials: 'include' });
    const data = await res.json().catch(() => []);
    const list = Array.isArray(data) ? data : [];
    setCampaigns(list);
    const firstActive = list.find((c: any) => String(c.status || '').toLowerCase() === 'active');
    if (firstActive?.id) setImportCampaignId(firstActive.id);
  };

  useEffect(() => { loadCampaigns(); }, []);

  const selectedCampaigns = useMemo(
    () => campaigns.filter((c: any) => String(c.status || '').toLowerCase() === 'active'),
    [campaigns],
  );

  const resetForm = () => {
    setForm(JSON.parse(JSON.stringify(emptyForm)));
    setCurrentStep(1);
    setEditingCampaign(null);
    setModalOpen(true);
  };

  const openEdit = (campaign: any) => {
    setEditingCampaign(campaign);
    setForm({
      ...JSON.parse(JSON.stringify(emptyForm)),
      ...campaign,
      status: (String(campaign.status || 'active').replace(/^./, (x) => x.toUpperCase()) as any),
      companySize: Array.isArray(campaign.companySize) ? campaign.companySize : [],
      contactType: Array.isArray(campaign.contactType) ? campaign.contactType : [],
      hasContactInfo: Array.isArray(campaign.hasContactInfo) ? campaign.hasContactInfo : [],
      sourcePriority: Array.isArray(campaign?.dataSources?.priority) ? campaign.dataSources.priority : ['apollo', 'hunter', 'gmaps', 'linkedin', 'web', 'sheet'],
      dataSources: {
        apollo: !!campaign?.dataSources?.apollo,
        hunter: !!campaign?.dataSources?.hunter,
        gmaps: !!campaign?.dataSources?.gmaps,
        linkedin: !!campaign?.dataSources?.linkedin,
        web: !!campaign?.dataSources?.web,
        sheet: !!campaign?.dataSources?.sheet,
      },
      messaging: {
        ...emptyForm.messaging,
        ...(campaign?.outreachTemplates || {}),
      },
    });
    setCurrentStep(1);
    setModalOpen(true);
  };

  const updateMulti = (key: 'companySize' | 'contactType' | 'hasContactInfo', value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter((x: string) => x !== value) : [...prev[key], value],
    }));
  };

  const insertVariable = (variable: string) => {
    if (!activeField) return;
    const ref = fieldRefs.current[activeField];
    if (!ref) return;
    const start = (ref as any).selectionStart ?? ref.value.length;
    const end = (ref as any).selectionEnd ?? ref.value.length;

    const setMsg = (key: string, value: string) => {
      setForm((prev) => ({ ...prev, messaging: { ...prev.messaging, [key]: value } }));
    };

    const current = String((form.messaging as any)[activeField] || '');
    const next = `${current.slice(0, start)}${variable}${current.slice(end)}`;
    setMsg(activeField, next);
  };

  const parseUpload = async (file?: File | null) => {
    if (!file) return null;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.csv') && !lower.endsWith('.xlsx')) return null;

    let headers: string[] = [];
    let rows: string[][] = [];

    if (lower.endsWith('.csv')) {
      const text = await file.text();
      const parsed = text
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => line.split(',').map((v) => v.trim()));
      headers = parsed[0] || [];
      rows = parsed.slice(1);
    } else {
      headers = ['Company Name', 'Website URL', 'Contact Name', 'Email', 'Phone', 'LinkedIn URL', 'City', 'Notes'];
    }

    const mapping: Record<string, string> = {};
    headers.forEach((h) => { mapping[h] = 'Skip'; });
    return { fileName: file.name, headers, rows, mapping };
  };

  const saveCampaign = async () => {
    try {
      const payload = {
        name: form.name,
        status: String(form.status).toLowerCase(),
        niche: form.niche,
        subNiche: form.subNiche,
        geography: `${form.geographyCity}${form.geographyRegion ? `, ${form.geographyRegion}` : ''}`,
        geographyCity: form.geographyCity,
        geographyRadius: form.geographyRadius,
        geographyRegion: form.geographyRegion,
        companySize: form.companySize,
        revenueRange: form.revenueRange,
        contactType: form.contactType,
        hasContactInfo: form.hasContactInfo,
        defaultChannel: form.defaultChannel,
        dailySendLimit: Number(form.dailySendLimit || 20),
        notes: form.notes,
        dataSources: { ...form.dataSources, priority: form.sourcePriority },
        spreadsheetData: form.spreadsheet,
        outreachTemplates: form.messaging,
      };

      const url = editingCampaign ? `${base}/api/campaigns/${editingCampaign.id}` : `${base}/api/campaigns`;
      const method = editingCampaign ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || 'Save failed');

      if (editingCampaign) {
        setCampaigns((prev) => prev.map((c) => (c.id === editingCampaign.id ? { ...c, ...data } : c)));
      } else {
        setCampaigns((prev) => [data, ...prev]);
      }

      setModalOpen(false);
      toast('success', editingCampaign ? 'Campaign updated' : 'Campaign created');
    } catch (e: any) {
      toast('error', e?.message || 'Save failed');
    }
  };

  const actionClone = async (id: string) => {
    try {
      const res = await fetch(`${base}/api/campaigns/${id}/clone`, { method: 'POST', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || 'Clone failed');
      setCampaigns((prev) => [data, ...prev]);
      toast('success', 'Campaign cloned');
    } catch (e: any) {
      toast('error', e?.message || 'Clone failed');
    }
  };

  const actionArchive = async (id: string) => {
    try {
      const res = await fetch(`${base}/api/campaigns/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || 'Archive failed');
      setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, ...data, status: 'archived' } : c)));
      toast('success', 'Campaign archived');
    } catch (e: any) {
      toast('error', e?.message || 'Archive failed');
    }
  };

  const actionDelete = async (id: string) => {
    try {
      const res = await fetch(`${base}/api/campaigns/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 404) throw new Error(data?.error?.message || 'Delete failed');
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      setConfirmDelete(null);
      toast('success', 'Campaign deleted');
    } catch (e: any) {
      toast('error', e?.message || 'Delete failed');
    }
  };

  const importLeads = async () => {
    try {
      if (!importCampaignId || !importData) throw new Error('Select campaign and upload file first');
      const res = await fetch(`${base}/api/leads/import/csv`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          campaignId: importCampaignId,
          fileName: importData.fileName,
          headers: importData.headers,
          rows: importData.rows,
          mapping: importData.mapping,
          enrichMissingFields: enrichMissing,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || 'Import failed');
      toast('success', 'Leads imported');
      setImportModalOpen(false);
    } catch (e: any) {
      toast('error', e?.message || 'Import failed');
    }
  };

  const sourceDots = (row: any) => sourceDefs.filter((s) => row?.dataSources?.[s.key]);
  const replyRate = (row: any) => {
    const contacted = Number(row.contactedCount || 0);
    const replied = Number(row.repliedCount || 0);
    if (!contacted) return '—';
    return `${Math.round((replied / contacted) * 100)}%`;
  };
  const healthColor = (row: any) => {
    const st = String(row.status || '').toLowerCase();
    const leads = Number(row.leadsCount || 0);
    if (st === 'paused' || st === 'archived') return '#7B8799';
    if (st === 'active' && leads > 0) return '#10D68A';
    return '#F5A623';
  };

  return (
    <div className="dash-stack fade-in" style={{ overflowX: 'hidden' }}>
      <section className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
        <div>
          <div className="page-eyebrow">PIPELINE / CAMPAIGNS</div>
          <h2 className="page-title" style={{ margin: 0 }}>Campaigns</h2>
          <p className="page-desc">Create and manage campaign targeting, sources, and message templates</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <GhostButton onClick={() => { setImportStep(1); setImportModalOpen(true); }}>Import Leads</GhostButton>
          <PrimaryButton onClick={resetForm}>+ New Campaign</PrimaryButton>
        </div>
      </section>

      <Card title="Campaign List" subtitle="Targeting, source stack, and performance snapshot">
        <Table>
          <thead>
            <tr>
              <th>Name</th><th>Niche</th><th>Geography</th><th>Status</th><th>Sources</th><th>Leads</th><th>Contacted</th><th>Replied</th><th>Booked</th><th>Reply Rate</th><th>Health</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((row: any) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.niche}</td>
                <td>{row.geographyCity || row.geography}</td>
                <td><Badge tone={String(row.status || '').toLowerCase() === 'active' ? 'success' : String(row.status || '').toLowerCase() === 'paused' ? 'warning' : 'default'}>{String(row.status || 'active').toUpperCase()}</Badge></td>
                <td>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {sourceDots(row).map((s) => <span key={s.key} title={s.name} style={{ width: 10, height: 10, borderRadius: 999, display: 'inline-block', background: s.dot }} />)}
                    {!sourceDots(row).length && <span className="muted">—</span>}
                  </div>
                </td>
                <td>{row.leadsCount || 0}</td>
                <td>{row.contactedCount || 0}</td>
                <td>{row.repliedCount || 0}</td>
                <td>{row.bookedCount || 0}</td>
                <td>{replyRate(row)}</td>
                <td><span style={{ width: 10, height: 10, borderRadius: 999, display: 'inline-block', background: healthColor(row) }} /></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <GhostButton onClick={() => openEdit(row)}>Edit</GhostButton>{' '}
                  <GhostButton onClick={() => actionClone(row.id)}>Clone</GhostButton>{' '}
                  <AmberGhostButton onClick={() => actionArchive(row.id)}>Archive</AmberGhostButton>{' '}
                  <DangerButton onClick={() => setConfirmDelete(row)}>Delete</DangerButton>
                </td>
              </tr>
            ))}
            {!campaigns.length && <tr><td colSpan={12} className="muted">No campaigns yet.</td></tr>}
          </tbody>
        </Table>
      </Card>

      {mounted && modalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', boxSizing: 'border-box' }}>
          <div style={{ width: '100%', maxWidth: 700, maxHeight: '90vh', background: '#0D1117', border: '1px solid #1C2333', borderRadius: 8, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ flexShrink: 0, padding: '16px 20px', borderBottom: '1px solid #1C2333' }}>
              <div className="page-eyebrow">Campaign Setup</div>
              <div style={{ fontWeight: 600 }}>Step {currentStep} / 4</div>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '16px 20px' }}>
              {currentStep === 1 && (
                <>
                  <Group label="CAMPAIGN INFO">
                    <div style={{ display: 'grid', gap: 10 }}>
                      <input style={inputStyle} placeholder="Campaign Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <select style={inputStyle} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as any }))}>{statusOptions.map((o) => <option key={o}>{o}</option>)}</select>
                        <select style={inputStyle} value={form.niche} onChange={(e) => setForm((f) => ({ ...f, niche: e.target.value }))}>{nicheOptions.map((o) => <option key={o}>{o}</option>)}</select>
                      </div>
                      <input style={inputStyle} placeholder="Sub-Niche" value={form.subNiche} onChange={(e) => setForm((f) => ({ ...f, subNiche: e.target.value }))} />
                    </div>
                  </Group>

                  <Group label="GEOGRAPHY">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      <input style={inputStyle} placeholder="City/Region" value={form.geographyCity} onChange={(e) => setForm((f) => ({ ...f, geographyCity: e.target.value }))} />
                      <select style={inputStyle} value={form.geographyRadius} onChange={(e) => setForm((f) => ({ ...f, geographyRadius: e.target.value }))}>{radiusOptions.map((o) => <option key={o}>{o}</option>)}</select>
                      <input style={inputStyle} placeholder="Province/State" value={form.geographyRegion} onChange={(e) => setForm((f) => ({ ...f, geographyRegion: e.target.value }))} />
                    </div>
                  </Group>

                  <Group label="TARGETING">
                    <div style={{ display: 'grid', gap: 10 }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{companySizes.map((o) => <Chip key={o} label={o} onClick={() => updateMulti('companySize', o)} />)}</div>
                      <select style={inputStyle} value={form.revenueRange} onChange={(e) => setForm((f) => ({ ...f, revenueRange: e.target.value }))}>{revenueOptions.map((o) => <option key={o}>{o}</option>)}</select>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{contactTypes.map((o) => <Chip key={o} label={o} onClick={() => updateMulti('contactType', o)} />)}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{infoTypes.map((o) => <Chip key={o} label={o} onClick={() => updateMulti('hasContactInfo', o)} />)}</div>
                    </div>
                  </Group>

                  <Group label="OUTREACH">
                    <div style={{ display: 'grid', gap: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <select style={inputStyle} value={form.defaultChannel} onChange={(e) => setForm((f) => ({ ...f, defaultChannel: e.target.value as any }))}>{channelOptions.map((o) => <option key={o}>{o}</option>)}</select>
                        <input style={inputStyle} type="number" value={form.dailySendLimit} onChange={(e) => setForm((f) => ({ ...f, dailySendLimit: Number(e.target.value || 20) }))} />
                      </div>
                      <textarea style={inputStyle} rows={3} placeholder="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                    </div>
                  </Group>
                </>
              )}

              {currentStep === 2 && (
                <>
                  {sourceDefs.map((s) => (
                    <div key={s.key} style={{ background: '#0A0E17', border: '1px solid #1C2333', borderRadius: 6, padding: 12, marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                        <div>
                          <div><strong>{s.name}</strong></div>
                          <div className="muted">{s.description}</div>
                          {s.needsKey && <Badge tone="warning">API key required — configure in Settings</Badge>}
                        </div>
                        <Toggle on={!!form.dataSources[s.key]} onToggle={() => setForm((f) => ({ ...f, dataSources: { ...f.dataSources, [s.key]: !f.dataSources[s.key] } }))} />
                      </div>
                    </div>
                  ))}
                  <Group label="SOURCE PRIORITY">
                    {form.sourcePriority.map((k: SourceKey, i: number) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span>{i + 1}. {sourceDefs.find((s) => s.key === k)?.name}</span>
                        <span>
                          <GhostButton onClick={() => {
                            const arr = [...form.sourcePriority];
                            const n = i - 1;
                            if (n < 0) return;
                            [arr[i], arr[n]] = [arr[n], arr[i]];
                            setForm((f) => ({ ...f, sourcePriority: arr }));
                          }}>↑</GhostButton>{' '}
                          <GhostButton onClick={() => {
                            const arr = [...form.sourcePriority];
                            const n = i + 1;
                            if (n >= arr.length) return;
                            [arr[i], arr[n]] = [arr[n], arr[i]];
                            setForm((f) => ({ ...f, sourcePriority: arr }));
                          }}>↓</GhostButton>
                        </span>
                      </div>
                    ))}
                  </Group>
                </>
              )}

              {currentStep === 3 && (
                <>
                  <label style={{ ...inputStyle, borderStyle: 'dashed', borderColor: '#243044', display: 'block', textAlign: 'center', cursor: 'pointer' }}>
                    <input type="file" accept=".csv,.xlsx" style={{ display: 'none' }} onChange={async (e) => {
                      const parsed = await parseUpload(e.target.files?.[0]);
                      setForm((f) => ({ ...f, spreadsheet: parsed }));
                    }} />
                    Drag and drop upload zone or click to browse
                  </label>

                  {form.spreadsheet && (
                    <>
                      <div className="muted" style={{ marginTop: 8 }}>File: {form.spreadsheet.fileName}</div>
                      {form.spreadsheet.headers.map((h: string) => (
                        <div key={h} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                          <div style={inputStyle}>{h}</div>
                          <select style={inputStyle} value={form.spreadsheet.mapping[h]} onChange={(e) => setForm((f) => ({ ...f, spreadsheet: { ...f.spreadsheet, mapping: { ...f.spreadsheet.mapping, [h]: e.target.value } } }))}>
                            {mappingOptions.map((m) => <option key={m}>{m}</option>)}
                          </select>
                        </div>
                      ))}
                      <Table>
                        <thead><tr>{form.spreadsheet.headers.map((h: string) => <th key={h}>{h}</th>)}</tr></thead>
                        <tbody>{form.spreadsheet.rows.slice(0, 5).map((r: string[], i: number) => <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody>
                      </Table>
                    </>
                  )}

                  <p className="muted">Any missing fields will be automatically enriched by your enabled data sources when the campaign runs</p>
                  <GhostButton onClick={() => setCurrentStep(4)}>Skip for now</GhostButton>
                </>
              )}

              {currentStep === 4 && (
                <>
                  <Group label="CAMPAIGN ANGLE">
                    <textarea style={inputStyle} rows={3} placeholder="e.g. Missing calls and losing bookings to competitors" value={form.messaging.painPoint} onChange={(e) => setForm((f) => ({ ...f, messaging: { ...f.messaging, painPoint: e.target.value } }))} />
                    <textarea style={{ ...inputStyle, marginTop: 8 }} rows={3} placeholder="e.g. We help home service businesses get 30% more booked appointments" value={form.messaging.yourOffer} onChange={(e) => setForm((f) => ({ ...f, messaging: { ...f.messaging, yourOffer: e.target.value } }))} />
                    <textarea style={{ ...inputStyle, marginTop: 8 }} rows={3} placeholder="e.g. One of our clients added 12 new bookings in their first week" value={form.messaging.yourProof} onChange={(e) => setForm((f) => ({ ...f, messaging: { ...f.messaging, yourProof: e.target.value } }))} />
                    <p className="muted" style={{ marginTop: 8 }}>The AI uses these three inputs to write personalized outreach for every lead in this campaign.</p>
                  </Group>

                  <Group label="EMAIL TEMPLATE">
                    <input style={inputStyle} placeholder="e.g. Quick question for {{business_name}}" value={form.messaging.emailSubject} onFocus={(e) => { setActiveField('emailSubject'); fieldRefs.current.emailSubject = e.currentTarget; }} onChange={(e) => setForm((f) => ({ ...f, messaging: { ...f.messaging, emailSubject: e.target.value } }))} />
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>{vars.map((v) => <Chip key={v} label={v} onClick={() => insertVariable(v)} />)}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}><span className="muted">Let AI generate email from my angle</span><Toggle on={form.messaging.aiEmail} onToggle={() => setForm((f) => ({ ...f, messaging: { ...f.messaging, aiEmail: !f.messaging.aiEmail } }))} /></div>
                    <textarea style={{ ...inputStyle, marginTop: 8 }} rows={6} disabled={form.messaging.aiEmail} value={form.messaging.aiEmail ? 'AI will generate a personalized email using your angle.' : form.messaging.emailBody} onFocus={(e) => { setActiveField('emailBody'); fieldRefs.current.emailBody = e.currentTarget; }} onChange={(e) => setForm((f) => ({ ...f, messaging: { ...f.messaging, emailBody: e.target.value } }))} />
                  </Group>

                  <Group label="LINKEDIN DM TEMPLATE">
                    <textarea style={inputStyle} rows={4} disabled={form.messaging.aiDm} value={form.messaging.aiDm ? 'AI will generate a personalized DM from your angle.' : form.messaging.dmBody} onFocus={(e) => { setActiveField('dmBody'); fieldRefs.current.dmBody = e.currentTarget; }} onChange={(e) => setForm((f) => ({ ...f, messaging: { ...f.messaging, dmBody: e.target.value } }))} />
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>{vars.map((v) => <Chip key={`dm-${v}`} label={v} onClick={() => insertVariable(v)} />)}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}><span className="muted">Let AI generate DM from my angle</span><Toggle on={form.messaging.aiDm} onToggle={() => setForm((f) => ({ ...f, messaging: { ...f.messaging, aiDm: !f.messaging.aiDm } }))} /></div>
                    <p className="muted" style={{ marginTop: 8 }}>LinkedIn DMs are capped at 20 per day.</p>
                  </Group>

                  <Group label="FOLLOW-UP SEQUENCE">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Enable follow-up sequence</span><Toggle on={form.messaging.followupEnabled} onToggle={() => setForm((f) => ({ ...f, messaging: { ...f.messaging, followupEnabled: !f.messaging.followupEnabled } }))} /></div>
                    {form.messaging.followupEnabled && form.messaging.followups.map((fu, i) => (
                      <div key={i} style={{ border: '1px solid #1C2333', borderLeft: i === 2 ? '3px solid #F5A623' : '1px solid #1C2333', borderRadius: 6, padding: 10, marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <strong>{i === 2 ? 'Breakup' : `Follow-up ${i + 1}`}</strong>
                          {i === 2 && <Badge tone="warning">Breakup message — final attempt</Badge>}
                        </div>
                        <select style={inputStyle} value={fu.delay} onChange={(e) => setForm((f) => { const x = [...f.messaging.followups]; x[i] = { ...x[i], delay: e.target.value }; return { ...f, messaging: { ...f.messaging, followups: x } }; })}>{delayOptions.map((d) => <option key={d}>{d}</option>)}</select>
                        <input style={{ ...inputStyle, marginTop: 8 }} placeholder="Subject" value={fu.subject} onChange={(e) => setForm((f) => { const x = [...f.messaging.followups]; x[i] = { ...x[i], subject: e.target.value }; return { ...f, messaging: { ...f.messaging, followups: x } }; })} />
                        <textarea style={{ ...inputStyle, marginTop: 8 }} rows={3} placeholder="Body" value={fu.body} onChange={(e) => setForm((f) => { const x = [...f.messaging.followups]; x[i] = { ...x[i], body: e.target.value }; return { ...f, messaging: { ...f.messaging, followups: x } }; })} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}><span className="muted">Let AI write this follow-up</span><Toggle on={fu.ai} onToggle={() => setForm((f) => { const x = [...f.messaging.followups]; x[i] = { ...x[i], ai: !x[i].ai }; return { ...f, messaging: { ...f.messaging, followups: x } }; })} /></div>
                      </div>
                    ))}
                  </Group>

                  <Group label="SEND WINDOW">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <input style={inputStyle} type="time" value={form.messaging.sendWindowFrom} onChange={(e) => setForm((f) => ({ ...f, messaging: { ...f.messaging, sendWindowFrom: e.target.value } }))} />
                      <input style={inputStyle} type="time" value={form.messaging.sendWindowTo} onChange={(e) => setForm((f) => ({ ...f, messaging: { ...f.messaging, sendWindowTo: e.target.value } }))} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                      {dayOptions.map((d) => <Chip key={d} label={d} onClick={() => setForm((f) => ({ ...f, messaging: { ...f.messaging, sendDays: f.messaging.sendDays.includes(d) ? f.messaging.sendDays.filter((x: string) => x !== d) : [...f.messaging.sendDays, d] } }))} />)}
                    </div>
                    <p className="muted" style={{ marginTop: 8 }}>Outreach only sends during this window to appear natural and avoid spam filters.</p>
                  </Group>
                </>
              )}
            </div>

            <div style={{ flexShrink: 0, padding: '12px 20px', borderTop: '1px solid #1C2333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="muted">{currentStep} / 4</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <GhostButton onClick={() => setModalOpen(false)}>Cancel</GhostButton>
                <GhostButton onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}>Back</GhostButton>
                {currentStep < 4 && <PrimaryButton onClick={() => setCurrentStep((s) => Math.min(4, s + 1))}>Next</PrimaryButton>}
                {currentStep === 4 && <PrimaryButton onClick={saveCampaign}>{editingCampaign ? 'Save Campaign' : 'Create Campaign'}</PrimaryButton>}
              </div>
            </div>
          </div>
        </div>
      )}

      {mounted && importModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box' }}>
          <div style={{ width: '100%', maxWidth: 700, maxHeight: '90vh', background: '#0D1117', border: '1px solid #1C2333', borderRadius: 8, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ flexShrink: 0, padding: '16px 20px', borderBottom: '1px solid #1C2333' }}>
              <div className="page-eyebrow">Import Leads</div>
              <div style={{ fontWeight: 600 }}>Step {importStep} / 3</div>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '16px 20px' }}>
              {importStep === 1 && (
                <select style={inputStyle} value={importCampaignId} onChange={(e) => setImportCampaignId(e.target.value)}>
                  {selectedCampaigns.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              {importStep === 2 && (
                <>
                  <label style={{ ...inputStyle, borderStyle: 'dashed', borderColor: '#243044', display: 'block', textAlign: 'center', cursor: 'pointer' }}>
                    <input type="file" accept=".csv,.xlsx" style={{ display: 'none' }} onChange={async (e) => setImportData(await parseUpload(e.target.files?.[0]))} />
                    Drag and drop upload zone or click to browse
                  </label>
                  {importData && (
                    <>
                      {importData.headers.map((h: string) => (
                        <div key={h} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                          <div style={inputStyle}>{h}</div>
                          <select style={inputStyle} value={importData.mapping[h]} onChange={(e) => setImportData((x: any) => ({ ...x, mapping: { ...x.mapping, [h]: e.target.value } }))}>
                            {mappingOptions.map((m) => <option key={m}>{m}</option>)}
                          </select>
                        </div>
                      ))}
                      <Table>
                        <thead><tr>{importData.headers.map((h: string) => <th key={h}>{h}</th>)}</tr></thead>
                        <tbody>{importData.rows.slice(0, 5).map((r: string[], i: number) => <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody>
                      </Table>
                    </>
                  )}
                </>
              )}
              {importStep === 3 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Enrich missing fields automatically</span>
                  <Toggle on={enrichMissing} onToggle={() => setEnrichMissing((v) => !v)} />
                </div>
              )}
            </div>
            <div style={{ flexShrink: 0, padding: '12px 20px', borderTop: '1px solid #1C2333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="muted">{importStep} / 3</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <GhostButton onClick={() => setImportModalOpen(false)}>Cancel</GhostButton>
                <GhostButton onClick={() => setImportStep((s) => Math.max(1, s - 1))}>Back</GhostButton>
                {importStep < 3 && <PrimaryButton onClick={() => setImportStep((s) => Math.min(3, s + 1))}>Next</PrimaryButton>}
                {importStep === 3 && <PrimaryButton onClick={importLeads}>Import</PrimaryButton>}
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'grid', placeItems: 'center', zIndex: 10000 }}>
          <div style={{ width: 'min(520px, calc(100vw - 32px))', padding: 14, border: '1px solid #1C2333', background: '#0D1117', borderRadius: 8 }}>
            <h4 style={{ margin: 0, marginBottom: 10 }}>Are you sure you want to delete this campaign? This cannot be undone.</h4>
            <div style={{ display: 'flex', justifyContent: 'end', gap: 8 }}>
              <GhostButton onClick={() => setConfirmDelete(null)}>Cancel</GhostButton>
              <DangerButton onClick={() => actionDelete(confirmDelete.id)}>Delete</DangerButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
