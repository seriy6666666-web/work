-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('DAY', 'NIGHT');

-- CreateTable
CREATE TABLE "PlannedShift" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "ShiftType" NOT NULL DEFAULT 'DAY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,

    CONSTRAINT "PlannedShift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlannedShift_siteId_date_idx" ON "PlannedShift"("siteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedShift_userId_date_key" ON "PlannedShift"("userId", "date");

-- AddForeignKey
ALTER TABLE "PlannedShift" ADD CONSTRAINT "PlannedShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedShift" ADD CONSTRAINT "PlannedShift_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
