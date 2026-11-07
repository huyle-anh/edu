-- A tuition fee is settled by exactly one successful payment.
-- Failed/cancelled attempts remain allowed for history.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM tuition_payments
    WHERE payment_status = 'SUCCESS'
    GROUP BY tuition_fee_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce single successful payment: duplicate SUCCESS payments exist';
  END IF;
END $$;

-- The subject-domain migration already created the equivalent
-- uq_success_tuition_payment_per_fee index. Do not create a duplicate index.

ALTER TABLE "tuition_payments"
  ADD CONSTRAINT "chk_tuition_payments_amount_positive"
  CHECK ("amount" > 0);
