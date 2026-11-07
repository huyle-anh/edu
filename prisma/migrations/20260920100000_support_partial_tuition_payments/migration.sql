ALTER TYPE "tuition_fee_status" ADD VALUE IF NOT EXISTS 'PARTIAL';

DROP INDEX IF EXISTS "uq_success_tuition_payment_per_fee";
