import { fetchJson } from '../../components/fetch-json';

export default async function LeadsPage() {
  const leads = await fetchJson('/leads').catch(() => []);
  return (
    <div>
      <h1>Leads</h1>
      <table width="100%" cellPadding={8} style={{ borderCollapse: 'collapse' }}>
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
