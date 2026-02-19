import React from 'react';

export function SidebarNavItem({
  href,
  label,
  active = false,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <a href={href} className={`sidebar-link ${active ? 'active' : ''}`}>
      <span aria-hidden className="sidebar-icon" />
      <span className="sidebar-label">{label}</span>
    </a>
  );
}
