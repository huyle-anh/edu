DROP TABLE IF EXISTS "tuition_notice_deliveries";
DROP TABLE IF EXISTS "tuition_notice_items";
DROP TABLE IF EXISTS "tuition_notices";

DROP TYPE IF EXISTS "tuition_notice_delivery_status";
DROP TYPE IF EXISTS "tuition_notice_delivery_method";
DROP TYPE IF EXISTS "tuition_notice_status";

ALTER TABLE "bank_statement_match_candidates"
  DROP COLUMN IF EXISTS "tuition_notice_id";

ALTER TYPE "bank_match_method" RENAME TO "bank_match_method_old";
CREATE TYPE "bank_match_method" AS ENUM ('TUITION_FEE_NO', 'STUDENT_CODE', 'PAYMENT_REFERENCE', 'PHONE_NUMBER', 'STUDENT_NAME', 'PARENT_NAME', 'AMOUNT', 'MANUAL');
ALTER TABLE "bank_statement_match_candidates"
  ALTER COLUMN "match_method" TYPE "bank_match_method"
  USING CASE
    WHEN "match_method"::text = 'NOTICE_NO' THEN 'TUITION_FEE_NO'::"bank_match_method"
    ELSE "match_method"::text::"bank_match_method"
  END;
ALTER TABLE "bank_statement_transactions"
  ALTER COLUMN "match_method" TYPE "bank_match_method"
  USING CASE
    WHEN "match_method"::text = 'NOTICE_NO' THEN 'TUITION_FEE_NO'::"bank_match_method"
    ELSE "match_method"::text::"bank_match_method"
  END;
DROP TYPE "bank_match_method_old";
