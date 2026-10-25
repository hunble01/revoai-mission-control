#!/usr/bin/env node

const webBase = process.env.TEST_WEB_BASE || 'http://127.0.0.1:3000';

async function get(path) {
  const res = await fetch(`${webBase}${path}`);
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${path} failed (${res.status})`);
  return text;
}

function normalize(html) {
  return html
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

function assertIncludes(html, marker, page) {
  const hay = normalize(html);
  if (!hay.includes(marker)) {
    throw new Error(`UI smoke failed: '${marker}' missing on ${page}`);
  }
}

(async () => {
  const pages = {
    '/campaigns': ['Campaign Setup & Import Start', 'Upload Center', 'Import CSV to Leads'],
    '/leads': ['Leads Qualification & Routing', 'Search leads', 'Rows per page'],
    '/approvals': ['Approval Decisions', 'Approval Inbox', 'Refresh queue'],
  };

  for (const [path, markers] of Object.entries(pages)) {
    const html = await get(path);
    markers.forEach((m) => assertIncludes(html, m, path));
  }

  console.log(JSON.stringify({
    ok: true,
    checks: ['campaigns-ui-smoke', 'leads-ui-smoke', 'approvals-ui-smoke'],
    base: webBase,
  }, null, 2));
})();
