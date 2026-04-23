'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { CountUp } from '../components/ui/CountUp';
import { SkeletonRows } from '../components/ui/Skeleton';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

export default function Home() {
  const [leads, setLeads] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [safety, setSafety] = useState<any>(null);
  const [researchRuns, setResearchRuns] = useState<any[]>([]);
  const [sendHistory, setSendHistory] = useState<any[]>([]);
  const [socialPosts, setSocialPosts] = useState<any[]>([]);
  const [queueOverview, setQueueOverview] = useState<any>(null);
  const [needsApproval, setNeedsApproval] = useState<any[]>([]);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [emailPipeline, setEmailPipeline] = useState<any>(null);
  const [lastRefresh, setLastRefresh] = useState<string>('—');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers = { 'x-admin-token': token };
    Promise.all([
      fetch(`${base}/api/leads`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => []),
      fetch(`${base}/api/drafts`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => []),
      fetch(`${base}/api/drafts?status=NEEDS_APPROVAL`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => []),
      fetch(`${base}/api/settings/safety`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => null),
      fetch(`${base}/api/research/runs`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => []),
      fetch(`${base}/api/drafts/send-history?limit=100`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => []),
      fetch(`${base}/api/social-posts/history?limit=100`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => []),
      fetch(`${base}/api/drafts/queue/overview`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => null),
      fetch(`${base}/api/events/feed?limit=50`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => []),
      fetch(`${base}/api/drafts/email-pipeline/status`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => null),
    ]).then(([l, d, na, s, rr, sh, sp, qo, feed, email]) => {
      setLeads(Array.isArray(l) ? l : []);
      setDrafts(Array.isArray(d) ? d : []);
      setNeedsApproval(Array.isArray(na) ? na : []);
      setSafety(s);
      setResearchRuns(Array.isArray(rr) ? rr : []);
      setSendHistory(Array.isArray(sh) ? sh : []);
      setSocialPosts(Array.isArray(sp) ? sp : []);
      setQueueOverview(qo || null);
      setActivityFeed(Array.isArray(feed) ? feed : []);
      setEmailPipeline(email || null);
      setLastRefresh(new Date().toLocaleTimeString());
    }).finally(() => setLoading(false));
  }, []);

  const kpis = useMemo(() => {
    const statusCount = (value: string) => leads.filter((l) => String(l.status || '').toUpperCase() === value).length;
    const postsScheduled = socialPosts.filter((p) => String(p.status || '').toLowerCase() === 'scheduled').length;
    const postsPosted = socialPosts.filter((p) => String(p.status || '').toLowerCase() === 'posted').length;
    const sendsToday = sendHistory.filter((s) => s.timestamp && new Date(s.timestamp).toDateString() === new Date().toDateString() && String(s.status).toLowerCase() === 'sent').length;

    return [
      { label: 'Leads Found', value: leads.length, meta: 'Pipeline volume' },
      { label: 'Needs Approval', value: needsApproval.length, meta: 'Action queue' },
      { label: 'Queued Sends', value: Number(queueOverview?.counts?.queued || 0), meta: 'Outbound queue' },
      { label: 'Sent Today', value: sendsToday, meta: 'Execution output' },
      { label: 'Posts Scheduled', value: postsScheduled, meta: 'Publishing queue' },
      { label: 'Posts Posted', value: postsPosted, meta: 'Social output' },
      { label: 'Replies', value: statusCount('REPLIED'), meta: 'Conversation wins' },
      { label: 'Booked', value: statusCount('BOOKED'), meta: 'Appointments won' },
    ];
  }, [leads, needsApproval, queueOverview, sendHistory, socialPosts]);

  return (
    <div className="dash-stack">
      <section className="hero-panel">
        <div className="hero-eyebrow"><span className="live-dot" /> MISSION CONTROL · LIVE</div>
        <h1 className="hero-title">Your outbound engine, in one view.</h1>
        <p className="hero-desc">
          Research → enrichment → AI drafts → approval → send. Watch every stage in real time, jump in where the
          system needs you, ship the rest on autopilot.
        </p>
        <div className="hero-actions">
          <Link href="/campaigns" prefetch className="hero-cta">⚡ Run a campaign</Link>
          <Link href="/approvals" prefetch className="hero-cta-ghost">Open approvals queue ({needsApproval.length})</Link>
          <Link href="/feed" prefetch className="hero-cta-ghost">Live feed</Link>
        </div>
        <div className="hero-meta">
          <span>Leads<strong>{leads.length}</strong></span>
          <span>Awaiting approval<strong>{needsApproval.length}</strong></span>
          <span>Queued<strong>{Number(queueOverview?.counts?.queued || 0)}</strong></span>
          <span>Last refresh<strong>{lastRefresh}</strong></span>
        </div>
      </section>

      {loading ? (
        <Card title="Loading overview" subtitle="Fetching operational data">
          <SkeletonRows rows={5} />
        </Card>
      ) : (
      <>
      <section className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {kpis.map((k, i) => (
          <div key={k.label} className={`kpi-card ${i % 4 === 0 ? 'cyan' : i % 4 === 1 ? 'emerald' : i % 4 === 2 ? 'amber' : 'violet'}`}>
            <div className="kpi-label">{k.label}</div>
            <div className={`kpi-value ${i % 4 === 0 ? 'cyan' : i % 4 === 1 ? 'emerald' : i % 4 === 2 ? 'amber' : 'violet'}`}><CountUp value={Number(k.value) || 0} /></div>
            <div className="kpi-delta">{k.meta}</div>
          </div>
        ))}
      </section>

      <section className="split-panels">
        <Card title="Research Runs" subtitle="Latest run health">
          <Table>
            <thead><tr><th>Run</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>
              {researchRuns.slice(0, 6).map((r: any) => (
                <tr key={r.id}><td>{r.campaignName || r.campaignId || 'General'}</td><td><Badge tone={String(r.status) === 'complete' ? 'success' : 'warning'}>{String(r.status || '').toUpperCase()}</Badge></td><td>{new Date(r.createdAt).toLocaleString()}</td></tr>
              ))}
              {!researchRuns.length && <tr><td colSpan={3} className="muted">No research runs yet.</td></tr>}
            </tbody>
          </Table>
        </Card>

        <Card title="Approvals Queue" subtitle="Pending human approval">
          <Table>
            <thead><tr><th>Lead</th><th>Channel</th><th>Status</th></tr></thead>
            <tbody>
              {needsApproval.slice(0, 6).map((d: any) => (
                <tr key={d.id}><td>{d?.lead?.businessName || 'Unknown'}</td><td>{d.channel}</td><td><Badge tone="warning">{d.status}</Badge></td></tr>
              ))}
              {!needsApproval.length && <tr><td colSpan={3} className="muted">No pending approvals.</td></tr>}
            </tbody>
          </Table>
        </Card>
      </section>

      <section className="split-panels">
        <Card title="Outbound Queue" subtitle="Execution status by queue state">
          <div className="table-toolbar" style={{ justifyContent: 'space-between' }}>
            <span className="muted">Queued: {queueOverview?.counts?.queued || 0}</span>
            <span className="muted">Sending: {queueOverview?.counts?.sending || 0}</span>
            <span className="muted">Sent: {queueOverview?.counts?.sent || 0}</span>
            <span className="muted">Failed: {queueOverview?.counts?.failed || 0}</span>
          </div>
          <Table>
            <thead><tr><th>Channel</th><th>Status</th><th>Attempts</th><th>Failure</th></tr></thead>
            <tbody>
              {(queueOverview?.recent || []).slice(0, 6).map((q: any) => (
                <tr key={q.id}><td>{q.channel}</td><td>{q.status}</td><td>{q.attemptCount}</td><td>{q.failureReason || '—'}</td></tr>
              ))}
              {!queueOverview?.recent?.length && <tr><td colSpan={4} className="muted">No queue jobs yet.</td></tr>}
            </tbody>
          </Table>
        </Card>

        <Card title="Post History" subtitle="Scheduled/posted diagnostics">
          <Table>
            <thead><tr><th>Channel</th><th>Status</th><th>Scheduled</th><th>Diagnostics</th></tr></thead>
            <tbody>
              {socialPosts.slice(0, 6).map((p: any) => (
                <tr key={p.id}>
                  <td>{p.channel}</td>
                  <td><Badge tone={String(p.status) === 'posted' ? 'success' : String(p.status) === 'scheduled' ? 'warning' : 'default'}>{String(p.status).toUpperCase()}</Badge></td>
                  <td>{p.scheduledAt ? new Date(p.scheduledAt).toLocaleString() : '—'}</td>
                  <td>{p.diagnostics?.lastFailure || (p.diagnostics?.hasExternalPostId ? 'external id set' : 'ok')}</td>
                </tr>
              ))}
              {!socialPosts.length && <tr><td colSpan={4} className="muted">No social post history yet.</td></tr>}
            </tbody>
          </Table>
        </Card>
      </section>

      <section className="split-panels">
        <Card title="Activity Feed" subtitle="Recent cross-channel operations">
          <Table>
            <thead><tr><th>Event</th><th>When</th></tr></thead>
            <tbody>
              {activityFeed.slice(0, 8).map((e: any, idx: number) => (
                <tr key={e.id || idx}><td>{e.eventType || e.type || 'unknown'}</td><td>{new Date(e.createdAt || e.timestamp || Date.now()).toLocaleString()}</td></tr>
              ))}
              {!activityFeed.length && <tr><td colSpan={2} className="muted">No activity events yet.</td></tr>}
            </tbody>
          </Table>
        </Card>

        <Card title="Email Pipeline Stability" subtitle="Last 24h email send health">
          <div className="table-toolbar" style={{ justifyContent: 'space-between' }}>
            <span className="muted">Attempts: {emailPipeline?.totals?.attempts ?? 0}</span>
            <span className="muted">Sent: {emailPipeline?.totals?.sent ?? 0}</span>
            <span className="muted">Failed: {emailPipeline?.totals?.failed ?? 0}</span>
            <Badge tone={emailPipeline?.stable ? 'success' : 'warning'}>{emailPipeline?.stable ? 'Stable' : 'Watch'}</Badge>
          </div>
          <div className="muted" style={{ marginTop: 8 }}>Failure rate: {emailPipeline?.totals?.failureRatePct ?? 0}%</div>
        </Card>
      </section>

      <Card title="Safety Status" subtitle="Outbound controls and runtime guardrails">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
          <div className="ui-card" style={{ padding: 10 }}><p className="kpi-title">Dry Run</p><Badge tone={safety?.dryRun ? 'success' : 'warning'}>{String(!!safety?.dryRun)}</Badge></div>
          <div className="ui-card" style={{ padding: 10 }}><p className="kpi-title">Email</p><Badge tone={safety?.outbound?.email ? 'success' : 'danger'}>{String(!!safety?.outbound?.email)}</Badge></div>
          <div className="ui-card" style={{ padding: 10 }}><p className="kpi-title">Facebook</p><Badge tone={safety?.outbound?.facebook ? 'success' : 'danger'}>{String(!!safety?.outbound?.facebook)}</Badge></div>
          <div className="ui-card" style={{ padding: 10 }}><p className="kpi-title">Instagram</p><Badge tone={safety?.outbound?.instagram ? 'success' : 'danger'}>{String(!!safety?.outbound?.instagram)}</Badge></div>
          <div className="ui-card" style={{ padding: 10 }}><p className="kpi-title">LinkedIn</p><Badge tone={safety?.outbound?.linkedin ? 'success' : 'danger'}>{String(!!safety?.outbound?.linkedin)}</Badge></div>
        </div>
      </Card>
      </>
      )}
    </div>
  );
}
