# MVP Smoke Test Report

Date (UTC): 2026-03-07
Suite: `node scripts/mvp-smoke-test.js`

## Scope
- Import flow
- Leads flow
- Approvals flow

## Result
- ✅ importFlow: PASS
- ✅ leadsFlow: PASS
- ✅ approvalsFlow: PASS

## Artifacts
- campaignId: `73921172-694d-47ce-bc4d-ef69e50dc1bb`
- leadId: `89b8285c-8628-48eb-ab15-3e37fe5f051b`
- draftId: `0959423c-07fe-48b9-ac18-d91fec7968e5`
- importSummary: imported=1, skippedDuplicates=0, invalidRows=0, totalRows=1

## Notes
- Smoke script now auto-creates a valid UUID campaign if seeded campaigns are missing/non-UUID.
- API was started for smoke execution with local infrastructure endpoints (Postgres/Redis on localhost).
