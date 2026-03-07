#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const files = {
  dev: path.join(__dirname, '..', 'env', 'profiles', 'dev.env.example'),
  stage: path.join(__dirname, '..', 'env', 'profiles', 'stage.env.example'),
  prod: path.join(__dirname, '..', 'env', 'profiles', 'prod.env.example'),
};

const required = [
  'NODE_ENV',
  'DATABASE_URL',
  'REDIS_URL',
  'PORT',
  'ADMIN_MODE',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
  'ADMIN_TOKEN',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_WS_URL',
  'INTERNAL_API_URL',
  'NEXT_PUBLIC_ADMIN_TOKEN',
];

function parseEnv(file) {
  const out = {};
  const raw = fs.readFileSync(file, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const k = trimmed.slice(0, idx).trim();
    const v = trimmed.slice(idx + 1).trim();
    out[k] = v;
  }
  return out;
}

const parsed = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, parseEnv(f)]));

const report = {
  ok: true,
  requiredCount: required.length,
  profiles: {},
  parityGaps: [],
  safeDefaultChecks: {},
};

for (const [profile, values] of Object.entries(parsed)) {
  const missing = required.filter((k) => !Object.prototype.hasOwnProperty.call(values, k));
  report.profiles[profile] = {
    missing,
    present: required.filter((k) => Object.prototype.hasOwnProperty.call(values, k)).length,
  };
  if (missing.length) report.ok = false;
}

for (const key of required) {
  const absent = Object.entries(parsed)
    .filter(([, values]) => !Object.prototype.hasOwnProperty.call(values, key))
    .map(([profile]) => profile);
  if (absent.length) report.parityGaps.push({ key, missingIn: absent });
}

report.safeDefaultChecks = {
  dev_local_endpoints:
    (parsed.dev.DATABASE_URL || '').includes('127.0.0.1') &&
    (parsed.dev.REDIS_URL || '').includes('127.0.0.1') &&
    (parsed.dev.NEXT_PUBLIC_API_URL || '').includes('127.0.0.1'),
  stage_placeholders_present:
    (parsed.stage.DATABASE_URL || '').includes('<stage-db-host>') &&
    (parsed.stage.ADMIN_TOKEN || '').includes('<stage-admin-token>'),
  prod_placeholders_present:
    (parsed.prod.DATABASE_URL || '').includes('<prod-db-host>') &&
    (parsed.prod.ADMIN_TOKEN || '').includes('<prod-admin-token>'),
  admin_token_parity:
    parsed.dev.ADMIN_TOKEN === parsed.dev.NEXT_PUBLIC_ADMIN_TOKEN &&
    parsed.stage.ADMIN_TOKEN === parsed.stage.NEXT_PUBLIC_ADMIN_TOKEN &&
    parsed.prod.ADMIN_TOKEN === parsed.prod.NEXT_PUBLIC_ADMIN_TOKEN,
};

if (!Object.values(report.safeDefaultChecks).every(Boolean)) {
  report.ok = false;
}

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
