-- Keep email only for login users and remove the standalone permission model.
DROP TABLE "role_permissions";
DROP TABLE "permissions";

DROP INDEX "uq_teachers_email";
DROP INDEX "uq_students_email";

ALTER TABLE "teachers" DROP COLUMN "email";
ALTER TABLE "students" DROP COLUMN "email";
