import React from 'react';

type IconKey =
  | 'dashboard' | 'pulse'
  | 'users' | 'megaphone' | 'fileText' | 'checkCircle' | 'send' | 'mail'
  | 'layout' | 'calendar' | 'share' | 'columns' | 'search'
  | 'link' | 'linkedin' | 'facebook'
  | 'barChart' | 'activity' | 'shield'
  | 'cpu'
  | 'heart' | 'sliders' | 'help';

const PATHS: Record<IconKey, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  pulse: <path d="M3 12h3l2.5-7 4 14 2.5-7H21" />,
  users: <><circle cx="9" cy="8" r="3" /><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" /><circle cx="17" cy="9" r="2.5" /><path d="M15.5 20c.3-2.6 1.8-4.6 3.8-5.4" /></>,
  megaphone: <><path d="M3 10v4h3l5 4V6l-5 4H3z" /><path d="M14 9a4 4 0 010 6" /><path d="M17 7a7 7 0 010 10" /></>,
  fileText: <><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v4h4" /><path d="M9 13h6M9 17h6M9 9h2" /></>,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.5" /></>,
  send: <><path d="M3 11l18-8-8 18-2.5-7.5L3 11z" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M4 7l8 6 8-6" /></>,
  layout: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 9v12" /></>,
  calendar: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></>,
  share: <><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" /></>,
  columns: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M20 20l-4.5-4.5" /></>,
  link: <><path d="M9.5 14.5l5-5" /><path d="M7 15.5a4 4 0 010-5.7l2-2a4 4 0 015.7 0" /><path d="M17 8.5a4 4 0 010 5.7l-2 2a4 4 0 01-5.7 0" /></>,
  linkedin: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8.5" r="1.1" fill="currentColor" stroke="none" /><path d="M8 11v6M12 17v-3.5c0-1.4 1-2.5 2.5-2.5s2.5 1.1 2.5 2.5V17" /></>,
  facebook: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M14 8.5h-1.5c-.9 0-1.5.6-1.5 1.5V11h3l-.4 3h-2.6v6" /></>,
  barChart: <><path d="M4 20V10M11 20V4M18 20v-7" /></>,
  activity: <path d="M3 12h4l2.5-6 4 11 2-5H21" />,
  shield: <path d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3z" />,
  cpu: <><rect x="7" y="7" width="10" height="10" rx="1.5" /><rect x="10.5" y="10.5" width="3" height="3" /><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" /></>,
  heart: <path d="M12 20s-7.5-4.6-9.5-9.3C1.2 7.8 2.8 5 5.8 5c1.8 0 3.2 1 4.2 2.4C11 6 12.4 5 14.2 5c3 0 4.6 2.8 3.3 5.7C15.5 15.4 12 20 12 20z" />,
  sliders: <><path d="M4 6h10M18 6h2M4 12h2M8 12h12M4 18h14M20 18h0" /><circle cx="14" cy="6" r="2" /><circle cx="6" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.8-1.5 1.3-1.5 2.5" /><path d="M12 17.2v.1" /></>,
};

export function NavIcon({ name, size = 16 }: { name: IconKey; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}

export type { IconKey };
