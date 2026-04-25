-- Trend-jacking content engine: pull from public RSS / public APIs (Hacker
-- News, Reddit, Google News) so Michael always has a fresh angle to comment
-- on. The /content-calendar Trends tab lists these and offers a one-click
-- "Draft a post about this" button that hands the trend to Claude.

CREATE TABLE "trending_items" (
  "id"           TEXT PRIMARY KEY,
  "source"       TEXT NOT NULL,
  "title"        TEXT NOT NULL,
  "url"          TEXT NOT NULL,
  "summary"      TEXT,
  "score"        INTEGER,
  "published_at" TIMESTAMP(3),
  "fetched_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dismissed"    BOOLEAN NOT NULL DEFAULT false,
  "drafted_at"   TIMESTAMP(3)
);

CREATE UNIQUE INDEX "trending_items_source_url_key" ON "trending_items" ("source", "url");
CREATE INDEX "trending_items_source_fetched_at_idx" ON "trending_items" ("source", "fetched_at" DESC);
CREATE INDEX "trending_items_dismissed_idx" ON "trending_items" ("dismissed");
