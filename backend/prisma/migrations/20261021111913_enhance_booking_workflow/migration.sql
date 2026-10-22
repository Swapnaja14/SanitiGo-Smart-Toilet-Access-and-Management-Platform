/*
  Warnings:

  - A unique constraint covering the columns `[sessionId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "BookingStatus" ADD VALUE 'EXPIRED';

-- DropForeignKey
ALTER TABLE "public"."Payment" DROP CONSTRAINT "Payment_bookingId_fkey";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ALTER COLUMN "token" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "sessionId" TEXT,
ALTER COLUMN "bookingId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_sessionId_key" ON "Payment"("sessionId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "UsageSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
