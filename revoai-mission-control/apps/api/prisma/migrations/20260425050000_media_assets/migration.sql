-- AI-generated media assets (images for now, video later). Each row is one
-- generation result with the prompt that produced it, source provider,
-- cost (in cents) and the URL of the asset. Used by /social Compose
-- 🎨 Generate image and by trend-jacking for auto-image-on-post.

CREATE TABLE "media_assets" (
  "id"          TEXT PRIMARY KEY,
  "kind"        TEXT NOT NULL,
  "source"      TEXT NOT NULL,
  "prompt"      TEXT,
  "url"         TEXT NOT NULL,
  "width"       INTEGER,
  "height"      INTEGER,
  "cost_cents"  INTEGER,
  "metadata"    JSONB NOT NULL DEFAULT '{}',
  "created_by"  TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "media_assets_kind_created_at_idx" ON "media_assets" ("kind", "created_at" DESC);
