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

  const [researchAgentSettings, setResearchAgentSettings] = useState<any>({ dailyRunTime: '07:00', maxLeadsPerRun: 25, industries: 'home services, clinics', geographies: 'Toronto,GTA' });
  const [rateLimitGuardrails, setRateLimitGuardrails] = useState<any>({ maxLinkedinDmsPerDay: 20, maxEmailsPerDay: 500 });
  const [contentDefaults, setContentDefaults] = useState<any>({ tone: 'Professional', hashtags: '#ai #automation' });
  const [notificationSettings, setNotificationSettings] = useState<any>({ researchComplete: true, approvalNeeded: true, sendFailure: true });

  const load = async () => {
    setErr('');
    try {
      const res = await fetch(`${base}/api/settings/safety`, { credentials: 'include', headers: { 'x-admin-token': token } });
      if (!res.ok) throw new Error(`Failed to load settings (HTTP ${res.status})`);
      const d = await res.json();
      setSafety(d);
      if (d?.research_agent_settings) setResearchAgentSettings(d.research_agent_settings);
      if (d?.rate_limit_guardrails) setRateLimitGuardrails(d.rate_limit_guardrails);
      if (d?.content_defaults) setContentDefaults(d.content_defaults);
      if (d?.notification_settings) setNotificationSettings(d.notification_settings);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load settings');
    }
  };

  useEffect(() => { load(); }, []);

  const saveAll = async (patch: any = {}) => {
    if (!safety) return;
    setSaving(true);
    setMsg('');
    setErr('');
    try {
      const res = await fetch(`${base}/api/settings/safety`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-admin-token': token, 'x-actor-role': 'admin' },
        body: JSON.stringify({
          dryRunEnabled: !!safety?.dry_run_mode?.enabled,
          outboundChannels: safety?.outbound_channels || {},
          globalPause: !!safety?.global_pause?.paused,
          researchAgentSettings,
          rateLimitGuardrails,
          contentDefaults,
          notificationSettings,
          ...patch,
        }),
      });
      if (!res.ok) throw new Error(`Failed to save settings (HTTP ${res.status})`);
      setSafety(await res.json());
      setMsg('Settings saved.');
    } catch (e: any) {
      setErr(e?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleOutbound = async (channel: 'email' | 'facebook' | 'instagram' | 'linkedin') => {
    const current = safety?.outbound_channels || {};
    const next = { ...current, [channel]: !current[channel] };
    setSafety((s: any) => ({ ...s, outbound_channels: next }));
    await saveAll({ outboundChannels: next });
  };

  return (
    <div className="dash-stack">
      <section className="page-hero"><h3>Settings</h3><p>Safety, research, limits, content defaults, notifications, and danger actions.</p></section>
      {err && <p style={{ color: '#ff9b9b' }}>{err}</p>}
      {msg && <p className="muted">{msg}</p>}

      <Card title="Channel Toggles" subtitle="Outbound gates">
        <div className="table-toolbar" style={{ display: 'grid', gap: 8 }}>
          <Button variant="secondary" disabled={saving} onClick={() => toggleOutbound('email')}>Email: {String(!!safety?.outbound_channels?.email)}</Button>
          <Button variant="secondary" disabled={saving} onClick={() => toggleOutbound('linkedin')}>LinkedIn: {String(!!safety?.outbound_channels?.linkedin)}</Button>
          <Button variant="secondary" disabled={saving} onClick={() => toggleOutbound('facebook')}>Facebook: {String(!!safety?.outbound_channels?.facebook)}</Button>
          <Button variant="secondary" disabled={saving} onClick={() => toggleOutbound('instagram')}>Instagram: {String(!!safety?.outbound_channels?.instagram)}</Button>
        </div>
      </Card>

      <Card title="Research Agent Settings" subtitle="Schedule + targeting">
        <div className="table-toolbar">
          <input className="ui-input" value={researchAgentSettings.dailyRunTime || ''} onChange={(e) => setResearchAgentSettings((s: any) => ({ ...s, dailyRunTime: e.target.value }))} placeholder="Daily run time" />
          <input className="ui-input" value={researchAgentSettings.maxLeadsPerRun || ''} onChange={(e) => setResearchAgentSettings((s: any) => ({ ...s, maxLeadsPerRun: Number(e.target.value || 0) }))} placeholder="Max leads/run" />
          <input className="ui-input" value={researchAgentSettings.industries || ''} onChange={(e) => setResearchAgentSettings((s: any) => ({ ...s, industries: e.target.value }))} placeholder="Industries" />
          <input className="ui-input" value={researchAgentSettings.geographies || ''} onChange={(e) => setResearchAgentSettings((s: any) => ({ ...s, geographies: e.target.value }))} placeholder="Geographies" />
        </div>
        <div className="table-toolbar" style={{ marginTop: 8 }}><Button variant="primary" onClick={() => saveAll()}>Save Research Settings</Button></div>
      </Card>

      <Card title="Rate Limit Guardrails" subtitle="Server-side limits">
        <div className="table-toolbar">
          <input className="ui-input" value={rateLimitGuardrails.maxLinkedinDmsPerDay || ''} onChange={(e) => setRateLimitGuardrails((s: any) => ({ ...s, maxLinkedinDmsPerDay: Math.min(20, Number(e.target.value || 0)) }))} placeholder="Max LinkedIn DMs/day (cap 20)" />
          <input className="ui-input" value={rateLimitGuardrails.maxEmailsPerDay || ''} onChange={(e) => setRateLimitGuardrails((s: any) => ({ ...s, maxEmailsPerDay: Number(e.target.value || 0) }))} placeholder="Max emails/day" />
        </div>
        <div className="table-toolbar" style={{ marginTop: 8 }}><Button variant="primary" onClick={() => saveAll()}>Save Guardrails</Button></div>
      </Card>

      <Card title="Content Defaults" subtitle="Tone + hashtags">
        <div className="table-toolbar">
          <select className="ui-input" value={contentDefaults.tone || 'Professional'} onChange={(e) => setContentDefaults((s: any) => ({ ...s, tone: e.target.value }))}>
            <option>Professional</option><option>Casual</option><option>Bold</option>
          </select>
          <input className="ui-input" value={contentDefaults.hashtags || ''} onChange={(e) => setContentDefaults((s: any) => ({ ...s, hashtags: e.target.value }))} placeholder="Default hashtags" />
        </div>
        <div className="table-toolbar" style={{ marginTop: 8 }}><Button variant="primary" onClick={() => saveAll()}>Save Content Defaults</Button></div>
      </Card>

      <Card title="Notification Settings" subtitle="Alert preferences">
        <div className="table-toolbar" style={{ display: 'grid', gap: 8 }}>
          <Button variant="secondary" onClick={() => setNotificationSettings((s: any) => ({ ...s, researchComplete: !s.researchComplete }))}>Research complete: {String(!!notificationSettings.researchComplete)}</Button>
          <Button variant="secondary" onClick={() => setNotificationSettings((s: any) => ({ ...s, approvalNeeded: !s.approvalNeeded }))}>Approval needed: {String(!!notificationSettings.approvalNeeded)}</Button>
          <Button variant="secondary" onClick={() => setNotificationSettings((s: any) => ({ ...s, sendFailure: !s.sendFailure }))}>Send failure: {String(!!notificationSettings.sendFailure)}</Button>
          <Button variant="primary" onClick={() => saveAll()}>Save Notifications</Button>
        </div>
      </Card>

      <Card title="Danger Zone" subtitle="High impact operations">
        <div className="table-toolbar">
          <Button variant="ghost" onClick={async () => {
            await fetch(`${base}/api/settings/safety/danger/clear-draft-queue`, { method: 'POST', credentials: 'include', headers: { 'x-admin-token': token, 'x-actor-role': 'admin' } });
            setMsg('Draft queue cleared.');
          }}>Clear Draft Queue</Button>
          <Button variant="ghost" onClick={async () => {
            await fetch(`${base}/api/settings/safety/danger/reset-agent-states`, { method: 'POST', credentials: 'include', headers: { 'x-admin-token': token, 'x-actor-role': 'admin' } });
            setMsg('Agent states reset.');
          }}>Reset Agent States</Button>
        </div>
      </Card>
    </div>
  );
}
