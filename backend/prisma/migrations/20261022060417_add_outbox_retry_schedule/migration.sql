-- AlterEnum
ALTER TYPE "OutboxStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "OutboxEvent" ADD COLUMN     "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "OutboxEvent_status_nextAttemptAt_idx" ON "OutboxEvent"("status", "nextAttemptAt");
