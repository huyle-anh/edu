-- Payroll has been removed from the application and its financial records are
-- intentionally deleted as part of this destructive schema change.
DROP TABLE IF EXISTS "teacher_payroll_items" CASCADE;
DROP TABLE IF EXISTS "teacher_payrolls" CASCADE;
DROP TABLE IF EXISTS "class_salary_rules" CASCADE;
DROP TYPE IF EXISTS "payroll_status";
