'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SidebarNavItem } from './ui/SidebarNavItem';
import { Input } from './ui/Input';

const NAV_GROUPS = [
  {
    title: 'INTELLIGENCE',
    items: [
      ['/', 'Overview'],
      ['/research', 'Research Hub'],
    ],
  },
  {
    title: 'PIPELINE',
    items: [
      ['/campaigns', 'Campaigns'],
      ['/leads', 'Leads'],
      ['/approvals', 'Approvals'],
      ['/drafts', 'Drafts'],
    ],
  },
  {
    title: 'CHANNELS',
    items: [
      ['/connections', 'Connections'],
      ['/linkedin', 'LinkedIn Manager'],
      ['/facebook', 'Facebook Manager'],
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      ['/board', 'Board'],
      ['/scheduler', 'Scheduler'],
      ['/feed', 'Live Feed'],
      ['/agents', 'Agents'],
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      ['/analytics', 'Analytics'],
      ['/health', 'Health'],
      ['/settings', 'Settings'],
      ['/help', 'Help'],
      ['/audit', 'Audit'],
    ],
  },
] as const;

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    if (!searchQ.trim()) {
      setSearchResults(null);
      return;
    }
    const t = setTimeout(() => {
      fetch(`${base}/api/search?q=${encodeURIComponent(searchQ.trim())}`, { credentials: 'include', headers: { 'x-admin-token': token } })
        .then((r) => r.json())
        .then((d) => setSearchResults(d))
        .catch(() => setSearchResults(null));
    }, 250);
    return () => clearTimeout(t);
  }, [searchQ]);

  useEffect(() => {
    fetch(`${base}/api/search/notifications`, { credentials: 'include', headers: { 'x-admin-token': token } })
      .then((r) => r.json())
      .then((d) => setNotifications(Array.isArray(d?.items) ? d.items : []))
      .catch(() => setNotifications([]));
  }, []);

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
              <a href="/help">Help Center</a>
              <a href="/settings">Settings</a>
              <a href="/login">Login</a>
              <a href="#" onClick={async (e) => { e.preventDefault(); await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/logout`, { method: 'POST', credentials: 'include' }); window.location.href = '/login'; }}>Logout</a>
              <div className="profile-chip">Boss Workspace • Secure</div>
            </div>
          </aside>

          <main className="content">
            <header className="topbar">
              <div>
                <strong>Operations Console</strong>
                <small>Speed-to-lead, approvals, booked appointments</small>
                <div className="flow-links" aria-label="Pipeline flow">
                  <a href="/research">Research</a>
                  <span>→</span>
                  <a href="/leads">Leads</a>
                  <span>→</span>
                  <a href="/approvals">Approvals</a>
                  <span>→</span>
                  <a href="/content">Content</a>
                  <span>→</span>
                  <a href="/drafts">Send</a>
                </div>
              </div>
              <div className="topbar-actions" style={{ position: 'relative' }}>
                <Input aria-label="Search" placeholder="Search leads, drafts, campaigns..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
                <button className="icon-btn" aria-label="Notifications" onClick={() => setShowNotif((v) => !v)}>◦</button>
                <button className="icon-btn" aria-label="Profile" onClick={() => setShowProfile((v) => !v)}>⌁</button>

                {!!searchQ.trim() && searchResults && (
                  <div className="ui-card" style={{ position: 'absolute', top: 42, right: 110, width: 340, padding: 10, zIndex: 40 }}>
                    <div className="muted">Leads: {searchResults?.leads?.length || 0} • Drafts: {searchResults?.drafts?.length || 0} • Campaigns: {searchResults?.campaigns?.length || 0}</div>
                  </div>
                )}

                {showNotif && (
                  <div className="ui-card" style={{ position: 'absolute', top: 42, right: 40, width: 320, padding: 10, zIndex: 40 }}>
                    {notifications.map((n: any, i) => <div key={i} className="muted" style={{ marginBottom: 6 }}>{n.label}</div>)}
                    {!notifications.length && <div className="muted">No notifications</div>}
                  </div>
                )}

                {showProfile && (
                  <div className="ui-card" style={{ position: 'absolute', top: 42, right: 0, width: 220, padding: 10, zIndex: 40 }}>
                    <div className="muted" style={{ marginBottom: 8 }}>Workspace: boss workspace</div>
                    <a href="/login" className="demo-step">Logout</a>
                  </div>
                )}
              </div>
            </header>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
