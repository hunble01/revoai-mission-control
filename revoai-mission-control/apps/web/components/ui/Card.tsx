import React from 'react';

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  title?: string;
  subtitle?: string;
};

export function Card({ title, subtitle, className = '', children, ...props }: CardProps) {
  return (
    <section className={`ui-card ${className}`.trim()} {...props}>
      {(title || subtitle) && (
        <header className="ui-card-header">
          {title && <h3 className="ui-card-title">{title}</h3>}
          {subtitle && <p className="ui-card-subtitle">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
