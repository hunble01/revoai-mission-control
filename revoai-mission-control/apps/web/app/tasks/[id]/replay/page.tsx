import { fetchJson } from '../../../../components/fetch-json';

export default async function ReplayPage({ params }: { params: { id: string } }) {
  const events = await fetchJson(`/tasks/${params.id}/replay`).catch(() => []);
  return (
    <div>
      <h1>Task Replay</h1>
      <p>Task: {params.id}</p>
      <ol>
        {events.map((e: any) => (
          <li key={String(e.id)}>
            <code>{e.eventType}</code> — {new Date(e.createdAt).toLocaleString()}
          </li>
        ))}
      </ol>
    </div>
  );
}
