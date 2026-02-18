const browserBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const internalBase = process.env.INTERNAL_API_URL || 'http://api:3001';
const adminToken = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

function getBase() {
  return typeof window === 'undefined' ? internalBase : browserBase;
}

export async function fetchJson(path: string) {
  const res = await fetch(`${getBase()}/api${path}`, {
    cache: 'no-store',
    headers: { 'x-admin-token': adminToken },
  });
  if (!res.ok) throw new Error(`Failed ${path}`);
  return res.json();
}

export async function postJson(path: string, body?: any, method: 'POST' | 'PATCH' = 'POST') {
  const res = await fetch(`${getBase()}/api${path}`, {
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
