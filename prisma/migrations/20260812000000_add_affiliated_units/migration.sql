-- CreateEnum
CREATE TYPE "AffiliatedUnitType" AS ENUM ('CHI_HOI', 'BAN');

-- CreateTable
CREATE TABLE "affiliated_units" (
    "id" TEXT NOT NULL,
    "type" "AffiliatedUnitType" NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT,
    "name_zh" TEXT,
    "name_ar" TEXT,
    "description" TEXT,
    "description_en" TEXT,
    "description_zh" TEXT,
    "description_ar" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliated_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliated_unit_members" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT,
    "name_zh" TEXT,
    "name_ar" TEXT,
    "title" TEXT NOT NULL,
    "title_en" TEXT,
    "title_zh" TEXT,
    "title_ar" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliated_unit_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "affiliated_units_type_isActive_sortOrder_idx" ON "affiliated_units"("type", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "affiliated_unit_members_unitId_sortOrder_idx" ON "affiliated_unit_members"("unitId", "sortOrder");

-- AddForeignKey
ALTER TABLE "affiliated_unit_members" ADD CONSTRAINT "affiliated_unit_members_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "affiliated_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
