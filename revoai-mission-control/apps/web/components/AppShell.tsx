'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SidebarNavItem } from './ui/SidebarNavItem';

const NAV_GROUPS = [
  {
    title: 'MAIN',
    items: [
      { href: '/', label: 'Overview' },
      { href: '/research', label: 'Research Hub', isNew: true },
      { href: '/leads', label: 'Leads', countKey: 'leads' },
      { href: '/campaigns', label: 'Campaigns' },
      { href: '/drafts', label: 'Drafts' },
      { href: '/approvals', label: 'Approvals', countKey: 'approvals' },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { href: '/connections', label: 'Connections' },
      { href: '/scheduler', label: 'Scheduler' },
      { href: '/feed', label: 'Live Feed' },
      { href: '/analytics', label: 'Analytics' },
      { href: '/audit', label: 'Audit' },
      { href: '/content-calendar', label: 'Content Calendar' },
    ],
  },
  {
    title: 'COMING SOON',
    items: [
      { href: '/linkedin', label: 'LinkedIn', isBeta: true },
      { href: '/facebook', label: 'Facebook', isBeta: true },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { href: '/health', label: 'Health' },
      { href: '/settings', label: 'Settings' },
      { href: '/help', label: 'Help' },
    ],
  },
] as const;

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = pathname === '/login';

  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showProfile, setShowProfile] = useState(false);
  const [navCounts, setNavCounts] = useState<{ approvals: number; leads: number }>({ approvals: 0, leads: 0 });
  const [clock, setClock] = useState('00:00:00');
  const [toasts, setToasts] = useState<Array<{ id: string; type: 'success' | 'warning' | 'error' | 'info'; text: string }>>([]);
  const [navOpen, setNavOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ email: string; role: string } | null>(null);

  // close mobile nav on route change
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // fetch current user for sidebar footer
  useEffect(() => {
    if (isAuthRoute) return;
    fetch(`${base}/api/auth/me`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok && d?.user?.email) {
          setCurrentUser({ email: d.user.email, role: String(d.user.role || 'admin').toLowerCase() });
        } else {
          // not logged in — kick to login
          if (typeof window !== 'undefined') window.location.replace('/login');
        }
      })
      .catch(() => {});
  }, [isAuthRoute]);

  async function doLogout() {
    try {
      await fetch(`${base}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {}
    window.location.replace('/login');
  }

  // Render login page without the shell
  if (isAuthRoute) {
    return <>{children}</>;
  }

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

    const t = setInterval(() => setClock(new Date().toISOString().slice(11, 19)), 1000);
    setClock(new Date().toISOString().slice(11, 19));

    const onToast = (ev: any) => {
      const detail = ev?.detail || {};
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((curr) => [...curr, { id, type: detail.type || 'info', text: detail.text || 'Update' }]);
      setTimeout(() => setToasts((curr) => curr.filter((x) => x.id !== id)), 4000);
    };
    window.addEventListener('app-toast' as any, onToast as any);

    Promise.all([
      fetch(`${base}/api/drafts?status=NEEDS_APPROVAL`, { credentials: 'include', headers: { 'x-admin-token': token } }).then((r) => r.json()).catch(() => []),
      fetch(`${base}/api/leads?status=NEW`, { credentials: 'include', headers: { 'x-admin-token': token } }).then((r) => r.json()).catch(() => []),
    ]).then(([drafts, leads]) => {
      setNavCounts({
        approvals: Array.isArray(drafts) ? drafts.length : 0,
        leads: Array.isArray(leads) ? leads.length : 0,
      });
    }).catch(() => setNavCounts({ approvals: 0, leads: 0 }));

    return () => {
      clearInterval(t);
      window.removeEventListener('app-toast' as any, onToast as any);
    };
  }, []);

  return (
    <div className="frame-wrap">
      <div className="app-frame">
        <div className={`shell${navOpen ? ' shell-open' : ''}`}>
          {navOpen && <div className="nav-backdrop" onClick={() => setNavOpen(false)} aria-hidden />}
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
                  {group.items.map((item: any) => (
                    <SidebarNavItem
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      active={pathname === item.href}
                      isNew={!!item.isNew}
                      isBeta={!!item.isBeta}
                      count={item.countKey ? navCounts[item.countKey as 'approvals' | 'leads'] : undefined}
                    />
                  ))}
                </nav>
              </div>
            ))}

            <div className="sidebar-footer">
              <div className="footer-status">
                <span className="status-dot" />
                <span className="footer-label" title={currentUser?.email}>
                  {currentUser?.email ? currentUser.email : 'not signed in'}
                </span>
              </div>
              {currentUser?.role && (
                <div className="footer-role">{currentUser.role}</div>
              )}
              <button type="button" className="footer-logout" onClick={doLogout}>
                Sign out
              </button>
            </div>
          </aside>

          <main className="content">
            <header className="topbar">
              <button
                type="button"
                className="menu-toggle"
                aria-label="Toggle navigation"
                aria-expanded={navOpen}
                onClick={() => setNavOpen((v) => !v)}
              >
                <span /><span /><span />
              </button>
              <div className="topbar-heading">
                <div className="topbar-title">Operations Console <span className="topbar-sub">MISSION CONTROL · {clock}</span></div>
                <div className="flow-links" aria-label="Pipeline flow">
                  <a href="/leads">Leads</a>
                  <span>→</span>
                  <a href="/drafts">Drafts</a>
                  <span>→</span>
                  <a href="/approvals">Approvals</a>
                  <span>→</span>
                  <a href="/scheduler">Send</a>
                </div>
              </div>
              <div className="topbar-actions" style={{ position: 'relative' }}>
                <div className="search-wrap">
                  <span className="search-icon">⌕</span>
                  <input className="topbar-search" aria-label="Search" placeholder="Search leads, drafts, campaigns..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
                </div>
                <button className="topbar-btn" aria-label="Notifications" onClick={() => setShowNotif((v) => !v)}>🔔<span className="notif-dot" /></button>
                <button className="topbar-btn topbar-profile" aria-label="Profile" onClick={() => setShowProfile((v) => !v)}>B</button>

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
                    <div className="muted">Local mode (authless)</div>
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
