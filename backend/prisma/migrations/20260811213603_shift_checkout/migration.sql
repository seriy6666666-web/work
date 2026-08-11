-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "checkOutAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Shift_userId_checkInAt_idx" ON "Shift"("userId", "checkInAt");
