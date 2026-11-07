CREATE TYPE "tuition_fee_billing_type" AS ENUM ('LEGACY_ONE_TIME', 'MONTHLY');

ALTER TABLE "tuition_fees"
  ADD COLUMN "billing_year" INTEGER,
  ADD COLUMN "billing_month" SMALLINT,
  ADD COLUMN "billing_type" "tuition_fee_billing_type" NOT NULL DEFAULT 'LEGACY_ONE_TIME';

UPDATE "tuition_fees"
SET
  "billing_year" = EXTRACT(YEAR FROM "created_at")::INTEGER,
  "billing_month" = EXTRACT(MONTH FROM "created_at")::SMALLINT
WHERE "billing_year" IS NULL OR "billing_month" IS NULL;

ALTER TABLE "tuition_fees"
  ALTER COLUMN "billing_year" SET NOT NULL,
  ALTER COLUMN "billing_month" SET NOT NULL,
  ADD CONSTRAINT "chk_tuition_fees_billing_month"
    CHECK ("billing_month" BETWEEN 1 AND 12);

CREATE INDEX "idx_tuition_fees_billing_month"
  ON "tuition_fees"("billing_year", "billing_month");

CREATE INDEX "idx_tuition_fees_student_class_month"
  ON "tuition_fees"("student_id", "class_id", "billing_year", "billing_month");

CREATE UNIQUE INDEX "uq_tuition_fees_monthly_student_class_month"
ON "tuition_fees"("student_id", "class_id", "billing_year", "billing_month")
WHERE "billing_type" = 'MONTHLY';

CREATE TABLE "enrollment_pauses" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "enrollment_id" UUID NOT NULL,
  "start_month" DATE NOT NULL,
  "end_month" DATE NOT NULL,
  "reason" TEXT,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "pk_enrollment_pauses" PRIMARY KEY ("id"),
  CONSTRAINT "chk_enrollment_pauses_period" CHECK ("start_month" <= "end_month"),
  CONSTRAINT "fk_enrollment_pauses_enrollment"
    FOREIGN KEY ("enrollment_id") REFERENCES "class_students"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "idx_enrollment_pauses_period"
  ON "enrollment_pauses"("enrollment_id", "start_month", "end_month");
