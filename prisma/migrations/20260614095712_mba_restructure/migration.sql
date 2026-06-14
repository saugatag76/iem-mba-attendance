/*
  Warnings:

  - You are about to drop the column `semester` on the `ClassSection` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "Stream" AS ENUM ('COMMON', 'FINANCE', 'HR', 'TECH_MANAGEMENT');

-- AlterTable
ALTER TABLE "ClassSection" DROP COLUMN "semester",
ADD COLUMN     "stream" "Stream" NOT NULL DEFAULT 'COMMON',
ADD COLUMN     "year" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "semester" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "stream" "Stream" NOT NULL DEFAULT 'COMMON';
