/*
  Warnings:

  - A unique constraint covering the columns `[refund_no]` on the table `payment_refunds` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "uq_payment_refunds_refund_no" ON "payment_refunds"("refund_no");

-- CreateIndex
CREATE INDEX "idx_payment_refunds_payment_id" ON "payment_refunds"("payment_id");
