CREATE TYPE "enrollment_pause_status" AS ENUM ('ACTIVE', 'CANCELLED');

ALTER TABLE "enrollment_pauses"
ADD COLUMN "status" "enrollment_pause_status" NOT NULL DEFAULT 'ACTIVE';
