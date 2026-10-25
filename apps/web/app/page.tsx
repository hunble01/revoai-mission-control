'use client';

import { LiveAgentDashboard } from '../components/LiveAgentDashboard';

export default function Home() {
  return (
    <div className="dash-stack">
      <section className="hero-panel">
        <div className="hero-eyebrow"><span className="live-dot" /> MISSION CONTROL · LIVE</div>
        <h1 className="hero-title">Your outbound engine, live.</h1>
        <p className="hero-desc">
          Six autonomous agents working in real time — discovery, enrichment, drafting, sending, follow-ups,
          delivery tracking. Every event streams from the backend as it happens.
        </p>
      </section>

      <LiveAgentDashboard />
    </div>
  );
}
