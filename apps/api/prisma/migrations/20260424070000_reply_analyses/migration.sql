-- Reply Intelligence v2: persist every Claude reply analysis so we have an
-- audit trail per lead, and so the UI can offer one-click apply for the
-- recommended action (pause sequence / mark unsubscribed / mark bounced).
--
-- recommendedAction is what Claude suggested; appliedAction is what the user
-- actually triggered (often the same, but we capture both for the audit).

CREATE TABLE "reply_analyses" (
  "id"                 TEXT PRIMARY KEY,
  "lead_id"            TEXT NOT NULL,
  "reply_text"         TEXT NOT NULL,
  "intent"             TEXT NOT NULL,
  "confidence"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reasoning"          TEXT NOT NULL DEFAULT '',
  "recommended_action" TEXT NOT NULL,
  "suggested_response" TEXT NOT NULL DEFAULT '',
  "applied_action"     TEXT,
  "applied_at"         TIMESTAMP(3),
  "applied_by"         TEXT,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "reply_analyses_lead_id_created_at_idx"
  ON "reply_analyses" ("lead_id", "created_at" DESC);
