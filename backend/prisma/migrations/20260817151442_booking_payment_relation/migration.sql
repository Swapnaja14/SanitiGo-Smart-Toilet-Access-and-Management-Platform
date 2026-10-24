/*
  Warnings:

  - You are about to drop the column `sessionId` on the `Payment` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[token]` on the table `Booking` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[bookingId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `token` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bookingId` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Payment" DROP CONSTRAINT "Payment_sessionId_fkey";

-- DropIndex
DROP INDEX "public"."Payment_sessionId_key";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "token" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "sessionId",
ADD COLUMN     "bookingId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Booking_token_key" ON "Booking"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_bookingId_key" ON "Payment"("bookingId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
