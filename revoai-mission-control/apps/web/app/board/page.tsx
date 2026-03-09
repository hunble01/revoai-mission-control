'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const COLUMNS = [
  { key: 'NEW', tone: 'default', label: 'NEW' },
  { key: 'RESEARCHED', tone: 'info', label: 'RESEARCHED' },
  { key: 'DRAFTED', tone: 'violet', label: 'DRAFTED' },
  { key: 'CONTACTED', tone: 'warning', label: 'CONTACTED' },
  { key: 'REPLIED', tone: 'success', label: 'REPLIED' },
  { key: 'BOOKED', tone: 'success', label: 'BOOKED' },
] as const;

export default function BoardPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignId, setCampaignId] = useState('ALL');
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const toast = (type: 'success' | 'error' | 'info' | 'warning', text: string) => window.dispatchEvent(new CustomEvent('app-toast', { detail: { type, text } }));

  const load = async () => {
    const [l, c] = await Promise.all([
      fetch(`${base}/api/leads`, { credentials: 'include' }).then((r) => r.json()).catch(() => []),
      fetch(`${base}/api/campaigns`, { credentials: 'include' }).then((r) => r.json()).catch(() => []),
    ]);
    setLeads(Array.isArray(l) ? l : []);
    setCampaigns(Array.isArray(c) ? c : []);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => campaignId === 'ALL' ? leads : leads.filter((l: any) => l.campaignId === campaignId), [leads, campaignId]);

  const moveLead = async (leadId: string, toStatus: string) => {
    const prev = leads;
    setLeads((curr) => curr.map((l: any) => l.id === leadId ? { ...l, status: toStatus } : l));
    try {
      const res = await fetch(`${base}/api/leads/${leadId}`, { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: toStatus }) });
      if (!res.ok) throw new Error(`Move failed (${res.status})`);
    } catch (e: any) {
      setLeads(prev);
      toast('error', e?.message || 'Move failed');
    }
  };

  return (
    <div className="dash-stack fade-in">
      <section className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="page-eyebrow">OPERATIONS / BOARD</div>
          <h2 className="page-title" style={{ margin: 0 }}>Pipeline Board</h2>
          <p className="page-desc">Total pipeline leads: {filtered.length}</p>
        </div>
        <select className="ui-input" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
          <option value="ALL">All Campaigns</option>
          {campaigns.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </section>

      <div style={{ display: 'flex', flexDirection: 'row', gap: 12, overflowX: 'auto', height: 'calc(100vh - 180px)' }}>
        {COLUMNS.map((col) => {
          const rows = filtered.filter((l: any) => String(l.status || '').toUpperCase() === col.key);
          return (
            <div
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.key); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); setDragOver(null); setDragging(null); if (id) moveLead(id, col.key); }}
              style={{ minWidth: 240, maxWidth: 280, background: dragOver === col.key ? 'rgba(0,201,255,0.04)' : '#0D1117', border: dragOver === col.key ? '1px solid #00C9FF' : '1px solid #1C2333', borderRadius: 8, display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #1C2333', flexShrink: 0, display: 'flex', justifyContent: 'space-between' }}>
                <strong>{col.label}</strong>
                <Badge tone={col.tone as any}>{rows.length}</Badge>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
                {rows.map((l: any) => {
                  const campaign = campaigns.find((c: any) => c.id === l.campaignId);
                  const days = Math.max(0, Math.floor((Date.now() - new Date(l.updatedAt || l.createdAt || Date.now()).getTime()) / 86400000));
                  return (
                    <div
                      key={l.id}
                      draggable
                      onDragStart={(e) => { setDragging(l.id); e.dataTransfer.setData('text/plain', l.id); }}
                      onDragEnd={() => setDragging(null)}
                      style={{ background: '#111827', border: dragging === l.id ? '1px solid #00C9FF' : '1px solid #1C2333', opacity: dragging === l.id ? 0.5 : 1, borderRadius: 6, padding: 12, marginBottom: 8, cursor: 'grab' }}
                    >
                      <div style={{ fontWeight: 700 }}>{l.businessName || 'Unknown'}</div>
                      <div className="muted">{l.contactName || '—'}</div>
                      <div style={{ marginTop: 6 }}><Badge tone="info">{campaign?.name || 'No campaign'}</Badge></div>
                      <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                        <Badge tone={String(l.fitScore || '').toLowerCase() === 'high' ? 'success' : String(l.fitScore || '').toLowerCase() === 'medium' ? 'warning' : 'default'}>{l.fitScore || 'Low'}</Badge>
                        <Badge tone={String(l.preferredChannel || 'EMAIL').toUpperCase() === 'EMAIL' ? 'info' : 'violet' as any}>{String(l.preferredChannel || 'EMAIL').toUpperCase()}</Badge>
                      </div>
                      <div className="muted" style={{ marginTop: 6 }}>{days} days</div>
                      <Button variant="secondary" onClick={() => window.location.href = `/leads?leadId=${l.id}`} style={{ marginTop: 8 }}>View</Button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
