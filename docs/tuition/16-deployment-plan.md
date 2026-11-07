# Deployment and rollback plan

Deploy theo phase: docs -> schema additive -> migration dry run -> backend -> frontend -> import/reconciliation -> tests -> cutover -> legacy removal.

Trước cutover: backup, lock migration window, verify totals, verify permissions và rollback script. Rollback application về version trước chỉ khi schema additive tương thích; không rollback destructive migration khi chưa có backup restore đã kiểm chứng.
