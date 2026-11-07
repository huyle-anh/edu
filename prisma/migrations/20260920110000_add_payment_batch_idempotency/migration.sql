ALTER TABLE "payment_batches"
  ADD COLUMN "idempotency_key" VARCHAR(150);

CREATE UNIQUE INDEX "uq_payment_batches_idempotency_key"
  ON "payment_batches"("idempotency_key");
