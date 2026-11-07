DROP INDEX "uq_attendance_sessions_schedule_date";
DROP INDEX "idx_attendance_sessions_date";
ALTER TABLE "attendance_sessions"
  DROP CONSTRAINT "fk_attendance_sessions_schedule";

ALTER TABLE "attendance_sessions"
  ADD COLUMN "class_subject_id" UUID,
  ADD COLUMN "session_at" TIMESTAMPTZ(6);

UPDATE "attendance_sessions" AS session
SET
  "class_subject_id" = schedule."class_subject_id",
  "session_at" = session."created_at"
FROM "class_schedules" AS schedule
WHERE schedule."id" = session."class_schedule_id";

ALTER TABLE "attendance_sessions"
  ALTER COLUMN "class_subject_id" SET NOT NULL,
  ALTER COLUMN "session_at" SET NOT NULL,
  DROP COLUMN "class_schedule_id",
  DROP COLUMN "session_date",
  ADD CONSTRAINT "fk_attendance_sessions_class_subject"
    FOREIGN KEY ("class_subject_id") REFERENCES "class_subjects"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "idx_attendance_sessions_subject_time"
  ON "attendance_sessions"("class_subject_id", "session_at");
