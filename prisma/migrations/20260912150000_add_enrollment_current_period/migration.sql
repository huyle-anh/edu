ALTER TABLE "class_students"
ADD COLUMN "current_period_start" DATE;

UPDATE "class_students"
SET "current_period_start" = "enrolled_at";

ALTER TABLE "class_students"
ALTER COLUMN "current_period_start" SET NOT NULL,
ALTER COLUMN "current_period_start" SET DEFAULT CURRENT_DATE;
