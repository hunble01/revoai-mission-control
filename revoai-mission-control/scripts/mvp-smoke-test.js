#!/usr/bin/env node

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3001/api';
const token = process.env.SMOKE_ADMIN_TOKEN || process.env.NEXT_PUBLIC_ADMIN_TOKEN || process.env.ADMIN_TOKEN || 'change-me';

async function req(path, { method = 'GET', body, role = 'admin' } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-admin-token': token,
      'x-actor-role': role,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!res.ok) {
    throw new Error(`${method} ${path} failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  const startedAt = new Date().toISOString();
  const stamp = Date.now();
  const smokeName = `SmokeCo ${stamp}`;
  const smokeEmail = `smoke.${stamp}@example.com`;

  const campaigns = await req('/campaigns');
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  let campaign = Array.isArray(campaigns)
    ? (campaigns.find((c) => c.isActive && uuidRe.test(String(c.id))) || campaigns.find((c) => uuidRe.test(String(c.id))))
    : null;

  if (!campaign) {
    campaign = await req('/campaigns', {
      method: 'POST',
      body: {
        name: `Smoke Campaign ${stamp}`,
        niche: 'General',
        geography: 'Toronto/GTA',
        minScore: 'B',
      },
      role: 'admin',
    });
  }

  assert(campaign?.id && uuidRe.test(String(campaign.id)), 'No valid UUID campaign available for smoke test');

  const importPayload = {
    campaignId: campaign.id,
    fileName: `smoke-${stamp}.csv`,
    headers: ['name', 'email', 'phone', 'company', 'source'],
    rows: [[`Owner ${stamp}`, smokeEmail, `416-555-${String(stamp).slice(-4)}`, smokeName, 'smoke-test']],
    mapping: { name: 'name', email: 'email', phone: 'phone', company: 'company', source: 'source' },
  };

  const importRes = await req('/leads/import/csv', { method: 'POST', body: importPayload, role: 'admin' });
  assert(typeof importRes.totalRows === 'number', 'Import response missing totalRows');

  const leads = await req(`/leads?search=${encodeURIComponent(smokeName)}`);
  assert(Array.isArray(leads) && leads.length >= 1, 'Imported lead not found in leads list');
  const lead = leads[0];

  await req(`/leads/${lead.id}`, { method: 'PATCH', body: { status: 'CONTACTED' }, role: 'admin' });
  const contactedLeads = await req(`/leads?search=${encodeURIComponent(smokeName)}&status=CONTACTED`);
  assert(Array.isArray(contactedLeads) && contactedLeads.some((l) => l.id === lead.id), 'Lead status update to CONTACTED not reflected');

  const draft = await req('/drafts', {
    method: 'POST',
    body: {
      campaignId: campaign.id,
      leadId: lead.id,
      channel: 'EMAIL',
      draftType: 'smoke-approval',
      content: `Smoke approval content ${stamp}`,
    },
    role: 'admin',
  });

  await req(`/drafts/${draft.id}`, { method: 'PATCH', body: { status: 'NEEDS_APPROVAL' }, role: 'admin' });
  const approveRes = await req(`/drafts/${draft.id}/approve`, { method: 'POST', body: { notes: 'smoke approve' }, role: 'admin' });
  const approvedStatus = approveRes?.data?.nextStatus || approveRes?.data?.status;
  assert(approvedStatus === 'APPROVED', `Approval action did not return APPROVED status (got ${approvedStatus})`);

  const queue = await req('/drafts?status=NEEDS_APPROVAL');
  assert(Array.isArray(queue) && !queue.some((d) => d.id === draft.id), 'Approved draft still in NEEDS_APPROVAL queue');

  const report = {
    ok: true,
    startedAt,
    finishedAt: new Date().toISOString(),
    checks: {
      importFlow: true,
      leadsFlow: true,
      approvalsFlow: true,
    },
    artifacts: {
      campaignId: campaign.id,
      leadId: lead.id,
      draftId: draft.id,
      importSummary: {
        imported: importRes.imported,
        skippedDuplicates: importRes.skippedDuplicates,
        invalidRows: importRes.invalidRows,
        totalRows: importRes.totalRows,
      },
    },
  };

  console.log(JSON.stringify(report, null, 2));
})();
