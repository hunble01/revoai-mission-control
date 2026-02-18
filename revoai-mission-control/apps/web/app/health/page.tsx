'use client';
import { useEffect, useState } from 'react';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

export default function HealthPage() {
  const [api, setApi] = useState<any>(null);
  const [safety, setSafety] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [h, s] = await Promise.all([
          fetch(`${base}/api/health`, { headers: { 'x-admin-token': token } }).then((r) => r.json()),
          fetch(`${base}/api/settings/safety`, { headers: { 'x-admin-token': token } }).then((r) => r.json()),
        ]);
        setApi(h);
        setSafety(s);
      } catch (e: any) {
        setError(e.message || 'Health check failed');
      }
    })();
  }, []);

  return (
    <div>
      <h1>System Health</h1>
      {error && <p style={{ color: 'tomato' }}>{error}</p>}
      <h3>API Connectivity</h3>
      <pre>{JSON.stringify(api, null, 2)}</pre>
      <h3>Current Mode</h3>
      <pre>{JSON.stringify(safety, null, 2)}</pre>
      <p>
        Expected for MVP: dry-run enabled + all outbound channels false.
      </p>
    </div>
  );
}
