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
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    const url = `${base}/api/drafts${q ? `?search=${encodeURIComponent(q)}` : ''}`;
    fetch(url, { headers: { 'x-admin-token': token } })
      .then((r) => r.json())
      .then((d) => setDrafts(d || []));
  };

  useEffect(() => {
    load();
  }, [q]);

  const markSent = async (id: string) => {
    setErr('');
    try {
      await postJson(`/drafts/${id}/mark-sent-manual`);
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <Card title="Drafts" subtitle="Review, approval, and manual sent actions">
      <div className="table-toolbar" style={{ marginBottom: 12 }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search drafts" aria-label="Search drafts" />
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
          {drafts.map((d: any) => (
            <tr key={d.id}>
              <td>{d.channel}</td>
              <td>{d.draftType}</td>
              <td><Badge tone={d.status === 'APPROVED' ? 'success' : 'default'}>{d.status}</Badge></td>
              <td>v{d.currentVersion}</td>
              <td>
                {d.channel === 'LINKEDIN' && d.status === 'APPROVED' ? (
                  <Button variant="primary" onClick={() => markSent(d.id)}>
                    Mark Sent
                  </Button>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
