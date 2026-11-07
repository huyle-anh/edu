-- Additive one-time tuition domain. Legacy tables remain during cutover.
-- CreateEnum
CREATE TYPE "tuition_fee_status" AS ENUM ('UNPAID', 'PAID', 'OVERDUE', 'EXEMPTED', 'CANCELLED');
-- CreateEnum
CREATE TYPE "tuition_fee_item_type" AS ENUM ('TUITION', 'MATERIAL', 'UNIFORM', 'EXAM_FEE', 'OTHER_FEE', 'DISCOUNT', 'SCHOLARSHIP');
-- CreateEnum
CREATE TYPE "tuition_adjustment_type" AS ENUM ('DISCOUNT', 'SCHOLARSHIP', 'ADD_FEE', 'REDUCE_FEE', 'EXEMPTION', 'CANCELLATION', 'TRANSFER_CLASS');
-- CreateEnum
CREATE TYPE "tuition_payment_method" AS ENUM ('CASH', 'BANK_TRANSFER', 'OTHER');
-- CreateEnum
CREATE TYPE "tuition_payment_status" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED');
-- CreateEnum
CREATE TYPE "tuition_refund_status" AS ENUM ('PENDING', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED');
-- CreateEnum
CREATE TYPE "tuition_notice_status" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED', 'REPLACED');
-- CreateEnum
CREATE TYPE "tuition_notice_delivery_method" AS ENUM ('EMAIL', 'SMS', 'ZALO', 'PRINT');
-- CreateEnum
CREATE TYPE "tuition_notice_delivery_status" AS ENUM ('PENDING', 'SENT', 'FAILED');
-- CreateEnum
CREATE TYPE "bank_import_status" AS ENUM ('UPLOADED', 'VALIDATING', 'VALIDATED', 'PROCESSING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED');
-- CreateEnum
CREATE TYPE "bank_reconciliation_status" AS ENUM ('IMPORTED', 'AUTO_MATCHED', 'MANUAL_MATCHED', 'CONFIRMED', 'UNMATCHED', 'AMBIGUOUS', 'DUPLICATED', 'AMOUNT_MISMATCH', 'IGNORED', 'REVERSED', 'ERROR');
-- CreateEnum
CREATE TYPE "bank_match_method" AS ENUM ('NOTICE_NO', 'TUITION_FEE_NO', 'STUDENT_CODE', 'PAYMENT_REFERENCE', 'PHONE_NUMBER', 'STUDENT_NAME', 'PARENT_NAME', 'AMOUNT', 'MANUAL');
-- CreateTable
CREATE TABLE "tuition_fees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fee_no" VARCHAR(30) NOT NULL,
    "student_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "original_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "additional_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "final_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "due_date" DATE,
    "status" "tuition_fee_status" NOT NULL DEFAULT 'UNPAID',
    "exemption_reason" TEXT,
    "cancellation_reason" TEXT,
    "note" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tuition_fees_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "tuition_fee_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tuition_fee_id" UUID NOT NULL,
    "item_type" "tuition_fee_item_type" NOT NULL,
    "item_name" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tuition_fee_items_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "tuition_adjustments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tuition_fee_id" UUID NOT NULL,
    "adjustment_type" "tuition_adjustment_type" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "before_amount" DECIMAL(15,2) NOT NULL,
    "after_amount" DECIMAL(15,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "approved_by" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tuition_adjustments_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "tuition_payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_no" VARCHAR(30) NOT NULL,
    "tuition_fee_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "payment_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(15,2) NOT NULL,
    "payment_method" "tuition_payment_method" NOT NULL,
    "payment_status" "tuition_payment_status" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" VARCHAR(150),
    "bank_account_id" UUID,
    "bank_transaction_no" VARCHAR(150),
    "transaction_reference" VARCHAR(150),
    "payer_name" VARCHAR(255),
    "payment_content" VARCHAR(500),
    "proof_file_url" TEXT,
    "received_by" UUID,
    "confirmed_by" UUID,
    "confirmed_at" TIMESTAMPTZ(6),
    "failure_reason" TEXT,
    "cancellation_reason" TEXT,
    "note" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tuition_payments_pkey" PRIMARY KEY ("id")
);
-- CreateTable
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
-- CreateTable
CREATE TABLE "tuition_notices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "notice_no" VARCHAR(30) NOT NULL,
    "tuition_fee_id" UUID NOT NULL,
    "issued_at" TIMESTAMPTZ(6),
    "issued_by" UUID,
    "student_code" VARCHAR(50) NOT NULL,
    "student_name" VARCHAR(255) NOT NULL,
    "class_name" VARCHAR(255),
    "course_name" VARCHAR(255),
    "original_amount" DECIMAL(15,2) NOT NULL,
    "discount_amount" DECIMAL(15,2) NOT NULL,
    "additional_amount" DECIMAL(15,2) NOT NULL,
    "final_amount" DECIMAL(15,2) NOT NULL,
    "due_date" DATE,
    "bank_name" VARCHAR(255),
    "bank_account_no" VARCHAR(100),
    "bank_account_name" VARCHAR(255),
    "transfer_content" VARCHAR(500),
    "qr_code_url" TEXT,
    "pdf_file_url" TEXT,
    "status" "tuition_notice_status" NOT NULL DEFAULT 'DRAFT',
    "replacement_notice_id" UUID,
    "cancellation_reason" TEXT,
    "cancelled_by" UUID,
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tuition_notices_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "tuition_notice_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tuition_notice_id" UUID NOT NULL,
    "item_type" "tuition_fee_item_type" NOT NULL,
    "item_name" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(15,2) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tuition_notice_items_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "tuition_notice_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tuition_notice_id" UUID NOT NULL,
    "delivery_method" "tuition_notice_delivery_method" NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" "tuition_notice_delivery_status" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMPTZ(6),
    "failed_at" TIMESTAMPTZ(6),
    "failure_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tuition_notice_deliveries_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "tuition_receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "receipt_no" VARCHAR(30) NOT NULL,
    "payment_id" UUID NOT NULL,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issued_by" UUID NOT NULL,
    "receiver_name" VARCHAR(255),
    "amount" DECIMAL(15,2) NOT NULL,
    "amount_in_words" TEXT,
    "pdf_file_url" TEXT,
    "email_sent_at" TIMESTAMPTZ(6),
    "status" "receipt_status" NOT NULL DEFAULT 'ACTIVE',
    "cancellation_reason" TEXT,
    "cancelled_by" UUID,
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tuition_receipts_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bank_code" VARCHAR(50) NOT NULL,
    "bank_name" VARCHAR(255) NOT NULL,
    "account_no" VARCHAR(100) NOT NULL,
    "account_name" VARCHAR(255) NOT NULL,
    "branch_name" VARCHAR(255),
    "currency_code" VARCHAR(10) NOT NULL DEFAULT 'VND',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "bank_csv_mappings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bank_code" VARCHAR(50) NOT NULL,
    "mapping_name" VARCHAR(255) NOT NULL,
    "delimiter" VARCHAR(5) NOT NULL,
    "encoding" VARCHAR(50) NOT NULL,
    "header_row" INTEGER NOT NULL DEFAULT 1,
    "data_start_row" INTEGER NOT NULL DEFAULT 2,
    "date_format" VARCHAR(50) NOT NULL,
    "transaction_date_column" VARCHAR(100) NOT NULL,
    "value_date_column" VARCHAR(100),
    "transaction_no_column" VARCHAR(100),
    "description_column" VARCHAR(100) NOT NULL,
    "sender_name_column" VARCHAR(100),
    "sender_account_column" VARCHAR(100),
    "credit_amount_column" VARCHAR(100) NOT NULL,
    "debit_amount_column" VARCHAR(100),
    "balance_column" VARCHAR(100),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bank_csv_mappings_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "bank_statement_imports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bank_account_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_hash" VARCHAR(128) NOT NULL,
    "encoding" VARCHAR(50) NOT NULL,
    "delimiter" VARCHAR(5) NOT NULL,
    "date_format" VARCHAR(50) NOT NULL,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "valid_rows" INTEGER NOT NULL DEFAULT 0,
    "invalid_rows" INTEGER NOT NULL DEFAULT 0,
    "duplicated_rows" INTEGER NOT NULL DEFAULT 0,
    "matched_rows" INTEGER NOT NULL DEFAULT 0,
    "unmatched_rows" INTEGER NOT NULL DEFAULT 0,
    "import_status" "bank_import_status" NOT NULL DEFAULT 'UPLOADED',
    "error_message" TEXT,
    "imported_by" UUID NOT NULL,
    "imported_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_by" UUID,
    "confirmed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statement_imports_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "bank_statement_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "statement_import_id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "row_no" INTEGER NOT NULL,
    "bank_transaction_no" VARCHAR(255),
    "transaction_date" TIMESTAMPTZ(6) NOT NULL,
    "value_date" TIMESTAMPTZ(6),
    "description" TEXT,
    "sender_name" VARCHAR(255),
    "sender_account_no" VARCHAR(100),
    "sender_bank_code" VARCHAR(50),
    "credit_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "debit_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "balance_amount" DECIMAL(15,2),
    "currency_code" VARCHAR(10) NOT NULL DEFAULT 'VND',
    "transaction_hash" VARCHAR(128) NOT NULL,
    "reconciliation_status" "bank_reconciliation_status" NOT NULL DEFAULT 'IMPORTED',
    "match_score" DECIMAL(5,2),
    "match_method" "bank_match_method",
    "matched_student_id" UUID,
    "matched_tuition_fee_id" UUID,
    "matched_notice_id" UUID,
    "payment_id" UUID,
    "error_code" VARCHAR(100),
    "error_message" TEXT,
    "confirmed_by" UUID,
    "confirmed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bank_statement_transactions_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "bank_statement_match_candidates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "statement_transaction_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "tuition_fee_id" UUID NOT NULL,
    "tuition_notice_id" UUID,
    "match_method" "bank_match_method" NOT NULL,
    "match_score" DECIMAL(5,2) NOT NULL,
    "matched_reference" VARCHAR(255),
    "amount_difference" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "is_selected" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statement_match_candidates_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "tuition_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "data_before" JSONB,
    "data_after" JSONB,
    "reason" TEXT,
    "performed_by" UUID NOT NULL,
    "performed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" INET,
    "user_agent" TEXT,

    CONSTRAINT "tuition_audit_logs_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "uq_tuition_fees_fee_no" ON "tuition_fees"("fee_no");
-- CreateIndex
CREATE INDEX "idx_tuition_fees_student_id" ON "tuition_fees"("student_id");
-- CreateIndex
CREATE INDEX "idx_tuition_fees_class_id" ON "tuition_fees"("class_id");
-- CreateIndex
CREATE INDEX "idx_tuition_fees_status" ON "tuition_fees"("status");
-- CreateIndex
CREATE INDEX "idx_tuition_fees_due_date" ON "tuition_fees"("due_date");
-- CreateIndex
CREATE INDEX "idx_tuition_fee_items_fee_id" ON "tuition_fee_items"("tuition_fee_id");
-- CreateIndex
CREATE INDEX "idx_tuition_adjustments_fee_id" ON "tuition_adjustments"("tuition_fee_id");
-- CreateIndex
CREATE UNIQUE INDEX "uq_tuition_payments_payment_no" ON "tuition_payments"("payment_no");
CREATE UNIQUE INDEX "uq_tuition_payments_idempotency_key" ON "tuition_payments"("idempotency_key");
-- CreateIndex
CREATE INDEX "idx_tuition_payments_fee_id" ON "tuition_payments"("tuition_fee_id");
-- CreateIndex
CREATE INDEX "idx_tuition_payments_student_id" ON "tuition_payments"("student_id");
-- CreateIndex
CREATE INDEX "idx_tuition_payments_status" ON "tuition_payments"("payment_status");
CREATE UNIQUE INDEX "uq_success_tuition_payment_per_fee"
ON "tuition_payments"("tuition_fee_id")
WHERE "payment_status" = 'SUCCESS';
-- CreateIndex
CREATE UNIQUE INDEX "uq_tuition_notices_notice_no" ON "tuition_notices"("notice_no");
-- CreateIndex
CREATE INDEX "idx_tuition_notices_fee_id" ON "tuition_notices"("tuition_fee_id");
-- CreateIndex
CREATE INDEX "idx_tuition_notices_status" ON "tuition_notices"("status");
-- CreateIndex
CREATE INDEX "idx_tuition_notice_deliveries_notice_id" ON "tuition_notice_deliveries"("tuition_notice_id");
-- CreateIndex
CREATE UNIQUE INDEX "uq_tuition_receipts_receipt_no" ON "tuition_receipts"("receipt_no");
-- CreateIndex
CREATE UNIQUE INDEX "uq_tuition_receipts_payment_id" ON "tuition_receipts"("payment_id");
-- CreateIndex
CREATE UNIQUE INDEX "uq_bank_accounts_bank_account" ON "bank_accounts"("bank_code", "account_no");
-- CreateIndex
CREATE INDEX "idx_bank_csv_mappings_bank_code" ON "bank_csv_mappings"("bank_code");
-- CreateIndex
CREATE UNIQUE INDEX "uq_bank_statement_imports_file" ON "bank_statement_imports"("bank_account_id", "file_hash");
-- CreateIndex
CREATE INDEX "idx_bank_statement_transactions_date" ON "bank_statement_transactions"("transaction_date");
-- CreateIndex
CREATE INDEX "idx_bank_statement_transactions_status" ON "bank_statement_transactions"("reconciliation_status");
-- CreateIndex
CREATE UNIQUE INDEX "uq_bank_statement_transactions_hash" ON "bank_statement_transactions"("bank_account_id", "transaction_hash");
-- CreateIndex
CREATE INDEX "idx_bank_match_candidates_transaction_id" ON "bank_statement_match_candidates"("statement_transaction_id");
-- CreateIndex
CREATE INDEX "idx_tuition_audit_entity" ON "tuition_audit_logs"("entity_type", "entity_id");
-- CreateIndex
CREATE INDEX "idx_tuition_audit_action" ON "tuition_audit_logs"("action");
-- AddForeignKey
ALTER TABLE "tuition_fees" ADD CONSTRAINT "tuition_fees_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "tuition_fees" ADD CONSTRAINT "tuition_fees_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "class_students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "tuition_fees" ADD CONSTRAINT "tuition_fees_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "tuition_fee_items" ADD CONSTRAINT "tuition_fee_items_tuition_fee_id_fkey" FOREIGN KEY ("tuition_fee_id") REFERENCES "tuition_fees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "tuition_adjustments" ADD CONSTRAINT "tuition_adjustments_tuition_fee_id_fkey" FOREIGN KEY ("tuition_fee_id") REFERENCES "tuition_fees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "tuition_payments" ADD CONSTRAINT "tuition_payments_tuition_fee_id_fkey" FOREIGN KEY ("tuition_fee_id") REFERENCES "tuition_fees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "tuition_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "tuition_notices" ADD CONSTRAINT "tuition_notices_tuition_fee_id_fkey" FOREIGN KEY ("tuition_fee_id") REFERENCES "tuition_fees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "tuition_notice_items" ADD CONSTRAINT "tuition_notice_items_tuition_notice_id_fkey" FOREIGN KEY ("tuition_notice_id") REFERENCES "tuition_notices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "tuition_notice_deliveries" ADD CONSTRAINT "tuition_notice_deliveries_tuition_notice_id_fkey" FOREIGN KEY ("tuition_notice_id") REFERENCES "tuition_notices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "tuition_receipts" ADD CONSTRAINT "tuition_receipts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "tuition_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "bank_statement_transactions" ADD CONSTRAINT "bank_statement_transactions_statement_import_id_fkey" FOREIGN KEY ("statement_import_id") REFERENCES "bank_statement_imports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "bank_statement_match_candidates" ADD CONSTRAINT "bank_statement_match_candidates_statement_transaction_id_fkey" FOREIGN KEY ("statement_transaction_id") REFERENCES "bank_statement_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
