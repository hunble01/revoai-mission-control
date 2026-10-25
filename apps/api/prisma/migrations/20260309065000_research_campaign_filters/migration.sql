ALTER TABLE "research_runs"
  ADD COLUMN IF NOT EXISTS "campaign_id" TEXT,
  ADD COLUMN IF NOT EXISTS "sources_used" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "search_params" JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  ALTER TABLE "research_runs"
    ADD CONSTRAINT "research_runs_campaign_id_fkey"
    FOREIGN KEY ("campaign_id") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "research_leads"
  ADD COLUMN IF NOT EXISTS "fit_score" TEXT,
  ADD COLUMN IF NOT EXISTS "source" TEXT;

ALTER TABLE "Lead"
  ADD COLUMN IF NOT EXISTS "fit_score" TEXT,
  ADD COLUMN IF NOT EXISTS "source_detail" TEXT;
