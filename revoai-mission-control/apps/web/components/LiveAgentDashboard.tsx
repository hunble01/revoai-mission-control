'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_BASE, apiHeaders } from '../lib/api';
import { CountUp } from './ui/CountUp';

/**
 * Mission-Control-style live agent dashboard.
 * Subscribes to the /activity Socket.IO stream and maps every event to
 * one of 6 long-running "agents". Each agent card pulses when active,
 * shows its last few actions, and a today's-count tile.
 */

type AgentKey = 'discovery' | 'enrichment' | 'drafter' | 'sender' | 'followup' | 'tracker';

type AgentDef = {
  key: AgentKey;
  name: string;
  icon: string;
  blurb: string;
  color: string;
  accent: string;
  matchEvents: (eventType: string) => boolean;
  countLabel: string;
};

const AGENTS: AgentDef[] = [
  {
    key: 'discovery',
    name: 'Discovery Agent',
    icon: '🔍',
    blurb: 'Google Maps → real businesses',
    color: '#00C9FF',
    accent: 'rgba(0,201,255,.14)',
    matchEvents: (t) => /research|stage1\.research|autorun.*(started|stage1|stage2\.promote)/i.test(t),
    countLabel: 'leads discovered · last 24h',
  },
  {
    key: 'enrichment',
    name: 'Enrichment Agent',
    icon: '🧠',
    blurb: 'Claude reads each lead\'s website',
    color: '#9B72FF',
    accent: 'rgba(155,114,255,.14)',
    matchEvents: (t) => /stage3\.enrich|lead\.enriched/i.test(t),
    countLabel: 'businesses enriched · last 24h',
  },
  {
    key: 'drafter',
    name: 'Draft Writer',
    icon: '✍️',
    blurb: 'Claude writes personalized emails',
    color: '#10D68A',
    accent: 'rgba(16,214,138,.14)',
    matchEvents: (t) => /stage4\.draft|draft\.created|draft\.generated/i.test(t),
    countLabel: 'drafts written · last 24h',
  },
  {
    key: 'sender',
    name: 'Send Worker',
    icon: '📮',
    blurb: 'Approved emails → Resend → inbox',
    color: '#F5A623',
    accent: 'rgba(245,166,35,.14)',
    matchEvents: (t) => /email\.sent|outbound\.sent|draft\.approved|queue\.sent/i.test(t),
    countLabel: 'emails sent · last 24h',
  },
  {
    key: 'followup',
    name: 'Follow-up Cron',
    icon: '🔁',
    blurb: 'Day 3 / 7 / 14 AI sequences',
    color: '#FF5B7A',
    accent: 'rgba(255,91,122,.14)',
    matchEvents: (t) => /followup|follow-up|sequence\.paused|auto-cycle/i.test(t),
    countLabel: 'follow-ups generated · last 24h',
  },
  {
    key: 'tracker',
    name: 'Delivery Tracker',
    icon: '📊',
    blurb: 'Opens · clicks · bounces',
    color: '#00E5D0',
    accent: 'rgba(0,229,208,.14)',
    matchEvents: (t) => /delivery\.|email\.(opened|clicked|bounced|delivered)/i.test(t),
    countLabel: 'delivery events · last 24h',
  },
];

type AgentState = {
  busy: boolean;
  lastAction?: { text: string; at: number };
  recent: { text: string; at: number }[];
  count: number;
};

const emptyState = (): AgentState => ({ busy: false, recent: [], count: 0 });

