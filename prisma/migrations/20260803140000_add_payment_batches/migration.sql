CREATE TYPE "payment_batch_status" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED');

CREATE TABLE "payment_batches" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "batch_no" VARCHAR(40) NOT NULL,
  "student_id" UUID NOT NULL,
  "total_amount" DECIMAL(15,2) NOT NULL,
  "payment_method" "tuition_payment_method" NOT NULL,
  "status" "payment_batch_status" NOT NULL DEFAULT 'PENDING',
  "payment_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "bank_account_id" UUID,
  "bank_transaction_no" VARCHAR(150),
  "transaction_reference" VARCHAR(150),
  "payer_name" VARCHAR(255),
  "payment_content" VARCHAR(500),
  "confirmed_by" UUID,
  "confirmed_at" TIMESTAMPTZ(6),
  "created_by" UUID NOT NULL,
  "updated_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "payment_batches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uq_payment_batches_batch_no" UNIQUE ("batch_no"),
  CONSTRAINT "payment_batches_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_batches_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "payment_allocations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "payment_batch_id" UUID NOT NULL,
  "tuition_fee_id" UUID NOT NULL,
  "amount" DECIMAL(15,2) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uq_payment_allocations_batch_fee" UNIQUE ("payment_batch_id", "tuition_fee_id"),
  CONSTRAINT "payment_allocations_payment_batch_id_fkey" FOREIGN KEY ("payment_batch_id") REFERENCES "payment_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_allocations_tuition_fee_id_fkey" FOREIGN KEY ("tuition_fee_id") REFERENCES "tuition_fees"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "payment_batch_receipts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "receipt_no" VARCHAR(40) NOT NULL,
  "payment_batch_id" UUID NOT NULL,
  "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "issued_by" UUID NOT NULL,
  "receiver_name" VARCHAR(255),
  "amount" DECIMAL(15,2) NOT NULL,
  CONSTRAINT "payment_batch_receipts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uq_payment_batch_receipts_receipt_no" UNIQUE ("receipt_no"),
  CONSTRAINT "uq_payment_batch_receipts_batch_id" UNIQUE ("payment_batch_id"),
  CONSTRAINT "payment_batch_receipts_payment_batch_id_fkey" FOREIGN KEY ("payment_batch_id") REFERENCES "payment_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "tuition_payments" ADD COLUMN "payment_batch_id" UUID;
ALTER TABLE "tuition_payments" ADD CONSTRAINT "tuition_payments_payment_batch_id_fkey" FOREIGN KEY ("payment_batch_id") REFERENCES "payment_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bank_statement_transactions" ADD COLUMN "payment_batch_id" UUID;
ALTER TABLE "bank_statement_transactions" ADD CONSTRAINT "bank_statement_transactions_payment_batch_id_fkey" FOREIGN KEY ("payment_batch_id") REFERENCES "payment_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "idx_payment_batches_student_id" ON "payment_batches"("student_id");
CREATE INDEX "idx_payment_batches_status" ON "payment_batches"("status");
CREATE INDEX "idx_payment_allocations_fee_id" ON "payment_allocations"("tuition_fee_id");
