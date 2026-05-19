-- CreateEnum
CREATE TYPE "TermsType" AS ENUM ('REGISTRATION', 'PRODUCT_LISTING');

-- CreateTable
CREATE TABLE "terms_acceptances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TermsType" NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "contextRef" TEXT,

    CONSTRAINT "terms_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "terms_acceptances_userId_type_idx" ON "terms_acceptances"("userId", "type");

-- CreateIndex
CREATE INDEX "terms_acceptances_type_version_idx" ON "terms_acceptances"("type", "version");

-- CreateIndex
CREATE INDEX "terms_acceptances_contextRef_idx" ON "terms_acceptances"("contextRef");

-- CreateIndex
CREATE INDEX "terms_acceptances_acceptedAt_idx" ON "terms_acceptances"("acceptedAt");

-- AddForeignKey
ALTER TABLE "terms_acceptances" ADD CONSTRAINT "terms_acceptances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
