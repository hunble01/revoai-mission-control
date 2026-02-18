import { fetchJson } from '../../components/fetch-json';

export default async function DraftsPage() {
  const drafts = await fetchJson('/drafts').catch(() => []);
  return (
    <div>
      <h1>Drafts</h1>
      <ul>
        {drafts.map((d: any) => (
          <li key={d.id}>{d.channel} · {d.draftType} · {d.status} · v{d.currentVersion}</li>
        ))}
      </ul>
    </div>
  );
}
