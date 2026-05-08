-- Add pinnedAt timestamp to track when admin pinned a News item.
-- Cron `unpin-stale` runs daily, unpins items where pinnedAt is older than
-- 2 days. Existing pinned items have pinnedAt = NULL → cron skips them so
-- the auto-unpin only applies to newly pinned items going forward.
ALTER TABLE "news" ADD COLUMN "pinnedAt" TIMESTAMP(3);

-- Partial index — accelerates the cron's WHERE isPinned=true AND pinnedAt
-- IS NOT NULL AND pinnedAt < cutoff query. Tiny index because most rows are
-- not pinned at any given time.
CREATE INDEX "news_isPinned_pinnedAt_idx" ON "news"("isPinned", "pinnedAt") WHERE "isPinned" = true;
