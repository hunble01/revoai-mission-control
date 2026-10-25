'use client';

export default function HelpPage() {
  const steps = [
    ['1', 'Research', 'Find opportunities and insights', '/research'],
    ['2', 'Leads', 'Qualify and manage pipeline leads', '/leads'],
    ['3', 'Approvals', 'Review drafts before sending', '/approvals'],
    ['4', 'Content', 'Create and schedule social content', '/content-calendar'],
    ['5', 'Send / Drafts', 'Send approved outreach', '/drafts'],
  ];

  return <div className="dash-stack fade-in">
    <section className="page-header"><div className="page-eyebrow">SYSTEM / HELP</div><h2 className="page-title" style={{ margin: 0 }}>Help Center</h2></section>
    <div style={{ display: 'grid', gap: 10 }}>
      {steps.map(([n, name, desc, href]) => (
        <a key={String(n)} href={String(href)} className="ui-card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none' }}>
          <div><div className="text-xs mono text-dim">STEP {n}</div><div style={{ fontWeight: 700 }}>{name}</div><div className="muted">{desc}</div><div className="muted">{href}</div></div>
          <div style={{ color: '#00C9FF' }}>→</div>
        </a>
      ))}
    </div>
  </div>;
}
