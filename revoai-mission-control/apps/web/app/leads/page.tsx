'use client';
import { useEffect, useState } from 'react';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [q, setQ] = useState('');

  const load = () => {
    const url = `${base}/api/leads${q ? `?search=${encodeURIComponent(q)}` : ''}`;
    fetch(url, { headers: { 'x-admin-token': token } })
      .then((r) => r.json())
      .then((d) => setLeads(d || []));
  };

  useEffect(() => {
    load();
  }, [q]);

  return (
    <div>
      <h1>Leads</h1>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search leads" />
      <table width="100%" cellPadding={8} style={{ borderCollapse: 'collapse', marginTop: 10 }}>
        <thead>
          <tr><th>Business</th><th>Region</th><th>Score</th><th>Status</th><th>Campaign</th></tr>
        </thead>
        <tbody>
          {leads.map((l: any) => (
            <tr key={l.id}>
              <td>{l.businessName}</td>
              <td>{l.region}</td>
              <td>{l.scoreOverride || l.leadScore || '—'}</td>
              <td>{l.status}</td>
              <td>{l.campaignId}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
