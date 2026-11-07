# Migration plan

1. Backup và snapshot totals.
2. Mapping old -> new, phát hiện partial/multiple-success.
3. Xuất `migration-multiple-payments-report.csv`.
4. Migrate tự động fee chưa thanh toán hoặc có đúng một payment SUCCESS khớp exact amount.
5. Đưa dữ liệu không tương thích vào exception report/read-only archive, không gộp ngầm.
6. So sánh tổng theo học viên/lớp/tháng và verify rollback.
7. Chuyển app sang schema mới; chỉ xóa legacy tables sau nghiệm thu riêng.
