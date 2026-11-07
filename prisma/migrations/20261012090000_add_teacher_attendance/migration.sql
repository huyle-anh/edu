CREATE TYPE "attendance_status" AS ENUM ('PRESENT', 'ABSENT');

ALTER TABLE "users" ADD COLUMN "teacher_id" UUID;
CREATE UNIQUE INDEX "uq_users_teacher_id" ON "users"("teacher_id");
ALTER TABLE "users" ADD CONSTRAINT "fk_users_teacher"
  FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "attendance_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "class_schedule_id" UUID NOT NULL,
  "session_date" DATE NOT NULL,
  "created_by" UUID NOT NULL,
  "updated_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_attendance_sessions_schedule_date" ON "attendance_sessions"("class_schedule_id", "session_date");
CREATE INDEX "idx_attendance_sessions_date" ON "attendance_sessions"("session_date");
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "fk_attendance_sessions_schedule"
  FOREIGN KEY ("class_schedule_id") REFERENCES "class_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "attendance_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "attendance_session_id" UUID NOT NULL,
  "enrollment_id" UUID NOT NULL,
  "status" "attendance_status" NOT NULL,
  "note" VARCHAR(500),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_attendance_records_session_enrollment" ON "attendance_records"("attendance_session_id", "enrollment_id");
CREATE INDEX "idx_attendance_records_enrollment" ON "attendance_records"("enrollment_id");
ALTER TABLE "attendance_records" ADD CONSTRAINT "fk_attendance_records_session"
  FOREIGN KEY ("attendance_session_id") REFERENCES "attendance_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_records" ADD CONSTRAINT "fk_attendance_records_enrollment"
  FOREIGN KEY ("enrollment_id") REFERENCES "class_students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "attendance_audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "attendance_session_id" UUID NOT NULL,
  "performed_by" UUID NOT NULL,
  "action" VARCHAR(50) NOT NULL,
  "data_before" JSONB,
  "data_after" JSONB,
  "performed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_attendance_audit_session_time" ON "attendance_audit_logs"("attendance_session_id", "performed_at");
ALTER TABLE "attendance_audit_logs" ADD CONSTRAINT "fk_attendance_audit_session"
  FOREIGN KEY ("attendance_session_id") REFERENCES "attendance_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_audit_logs" ADD CONSTRAINT "fk_attendance_audit_actor"
  FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
