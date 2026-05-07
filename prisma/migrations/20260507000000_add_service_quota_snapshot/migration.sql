-- CreateEnum
CREATE TYPE "ServiceQuotaService" AS ENUM ('CLOUDINARY', 'GDRIVE', 'SUPABASE', 'VERCEL');

-- CreateEnum
CREATE TYPE "ServiceQuotaSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateTable
CREATE TABLE "service_quota_snapshots" (
    "id" TEXT NOT NULL,
    "service" "ServiceQuotaService" NOT NULL,
    "metric" TEXT NOT NULL,
    "used" BIGINT NOT NULL,
    "limit" BIGINT NOT NULL,
    "unit" TEXT NOT NULL,
    "source" "ServiceQuotaSource" NOT NULL DEFAULT 'AUTO',
    "note" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_quota_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_quota_snapshots_service_metric_capturedAt_idx" ON "service_quota_snapshots"("service", "metric", "capturedAt");

-- CreateIndex
CREATE INDEX "service_quota_snapshots_capturedAt_idx" ON "service_quota_snapshots"("capturedAt");
