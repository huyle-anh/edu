-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "teacher_status" AS ENUM ('ACTIVE', 'INACTIVE', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "student_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "room_status" AS ENUM ('AVAILABLE', 'MAINTENANCE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "class_status" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "enrollment_status" AS ENUM ('ACTIVE', 'LEFT', 'COMPLETED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "fee_status" AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "payment_request_status" AS ENUM ('ACTIVE', 'EXPIRED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "payment_qr_status" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('CASH', 'TRANSFER', 'WALLET');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "payment_notice_status" AS ENUM ('DRAFT', 'GENERATED', 'PRINTED', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "receipt_status" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "attendance_status" AS ENUM ('PRESENT', 'ABSENT', 'MAKEUP');

-- CreateEnum
CREATE TYPE "payroll_status" AS ENUM ('DRAFT', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "expense_status" AS ENUM ('DRAFT', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "resource" VARCHAR(100) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "is_allowed" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teachers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "user_id" UUID,
    "full_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "bank_account" VARCHAR(100),
    "specialty" VARCHAR(255),
    "status" "teacher_status" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "birthday" DATE,
    "parent_name" VARCHAR(255),
    "address" TEXT,
    "status" "student_status" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "floor" VARCHAR(50),
    "location" VARCHAR(255),
    "status" "room_status" NOT NULL DEFAULT 'AVAILABLE',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "teacher_id" UUID,
    "room_id" UUID,
    "tuition_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_sessions" INTEGER NOT NULL DEFAULT 0,
    "max_students" INTEGER NOT NULL DEFAULT 0,
    "start_date" DATE,
    "end_date" DATE,
    "status" "class_status" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_students" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "class_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "enrolled_at" DATE NOT NULL DEFAULT CURRENT_DATE,
    "left_at" DATE,
    "status" "enrollment_status" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "class_students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "class_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "day_of_week" SMALLINT NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "class_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "class_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "schedule_id" UUID,
    "attendance_date" DATE NOT NULL,
    "status" "attendance_status" NOT NULL DEFAULT 'PRESENT',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_fees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "billing_year" INTEGER NOT NULL,
    "billing_month" SMALLINT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "final_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "outstanding_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "due_date" DATE,
    "status" "fee_status" NOT NULL DEFAULT 'UNPAID',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "student_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "bank_code" VARCHAR(50) NOT NULL,
    "bank_name" VARCHAR(100) NOT NULL,
    "account_number" VARCHAR(100) NOT NULL,
    "account_name" VARCHAR(255) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "payment_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_fee_id" UUID NOT NULL,
    "payment_account_id" UUID NOT NULL,
    "payment_code" VARCHAR(100) NOT NULL,
    "requested_amount" DECIMAL(12,2) NOT NULL,
    "transfer_content" VARCHAR(255) NOT NULL,
    "expired_at" TIMESTAMPTZ(6),
    "status" "payment_request_status" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_qr_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_request_id" UUID NOT NULL,
    "qr_payload" TEXT NOT NULL,
    "status" "payment_qr_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payment_qr_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_notices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_request_id" UUID NOT NULL,
    "notice_number" VARCHAR(100) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "due_date" DATE,
    "pdf_url" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_latest" BOOLEAN NOT NULL DEFAULT true,
    "printed_at" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6),
    "send_method" VARCHAR(50),
    "status" "payment_notice_status" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payment_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bank_code" VARCHAR(50) NOT NULL,
    "transaction_id" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "transaction_date" TIMESTAMPTZ(6) NOT NULL,
    "description" TEXT,
    "reference_code" VARCHAR(100),
    "raw_data" JSONB,
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "matched_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_fee_id" UUID NOT NULL,
    "payment_request_id" UUID,
    "bank_transaction_id" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "payment_method" NOT NULL,
    "payment_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "confirmed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancel_reason" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_id" UUID NOT NULL,
    "receipt_number" VARCHAR(100) NOT NULL,
    "issue_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "printed_at" TIMESTAMPTZ(6),
    "status" "receipt_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancel_reason" TEXT,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100),
    "amount" DECIMAL(12,2) NOT NULL,
    "expense_date" DATE NOT NULL,
    "status" "expense_status" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_salary_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "class_id" UUID NOT NULL,
    "teacher_share_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "class_salary_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_payrolls" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "teacher_id" UUID NOT NULL,
    "billing_year" INTEGER NOT NULL,
    "billing_month" SMALLINT NOT NULL,
    "total_revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "center_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "salary_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "payroll_status" NOT NULL DEFAULT 'DRAFT',
    "approved_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "teacher_payrolls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_payroll_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payroll_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "class_code" VARCHAR(50) NOT NULL,
    "class_name" VARCHAR(255) NOT NULL,
    "student_count" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "teacher_share_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "salary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "center_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "teacher_payroll_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "table_name" VARCHAR(100) NOT NULL,
    "record_id" UUID,
    "old_data" JSONB,
    "new_data" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_users_email" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "uq_roles_code" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_permissions_code" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "idx_permissions_resource_action" ON "permissions"("resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_roles_user_role" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_role_permissions_role_permission" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_teachers_code" ON "teachers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_teachers_user_id" ON "teachers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_teachers_email" ON "teachers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "uq_students_code" ON "students"("code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_students_email" ON "students"("email");

-- CreateIndex
CREATE UNIQUE INDEX "uq_rooms_code" ON "rooms"("code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_classes_code" ON "classes"("code");

-- CreateIndex
CREATE INDEX "idx_classes_teacher_id" ON "classes"("teacher_id");

-- CreateIndex
CREATE INDEX "idx_classes_room_id" ON "classes"("room_id");

-- CreateIndex
CREATE INDEX "idx_classes_status" ON "classes"("status");

-- CreateIndex
CREATE INDEX "idx_class_students_class_id" ON "class_students"("class_id");

-- CreateIndex
CREATE INDEX "idx_class_students_student_id" ON "class_students"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_class_students_class_student" ON "class_students"("class_id", "student_id");

-- CreateIndex
CREATE INDEX "idx_class_schedules_class_id" ON "class_schedules"("class_id");

-- CreateIndex
CREATE INDEX "idx_class_schedules_room_day" ON "class_schedules"("room_id", "day_of_week");

-- CreateIndex
CREATE INDEX "idx_class_schedules_teacher_day" ON "class_schedules"("teacher_id", "day_of_week");

-- CreateIndex
CREATE INDEX "idx_attendances_class_date" ON "attendances"("class_id", "attendance_date");

-- CreateIndex
CREATE INDEX "idx_attendances_student_id" ON "attendances"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_attendances_class_student_date" ON "attendances"("class_id", "student_id", "attendance_date");

-- CreateIndex
CREATE INDEX "idx_student_fees_student_id" ON "student_fees"("student_id");

-- CreateIndex
CREATE INDEX "idx_student_fees_class_id" ON "student_fees"("class_id");

-- CreateIndex
CREATE INDEX "idx_student_fees_billing_month" ON "student_fees"("billing_year", "billing_month");

-- CreateIndex
CREATE INDEX "idx_student_fees_status" ON "student_fees"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_student_fees_student_class_month" ON "student_fees"("student_id", "class_id", "billing_year", "billing_month");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payment_accounts_code" ON "payment_accounts"("code");

-- CreateIndex
CREATE INDEX "idx_payment_accounts_active" ON "payment_accounts"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payment_accounts_bank_account" ON "payment_accounts"("bank_code", "account_number");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payment_requests_payment_code" ON "payment_requests"("payment_code");

-- CreateIndex
CREATE INDEX "idx_payment_requests_student_fee_id" ON "payment_requests"("student_fee_id");

-- CreateIndex
CREATE INDEX "idx_payment_requests_payment_account_id" ON "payment_requests"("payment_account_id");

-- CreateIndex
CREATE INDEX "idx_payment_requests_status" ON "payment_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payment_qr_codes_payment_request_id" ON "payment_qr_codes"("payment_request_id");

-- CreateIndex
CREATE INDEX "idx_payment_qr_codes_status" ON "payment_qr_codes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payment_notices_notice_number" ON "payment_notices"("notice_number");

-- CreateIndex
CREATE INDEX "idx_payment_notices_payment_request_id" ON "payment_notices"("payment_request_id");

-- CreateIndex
CREATE INDEX "idx_payment_notices_status" ON "payment_notices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payment_notices_request_version" ON "payment_notices"("payment_request_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "uq_bank_transactions_transaction_id" ON "bank_transactions"("transaction_id");

-- CreateIndex
CREATE INDEX "idx_bank_transactions_bank_code" ON "bank_transactions"("bank_code");

-- CreateIndex
CREATE INDEX "idx_bank_transactions_reference_code" ON "bank_transactions"("reference_code");

-- CreateIndex
CREATE INDEX "idx_bank_transactions_transaction_date" ON "bank_transactions"("transaction_date");

-- CreateIndex
CREATE INDEX "idx_bank_transactions_matched" ON "bank_transactions"("matched");

-- CreateIndex
CREATE INDEX "idx_payments_student_fee_id" ON "payments"("student_fee_id");

-- CreateIndex
CREATE INDEX "idx_payments_payment_request_id" ON "payments"("payment_request_id");

-- CreateIndex
CREATE INDEX "idx_payments_bank_transaction_id" ON "payments"("bank_transaction_id");

-- CreateIndex
CREATE INDEX "idx_payments_payment_date" ON "payments"("payment_date");

-- CreateIndex
CREATE INDEX "idx_payments_method" ON "payments"("method");

-- CreateIndex
CREATE INDEX "idx_payments_status" ON "payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_receipts_payment_id" ON "receipts"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_receipts_receipt_number" ON "receipts"("receipt_number");

-- CreateIndex
CREATE INDEX "idx_receipts_issue_date" ON "receipts"("issue_date");

-- CreateIndex
CREATE INDEX "idx_receipts_status" ON "receipts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_expenses_code" ON "expenses"("code");

-- CreateIndex
CREATE INDEX "idx_expenses_expense_date" ON "expenses"("expense_date");

-- CreateIndex
CREATE INDEX "idx_expenses_status" ON "expenses"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_class_salary_rules_class_id" ON "class_salary_rules"("class_id");

-- CreateIndex
CREATE INDEX "idx_teacher_payrolls_billing_month" ON "teacher_payrolls"("billing_year", "billing_month");

-- CreateIndex
CREATE INDEX "idx_teacher_payrolls_status" ON "teacher_payrolls"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_teacher_payrolls_teacher_month" ON "teacher_payrolls"("teacher_id", "billing_year", "billing_month");

-- CreateIndex
CREATE INDEX "idx_teacher_payroll_items_payroll_id" ON "teacher_payroll_items"("payroll_id");

-- CreateIndex
CREATE INDEX "idx_teacher_payroll_items_class_id" ON "teacher_payroll_items"("class_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_teacher_payroll_items_payroll_class" ON "teacher_payroll_items"("payroll_id", "class_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_action" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "idx_audit_logs_table_record" ON "audit_logs"("table_name", "record_id");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "fk_user_roles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "fk_user_roles_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "fk_role_permissions_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "fk_role_permissions_permission" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "fk_teachers_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "fk_classes_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "fk_classes_room" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_students" ADD CONSTRAINT "fk_class_students_class" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_students" ADD CONSTRAINT "fk_class_students_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_schedules" ADD CONSTRAINT "fk_class_schedules_class" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_schedules" ADD CONSTRAINT "fk_class_schedules_room" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_schedules" ADD CONSTRAINT "fk_class_schedules_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "fk_attendances_class" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "fk_attendances_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "fk_attendances_schedule" FOREIGN KEY ("schedule_id") REFERENCES "class_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fees" ADD CONSTRAINT "fk_student_fees_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fees" ADD CONSTRAINT "fk_student_fees_class" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "fk_payment_requests_student_fee" FOREIGN KEY ("student_fee_id") REFERENCES "student_fees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "fk_payment_requests_payment_account" FOREIGN KEY ("payment_account_id") REFERENCES "payment_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_qr_codes" ADD CONSTRAINT "fk_payment_qr_codes_payment_request" FOREIGN KEY ("payment_request_id") REFERENCES "payment_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_notices" ADD CONSTRAINT "fk_payment_notices_payment_request" FOREIGN KEY ("payment_request_id") REFERENCES "payment_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "fk_payments_student_fee" FOREIGN KEY ("student_fee_id") REFERENCES "student_fees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "fk_payments_payment_request" FOREIGN KEY ("payment_request_id") REFERENCES "payment_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "fk_payments_bank_transaction" FOREIGN KEY ("bank_transaction_id") REFERENCES "bank_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "fk_receipts_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_salary_rules" ADD CONSTRAINT "fk_class_salary_rules_class" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_payrolls" ADD CONSTRAINT "fk_teacher_payrolls_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_payroll_items" ADD CONSTRAINT "fk_teacher_payroll_items_payroll" FOREIGN KEY ("payroll_id") REFERENCES "teacher_payrolls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_payroll_items" ADD CONSTRAINT "fk_teacher_payroll_items_class" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
