import React from 'react';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info';

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
};

export function Badge({ tone = 'default', className = '', children, ...props }: BadgeProps) {
  return (
    <span className={`ui-badge ui-badge-${tone} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}
