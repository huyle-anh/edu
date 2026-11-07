UPDATE "teachers"
SET "status" = 'INACTIVE'::teacher_status
WHERE "status" = 'ON_LEAVE'::teacher_status;

ALTER TABLE "teachers" DROP CONSTRAINT IF EXISTS "fk_teachers_user";
DROP INDEX IF EXISTS "uq_teachers_user_id";
ALTER TABLE "teachers" DROP COLUMN IF EXISTS "user_id";

ALTER TYPE "teacher_status" RENAME TO "teacher_status_old";
CREATE TYPE "teacher_status" AS ENUM ('ACTIVE', 'INACTIVE');
ALTER TABLE "teachers"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "teacher_status"
    USING ("status"::text::"teacher_status"),
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"teacher_status";
DROP TYPE "teacher_status_old";
