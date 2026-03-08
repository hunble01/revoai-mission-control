'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

export default function ContentPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [tab, setTab] = useState<'all' | 'needs_approval' | 'approved' | 'scheduled' | 'posted'>('all');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ channel: 'LINKEDIN', body: '', scheduledAt: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    const q = tab === 'all' ? '' : `?status=${tab}`;
    const res = await fetch(`${base}/api/social-posts${q}`, { credentials: 'include', headers: { 'x-admin-token': token } });
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(data?.error?.message || `Failed to load posts (HTTP ${res.status})`);
    setPosts(Array.isArray(data) ? data : []);
  };

  useEffect(() => { load().catch(() => setPosts([])); }, [tab]);

  const createPost = async () => {
    setErr('');
    setMsg('');
    try {
      const res = await fetch(`${base}/api/social-posts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ ...form, status: 'needs_approval' }),
      });
      if (!res.ok) throw new Error(`Failed to create post (HTTP ${res.status})`);
      setMsg('Post created in needs approval.');
      setShowNew(false);
      setForm({ channel: 'LINKEDIN', body: '', scheduledAt: '' });
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Create failed');
    }
  };

  const filtered = useMemo(() => posts, [posts]);

  return (
    <div className="dash-stack">
      <section className="page-hero">
        <h3>Content Calendar</h3>
        <p>Draft, approve, and schedule LinkedIn/Facebook posts.</p>
      </section>

      <div className="table-toolbar">
        <Button variant="secondary" onClick={() => setShowNew((v) => !v)}>{showNew ? 'Cancel' : 'New Post'}</Button>
        <Button variant="primary" onClick={() => setMsg('AI Generate hook ready for Phase 2')}>AI Generate</Button>
      </div>

      <div className="table-toolbar" style={{ marginTop: 8 }}>
        {['all', 'needs_approval', 'approved', 'scheduled', 'posted'].map((t) => (
          <Button key={t} variant={tab === t ? 'primary' : 'secondary'} onClick={() => setTab(t as any)}>{t}</Button>
        ))}
      </div>

      {showNew && (
        <Card title="New Post" subtitle="Create social post draft">
          <div className="table-toolbar">
            <select className="ui-input" value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}>
              <option value="LINKEDIN">LinkedIn</option>
              <option value="FACEBOOK">Facebook</option>
            </select>
            <input className="ui-input" placeholder="Schedule ISO datetime (optional)" value={form.scheduledAt} onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))} />
          </div>
          <textarea className="ui-textarea" placeholder="Post body" value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
          <div className="table-toolbar" style={{ marginTop: 8 }}>
            <Button variant="primary" onClick={createPost} disabled={!form.body.trim()}>Create</Button>
          </div>
        </Card>
      )}

      {err && <p style={{ color: '#ff9b9b' }}>{err}</p>}
      {msg && <p className="muted">{msg}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
        {filtered.map((p: any) => (
          <Card key={p.id} title={`${p.channel} • ${p.status}`} subtitle={p.scheduledAt ? `Scheduled ${new Date(p.scheduledAt).toLocaleString()}` : 'No schedule'}>
            <p style={{ marginTop: 0 }}>{p.body}</p>
            <div className="table-toolbar">
              <Badge tone={p.status === 'approved' ? 'success' : p.status === 'needs_approval' ? 'warning' : 'default'}>{p.status}</Badge>
              {String(p.channel) === 'LINKEDIN' && ['approved', 'scheduled'].includes(String(p.status)) && (
                <Button
                  variant="primary"
                  onClick={async () => {
                    setErr('');
                    setMsg('');
                    try {
                      const res = await fetch(`${base}/api/linkedin/post`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'content-type': 'application/json', 'x-admin-token': token },
                        body: JSON.stringify({ socialPostId: p.id }),
                      });
                      const j = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(j?.error?.message || `LinkedIn publish failed (${res.status})`);
                      setMsg('Published to LinkedIn.');
                      await load();
                    } catch (e: any) {
                      setErr(e?.message || 'LinkedIn publish failed');
                    }
                  }}
                >
                  Publish LinkedIn
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
