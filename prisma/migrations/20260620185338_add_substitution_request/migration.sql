-- CreateEnum
CREATE TYPE "SubstitutionStatus" AS ENUM ('PENDING_TEACHER', 'TEACHER_ACCEPTED', 'TEACHER_DECLINED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "SubstitutionRequest" (
    "id" TEXT NOT NULL,
    "scheduledClassId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "requestedById" TEXT NOT NULL,
    "substituteTeacherId" TEXT NOT NULL,
    "approvedById" TEXT,
    "reason" TEXT NOT NULL,
    "teacherNote" TEXT,
    "adminNote" TEXT,
    "status" "SubstitutionStatus" NOT NULL DEFAULT 'PENDING_TEACHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubstitutionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubstitutionRequest_requestedById_idx" ON "SubstitutionRequest"("requestedById");

-- CreateIndex
CREATE INDEX "SubstitutionRequest_substituteTeacherId_idx" ON "SubstitutionRequest"("substituteTeacherId");

-- CreateIndex
CREATE INDEX "SubstitutionRequest_status_idx" ON "SubstitutionRequest"("status");

-- AddForeignKey
ALTER TABLE "SubstitutionRequest" ADD CONSTRAINT "SubstitutionRequest_scheduledClassId_fkey" FOREIGN KEY ("scheduledClassId") REFERENCES "ScheduledClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubstitutionRequest" ADD CONSTRAINT "SubstitutionRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubstitutionRequest" ADD CONSTRAINT "SubstitutionRequest_substituteTeacherId_fkey" FOREIGN KEY ("substituteTeacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubstitutionRequest" ADD CONSTRAINT "SubstitutionRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
