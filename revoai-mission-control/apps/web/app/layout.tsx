import './globals.css';

export const metadata = {
  title: 'RevoAI Mission Control',
};

const NAV_GROUPS = [
  {
    title: 'AI Assistant',
    items: [
      ['Overview', '/'],
      ['Board', '/board'],
      ['Agents', '/agents'],
      ['Live Feed', '/feed'],
    ],
  },
  {
    title: 'Pipeline',
    items: [
      ['Approvals', '/approvals'],
      ['Leads', '/leads'],
      ['Drafts', '/drafts'],
      ['Campaigns', '/campaigns'],
    ],
  },
  {
    title: 'System',
    items: [
      ['Scheduler', '/scheduler'],
      ['Health', '/health'],
      ['Audit', '/audit'],
    ],
  },
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="frame-wrap">
          <div className="app-frame">
            <div className="shell">
              <aside className="sidebar">
                <div className="brand">
                  <div className="brand-dot" />
                  <div>
                    <h2>RevoAI</h2>
                    <p>Mission Control</p>
                  </div>
                </div>

                {NAV_GROUPS.map((group) => (
                  <div key={group.title} className="nav-group">
                    <div className="nav-group-title">{group.title}</div>
                    <nav className="nav">
                      {group.items.map(([label, href]) => (
                        <a key={href} href={href}>
                          <span className="nav-icon" />
                          {label}
                        </a>
                      ))}
                    </nav>
                  </div>
                ))}

                <div className="sidebar-footer">
                  <a href="#">Help Center</a>
                  <a href="#">Settings</a>
                  <div className="profile-chip">Boss Workspace • Secure</div>
                </div>
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
          </div>
        </div>
      </body>
    </html>
  );
}
