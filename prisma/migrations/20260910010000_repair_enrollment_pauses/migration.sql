CREATE TABLE IF NOT EXISTS "enrollment_pauses" (
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

CREATE INDEX IF NOT EXISTS "idx_enrollment_pauses_period"
  ON "enrollment_pauses"("enrollment_id", "start_month", "end_month");
