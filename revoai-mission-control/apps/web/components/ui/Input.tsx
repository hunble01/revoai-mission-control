import React from 'react';

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = '', ...props }: InputProps) {
  return <input className={`ui-input ${className}`.trim()} {...props} />;
}
