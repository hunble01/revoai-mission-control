'use client';

export default function HelpPage() {
  const steps = [
    ['1', 'Research', 'Find opportunities and insights', '/research', '🔎'],
    ['2', 'Leads', 'Qualify and manage pipeline leads', '/leads', '🎯'],
    ['3', 'Approvals', 'Review drafts before sending', '/approvals', '✅'],
    ['4', 'Content', 'Create and schedule social content', '/content-calendar', '🗓️'],
    ['5', 'Send / Drafts', 'Send approved outreach', '/drafts', '📨'],
  ];

  const faqs = [
    ['Where do I review AI-drafted outreach?', 'Head to Approvals — every draft the agents write waits there until you approve or reject it.'],
    ['How do I see what agents did while I was away?', 'The Audit log under System records every automated and manual action.'],
    ['Where do scheduled sends go?', 'The Scheduler page shows everything queued for email and social, with exact send times.'],
  ];

  return <div className="dash-stack fade-in">
    <section className="page-header"><div className="page-eyebrow">SYSTEM / HELP</div><h2 className="page-title" style={{ margin: 0 }}>Help Center</h2><p className="page-desc">How the pipeline flows, end to end — and where to go for each step.</p></section>

    <div className="help-steps">
      {steps.map(([n, name, desc, href, emoji]) => (
        <a key={String(n)} href={String(href)} className="help-step-card">
          <div className="help-step-icon">{emoji}</div>
          <div className="help-step-body">
            <div className="text-xs mono text-dim">STEP {n}</div>
            <div className="help-step-name">{name}</div>
            <div className="muted">{desc}</div>
          </div>
          <div className="help-step-arrow">→</div>
        </a>
      ))}
    </div>

    <section className="ui-card">
      <h3 style={{ marginTop: 0 }}>Common questions</h3>
      <div style={{ display: 'grid', gap: 12 }}>
        {faqs.map(([q, a]) => (
          <div key={q}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{q}</div>
            <div className="muted">{a}</div>
          </div>
        ))}
      </div>
    </section>
  </div>;
}
