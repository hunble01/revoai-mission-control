import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({ variant = 'secondary', className = '', children, ...props }: ButtonProps) {
  return (
    <button className={`ui-btn ui-btn-${variant} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
