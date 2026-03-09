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

  return <div className="dash-stack fade-in">
    <section className="page-header"><div className="page-eyebrow">OPERATIONS / SCHEDULER</div><h2 className="page-title" style={{ margin: 0 }}>Scheduler</h2></section>
    <div style={{ display: 'grid', gap: 10 }}>
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
  </div>;
}
