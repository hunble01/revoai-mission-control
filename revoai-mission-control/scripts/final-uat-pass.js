#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const api = process.env.UAT_API_BASE || 'http://127.0.0.1:3001/api';
const web = process.env.UAT_WEB_BASE || 'http://127.0.0.1:3000';
const email = process.env.UAT_ADMIN_EMAIL || process.env.BOOTSTRAP_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@revoai.local';
const password = process.env.UAT_ADMIN_PASSWORD || process.env.BOOTSTRAP_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'change-me';

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { res, data, text };
}

(async () => {
  const report = { ok: true, checks: [], failures: [], ts: new Date().toISOString() };

  const b = await fetchJson(`${api}/auth/bootstrap`, { method: 'POST' });
  if (!b.res.ok) {
    report.ok = false; report.failures.push(`bootstrap:${b.res.status}`);
  } else report.checks.push('auth_bootstrap');

  const login = await fetchJson(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const cookie = login.res.headers.get('set-cookie') || '';
  if (!login.res.ok || !cookie.includes('mc_session=')) {
    report.ok = false; report.failures.push(`auth_login:${login.res.status}`);
  } else report.checks.push('auth_login_session');

  const apiChecks = [
    '/health', '/alerts', '/leads', '/drafts', '/campaigns', '/scheduler/jobs', '/scheduler/runs', '/agents', '/audit?limit=20', '/tasks'
  ];
  for (const route of apiChecks) {
    const r = await fetchJson(`${api}${route}`, { headers: { cookie } });
    if (!r.res.ok) {
      report.ok = false; report.failures.push(`api${route}:${r.res.status}`);
    } else report.checks.push(`api${route}`);
  }

  const webRoutes = ['/', '/campaigns', '/leads', '/approvals', '/drafts', '/board', '/tasks/00000000-0000-0000-0000-000000000000/replay', '/feed', '/agents', '/scheduler', '/health', '/audit', '/help', '/settings'];
  for (const route of webRoutes) {
    const res = await fetch(`${web}${route}`);
    if (!res.ok) {
      report.ok = false; report.failures.push(`web${route}:${res.status}`);
    } else report.checks.push(`web${route}`);
  }

  const outPath = path.join(process.cwd(), 'docs', 'FINAL_UAT_REPORT.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
})();
