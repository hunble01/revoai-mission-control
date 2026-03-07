#!/usr/bin/env node

const required = [
  'DATABASE_URL',
  'REDIS_URL',
  'ADMIN_TOKEN',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_ADMIN_TOKEN',
];

const missing = required.filter((k) => !process.env[k] || !String(process.env[k]).trim());

const checks = {
  DATABASE_URL_localhost_hint: String(process.env.DATABASE_URL || '').includes('127.0.0.1') || String(process.env.DATABASE_URL || '').includes('localhost'),
  REDIS_URL_localhost_hint: String(process.env.REDIS_URL || '').includes('127.0.0.1') || String(process.env.REDIS_URL || '').includes('localhost'),
  ADMIN_TOKEN_present: !!process.env.ADMIN_TOKEN,
  WEB_ADMIN_TOKEN_matches: !!process.env.ADMIN_TOKEN && process.env.ADMIN_TOKEN === process.env.NEXT_PUBLIC_ADMIN_TOKEN,
};

const out = {
  ok: missing.length === 0,
  missing,
  checks,
  timestamp: new Date().toISOString(),
};

if (!out.ok) {
  console.error(JSON.stringify(out, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(out, null, 2));
