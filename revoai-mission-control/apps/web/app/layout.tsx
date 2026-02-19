import './globals.css';

export const metadata = {
  title: 'RevoAI Mission Control',
};

const NAV_ITEMS = [
  ['Overview', '/'],
  ['Board', '/board'],
  ['Agents', '/agents'],
  ['Live Feed', '/feed'],
  ['Approvals', '/approvals'],
  ['Leads', '/leads'],
  ['Drafts', '/drafts'],
  ['Campaigns', '/campaigns'],
  ['Scheduler', '/scheduler'],
  ['Health', '/health'],
  ['Audit', '/audit'],
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div className="brand">
              <h2>RevoAI Mission Control</h2>
              <p>Dry-run mode • Approval gated</p>
            </div>
            <nav className="nav">
              {NAV_ITEMS.map(([label, href]) => (
                <a key={href} href={href}>
                  {label}
                </a>
              ))}
            </nav>
          </aside>
          <main className="content">
            <header className="topbar">
              <div>
                <strong>Operations Console</strong>
                <br />
                <small>Speed-to-lead, approvals, and booked-appointment pipeline</small>
              </div>
              <span className="pill">Outbound: OFF</span>
            </header>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
