'use client';

import { useMemo, useState, useEffect } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AuditPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [action, setAction] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      const a = await fetch(`${base}/api/audit`, { credentials: 'include' }).then(r => r.json()).catch(() => null);
      if (Array.isArray(a)) { setRows(a); return; }
      const f = await fetch(`${base}/api/events/feed`, { credentials: 'include' }).then(r => r.json()).catch(() => []);
      setRows(Array.isArray(f) ? f : []);
    })();
  }, []);

  const filtered = useMemo(() => rows.filter((r: any) => {
    const text = `${r.action || r.eventType || ''} ${r.entity || r.resourceType || ''} ${r.user || r.createdBy || 'admin'} ${JSON.stringify(r.payload || '')}`.toLowerCase();
    const hitQ = !q.trim() || text.includes(q.toLowerCase());
    const hitAction = action === 'ALL' || String(r.action || r.eventType || '').toLowerCase().includes(action.toLowerCase().replace(/\s/g, '_'));
    const ts = new Date(r.timestamp || r.createdAt || Date.now()).getTime();
    const fromOk = !from || ts >= new Date(from).getTime();
    const toOk = !to || ts <= new Date(to + 'T23:59:59').getTime();
    return hitQ && hitAction && fromOk && toOk;
  }), [rows, q, action, from, to]);

  const start = (page - 1) * 25;
  const view = filtered.slice(start, start + 25);

  const exportCsv = () => {
    const csv = ['timestamp,action,entity,user,detail,status', ...filtered.map((r: any) => [
      new Date(r.timestamp || r.createdAt || Date.now()).toISOString(),
      r.action || r.eventType || '',
      r.entity || r.resourceType || r.resourceId || '',
      r.user || r.createdBy || 'admin',
      (r.detail || JSON.stringify(r.payload || '') || '').replace(/,/g, ';'),
      r.status || 'SUCCESS',
    ].join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'audit.csv'; a.click();
  };

  return <div className="dash-stack fade-in">
    <section className="page-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
      <div><div className="page-eyebrow">SYSTEM / AUDIT</div><h2 className="page-title" style={{ margin: 0 }}>Audit Log</h2><p className="page-desc">Full activity log of all actions taken in the system</p></div>
      <Button variant="ghost" onClick={exportCsv}>Export CSV</Button>
    </section>

    <div className="table-toolbar">
      <input className="ui-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search action/entity/user/detail" />
      <select className="ui-input" value={action} onChange={(e) => setAction(e.target.value)}>
        {['ALL','Research Run','Draft Created','Draft Approved','Draft Rejected','Lead Created','Lead Updated','Campaign Created','Settings Changed','Send Attempted'].map((x) => <option key={x}>{x}</option>)}
      </select>
      <input className="ui-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      <input className="ui-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      <Button variant="ghost" onClick={() => { setQ(''); setAction('ALL'); setFrom(''); setTo(''); }}>Clear filters</Button>
    </div>

    {!rows.length ? <div className="ui-card" style={{ padding: 24, textAlign: 'center' }}>No audit events yet. Actions you take will be logged here.</div> :
      <table className="ui-table"><thead><tr><th>Timestamp</th><th>Action</th><th>Entity</th><th>User</th><th>Detail</th><th>Status</th></tr></thead><tbody>
        {view.map((r: any, i: number) => {
          const act = r.action || r.eventType || 'Unknown';
          const tone: any = act.toLowerCase().includes('research') ? 'info' : act.toLowerCase().includes('draft') ? 'violet' : act.toLowerCase().includes('lead') ? 'success' : act.toLowerCase().includes('campaign') ? 'warning' : act.toLowerCase().includes('send') ? 'danger' : 'default';
          const st = String(r.status || 'SUCCESS').toUpperCase();
          return <tr key={r.id || i} style={{ background: 'transparent' }}>
            <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{new Date(r.timestamp || r.createdAt || Date.now()).toLocaleString()}</td>
            <td><Badge tone={tone}>{act}</Badge></td>
            <td>{r.entity || r.resourceType || r.resourceId || '—'}</td>
            <td>admin</td>
            <td>{r.detail || JSON.stringify(r.payload || {})}</td>
            <td><Badge tone={st === 'SUCCESS' ? 'success' : st === 'FAILED' ? 'danger' : 'warning'}>{st}</Badge></td>
          </tr>;
        })}
      </tbody></table>}

    <div className="table-toolbar"><span className="muted">{Math.min(start + 1, filtered.length)}-{Math.min(start + 25, filtered.length)} of {filtered.length}</span><Button variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button><Button variant="secondary" onClick={() => setPage((p) => (start + 25 < filtered.length ? p + 1 : p))}>Next</Button></div>
  </div>;
}
