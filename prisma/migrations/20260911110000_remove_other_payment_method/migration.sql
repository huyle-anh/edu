-- Remove OTHER from the active payment method contract without silently
-- rewriting historical rows. The migration stops if legacy rows still exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM tuition_payments
    WHERE payment_method::text = 'OTHER'
  ) OR EXISTS (
    SELECT 1
    FROM payment_batches
    WHERE payment_method::text = 'OTHER'
  ) THEN
    RAISE EXCEPTION
      'Cannot remove OTHER payment method: historical OTHER rows must be reviewed first';
  END IF;
END $$;

CREATE TYPE "tuition_payment_method_without_other" AS ENUM ('CASH', 'BANK_TRANSFER');

ALTER TABLE "tuition_payments"
  ALTER COLUMN "payment_method" TYPE "tuition_payment_method_without_other"
  USING "payment_method"::text::"tuition_payment_method_without_other";

ALTER TABLE "payment_batches"
  ALTER COLUMN "payment_method" TYPE "tuition_payment_method_without_other"
  USING "payment_method"::text::"tuition_payment_method_without_other";

DROP TYPE "tuition_payment_method";
ALTER TYPE "tuition_payment_method_without_other" RENAME TO "tuition_payment_method";