function humanizeEvent(eventType: string, payload: any): string {
  const t = eventType;
  if (/stage1\.research/i.test(t)) return `Discovered ${payload?.discovered ?? '?'} businesses`;
  if (/stage2\.promote/i.test(t)) return `Promoted ${payload?.promoted ?? '?'} new leads${payload?.skippedDuplicate ? ` · skipped ${payload.skippedDuplicate} dupes` : ''}`;
  if (/stage3\.enrich/i.test(t)) return `Enriched ${payload?.enriched ?? '?'} leads`;
  if (/stage4\.draft\.dedup/i.test(t)) return `Skipped ${payload?.skippedRace ?? 0} duplicate drafts`;
  if (/stage4\.draft/i.test(t)) return `Wrote ${payload?.drafted ?? '?'} personalized drafts`;
  if (/autorun\.complete/i.test(t)) return `Autorun complete · ${payload?.drafted ?? 0} drafts in /approvals`;
  if (/autorun\.started/i.test(t)) return `Starting autorun pipeline…`;
  if (/lead\.enriched/i.test(t)) return `Enriched a lead via ${payload?.source || 'LLM'}`;
  if (/lead\.sequence\.paused/i.test(t)) return `Paused sequence · reason: ${payload?.reason || '?'}`;
  if (/email\.sent/i.test(t)) return `Sent email`;
  if (/email\.delivered/i.test(t)) return `Delivery confirmed`;
  if (/email\.opened/i.test(t)) return `Open detected`;
  if (/email\.clicked/i.test(t)) return `Click detected`;
  if (/email\.bounced/i.test(t)) return `Bounce (suppressed)`;
  if (/auto-cycle/i.test(t)) return `6-hour follow-up cycle complete`;
  if (/campaign\.autorun/i.test(t)) return `Campaign autorun event`;
  return eventType.replace(/[._]/g, ' ');
}

