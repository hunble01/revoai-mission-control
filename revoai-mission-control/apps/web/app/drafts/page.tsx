'use client';
import { useEffect, useState } from 'react';
import { postJson } from '../../components/fetch-json';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Table } from '../../components/ui/Table';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [err, setErr] = useState('');
  const [compareDraft, setCompareDraft] = useState<any>(null);
  const sentDraftIds = new Set(history.filter((h: any) => h?.status === 'sent' && h?.draftId).map((h: any) => h.draftId));

  const load = async () => {
    try {
      const url = `${base}/api/drafts${q ? `?search=${encodeURIComponent(q)}` : ''}`;
      const [draftsRes, historyRes] = await Promise.all([
        fetch(url, { credentials: 'include', headers: { 'x-admin-token': token } }),
        fetch(`${base}/api/drafts/send-history?limit=60`, { credentials: 'include', headers: { 'x-admin-token': token } }),
      ]);

      const draftsJson = await draftsRes.json().catch(() => ({}));
      if (!draftsRes.ok) throw new Error(draftsJson?.error?.message || `Failed to load drafts (HTTP ${draftsRes.status})`);
      const historyJson = await historyRes.json().catch(() => ([]));

      setDrafts(Array.isArray(draftsJson) ? draftsJson : []);
      setHistory(Array.isArray(historyJson) ? historyJson : []);
    } catch (e: any) {
      setDrafts([]);
      setHistory([]);
      setErr(e?.message || 'Failed to load drafts');
    }
  };

  useEffect(() => {
    load();
  }, [q]);

  const visibleDrafts = drafts.filter((d: any) => {
    if (statusFilter !== 'ALL' && String(d.status || '').toUpperCase() !== statusFilter) return false;
    if (channelFilter !== 'ALL' && String(d.channel || '').toUpperCase() !== channelFilter) return false;
    return true;
  });

  const sendLinkedin = async (id: string) => {
    setErr('');
    try {
      await postJson(`/drafts/${id}/send-linkedin`);
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const sendEmail = async (id: string) => {
    setErr('');
    try {
      await postJson(`/drafts/${id}/send-email`);
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const sendFacebook = async (id: string) => {
    setErr('');
    try {
      await postJson(`/drafts/${id}/send-facebook`);
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <Card title="Drafts" subtitle="Review, approval, and manual sent actions">
      <div className="table-toolbar" style={{ marginBottom: 12 }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search drafts" aria-label="Search drafts" />
        <select className="ui-input" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
          <option value="ALL">All channels</option>
          <option value="EMAIL">EMAIL</option>
          <option value="LINKEDIN">LINKEDIN</option>
          <option value="FACEBOOK">FACEBOOK</option>
        </select>
        <select className="ui-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">All statuses</option>
          <option value="APPROVED">APPROVED</option>
          <option value="NEEDS_APPROVAL">NEEDS_APPROVAL</option>
          <option value="DRAFT">DRAFT</option>
          <option value="REJECTED">REJECTED</option>
        </select>
      </div>
      {err && <p className="error-text">{err}</p>}

      <Table>
        <thead>
          <tr>
            <th>Channel</th>
            <th>Type</th>
            <th>Status</th>
            <th>Version</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {visibleDrafts.map((d: any) => (
            <tr key={d.id}>
              <td>{d.channel}</td>
              <td>{d.draftType}</td>
              <td><Badge tone={d.status === 'APPROVED' ? 'success' : 'default'}>{d.status}</Badge></td>
              <td>v{d.currentVersion}</td>
              <td>
                {d.channel === 'LINKEDIN' && d.status === 'APPROVED' ? (
                  <Button variant="primary" onClick={() => sendLinkedin(d.id)}>
                    Send via LinkedIn
                  </Button>
                ) : d.channel === 'EMAIL' && d.status === 'APPROVED' ? (
                  sentDraftIds.has(d.id) ? (
                    <span className="muted">Sent</span>
                  ) : (
                    <Button variant="primary" onClick={() => sendEmail(d.id)}>
                      Send Email
                    </Button>
                  )
                ) : d.channel === 'FACEBOOK' && d.status === 'APPROVED' ? (
                  <Button variant="primary" onClick={() => sendFacebook(d.id)}>
                    Send Facebook
                  </Button>
                ) : (
                  <span className="muted">—</span>
                )}
                <Button variant="secondary" onClick={() => setCompareDraft(d)}>Compare v1 vs v2</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {compareDraft && (
        <Card title="Draft Version Compare" subtitle={`Draft ${compareDraft.id.slice(0, 8)}`}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="ui-card" style={{ padding: 10 }}>
              <strong>v1</strong>
              <p className="muted">(baseline snapshot unavailable in current API)</p>
            </div>
            <div className="ui-card" style={{ padding: 10 }}>
              <strong>v2/current</strong>
              <p>{compareDraft.content || '(content hidden in list payload)'}</p>
            </div>
          </div>
          <div className="table-toolbar" style={{ marginTop: 8 }}>
            <Button variant="secondary" onClick={() => setCompareDraft(null)}>Close</Button>
          </div>
        </Card>
      )}

      <div style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 8 }}>Send History</h3>
        <Table>
          <thead>
            <tr>
              <th>Recipient</th>
              <th>Provider</th>
              <th>Status</th>
              <th>Timestamp</th>
              <th>External ID</th>
              <th>Failure Class</th>
              <th>Replied</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h: any) => (
              <tr key={h.id}>
                <td>{h.recipient || '—'}</td>
                <td>{h.provider}</td>
                <td>{h.status}</td>
                <td>{h.timestamp ? new Date(h.timestamp).toLocaleString() : '—'}</td>
                <td>{h.externalMessageId || '—'}</td>
                <td>{h.failureClassification || '—'}</td>
                <td>{h.replyStatus || 'Pending'}</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">No send records yet.</td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
    </Card>
  );
}
