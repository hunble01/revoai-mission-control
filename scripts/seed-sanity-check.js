#!/usr/bin/env node

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3001/api';
const token = process.env.ADMIN_TOKEN || process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

(async () => {
  const res = await fetch(`${base}/seed/load`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': token,
      'x-actor-role': 'admin',
    },
    body: JSON.stringify({}),
  });

  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!res.ok) {
    console.error(JSON.stringify({ ok: false, status: res.status, data }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, status: res.status, data }, null, 2));
})();
