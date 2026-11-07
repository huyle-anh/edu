CREATE TYPE "bank_statement_row_status" AS ENUM (
  'AUTO_MATCHED',
  'UNMATCHED',
  'IGNORED',
  'DUPLICATED',
  'CONFIRMED'
);

CREATE TABLE "bank_statement_import_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "bank_account_id" UUID NOT NULL,
  "file_name" VARCHAR(255) NOT NULL,
  "bank_format" VARCHAR(30) NOT NULL,
  "statement_from_date" VARCHAR(50),
  "statement_to_date" VARCHAR(50),
  "account_no" VARCHAR(100),
  "account_name" VARCHAR(255),
  "currency_code" VARCHAR(10),
  "opening_balance" DECIMAL(15,2),
  "closing_balance" DECIMAL(15,2),
  "total_rows" INTEGER NOT NULL,
  "valid_rows" INTEGER NOT NULL,
  "invalid_rows" INTEGER NOT NULL,
  "duplicated_rows" INTEGER NOT NULL,
  "matched_rows" INTEGER NOT NULL,
  "unmatched_rows" INTEGER NOT NULL,
  "ignored_rows" INTEGER NOT NULL,
  "invalid_row_errors" JSONB,
  "performed_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bank_statement_import_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bank_statement_import_rows" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "session_id" UUID NOT NULL,
  "row_no" INTEGER NOT NULL,
  "transaction_hash" VARCHAR(255) NOT NULL,
  "transaction_date" TIMESTAMPTZ(6) NOT NULL,
  "bank_transaction_no" VARCHAR(150),
  "description" TEXT NOT NULL,
  "reconciliation_content" TEXT NOT NULL DEFAULT '',
  "credit_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "debit_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "balance_amount" DECIMAL(15,2),
  "status" "bank_statement_row_status" NOT NULL DEFAULT 'UNMATCHED',
  "payment_batch_candidate_count" INTEGER NOT NULL DEFAULT 0,
  "payment_batch_group_candidate_count" INTEGER NOT NULL DEFAULT 0,
  "raw_data" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bank_statement_import_rows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bank_statement_import_row_batches" (
  "row_id" UUID NOT NULL,
  "payment_batch_id" UUID NOT NULL,
  "is_confirmed" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "bank_statement_import_row_batches_pkey" PRIMARY KEY ("row_id", "payment_batch_id")
);

CREATE UNIQUE INDEX "uq_bank_statement_rows_session_row"
  ON "bank_statement_import_rows"("session_id", "row_no");
CREATE INDEX "idx_bank_statement_sessions_account_created"
  ON "bank_statement_import_sessions"("bank_account_id", "created_at");
CREATE INDEX "idx_bank_statement_rows_transaction_date"
  ON "bank_statement_import_rows"("transaction_date");
CREATE INDEX "idx_bank_statement_rows_transaction_hash"
  ON "bank_statement_import_rows"("transaction_hash");
CREATE INDEX "idx_bank_statement_row_batches_batch"
  ON "bank_statement_import_row_batches"("payment_batch_id");

ALTER TABLE "bank_statement_import_sessions"
  ADD CONSTRAINT "bank_statement_import_sessions_bank_account_id_fkey"
  FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bank_statement_import_rows"
  ADD CONSTRAINT "bank_statement_import_rows_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "bank_statement_import_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bank_statement_import_row_batches"
  ADD CONSTRAINT "bank_statement_import_row_batches_row_id_fkey"
  FOREIGN KEY ("row_id") REFERENCES "bank_statement_import_rows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bank_statement_import_row_batches"
  ADD CONSTRAINT "bank_statement_import_row_batches_payment_batch_id_fkey"
  FOREIGN KEY ("payment_batch_id") REFERENCES "payment_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
