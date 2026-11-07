CREATE TYPE "subject_status" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "class_subject_status" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "enrollment_subject_status" AS ENUM ('ACTIVE', 'DROPPED', 'COMPLETED');

CREATE TABLE "subjects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "status" "subject_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "class_subjects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "class_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "teacher_id" UUID,
    "tuition_fee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_sessions" INTEGER NOT NULL DEFAULT 0,
    "max_students" INTEGER,
    "status" "class_subject_status" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "class_subjects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "enrollment_subjects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "enrollment_id" UUID NOT NULL,
    "class_subject_id" UUID NOT NULL,
    "tuition_fee_override" DECIMAL(15,2),
    "status" "enrollment_subject_status" NOT NULL DEFAULT 'ACTIVE',
    "enrolled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dropped_at" TIMESTAMPTZ(6),
    "note" TEXT,
    CONSTRAINT "enrollment_subjects_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "class_schedules" ADD COLUMN "class_subject_id" UUID;
ALTER TABLE "tuition_fee_items" ADD COLUMN "class_subject_id" UUID;

CREATE UNIQUE INDEX "uq_subjects_code" ON "subjects"("code");
CREATE UNIQUE INDEX "uq_class_subjects_class_subject" ON "class_subjects"("class_id", "subject_id");
CREATE UNIQUE INDEX "uq_enrollment_subjects_enrollment_subject" ON "enrollment_subjects"("enrollment_id", "class_subject_id");
CREATE INDEX "idx_subjects_status" ON "subjects"("status");
CREATE INDEX "idx_class_subjects_class_id" ON "class_subjects"("class_id");
CREATE INDEX "idx_class_subjects_subject_id" ON "class_subjects"("subject_id");
CREATE INDEX "idx_class_subjects_teacher_id" ON "class_subjects"("teacher_id");
CREATE INDEX "idx_enrollment_subjects_enrollment_id" ON "enrollment_subjects"("enrollment_id");
CREATE INDEX "idx_enrollment_subjects_class_subject_id" ON "enrollment_subjects"("class_subject_id");
CREATE INDEX "idx_class_schedules_class_subject_id" ON "class_schedules"("class_subject_id");
CREATE INDEX "idx_tuition_fee_items_class_subject_id" ON "tuition_fee_items"("class_subject_id");

ALTER TABLE "class_subjects" ADD CONSTRAINT "fk_class_subjects_class" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "class_subjects" ADD CONSTRAINT "fk_class_subjects_subject" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "class_subjects" ADD CONSTRAINT "fk_class_subjects_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "enrollment_subjects" ADD CONSTRAINT "fk_enrollment_subjects_enrollment" FOREIGN KEY ("enrollment_id") REFERENCES "class_students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "enrollment_subjects" ADD CONSTRAINT "fk_enrollment_subjects_class_subject" FOREIGN KEY ("class_subject_id") REFERENCES "class_subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "class_schedules" ADD CONSTRAINT "fk_class_schedules_class_subject" FOREIGN KEY ("class_subject_id") REFERENCES "class_subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tuition_fee_items" ADD CONSTRAINT "fk_tuition_fee_items_class_subject" FOREIGN KEY ("class_subject_id") REFERENCES "class_subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