export function LiveAgentDashboard() {
  const [agents, setAgents] = useState<Record<AgentKey, AgentState>>(() => {
    const s: Record<string, AgentState> = {};
    AGENTS.forEach((a) => (s[a.key] = emptyState()));
    return s as Record<AgentKey, AgentState>;
  });
  const [tape, setTape] = useState<{ id: string; text: string; agent: AgentKey | null; at: number }[]>([]);
  const [connected, setConnected] = useState(false);
  const [kpis, setKpis] = useState<{ leads: number; drafts: number; pending: number; sent24h: number }>({
    leads: 0,
    drafts: 0,
    pending: 0,
    sent24h: 0,
  });
  const busyTimers = useRef<Record<string, any>>({});

  useEffect(() => {
    // Pull initial KPIs from REST (the Socket only streams deltas)
    const headers = { ...apiHeaders };
    Promise.all([
      fetch(`${API_BASE}/api/leads`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => []),
      fetch(`${API_BASE}/api/drafts`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => []),
      fetch(`${API_BASE}/api/drafts?status=NEEDS_APPROVAL`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => []),
      fetch(`${API_BASE}/api/drafts/send-history?limit=100`, { credentials: 'include', headers }).then((r) => r.json()).catch(() => []),
    ]).then(([l, d, na, sh]) => {
      const today = new Date().toDateString();
      const sentToday = (Array.isArray(sh) ? sh : []).filter(
        (s: any) => s?.timestamp && new Date(s.timestamp).toDateString() === today && String(s.status).toLowerCase() === 'sent',
      ).length;
      setKpis({
        leads: Array.isArray(l) ? l.length : 0,
        drafts: Array.isArray(d) ? d.length : 0,
        pending: Array.isArray(na) ? na.length : 0,
        sent24h: sentToday,
      });
    });

    // Seed per-agent counters from DB so they reflect real today-activity
    // on first load (otherwise they sit at 0 until a new event arrives
    // over the socket — confusing when emails were sent earlier in the day).
    fetch(`${API_BASE}/api/stats/agent-counts`, { credentials: 'include', headers })
      .then((r) => r.json())
      .then((counts: any) => {
        setAgents((prev) => ({
          ...prev,
          discovery: { ...prev.discovery, count: Number(counts?.discovery || 0) },
          enrichment: { ...prev.enrichment, count: Number(counts?.enrichment || 0) },
          drafter: { ...prev.drafter, count: Number(counts?.drafter || 0) },
          sender: { ...prev.sender, count: Number(counts?.sender || 0) },
          followup: { ...prev.followup, count: Number(counts?.followup || 0) },
          tracker: { ...prev.tracker, count: Number(counts?.tracker || 0) },
        }));
      })
      .catch(() => {});

    // Also pull recent events to seed the tape so the UI isn't empty on load
    fetch(`${API_BASE}/api/events/feed?limit=30`, { credentials: 'include', headers })
      .then((r) => r.json())
      .then((rows) => {
        if (!Array.isArray(rows)) return;
        const seeded = rows
          .map((r: any) => {
            const agent = AGENTS.find((a) => a.matchEvents(String(r.eventType || '')))?.key || null;
            return {
              id: r.id || `${r.eventType}-${r.createdAt}`,
              text: humanizeEvent(String(r.eventType || ''), r.payload),
              agent,
              at: new Date(r.createdAt || Date.now()).getTime(),
            };
          })
          .slice(0, 20);
        setTape(seeded);
      })
      .catch(() => {});

    // Live stream
    const socket: Socket = io(API_BASE, { transports: ['websocket'] });
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('activity', (evt: any) => {
      const type = String(evt?.eventType || evt?.type || '');
      const payload = evt?.payload || {};
      const text = humanizeEvent(type, payload);
      const now = Date.now();

      const agent = AGENTS.find((a) => a.matchEvents(type));
      if (agent) {
        setAgents((prev) => {
          const curr = prev[agent.key];
          const recent = [{ text, at: now }, ...curr.recent].slice(0, 4);
          // Bump count on meaningful "did a unit of work" events
          let count = curr.count;
          if (/stage1\.research/i.test(type)) count += Number(payload?.discovered || 0);
          else if (/stage2\.promote/i.test(type)) count += Number(payload?.promoted || 0);
          else if (/stage3\.enrich/i.test(type)) count += Number(payload?.enriched || 0);
          else if (/stage4\.draft(?!\.dedup)/i.test(type)) count += Number(payload?.drafted || 0);
          else if (/email\.sent|outbound\.sent/i.test(type)) count += 1;
          else if (/followup|auto-cycle/i.test(type)) count += 1;
          else if (/delivery\.|email\.(opened|clicked|bounced|delivered)/i.test(type)) count += 1;

          return {
            ...prev,
            [agent.key]: { busy: true, lastAction: { text, at: now }, recent, count },
          };
        });
        // auto-idle after 4s of no new events for this agent
        clearTimeout(busyTimers.current[agent.key]);
        busyTimers.current[agent.key] = setTimeout(() => {
          setAgents((prev) => ({ ...prev, [agent.key]: { ...prev[agent.key], busy: false } }));
        }, 4000);
      }

      setTape((prev) => {
        const entry = { id: `${now}-${Math.random().toString(36).slice(2, 6)}`, text, agent: agent?.key || null, at: now };
        return [entry, ...prev].slice(0, 40);
      });
    });

    return () => { socket.disconnect(); };
  }, []);

  const connColor = connected ? '#10D68A' : '#FF5B7A';

  return (
    <div className="dash-stack">
      {/* Connection status banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 999, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', alignSelf: 'flex-start', fontSize: 12 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: connColor, boxShadow: `0 0 8px ${connColor}`, animation: connected ? 'pulse 2s ease-in-out infinite' : undefined }} />
        <span style={{ color: '#B0BAC9', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '.08em', textTransform: 'uppercase' }}>
          {connected ? 'Live · socket connected' : 'Reconnecting…'}
        </span>
      </div>

      {/* KPI strip */}
      <section className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <div className="kpi-card cyan">
          <div className="kpi-label">Leads in DB</div>
          <div className="kpi-value cyan"><CountUp value={kpis.leads} /></div>
          <div className="kpi-delta">total pipeline</div>
        </div>
        <div className="kpi-card emerald">
          <div className="kpi-label">Drafts</div>
          <div className="kpi-value emerald"><CountUp value={kpis.drafts} /></div>
          <div className="kpi-delta">all statuses</div>
        </div>
        <div className="kpi-card amber">
          <div className="kpi-label">Awaiting approval</div>
          <div className="kpi-value amber"><CountUp value={kpis.pending} /></div>
          <div className="kpi-delta">ready to review</div>
        </div>
        <div className="kpi-card violet">
          <div className="kpi-label">Sent today</div>
          <div className="kpi-value violet"><CountUp value={kpis.sent24h} /></div>
          <div className="kpi-delta">outbound</div>
        </div>
      </section>

      {/* Agents grid */}
      <section>
        <div className="page-eyebrow" style={{ marginBottom: 12 }}>LIVE AGENTS</div>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {AGENTS.map((a) => {
            const s = agents[a.key];
            return (
              <div
                key={a.key}
                style={{
                  position: 'relative',
                  background: `linear-gradient(180deg, rgba(17,24,39,.95), rgba(13,17,23,.95))`,
                  border: `1px solid ${s.busy ? a.color : 'rgba(255,255,255,.06)'}`,
                  borderRadius: 14,
                  padding: 16,
                  overflow: 'hidden',
                  transition: 'border-color .25s ease, box-shadow .25s ease',
                  boxShadow: s.busy ? `0 0 0 1px ${a.color}33, 0 10px 30px rgba(0,0,0,.4), 0 0 40px ${a.color}22` : '0 6px 22px rgba(0,0,0,.28)',
                }}
              >
                {s.busy && (
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(400px 180px at 50% -40%, ${a.color}22, transparent 60%)` }} />
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: a.accent, display: 'grid', placeItems: 'center', fontSize: 18, border: `1px solid ${a.color}33` }}>
                    {a.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#E8EDF5', letterSpacing: '-.005em' }}>{a.name}</div>
                    <div style={{ fontSize: 11.5, color: '#8B95A8' }}>{a.blurb}</div>
                  </div>
                  <span
                    title={s.busy ? 'working' : 'idle'}
                    style={{
                      width: 10, height: 10, borderRadius: 999,
                      background: s.busy ? a.color : '#4A5568',
                      boxShadow: s.busy ? `0 0 10px ${a.color}` : 'none',
                      animation: s.busy ? 'pulse 1.2s ease-in-out infinite' : undefined,
                    }}
                  />
                </div>

                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                  <div style={{ fontSize: 10.5, color: '#7C8599', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 6 }}>{a.countLabel}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: a.color, letterSpacing: '-.02em', lineHeight: 1 }}>
                    <CountUp value={s.count} />
                  </div>
                </div>

                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.06)', minHeight: 56 }}>
                  {s.recent.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#4A5568', fontStyle: 'italic' }}>idle — waiting for work</div>
                  ) : (
                    s.recent.map((r, i) => (
                      <div key={`${r.at}-${i}`} style={{ fontSize: 12, color: i === 0 ? '#D6DFEE' : '#6B7588', lineHeight: 1.5, opacity: 1 - i * 0.18 }}>
                        · {r.text}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Live activity ticker */}
      <section>
        <div className="page-eyebrow" style={{ marginBottom: 12 }}>LIVE ACTIVITY</div>
        <div style={{ background: 'rgba(13,17,23,.6)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, padding: 16, maxHeight: 320, overflowY: 'auto' }}>
          {tape.length === 0 ? (
            <div style={{ color: '#4A5568', fontSize: 13 }}>Waiting for events… click ⚡ Run Campaign or wait for the follow-up cron.</div>
          ) : (
            tape.map((row) => {
              const agent = AGENTS.find((a) => a.key === row.agent);
              const color = agent?.color || '#8B95A8';
              const ts = new Date(row.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              return (
                <div key={row.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#4A5568', width: 70, flexShrink: 0 }}>{ts}</span>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: color, flexShrink: 0, marginTop: 6 }} />
                  <span style={{ fontSize: 13, color: '#D6DFEE', flex: 1 }}>{row.text}</span>
                  {agent && <span style={{ fontSize: 10.5, color, fontFamily: 'JetBrains Mono, monospace', opacity: .8, letterSpacing: '.06em', textTransform: 'uppercase' }}>{agent.name.replace(' Agent', '').replace(' Cron', '').replace(' Worker', '').replace(' Writer', '').replace(' Tracker', '')}</span>}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
