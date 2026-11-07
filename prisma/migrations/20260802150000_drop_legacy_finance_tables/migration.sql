-- Destructive cutover explicitly approved: remove the legacy fee/payment flow.
DROP TABLE IF EXISTS
  "receipts",
  "payments",
  "bank_transactions",
  "payment_notices",
  "payment_qr_codes",
  "payment_requests",
  "payment_accounts",
  "student_fees"
CASCADE;

DROP TYPE IF EXISTS
  "fee_status",
  "payment_request_status",
  "payment_qr_status",
  "payment_method",
  "payment_status",
  "payment_notice_status";
