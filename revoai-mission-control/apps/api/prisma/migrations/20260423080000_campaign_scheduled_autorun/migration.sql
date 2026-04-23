-- Let campaigns schedule their next autorun firing.
-- When scheduled_autorun_at <= NOW() and no research_run exists for that
-- campaign today, the ScheduledAutorunService cron kicks off the pipeline
-- and clears this field. Lets the user set "run this campaign Monday at
-- 9am" without having to click ⚡ Run Campaign in person.

ALTER TABLE "Campaign" ADD COLUMN "scheduled_autorun_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS idx_campaign_scheduled_autorun_at
  ON "Campaign" ("scheduled_autorun_at")
  WHERE "scheduled_autorun_at" IS NOT NULL;
