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
  const connected = String(status).toLowerCase() === 'connected';

  return (
    <div className={`connection-card ${connected ? 'connected' : ''}`}>
      <div className="flex gap-12 mb-16">
        <div style={{ width: 44, height: 44, borderRadius: 8, border: `1px solid ${connected ? 'rgba(16,214,138,0.35)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: connected ? 'var(--emerald)' : 'var(--muted)', background: connected ? 'rgba(16,214,138,.08)' : 'var(--surface)' }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{provider}</div>
          <div className="text-xs mono text-dim">Status: {status} · Health: {health}</div>
          <div className="text-xs mono text-dim">Last checked: {lastCheckedAt || 'Never'}</div>
        </div>
        <span className={`badge ${connected ? 'active' : 'error'}`}>{connected ? 'CONNECTED' : 'DISCONNECTED'}</span>
      </div>

      <div className="quota-bar mb-12">
        <div className="quota-track">
          <div className="quota-fill" style={{ width: `${quotaMax ? Math.min(100, Math.round((quotaUsed / quotaMax) * 100)) : 0}%`, background: quotaMax && quotaUsed / quotaMax > 0.8 ? 'var(--rose)' : 'var(--cyan)' }} />
        </div>
        <span className="text-xs mono">{quotaUsed}/{quotaMax || 0}</span>
      </div>

      <div className="text-xs mono text-dim mb-8">Error rate: {errorRate}%</div>
      <div className="text-xs mono text-dim mb-12">Token expiry: {expiresInSec == null ? '—' : `${Math.floor(expiresInSec / 3600)}h`} · Last success: {lastSuccessfulSendAt ? new Date(lastSuccessfulSendAt).toLocaleString() : '—'}</div>

      <div className="flex gap-8">
        <Button variant="primary" onClick={onConnect} disabled={connectDisabled || connecting}>
          {connecting ? 'Connecting…' : ((expiresInSec != null && expiresInSec <= 0) ? 'Reconnect' : `Connect ${provider}`)}
        </Button>
        <Button variant="secondary" disabled={testDisabled} onClick={onTest}>⚡️ Test</Button>
        {connected && <Button variant="ghost" disabled={disconnectDisabled} onClick={onDisconnect}>Disconnect</Button>}
      </div>
    </div>
  );
}
