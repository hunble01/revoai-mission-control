import React from 'react';

export function SidebarNavItem({
  href,
  label,
  active = false,
  isNew = false,
  isBeta = false,
  count,
}: {
  href: string;
  label: string;
  active?: boolean;
  isNew?: boolean;
  isBeta?: boolean;
  count?: number;
}) {
  return (
    <a href={href} className={`sidebar-link ${active ? 'active' : ''} ${isBeta ? 'beta' : ''}`}>
      <span aria-hidden className="sidebar-icon" />
      <span className="sidebar-label">{label}</span>
      {typeof count === 'number' && count > 0 ? <span className="nav-badge">{count}</span> : null}
      {isNew && !(typeof count === 'number' && count > 0) ? <span className="nav-new">NEW</span> : null}
      {isBeta && !(typeof count === 'number' && count > 0) ? <span className="nav-beta">SOON</span> : null}
    </a>
  );
}
