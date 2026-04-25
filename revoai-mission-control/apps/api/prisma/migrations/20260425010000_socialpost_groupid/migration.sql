-- Wave 1 of the Social Hub: a single Compose action that fans out to multiple
-- platforms (LinkedIn / Facebook / Instagram / YouTube) creates one SocialPost
-- per platform sharing a group_id. The hub UI uses group_id to render the
-- bundle as a single row in the Queue + Calendar views, and to act on all
-- variants together (reschedule, edit body, archive).

ALTER TABLE "social_posts" ADD COLUMN "group_id" TEXT;
CREATE INDEX IF NOT EXISTS idx_social_posts_group_id
  ON "social_posts" ("group_id")
  WHERE "group_id" IS NOT NULL;
