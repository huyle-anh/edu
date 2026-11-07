ALTER TABLE "classes"
  DROP CONSTRAINT IF EXISTS "fk_classes_teacher";

DROP INDEX IF EXISTS "idx_classes_teacher_id";

ALTER TABLE "classes"
  DROP COLUMN IF EXISTS "teacher_id",
  DROP COLUMN IF EXISTS "tuition_fee",
  DROP COLUMN IF EXISTS "total_sessions";
