ALTER TABLE "tuition_receipts" ADD COLUMN "printed_at" TIMESTAMPTZ(6);

ALTER TABLE "payment_batch_receipts" ADD COLUMN "printed_at" TIMESTAMPTZ(6);

UPDATE "tuition_receipts" AS receipt
SET "receiver_name" = student."full_name"
FROM "tuition_payments" AS payment
JOIN "tuition_fees" AS fee ON fee.id = payment."tuition_fee_id"
JOIN "students" AS student ON student.id = fee."student_id"
WHERE receipt."payment_id" = payment.id
  AND (receipt."receiver_name" IS NULL OR receipt."receiver_name" = fee."student_id"::text);

UPDATE "payment_batch_receipts" AS receipt
SET "receiver_name" = student."full_name"
FROM "payment_batches" AS batch
JOIN "students" AS student ON student.id = batch."student_id"
WHERE receipt."payment_batch_id" = batch.id
  AND (receipt."receiver_name" IS NULL OR receipt."receiver_name" = batch."student_id"::text);
