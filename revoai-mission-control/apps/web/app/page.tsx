export default function Home() {
  return (
    <div>
      <section className="grid-4">
        <article className="card">
          <div className="kpi-title">New leads (24h)</div>
          <div className="kpi-value">42</div>
          <div className="kpi-sub">+18% vs yesterday</div>
        </article>
        <article className="card">
          <div className="kpi-title">Drafts pending approval</div>
          <div className="kpi-value">11</div>
          <div className="kpi-sub">Queue healthy</div>
        </article>
        <article className="card">
          <div className="kpi-title">Approval SLA</div>
          <div className="kpi-value">23m</div>
          <div className="kpi-sub">Median decision time</div>
        </article>
        <article className="card">
          <div className="kpi-title">Recovered bookings</div>
          <div className="kpi-value">7</div>
          <div className="kpi-sub">From follow-up workflows</div>
        </article>
      </section>

      <section className="grid-2">
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Today’s priorities</h3>
          <ol className="list">
            <li>Clear approval queue for high-intent local leads.</li>
            <li>Review scheduler retries and fix any failed runs.</li>
            <li>Validate no-show recovery drafts before release.</li>
            <li>Audit top campaigns and prep optimization actions.</li>
          </ol>
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>Safety status</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Mission Control is running in a protected build mode.
          </p>
          <ul className="list">
            <li>Dry-run enabled</li>
            <li>Outbound channels default OFF</li>
            <li>Admin-only approvals enforced</li>
            <li>Audit logging active</li>
          </ul>
        </article>
      </section>
    </div>
  );
}
