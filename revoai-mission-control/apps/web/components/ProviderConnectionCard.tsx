'use client';

import { Button } from './ui/Button';

type ProviderConnectionCardProps = {
  provider: string;
  icon: string;
  status?: string;
  health?: string;
  lastCheckedAt?: string;
  expiresInSec?: number | null;
  quotaUsed?: number;
  quotaMax?: number;
  errorRate?: number;
  lastSuccessfulSendAt?: string | null;
  connectDisabled?: boolean;
  onConnect?: () => void;
  connecting?: boolean;
  onDisconnect?: () => void;
  disconnectDisabled?: boolean;
  onTest?: () => void;
  testDisabled?: boolean;
};

export function ProviderConnectionCard({
  provider,
  icon,
  status = 'Not Connected',
  health = 'Degraded',
  lastCheckedAt,
  connectDisabled = true,
  onConnect,
  connecting = false,
  onDisconnect,
  disconnectDisabled = false,
  onTest,
  testDisabled = false,
  expiresInSec = null,
  quotaUsed = 0,
  quotaMax = 0,
  errorRate = 0,
  lastSuccessfulSendAt = null,
}: ProviderConnectionCardProps) {
  return (
    <div className="ui-card" style={{ padding: 14, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          aria-hidden
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            border: '1px solid var(--border)',
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(255,255,255,0.03)',
          }}
        >
          {icon}
        </div>
        <div>
          <strong>{provider}</strong>
          <div className="muted" style={{ fontSize: 12 }}>Status: {status}</div>
          <div className="muted" style={{ fontSize: 12 }}>Health: {health}</div>
          <div className="muted" style={{ fontSize: 12 }}>Last checked: {lastCheckedAt || 'Never'}</div>
          <div className="muted" style={{ fontSize: 12 }}>Token expiry: {expiresInSec == null ? '—' : `${Math.floor(expiresInSec / 3600)}h`}</div>
        </div>
      </div>

      <div className="muted" style={{ fontSize: 12 }}>Quota: {quotaUsed}/{quotaMax} • Error rate: {errorRate}%</div>
      <div className="muted" style={{ fontSize: 12 }}>Last success: {lastSuccessfulSendAt ? new Date(lastSuccessfulSendAt).toLocaleString() : '—'}</div>

      <div className="table-toolbar">
        <Button variant="secondary" disabled={connectDisabled || connecting} onClick={onConnect}>
          {connecting ? 'Connecting…' : ((expiresInSec != null && expiresInSec <= 0) ? 'Reconnect' : 'Connect')}
        </Button>
        <Button variant="secondary" disabled={testDisabled} onClick={onTest}>
          Test
        </Button>
        {String(status).toLowerCase() === 'connected' && (
          <Button variant="ghost" disabled={disconnectDisabled} onClick={onDisconnect}>
            Disconnect
          </Button>
        )}
      </div>
    </div>
  );
}
