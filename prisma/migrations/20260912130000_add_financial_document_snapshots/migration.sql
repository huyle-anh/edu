ALTER TABLE "payment_batches"
  ADD COLUMN "notice_snapshot" JSONB;

ALTER TABLE "payment_batch_receipts"
  ADD COLUMN "snapshot" JSONB;

ALTER TABLE "tuition_receipts"
  ADD COLUMN "snapshot" JSONB;
