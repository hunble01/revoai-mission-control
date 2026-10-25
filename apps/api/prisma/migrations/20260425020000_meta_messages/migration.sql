-- Wave 2 of the Social Hub: Facebook + Instagram DM queue.
--
-- Honest constraint: Meta only allows DMs in the 24-hour window after a
-- user has messaged the page first. We can't safely run cold-DM automation
-- on Facebook or Instagram. So this queue is for warm-reply use only —
-- the UI shows a banner explaining the restriction, and "real send" is
-- gated behind a stub-mode flag that stays on by default until the user
-- has a validated path (e.g., Messenger Platform with verified business
-- account + valid 24h window).

CREATE TABLE "meta_messages" (
  "id"                 TEXT PRIMARY KEY,
  "channel"            TEXT NOT NULL,
  "lead_id"            TEXT,
  "recipient_handle"   TEXT,
  "message_body"       TEXT NOT NULL,
  "status"             TEXT NOT NULL DEFAULT 'queued',
  "sent_at"            TIMESTAMP(3),
  "reply_received_at"  TIMESTAMP(3),
  "external_thread_id" TEXT,
  "reject_reason"      TEXT,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3) NOT NULL
);

CREATE INDEX "meta_messages_channel_status_idx" ON "meta_messages" ("channel", "status");
CREATE INDEX "meta_messages_sent_at_idx" ON "meta_messages" ("sent_at");
