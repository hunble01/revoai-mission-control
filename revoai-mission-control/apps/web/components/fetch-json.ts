export async function fetchJson(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const res = await fetch(`${base}/api${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed ${path}`);
  return res.json();
}
