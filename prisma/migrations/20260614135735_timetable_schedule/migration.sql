-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Stream" ADD VALUE 'MARKETING';
ALTER TYPE "Stream" ADD VALUE 'SUPPLY_CHAIN';
ALTER TYPE "Stream" ADD VALUE 'ENTREPRENEURSHIP';

-- CreateTable
CREATE TABLE "ScheduledClass" (
    "id" TEXT NOT NULL,
    "classSectionId" TEXT NOT NULL,
    "day" "Weekday" NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "offeringId" TEXT,
    "subgroup" TEXT,
    "room" TEXT,
    "rawLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledClass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledClass_classSectionId_day_slotIndex_idx" ON "ScheduledClass"("classSectionId", "day", "slotIndex");

-- CreateIndex
CREATE INDEX "ScheduledClass_offeringId_idx" ON "ScheduledClass"("offeringId");

-- AddForeignKey
ALTER TABLE "ScheduledClass" ADD CONSTRAINT "ScheduledClass_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "ClassSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledClass" ADD CONSTRAINT "ScheduledClass_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE SET NULL ON UPDATE CASCADE;
