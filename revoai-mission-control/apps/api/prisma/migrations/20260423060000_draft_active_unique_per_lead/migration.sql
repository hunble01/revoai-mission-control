-- Prevent duplicate active drafts per lead.
-- Motivation: during a double-click of the Run Campaign button, two
-- concurrent autorun stage-4 workers each saw "no existing draft" via
-- findFirst before either inserted, so both inserted drafts for the
-- same lead. Michael had Laya Spa get 3 sends in 12 seconds.
--
-- A partial unique index makes the DB enforce the invariant: there can
-- be AT MOST ONE draft per lead whose status is still in-flight
-- (DRAFT, NEEDS_APPROVAL, APPROVED). Multiple SENT/REJECTED drafts
-- remain allowed (history).

CREATE UNIQUE INDEX IF NOT EXISTS idx_draft_leadid_active_status
  ON "Draft" ("leadId")
  WHERE status IN ('DRAFT', 'NEEDS_APPROVAL', 'APPROVED') AND "leadId" IS NOT NULL;
