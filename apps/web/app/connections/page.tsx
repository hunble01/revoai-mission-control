'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { ProviderConnectionCard } from '../../components/ProviderConnectionCard';
import { SkeletonRows } from '../../components/ui/Skeleton';

import { API_BASE, apiHeaders } from '../../lib/api';

const providers = [
  { provider: 'Email', key: 'EMAIL', apiProvider: 'email', icon: '✉️' },
  { provider: 'Facebook', key: 'FACEBOOK', apiProvider: 'facebook', icon: '📘' },
  { provider: 'Instagram', key: 'INSTAGRAM', apiProvider: 'instagram', icon: '📸' },
  { provider: 'LinkedIn', key: 'LINKEDIN', apiProvider: 'linkedin', icon: '💼' },
];

function toStatusLabel(raw: any) {
  const v = String(raw || '').toUpperCase();
  if (!v) return 'Not Connected';
  if (v === 'NOT_CONNECTED') return 'Not Connected';
  if (v === 'CONNECTING') return 'Connecting';
  if (v === 'CONNECTED') return 'Connected';
  if (v === 'DEGRADED') return 'Degraded';
  if (v === 'ERROR') return 'Error';
  return 'Not Connected';
}

function toHealthLabel(raw: any) {
  const v = String(raw || '').toUpperCase();
  if (v === 'HEALTHY') return 'Healthy';
  if (v === 'FAILED') return 'Failed';
  if (v === 'DEGRADED') return 'Degraded';
  return 'Degraded';
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connectingProvider, setConnectingProvider] = useState<string>('');
  const [disconnectingProvider, setDisconnectingProvider] = useState<string>('');
  const [testingProvider, setTestingProvider] = useState<string>('');
  const [infoMessage, setInfoMessage] = useState<string>('');

  const loadConnections = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/connections`, {
        credentials: 'include',
        headers: apiHeaders,
      });

      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error((data as any)?.error?.message || `Failed to load connections (HTTP ${res.status})`);
      setConnections(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setConnections([]);
      setError(e?.message || 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConnections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byProvider = useMemo(() => {
    const map = new Map<string, any>();
    for (const item of Array.isArray(connections) ? connections : []) {
      const key = String(item?.provider || '').toUpperCase();
      if (key) map.set(key, item);
    }
    return map;
  }, [connections]);

  const startConnect = async (provider: string) => {
    setConnectingProvider(provider);
    setError('');
    setInfoMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/connections/${provider}/connect`, {
        method: 'POST',
        credentials: 'include',
        headers: apiHeaders,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error?.message || `Failed to start connect (HTTP ${res.status})`);

      const authUrl = (data as any)?.authUrl;
      if (!authUrl || typeof authUrl !== 'string') throw new Error('Missing authUrl from connect response');

      window.location.href = authUrl;
    } catch (e: any) {
      setError(e?.message || 'Failed to start provider connect flow');
    } finally {
      setConnectingProvider('');
    }
  };

  const disconnect = async (provider: string) => {
    setDisconnectingProvider(provider);
    setError('');
    setInfoMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/connections/${provider}/disconnect`, {
        method: 'POST',
        credentials: 'include',
        headers: apiHeaders,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error?.message || `Failed to disconnect (HTTP ${res.status})`);
      setInfoMessage(`${provider} disconnected.`);
      await loadConnections();
    } catch (e: any) {
      setError(e?.message || 'Failed to disconnect provider');
    } finally {
      setDisconnectingProvider('');
    }
  };

  const testConnection = async (provider: string) => {
    setTestingProvider(provider);
    setError('');
    setInfoMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/connections/${provider}/test`, {
        method: 'POST',
        credentials: 'include',
        headers: apiHeaders,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error?.message || `Failed to test connection (HTTP ${res.status})`);
      setInfoMessage((data as any)?.message || `${provider} test completed.`);
      await loadConnections();
    } catch (e: any) {
      setError(e?.message || 'Failed to test connection');
    } finally {
      setTestingProvider('');
    }
  };

  return (
    <div className="dash-stack fade-in">
      <section className="page-header">
        <div className="page-eyebrow">CHANNELS</div>
        <h2 className="page-title" style={{ margin: 0 }}>Connections & Providers</h2>
        <p className="page-desc">Manage your outbound channel connections. Sends are blocked unless connected, enabled, and healthy.</p>
      </section>

      <Card title="Provider Connections" subtitle="Account connection status and actions">
        {loading && <SkeletonRows rows={5} />}
        {!!error && <p style={{ color: '#ff9b9b' }}>{error}</p>}
        {!!infoMessage && <p className="muted">{infoMessage}</p>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          {providers.map((p) => {
            const rec = byProvider.get(p.key);
            return (
              <ProviderConnectionCard
                key={p.provider}
                provider={p.provider}
                icon={p.icon}
                status={toStatusLabel(rec?.status)}
                health={toHealthLabel(rec?.health)}
                lastCheckedAt={rec?.lastCheckedAt ? new Date(rec.lastCheckedAt).toLocaleString() : 'Never'}
                expiresInSec={rec?.tokenMeta?.expiresInSec ?? null}
                quotaUsed={rec?.metrics?.quotaUsed || 0}
                quotaMax={rec?.metrics?.quotaMax || 0}
                errorRate={rec?.metrics?.errorRate || 0}
                lastSuccessfulSendAt={rec?.metrics?.lastSuccessfulSendAt || null}
                connectDisabled={false}
                connecting={connectingProvider === p.apiProvider}
                onConnect={() => startConnect(p.apiProvider)}
                onDisconnect={() => disconnect(p.apiProvider)}
                disconnectDisabled={disconnectingProvider === p.apiProvider}
                onTest={() => testConnection(p.apiProvider)}
                testDisabled={testingProvider === p.apiProvider}
              />
            );
          })}
        </div>
      </Card>
    </div>
  );
}
