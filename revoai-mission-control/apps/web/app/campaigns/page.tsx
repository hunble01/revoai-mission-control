'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Table } from '../../components/ui/Table';

type ResearchItem = {
  id: string;
  title: string;
  notes: string;
  tags: string;
  createdAt: string;
};

type ParsedUpload = {
  fileName: string;
  fileType: string;
  rows: string[][];
  headers: string[];
};

type ImportSummary = {
  imported: number;
  skippedDuplicates: number;
  invalidRows: number;
  totalRows: number;
};

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';

function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(',').map((v) => v.trim()));
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);

  const [research, setResearch] = useState<ResearchItem[]>([]);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [query, setQuery] = useState('');

  const [uploads, setUploads] = useState<ParsedUpload[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importStage, setImportStage] = useState<'idle' | 'validating' | 'importing' | 'complete' | 'failed'>('idle');

  useEffect(() => {
    fetch(`${base}/api/campaigns`, { headers: { 'x-admin-token': token } })
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : [];
        setCampaigns(list);
        if (list[0]?.id) setSelectedCampaignId(list[0].id);
      })
      .catch(() => setCampaigns([]));

    const saved = localStorage.getItem('revoai_research_items');
    if (saved) {
      try {
        setResearch(JSON.parse(saved));
      } catch {}
    }
  }, []);

  const filteredResearch = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return research;
    return research.filter((r) => `${r.title} ${r.notes} ${r.tags}`.toLowerCase().includes(q));
  }, [research, query]);

  const activeCsv = useMemo(
    () => uploads.find((u) => u.fileType === 'CSV' && u.headers.length > 0),
    [uploads],
  );

  const mappedCount = useMemo(() => {
    if (!activeCsv) return 0;
    return activeCsv.headers.filter((h) => !!map[h]).length;
  }, [activeCsv, map]);

  const totalColumns = activeCsv?.headers.length || 0;
  const hasRequiredMapping = Object.values(map).some((v) => v === 'name' || v === 'company');
  const importReady = mappedCount > 0 && hasRequiredMapping;

  const duplicatePreview = useMemo(() => {
    if (!activeCsv) return { email: 0, phone: 0 };

    const mappedEmailHeader = activeCsv.headers.find((h) => map[h] === 'email');
    const mappedPhoneHeader = activeCsv.headers.find((h) => map[h] === 'phone');

    const emailIdx = mappedEmailHeader
      ? activeCsv.headers.indexOf(mappedEmailHeader)
      : activeCsv.headers.findIndex((h) => h.toLowerCase().includes('email'));
    const phoneIdx = mappedPhoneHeader
      ? activeCsv.headers.indexOf(mappedPhoneHeader)
      : activeCsv.headers.findIndex((h) => h.toLowerCase().includes('phone'));

    const countDupes = (idx: number) => {
      if (idx < 0) return 0;
      const counts = new Map<string, number>();
      for (const row of activeCsv.rows) {
        const val = (row[idx] || '').trim().toLowerCase();
        if (!val) continue;
        counts.set(val, (counts.get(val) || 0) + 1);
      }
      let dupes = 0;
      counts.forEach((n) => {
        if (n > 1) dupes += n - 1;
      });
      return dupes;
    };

    return {
      email: countDupes(emailIdx),
      phone: countDupes(phoneIdx),
    };
  }, [activeCsv, map]);

  const saveResearch = (next: ResearchItem[]) => {
    setResearch(next);
    localStorage.setItem('revoai_research_items', JSON.stringify(next));
  };

  const addResearch = () => {
    if (!title.trim() || !notes.trim()) return;
    const next: ResearchItem[] = [
      {
        id: crypto.randomUUID(),
        title: title.trim(),
        notes: notes.trim(),
        tags: tags.trim(),
        createdAt: new Date().toISOString(),
      },
      ...research,
    ];
    saveResearch(next);
    setTitle('');
    setNotes('');
    setTags('');
  };

  const exportResearchPdf = (item: ResearchItem) => {
    const w = window.open('', '_blank', 'width=900,height=900');
    if (!w) return;
    w.document.write(`
      <html><head><title>${item.title}</title>
      <style>body{font-family:Inter,Arial,sans-serif;padding:28px;line-height:1.5} h1{margin-top:0}</style>
      </head><body>
      <h1>${item.title}</h1>
      <p><strong>Created:</strong> ${new Date(item.createdAt).toLocaleString()}</p>
      <p><strong>Tags:</strong> ${item.tags || '—'}</p>
      <hr/>
      <p>${item.notes.replace(/\n/g, '<br/>')}</p>
      </body></html>
    `);
    w.document.close();
    w.focus();
    w.print();
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const parsed: ParsedUpload[] = [];

    for (const file of Array.from(files)) {
      const ext = file.name.toLowerCase();

      if (ext.endsWith('.csv')) {
        const text = await file.text();
        const rows = parseCsv(text);
        parsed.push({
          fileName: file.name,
          fileType: 'CSV',
          rows: rows.slice(1),
          headers: rows[0] || [],
        });
      } else if (ext.endsWith('.xlsx')) {
        parsed.push({ fileName: file.name, fileType: 'XLSX', rows: [], headers: [] });
      } else if (ext.endsWith('.pdf')) {
        parsed.push({ fileName: file.name, fileType: 'PDF', rows: [], headers: [] });
      }
    }

    setUploads(parsed);
    setImportSummary(null);
    setImportError('');
    setImportStage('idle');
    if (parsed[0]?.headers?.length) {
      const initial: Record<string, string> = {};
      for (const h of parsed[0].headers) initial[h] = '';
      setMap(initial);
    }
  };

  const importCsvToLeads = async () => {
    const csv = uploads.find((u) => u.fileType === 'CSV' && u.headers.length > 0);
    if (!csv) {
      setImportError('Please upload a CSV file first.');
      setImportStage('failed');
      return;
    }

    if (!Object.values(map).some((v) => v === 'name' || v === 'company')) {
      setImportError('Map at least one required field: Name or Company.');
      setImportStage('failed');
      return;
    }

    setImporting(true);
    setImportError('');
    setImportSummary(null);
    setImportStage('validating');
    const startedAt = Date.now();

    try {
      const res = await fetch(`${base}/api/leads/import/csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
          'x-actor-role': 'ADMIN',
        },
        body: JSON.stringify({
          campaignId: selectedCampaignId || undefined,
          headers: csv.headers,
          rows: csv.rows,
          mapping: map,
        }),
      });

      setImportStage('importing');
      const raw = await res.text();
      let payload: any = null;
      if (raw) {
        try {
          payload = JSON.parse(raw);
        } catch {
          payload = { message: raw };
        }
      }

      if (!res.ok) {
        throw new Error(payload?.message || `CSV import failed (HTTP ${res.status}).`);
      }

      setImportSummary(payload);
      setImportStage('complete');
    } catch (err: any) {
      setImportError(err?.message || 'CSV import failed.');
      setImportStage('failed');
    } finally {
      const elapsed = Date.now() - startedAt;
      if (elapsed < 600) {
        await new Promise((resolve) => setTimeout(resolve, 600 - elapsed));
      }
      setImporting(false);
    }
  };

  return (
    <div className="dash-stack">
      <Card title="Campaigns" subtitle="Current campaign records">
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Niche</th>
              <th>Geography</th>
              <th>Min Score</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c: any) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.niche}</td>
                <td>{c.geography}</td>
                <td>{c.minScore}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card title="Research Hub" subtitle="Save and export research notes">
        <div className="table-toolbar" style={{ marginBottom: 10 }}>
          <Input placeholder="Research title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input placeholder="Tags (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
          <Button variant="primary" onClick={addResearch}>Save Research</Button>
        </div>
        <textarea className="ui-textarea" placeholder="Write research notes here..." value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="table-toolbar" style={{ marginTop: 10 }}>
          <Input placeholder="Search research" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          {filteredResearch.map((r) => (
            <div key={r.id} className="ui-card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <strong>{r.title}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>{new Date(r.createdAt).toLocaleString()}</div>
                </div>
                <Button variant="secondary" onClick={() => exportResearchPdf(r)}>Export PDF</Button>
              </div>
              <p style={{ marginBottom: 0 }}>{r.notes}</p>
              {r.tags && <Badge style={{ marginTop: 6 }}>{r.tags}</Badge>}
            </div>
          ))}
          {!filteredResearch.length && <p className="muted">No research notes saved yet.</p>}
        </div>
      </Card>

      <Card title="Upload Center" subtitle="Upload CSV / XLSX / PDF for intake">
        <input type="file" accept=".csv,.xlsx,.pdf" multiple onChange={(e) => onFiles(e.target.files)} />

        <div className="table-toolbar" style={{ marginTop: 10 }}>
          <select
            className="ui-input"
            value={selectedCampaignId}
            onChange={(e) => setSelectedCampaignId(e.target.value)}
            aria-label="Campaign"
          >
            {campaigns.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <Button variant="primary" onClick={importCsvToLeads} disabled={importing || !importReady}>
            {importing ? '⏳ Importing…' : 'Import CSV to Leads'}
          </Button>
        </div>

        {activeCsv && (
          <p className="muted" style={{ marginTop: 8 }}>
            Mapped: {mappedCount}/{totalColumns} columns • {importReady ? 'Ready to import' : hasRequiredMapping ? 'Map at least 1 field to continue' : 'Map required field: Name or Company'}
          </p>
        )}

        {activeCsv && importStage !== 'idle' && (
          <div className="ui-card" style={{ padding: 12, marginTop: 10 }}>
            <strong>Import Status</strong>
            <p className="muted" style={{ marginBottom: 0 }}>
              {importStage === 'validating' && 'Validating CSV mapping and row shape...'}
              {importStage === 'importing' && 'Importing rows to Leads...'}
              {importStage === 'complete' && 'Import complete.'}
              {importStage === 'failed' && 'Import failed.'}
            </p>
          </div>
        )}

        {importError && <p style={{ color: '#ff9b9b' }}>{importError}</p>}
        {importSummary && (
          <div className="ui-card" style={{ padding: 12, marginTop: 10 }}>
            <strong>Import Summary</strong>
            <p className="muted" style={{ marginBottom: 0 }}>
              Imported: {importSummary.imported} • Skipped duplicates: {importSummary.skippedDuplicates} • Invalid rows: {importSummary.invalidRows} • Total rows: {importSummary.totalRows}
            </p>
          </div>
        )}

        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          {uploads.map((u, idx) => (
            <div key={`${u.fileName}-${idx}`} className="ui-card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <strong>{u.fileName}</strong>
                <Badge>{u.fileType}</Badge>
              </div>

              {u.fileType === 'CSV' && !!u.headers.length && (
                <>
                  <p className="muted" style={{ marginTop: 0 }}>Column mapping</p>
                  <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
                    {u.headers.map((h) => (
                      <label key={h} className="muted" style={{ display: 'grid', gap: 4 }}>
                        {h}
                        <select
                          className="ui-input"
                          value={map[h] || ''}
                          onChange={(e) => setMap((m) => ({ ...m, [h]: e.target.value }))}
                        >
                          <option value="">Ignore</option>
                          <option value="name">Name</option>
                          <option value="company">Company</option>
                          <option value="email">Email</option>
                          <option value="phone">Phone</option>
                          <option value="source">Source</option>
                        </select>
                      </label>
                    ))}
                  </div>

                  {(duplicatePreview.email > 0 || duplicatePreview.phone > 0) && (
                    <div className="ui-card" style={{ padding: 10, marginBottom: 10, borderColor: '#6b5a2c' }}>
                      <strong style={{ color: '#ffd479' }}>Duplicate warning</strong>
                      <p className="muted" style={{ marginBottom: 0 }}>
                        Email duplicates: {duplicatePreview.email} • Phone duplicates: {duplicatePreview.phone}
                      </p>
                    </div>
                  )}

                  <Table>
                    <thead>
                      <tr>{u.headers.map((h) => <th key={h}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {u.rows.slice(0, 5).map((row, i) => (
                        <tr key={i}>{row.map((col, j) => <td key={j}>{col}</td>)}</tr>
                      ))}
                    </tbody>
                  </Table>
                </>
              )}

              {u.fileType !== 'CSV' && (
                <p className="muted" style={{ marginBottom: 0 }}>
                  File received and queued for structured intake.
                </p>
              )}
            </div>
          ))}
          {!uploads.length && <p className="muted">No files uploaded yet.</p>}
        </div>
      </Card>
    </div>
  );
}
