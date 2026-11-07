CREATE TYPE "tuition_refund_status" AS ENUM ('PENDING', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED');

CREATE TABLE "payment_refunds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "refund_no" VARCHAR(30) NOT NULL,
    "payment_id" UUID NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "refund_method" "tuition_payment_method" NOT NULL,
    "refund_date" TIMESTAMPTZ(6),
    "bank_transaction_no" VARCHAR(150),
    "reason" TEXT NOT NULL,
    "status" "tuition_refund_status" NOT NULL DEFAULT 'PENDING',
    "created_by" UUID NOT NULL,
    "approved_by" UUID,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_payment_refunds_refund_no" ON "payment_refunds"("refund_no");
CREATE INDEX "idx_payment_refunds_payment_id" ON "payment_refunds"("payment_id");
CREATE INDEX "idx_payment_refunds_status" ON "payment_refunds"("status");

ALTER TABLE "payment_refunds"
  ADD CONSTRAINT "payment_refunds_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "tuition_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_refunds"
  ADD CONSTRAINT "chk_payment_refunds_amount_positive" CHECK ("amount" > 0);
