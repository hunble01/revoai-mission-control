-- Wave 2 of the Social Hub: Reply Intelligence for social comments + DMs.
--
-- The existing reply_analyses table is lead-specific (a cold-email recipient
-- replied). Wave 2 extends Reply Intelligence to social: a comment under a
-- LinkedIn post, an Instagram DM, a Facebook page reply. Same Claude
-- classification + apply-action pattern, just different subject types.
--
-- Approach: add a polymorphic subject (subject_type + subject_id). Backfill
-- existing rows so subject_type='lead' and subject_id=lead_id. Keep lead_id
-- nullable so social rows don't need a fake lead.

ALTER TABLE "reply_analyses" ADD COLUMN "subject_type" TEXT;
ALTER TABLE "reply_analyses" ADD COLUMN "subject_id"   TEXT;

UPDATE "reply_analyses"
   SET "subject_type" = 'lead', "subject_id" = "lead_id"
 WHERE "subject_type" IS NULL;

ALTER TABLE "reply_analyses" ALTER COLUMN "subject_type" SET NOT NULL;
ALTER TABLE "reply_analyses" ALTER COLUMN "subject_id"   SET NOT NULL;
ALTER TABLE "reply_analyses" ALTER COLUMN "lead_id"      DROP NOT NULL;

CREATE INDEX "reply_analyses_subject_idx"
  ON "reply_analyses" ("subject_type", "subject_id", "created_at" DESC);
