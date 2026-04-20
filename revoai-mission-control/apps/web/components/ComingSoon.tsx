import React from 'react';

type Props = {
  feature: string;
  needs?: string;
};

export function ComingSoon({ feature, needs }: Props) {
  return (
    <div className="coming-soon-banner" role="status">
      <span className="cs-tag">COMING SOON</span>
      <div className="cs-text">
        <strong style={{ color: '#2A2824', display: 'block', marginBottom: 2 }}>{feature} is still in beta.</strong>
        {needs ? <>What's needed to activate: {needs}.</> : <>This page is live but not yet connected to real data sources.</>}
      </div>
    </div>
  );
}
