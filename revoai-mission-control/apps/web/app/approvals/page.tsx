import { fetchJson } from '../../components/fetch-json';

export default async function ApprovalsPage() {
  const drafts = await fetchJson('/drafts').catch(() => []);
  const queue = drafts.filter((d: any) => d.status === 'NEEDS_APPROVAL');
  return (
    <div>
      <h1>Approval Inbox</h1>
      <p>Approve/Reject/Request changes/Edit inline/Approve with notes handled via API endpoints.</p>
      <ul>
        {queue.map((d: any) => (
          <li key={d.id}>{d.channel} · {d.draftType} · v{d.currentVersion}</li>
        ))}
      </ul>
    </div>
  );
}
