'use client';

import { Card } from '../../components/ui/Card';

export default function HelpPage() {
  return (
    <div className="dash-stack">
      <section className="page-hero">
        <h3>Help Center</h3>
        <p>Operational quick help for Mission Control operators.</p>
      </section>

      <Card title="Core Workflow" subtitle="Fast operator checklist">
        <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
          <li>Import leads from <a href="/campaigns">Campaigns</a>.</li>
          <li>Qualify/update lead statuses in <a href="/leads">Leads</a>.</li>
          <li>Process pending draft decisions in <a href="/approvals">Approvals</a>.</li>
          <li>Review scheduler jobs and runs in <a href="/scheduler">Scheduler</a>.</li>
        </ol>
      </Card>

      <Card title="Runbooks" subtitle="Deployment and recovery references">
        <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
          <li><a href="/audit">Audit Log</a> for critical action traceability.</li>
          <li>Release workflow: <code>docs/RELEASE_WORKFLOW.md</code>.</li>
          <li>Backup/restore: <code>docs/BACKUP_RESTORE.md</code>.</li>
          <li>MVP checklist: <code>docs/MVP_RELEASE_CHECKLIST.md</code>.</li>
        </ul>
      </Card>
    </div>
  );
}
