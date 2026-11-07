# Test plan

Unit: money formula, status, exact amount, duplicate success, adjustments, refunds, hash/match score.

Integration: create fee, one-time cash/bank/VietQR, mismatch, duplicate/concurrency, receipt, notice, refund, import, auto/manual reconciliation, rollback, permissions.

E2E: fee-to-receipt, VietQR, Excel BIDV/Techcombank reconciliation, mismatch, refund, reissue notice, print receipt. Bắt buộc chạy typecheck/lint/build và Prisma validate/generate sau schema changes.
