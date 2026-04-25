'use client';

import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const cronToText = (cron: string) => {
  if (cron === '0 9 * * *') return 'Daily at 9:00 AM';
  if (cron === '0 9 * * 1-5') return 'Weekdays at 9:00 AM';
  if (cron === '0 */6 * * *') return 'Every 6 hours';
  return cron;
};

const toCron = (freq: string, time: string, days: string[], custom: string) => {
  if (freq === 'CUSTOM') return custom;
  if (freq === 'HOURLY') return '0 * * * *';
  if (freq === 'DAILY') return `0 ${time.split(':')[0]} * * *`;
  if (freq === 'WEEKDAYS') return `0 ${time.split(':')[0]} * * 1-5`;
  if (freq === 'WEEKLY') return `0 ${time.split(':')[0]} * * ${days.map((d) => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(d)).join(',')}`;
  return '0 9 * * *';
};

export default function SchedulerPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [editor, setEditor] = useState<Record<string, any>>({});

  const load = async () => {
    const rows = await fetch(`${base}/api/scheduler/jobs`, { credentials: 'include' }).then((r) => r.json()).catch(() => []);
    setJobs(Array.isArray(rows) ? rows : []);
  };
  useEffect(() => { load(); }, []);

  const systemCrons = [
    { name: '🔁 Follow-up Cron', schedule: 'Every 6 hours', purpose: 'Generates Day 3/7/14 AI follow-up drafts for contacted leads', status: 'Active' },
    { name: '⏰ Scheduled Autorun', schedule: 'Every 15 minutes', purpose: 'Fires campaigns whose scheduledAutorunAt has passed', status: 'Active' },
    { name: '📮 Queue Drain', schedule: 'Every 60 seconds', purpose: 'Processes approved drafts in the outbound queue and sends via Resend', status: 'Active' },
    { name: '📊 Delivery Tracker', schedule: 'Every 30 minutes', purpose: 'Polls Resend API for delivered/opened/clicked/bounced events', status: 'Active' },
    { name: '📣 Social Publish Cron', schedule: 'Every 60 seconds', purpose: 'Publishes scheduled social posts (LinkedIn / Facebook / Instagram) when their scheduledAt passes', status: 'Active' },
    { name: '⚡ Social Autopilot', schedule: 'Every 60 minutes', purpose: 'Auto-generates RevoAI-product-focused posts (with optional images), scheduled into best-time windows. Drafts wait for your approval unless autoApprove is on.', status: 'Active' },
  ];

  return <div className="dash-stack fade-in">
    <section className="page-header"><div className="page-eyebrow">OPERATIONS / SCHEDULER</div><h2 className="page-title" style={{ margin: 0 }}>Scheduler</h2></section>

    <Card title="Live System Crons" subtitle="Background workers running inside the API container">
      <div style={{ display: 'grid', gap: 8 }}>
        {systemCrons.map((c) => (
          <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'rgba(16,214,138,.04)', border: '1px solid rgba(16,214,138,.18)', borderRadius: 8 }}>
            <div>
              <div style={{ fontWeight: 700, color: '#E8EDF5' }}>{c.name}</div>
              <div className="muted" style={{ fontSize: 12 }}>{c.purpose}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#10D68A', letterSpacing: '.06em' }}>● {c.status}</div>
              <div className="muted" style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>{c.schedule}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 11, marginTop: 10, marginBottom: 0 }}>
        These run in-memory inside the API process. Disable individually via env flags (FOLLOWUP_AUTOCRON, SCHEDULED_AUTORUN, QUEUE_DRAIN, DELIVERY_TRACKER_AUTOCRON).
      </p>
    </Card>

    <Card title="DB-Stored Scheduler Jobs" subtitle={jobs.length ? `${jobs.length} custom cron job${jobs.length === 1 ? '' : 's'}` : 'None configured yet'}>
      <div style={{ display: 'grid', gap: 10 }}>
      {!jobs.length && (
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          No custom cron jobs in the database. The live system crons above handle the full outreach pipeline. Add custom jobs here later if you need one-off scheduled tasks.
        </p>
      )}
      {jobs.map((j: any) => {
        const e = editor[j.id] || { frequency: 'DAILY', time: '09:00', days: ['Mon'], custom: j.cronExpr };
        return <Card key={j.id} title={j.name} subtitle={cronToText(j.cronExpr)}>
          <div className="table-toolbar">
            <select className="ui-input" value={e.frequency} onChange={(x) => setEditor((s) => ({ ...s, [j.id]: { ...e, frequency: x.target.value } }))}><option value="HOURLY">Hourly</option><option value="DAILY">Daily</option><option value="WEEKDAYS">Weekdays</option><option value="WEEKLY">Weekly</option><option value="CUSTOM">Custom</option></select>
            {['DAILY','WEEKDAYS','WEEKLY'].includes(e.frequency) && <input className="ui-input" type="time" value={e.time} onChange={(x) => setEditor((s) => ({ ...s, [j.id]: { ...e, time: x.target.value } }))} />}
            {e.frequency === 'WEEKLY' && ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => <Button key={d} variant={e.days.includes(d) ? 'primary' : 'secondary'} onClick={() => setEditor((s) => ({ ...s, [j.id]: { ...e, days: e.days.includes(d) ? e.days.filter((x: string) => x !== d) : [...e.days, d] } }))}>{d}</Button>)}
            {e.frequency === 'CUSTOM' && <input className="ui-input" value={e.custom} onChange={(x) => setEditor((s) => ({ ...s, [j.id]: { ...e, custom: x.target.value } }))} placeholder="cron" />}
            <Button variant="primary" onClick={async () => { const cronExpr = toCron(e.frequency, e.time, e.days, e.custom); await fetch(`${base}/api/scheduler/jobs/${j.id}`, { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cronExpr }) }); await load(); }}>Save</Button>
          </div>
        </Card>;
      })}
      </div>
    </Card>
  </div>;
}
