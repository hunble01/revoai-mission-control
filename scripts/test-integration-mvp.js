#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const apiBase = process.env.TEST_API_BASE || 'http://127.0.0.1:3001/api';

function readEnvToken() {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    const raw = fs.readFileSync(envPath, 'utf8');
    const line = raw.split(/\r?\n/).find((l) => l.startsWith('ADMIN_TOKEN='));
    return line ? line.slice('ADMIN_TOKEN='.length).trim() : '';
  } catch {
    return '';
  }
}

const token = process.env.TEST_ADMIN_TOKEN || process.env.ADMIN_TOKEN || process.env.NEXT_PUBLIC_ADMIN_TOKEN || readEnvToken() || 'change-me';

async function req(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-admin-token': token,
      'x-actor-role': 'admin',
      'x-actor-id': 'integration-test',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`${method} ${path} failed (${res.status}): ${JSON.stringify(data)}`);
  return data;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  const stamp = Date.now();
  const campaigns = await req('/campaigns');
  assert(Array.isArray(campaigns) && campaigns.length > 0, 'No campaigns available');
  const campaign = campaigns.find((c) => c.isActive) || campaigns[0];

  const importRes = await req('/leads/import/csv', {
    method: 'POST',
    body: {
      campaignId: campaign.id,
      fileName: `integration-${stamp}.csv`,
      headers: ['name', 'email', 'phone', 'company', 'source'],
      rows: [[`Lead ${stamp}`, `lead.${stamp}@example.com`, `416-555-${String(stamp).slice(-4)}`, `Co ${stamp}`, 'integration-test']],
      mapping: { name: 'name', email: 'email', phone: 'phone', company: 'company', source: 'source' },
    },
  });

  assert(typeof importRes.imported === 'number', 'Import response missing imported count');

  const leads = await req(`/leads?search=${encodeURIComponent(`Co ${stamp}`)}`);
  assert(Array.isArray(leads) && leads.length > 0, 'Imported lead not retrievable in leads list');
  const lead = leads[0];

  await req(`/leads/${lead.id}`, { method: 'PATCH', body: { status: 'CONTACTED' } });
  const leadsContacted = await req(`/leads?search=${encodeURIComponent(`Co ${stamp}`)}&status=CONTACTED`);
  assert(leadsContacted.some((l) => l.id === lead.id), 'Lead status update not reflected in filtered list');

  const draft = await req('/drafts', {
    method: 'POST',
    body: {
      campaignId: campaign.id,
      leadId: lead.id,
      channel: 'EMAIL',
      draftType: 'integration-approval',
      content: `Approval content ${stamp}`,
    },
  });

  await req(`/drafts/${draft.id}`, { method: 'PATCH', body: { status: 'NEEDS_APPROVAL' } });
  const decision = await req(`/drafts/${draft.id}/approve`, { method: 'POST', body: { notes: 'integration approve' } });
  const approved = decision?.data?.nextStatus === 'APPROVED' || decision?.data?.status === 'APPROVED';
  assert(approved, 'Approval endpoint did not return approved status contract');

  const importRuns = await req('/leads/import/runs?limit=10');
  assert(Array.isArray(importRuns) && importRuns.length > 0, 'Import run history missing');

  console.log(JSON.stringify({
    ok: true,
    checks: ['import', 'leads-status-update', 'approvals-decision', 'import-history'],
    artifacts: {
      campaignId: campaign.id,
      leadId: lead.id,
      draftId: draft.id,
    },
  }, null, 2));
})();
