'use client';

import { usePathname } from 'next/navigation';
import { SidebarNavItem } from './ui/SidebarNavItem';
import { Input } from './ui/Input';

const NAV_GROUPS = [
  {
    title: 'AI Assistant',
    items: [
      ['/', 'Dashboard'],
      ['/board', 'Board'],
      ['/agents', 'Agents'],
      ['/feed', 'Live Feed'],
    ],
  },
  {
    title: 'Pipeline',
    items: [
      ['/approvals', 'Approvals'],
      ['/leads', 'Leads'],
      ['/drafts', 'Drafts'],
      ['/campaigns', 'Campaigns'],
    ],
  },
  {
    title: 'System',
    items: [
      ['/scheduler', 'Scheduler'],
      ['/health', 'Health'],
      ['/audit', 'Audit'],
    ],
  },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="frame-wrap">
      <div className="app-frame">
        <div className="shell">
          <aside className="sidebar">
            <div className="brand">
              <span className="brand-dot" aria-hidden />
              <div>
                <h2>RevoAI</h2>
                <p>Mission Control</p>
              </div>
            </div>

            {NAV_GROUPS.map((group) => (
              <div key={group.title} className="nav-group">
                <div className="nav-group-title">{group.title}</div>
                <nav className="sidebar-nav" aria-label={group.title}>
                  {group.items.map(([href, label]) => (
                    <SidebarNavItem key={href} href={href} label={label} active={pathname === href} />
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
                <small>Speed-to-lead, approvals, booked appointments</small>
              </div>
              <div className="topbar-actions">
                <Input aria-label="Search" placeholder="Search anything..." />
                <button className="icon-btn" aria-label="Notifications">◦</button>
                <button className="icon-btn" aria-label="Profile">⌁</button>
              </div>
            </header>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
