-- Sao kê chỉ là dữ liệu tạm trong phiên import.
-- Chỉ payment/receipt đã xác nhận được lưu trong domain tài chính.
DROP TABLE IF EXISTS "bank_statement_match_candidates";
DROP TABLE IF EXISTS "bank_statement_transactions";
DROP TABLE IF EXISTS "bank_statement_imports";

DROP TYPE IF EXISTS "bank_match_method";
DROP TYPE IF EXISTS "bank_reconciliation_status";
DROP TYPE IF EXISTS "bank_import_status";
