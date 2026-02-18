import { fetchJson } from '../../components/fetch-json';

export default async function CampaignsPage() {
  const campaigns = await fetchJson('/campaigns').catch(() => []);
  return (
    <div>
      <h1>Campaigns</h1>
      <ul>
        {campaigns.map((c: any) => (
          <li key={c.id}>{c.name} · {c.niche} · {c.geography} · min score {c.minScore}</li>
        ))}
      </ul>
    </div>
  );
}
