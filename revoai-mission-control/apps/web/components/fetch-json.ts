const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const adminToken = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

export async function fetchJson(path: string) {
  const res = await fetch(`${base}/api${path}`, {
    cache: 'no-store',
    headers: { 'x-admin-token': adminToken },
  });
  if (!res.ok) throw new Error(`Failed ${path}`);
  return res.json();
}

export async function postJson(path: string, body?: any, method: 'POST' | 'PATCH' = 'POST') {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-admin-token': adminToken,
      'x-actor-role': 'admin',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Failed ${path}`);
  return data;
}
