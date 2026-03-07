'use client';

import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

export default function SettingsPage() {
  const [safety, setSafety] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setErr('');
    try {
      const res = await fetch(`${base}/api/settings/safety`, { headers: { 'x-admin-token': token } });
      if (!res.ok) throw new Error(`Failed to load settings (HTTP ${res.status})`);
      setSafety(await res.json());
    } catch (e: any) {
      setErr(e?.message || 'Failed to load settings');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleOutbound = async (channel: 'email' | 'facebook' | 'instagram' | 'linkedin') => {
    if (!safety) return;
    setSaving(true);
    setMsg('');
    setErr('');

    const next = {
      ...safety,
      outbound: {
        ...safety.outbound,
        [channel]: !safety?.outbound?.[channel],
      },
    };

    try {
      const res = await fetch(`${base}/api/settings/safety`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-admin-token': token,
          'x-actor-role': 'admin',
        },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error(`Failed to update settings (HTTP ${res.status})`);
      setSafety(await res.json());
      setMsg(`Updated ${channel} setting.`);
    } catch (e: any) {
      setErr(e?.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dash-stack">
      <section className="page-hero">
        <h3>Settings</h3>
        <p>Operational safety controls for outbound channels.</p>
      </section>

      <Card title="Safety Controls" subtitle="Live settings from /api/settings/safety">
        {err && <p style={{ color: '#ff9b9b' }}>{err}</p>}
        {msg && <p className="muted">{msg}</p>}

        {!safety ? (
          <p className="muted">Loading settings...</p>
        ) : (
          <div className="table-toolbar" style={{ display: 'grid', gap: 8 }}>
            <Button variant="secondary" disabled={saving} onClick={() => toggleOutbound('email')}>
              Email: {String(!!safety?.outbound?.email)}
            </Button>
            <Button variant="secondary" disabled={saving} onClick={() => toggleOutbound('facebook')}>
              Facebook: {String(!!safety?.outbound?.facebook)}
            </Button>
            <Button variant="secondary" disabled={saving} onClick={() => toggleOutbound('instagram')}>
              Instagram: {String(!!safety?.outbound?.instagram)}
            </Button>
            <Button variant="secondary" disabled={saving} onClick={() => toggleOutbound('linkedin')}>
              LinkedIn: {String(!!safety?.outbound?.linkedin)}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
