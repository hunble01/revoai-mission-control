import React from 'react';
import Link from 'next/link';
import { NavIcon, type IconKey } from './NavIcon';

export function SidebarNavItem({
  href,
  label,
  icon,
  active = false,
  isNew = false,
  isBeta = false,
  count,
}: {
  href: string;
  label: string;
  icon?: IconKey;
  active?: boolean;
  isNew?: boolean;
  isBeta?: boolean;
  count?: number;
}) {
  return (
    <Link href={href} prefetch className={`sidebar-link ${active ? 'active' : ''} ${isBeta ? 'beta' : ''}`}>
      <span aria-hidden className="sidebar-icon-wrap">
        {icon ? <NavIcon name={icon} /> : <span className="sidebar-icon" />}
      </span>
      <span className="sidebar-label">{label}</span>
      {typeof count === 'number' && count > 0 ? <span className="nav-badge">{count}</span> : null}
      {isNew && !(typeof count === 'number' && count > 0) ? <span className="nav-new">NEW</span> : null}
      {isBeta && !(typeof count === 'number' && count > 0) ? <span className="nav-beta">SOON</span> : null}
    </Link>
  );
}
