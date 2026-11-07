-- Remove the room management module and all room assignments.
ALTER TABLE "class_schedules" DROP CONSTRAINT "fk_class_schedules_room";
ALTER TABLE "classes" DROP CONSTRAINT "fk_classes_room";

DROP INDEX "idx_class_schedules_room_day";
DROP INDEX "idx_classes_room_id";

ALTER TABLE "class_schedules" DROP COLUMN "room_id";
ALTER TABLE "classes" DROP COLUMN "room_id";

DROP TABLE "rooms";
DROP TYPE "room_status";
