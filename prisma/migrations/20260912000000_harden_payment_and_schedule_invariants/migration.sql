-- Enforce invariants that must not depend on the UI or API path.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM class_schedules
    WHERE class_subject_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot require class_subject_id: legacy schedules without a subject must be reviewed first';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM payment_batches
    WHERE (payment_method = 'BANK_TRANSFER' AND bank_account_id IS NULL)
       OR (payment_method = 'CASH' AND bank_account_id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce payment batch bank account invariant: legacy rows need review';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tuition_payments
    WHERE (payment_method = 'BANK_TRANSFER' AND bank_account_id IS NULL)
       OR (payment_method = 'CASH' AND bank_account_id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce tuition payment bank account invariant: legacy rows need review';
  END IF;
END $$;

ALTER TABLE "class_schedules"
  DROP CONSTRAINT IF EXISTS "fk_class_schedules_class_subject";

ALTER TABLE "class_schedules"
  ALTER COLUMN "class_subject_id" SET NOT NULL;

ALTER TABLE "class_schedules"
  ADD CONSTRAINT "fk_class_schedules_class_subject"
  FOREIGN KEY ("class_subject_id") REFERENCES "class_subjects"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_batches"
  ADD CONSTRAINT "chk_payment_batches_bank_account_by_method"
  CHECK (
    ("payment_method" = 'BANK_TRANSFER' AND "bank_account_id" IS NOT NULL)
    OR ("payment_method" = 'CASH' AND "bank_account_id" IS NULL)
  );

ALTER TABLE "tuition_payments"
  ADD CONSTRAINT "chk_tuition_payments_bank_account_by_method"
  CHECK (
    ("payment_method" = 'BANK_TRANSFER' AND "bank_account_id" IS NOT NULL)
    OR ("payment_method" = 'CASH' AND "bank_account_id" IS NULL)
  );
