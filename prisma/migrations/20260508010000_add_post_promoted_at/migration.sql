-- Mirror cho News.pinnedAt — track thời điểm Post được promote bởi admin
-- (set isPromoted=true hoặc newsCategories có phần tử). Cron unpromote-stale
-- chạy daily, gỡ cả 2 cờ sau 2 ngày kể từ promotedAt.
-- Bài existing có promotedAt=NULL → cron skip để admin tự quản; backfill
-- one-shot ngay sau migration set tất cả bài về 2026-05-08 baseline.
ALTER TABLE "posts" ADD COLUMN "promotedAt" TIMESTAMP(3);

-- Partial index cho cron query: WHERE isPromoted=true AND promotedAt < cutoff
-- AND promotedAt IS NOT NULL. Phần lớn bài có isPromoted=false nên partial
-- index rất nhỏ (1 vài rows), tránh full-table scan khi cron chạy.
CREATE INDEX "posts_isPromoted_promotedAt_idx" ON "posts"("isPromoted", "promotedAt") WHERE "isPromoted" = true;
