'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

import { API_BASE, apiHeaders } from '../../lib/api';

export default function ContentPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [tab, setTab] = useState<'all' | 'needs_approval' | 'approved' | 'scheduled' | 'posted'>('all');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ channel: 'LINKEDIN', body: '', scheduledAt: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    const q = tab === 'all' ? '' : `?status=${tab}`;
    const res = await fetch(`${API_BASE}/api/social-posts${q}`, { credentials: 'include', headers: apiHeaders });
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(data?.error?.message || `Failed to load posts (HTTP ${res.status})`);
    setPosts(Array.isArray(data) ? data : []);
  };

  useEffect(() => { load().catch(() => setPosts([])); }, [tab]);

  const createPost = async () => {
    setErr('');
    setMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/social-posts`, {
        method: 'POST',
        credentials: 'include',
        headers: apiHeaders,
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

  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState('');

  const filtered = useMemo(() => posts, [posts]);

  const approvePost = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/social-posts/${id}/approve`, { method: 'POST', credentials: 'include', headers: apiHeaders });
    if (!res.ok) throw new Error(`Approve failed (${res.status})`);
  };

  const rejectPost = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/social-posts/${id}/reject`, {
      method: 'POST',
      credentials: 'include',
      headers: apiHeaders,
      body: JSON.stringify({ notes: 'Rejected in content queue' }),
    });
    if (!res.ok) throw new Error(`Reject failed (${res.status})`);
  };

  const savePostEdit = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/social-posts/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: apiHeaders,
      body: JSON.stringify({ body: editingBody }),
    });
    if (!res.ok) throw new Error(`Edit failed (${res.status})`);
  };

  const schedulePost = async (id: string) => {
    const when = form.scheduledAt || new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const res = await fetch(`${API_BASE}/api/social-posts/${id}/schedule`, {
      method: 'POST',
      credentials: 'include',
      headers: apiHeaders,
      body: JSON.stringify({ scheduledAt: when }),
    });
    if (!res.ok) throw new Error(`Schedule failed (${res.status})`);
  };

  return (
    <div className="dash-stack fade-in">
      <section className="page-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="page-eyebrow">INTELLIGENCE / CONTENT</div>
          <h2 className="page-title" style={{ margin: 0 }}>Content Calendar</h2>
          <p className="page-desc">Draft, approve, and schedule LinkedIn/Facebook posts. AI content requires approval before publish.</p>
        </div>
        <div className="table-toolbar" style={{ alignSelf: 'flex-start' }}>
          <Button variant="secondary" onClick={() => setMsg('AI Generate hook ready for Phase 2')}>✦ AI Generate</Button>
          <Button variant="primary" onClick={() => setShowNew((v) => !v)}>{showNew ? 'Cancel' : '+ New Post'}</Button>
        </div>
      </section>

      <div className="tabs">
        {[
          ['all', 'All Posts'],
          ['needs_approval', 'Needs Approval'],
          ['scheduled', 'Scheduled'],
          ['posted', 'Posted'],
        ].map(([k, label]) => (
          <div key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k as any)}>{label}</div>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }}>
        {filtered.map((p: any) => (
          <div key={p.id} className="post-card">
            <div className="flex gap-8 mb-8">
              <span className={`badge ${String(p.channel) === 'LINKEDIN' ? 'violet' : 'new'}`}>{String(p.channel || '').toUpperCase()}</span>
              <span className={`badge ${String(p.status) === 'needs_approval' ? 'pending' : String(p.status) === 'approved' ? 'active' : String(p.status) === 'posted' ? 'done' : 'new'}`}>{String(p.status || '').toUpperCase()}</span>
              <span className="text-xs mono text-dim ml-auto">{p.scheduledAt ? new Date(p.scheduledAt).toLocaleString() : 'No schedule'}</span>
            </div>
            <div className="post-preview">
              {editingPostId === p.id ? (
                <textarea className="ui-textarea" value={editingBody} onChange={(e) => setEditingBody(e.target.value)} />
              ) : (
                p.body
              )}
            </div>
            <div className="table-toolbar" style={{ marginTop: 10 }}>
              {String(p.status) === 'needs_approval' && (
                <Button variant="primary" onClick={async () => { try { setErr(''); await approvePost(p.id); setMsg('Approved'); await load(); } catch (e: any) { setErr(e?.message || 'Approve failed'); } }}>✓ Approve</Button>
              )}
              {String(p.status) === 'needs_approval' && (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      if (editingPostId === p.id) {
                        await savePostEdit(p.id);
                        setEditingPostId(null);
                        setEditingBody('');
                        setMsg('Edit saved');
                        await load();
                        return;
                      }
                      setEditingPostId(p.id);
                      setEditingBody(String(p.body || ''));
                    } catch (e: any) {
                      setErr(e?.message || 'Edit failed');
                    }
                  }}
                >
                  {editingPostId === p.id ? 'Save Edit' : '✎ Edit'}
                </Button>
              )}
              {String(p.status) === 'needs_approval' && <Button variant="ghost" onClick={async () => { try { await rejectPost(p.id); setMsg('Moved back to draft'); await load(); } catch (e: any) { setErr(e?.message || 'Reject failed'); } }}>✕</Button>}
              {['approved', 'needs_approval'].includes(String(p.status)) && <Button variant="secondary" onClick={async () => { try { await schedulePost(p.id); setMsg('Scheduled'); await load(); } catch (e: any) { setErr(e?.message || 'Schedule failed'); } }}>Schedule</Button>}
              {String(p.channel) === 'LINKEDIN' && ['approved', 'scheduled'].includes(String(p.status)) && (
                <Button
                  variant="primary"
                  onClick={async () => {
                    setErr('');
                    setMsg('');
                    try {
                      const res = await fetch(`${API_BASE}/api/linkedin/post`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: apiHeaders,
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
              {String(p.channel) === 'FACEBOOK' && ['approved', 'scheduled'].includes(String(p.status)) && (
                <Button
                  variant="primary"
                  onClick={async () => {
                    setErr('');
                    setMsg('');
                    try {
                      const res = await fetch(`${API_BASE}/api/facebook/publish`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: apiHeaders,
                        body: JSON.stringify({ socialPostId: p.id, mode: 'socialPost' }),
                      });
                      const j = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(j?.error?.message || `Facebook publish failed (${res.status})`);
                      setMsg('Published to Facebook.');
                      await load();
                    } catch (e: any) {
                      setErr(e?.message || 'Facebook publish failed');
                    }
                  }}
                >
                  Publish Facebook
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
