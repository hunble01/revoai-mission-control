# RevoAI Mission Control — Fast-but-Safe Roadmap

## Mode
- Delivery mode: **Fast-but-safe**
- Rule: Ship in larger chunks, keep one strict QA gate per milestone.
- Safety: Dry-run + approval-gated outbound until explicitly changed.

## Status Legend
- [ ] Not started
- [~] In progress
- [x] Done

---

## Phase 0 — Foundation (already mostly done)
- [x] Core app shell + premium CRM dark UI baseline
- [x] Overview/Leads/Drafts/Approvals base redesign direction
- [x] Admin-gated mutation controls + audit/replay foundations
- [x] Safety model defaults (dry-run/on, outbound/off)
- [~] VPS runtime hardening/ops ergonomics

---

## Phase 1 — Complete Layer 2 UI + consistency (Day 1–2)
1. [~] Approvals final visual/UX pass
2. [~] Leads final visual/UX pass
3. [~] Drafts final visual/UX pass
4. [ ] Cross-page spacing/typography/border consistency sweep
5. [ ] Responsive pass (desktop/tablet/mobile behavior)
6. [ ] QA gate #1 (no console errors, no broken states)

Deliverable: Cohesive premium UI for core operator pages.

---

## Phase 2 — Research Hub + Upload Center (Day 2–5)
1. [ ] Research records model + API routes
2. [ ] Research UI (create/list/search/detail)
3. [ ] Export research record to PDF
4. [ ] Upload UI for CSV/XLSX/PDF
5. [ ] File parsing pipeline (CSV/XLSX to structured rows)
6. [ ] PDF intake metadata extraction path
7. [ ] Column mapping UI (name/company/email/phone/source/etc.)
8. [ ] Import validation + dedupe checks
9. [ ] Persist original file for audit traceability
10. [ ] QA gate #2 (intake end-to-end smoke test)

Deliverable: You can upload external lists/documents, map, and ingest safely.

---

## Phase 3 — Outreach prep engine (approval-gated) (Day 5–8)
1. [ ] Intake queue -> lead review states
2. [ ] Draft generation workflow from imported leads
3. [ ] Email outreach draft templates + personalization fields
4. [ ] LinkedIn outreach draft templates + personalization fields
5. [ ] Approval queue integration for all generated drafts
6. [ ] Manual mark-sent and state transitions
7. [ ] QA gate #3 (draft -> approval -> manual sent flow)

Deliverable: Automated prep, human-approved execution.

---

## Phase 4 — Social content workflow (Day 8–10)
1. [ ] Daily content research entries for AI/video ideas
2. [ ] Post draft objects (LinkedIn/Facebook)
3. [ ] Calendar/scheduler integration for post queue
4. [ ] Approval-gated publish-ready flow
5. [ ] QA gate #4 (content workflow + schedule integrity)

Deliverable: Daily posting pipeline ready, still controlled by approvals.

---

## Phase 5 — Full hardening + production readiness (Day 10–14)
1. [ ] End-to-end reliability tests
2. [ ] Error handling + retries + guardrails tightening
3. [ ] Audit/reporting consistency pass
4. [ ] Performance and responsiveness pass
5. [ ] Deployment runbook finalization
6. [ ] Final acceptance QA gate

Deliverable: Functional fast release candidate (10–14 days).

---

## Post-14 day hardening window (optional, Day 15–21)
- [ ] Advanced polish and edge-case coverage
- [ ] Additional analytics and attribution enrichments
- [ ] Execution connector hardening by channel

Deliverable: Fully polished, hardened build (~2–3 weeks total).

---

## Non-negotiables
- No outbound auto-send without explicit approval change.
- Keep approved premium UI language across all modules.
- Preserve project context/memory continuously.
- Proactive status updates at every meaningful milestone/blocker.
