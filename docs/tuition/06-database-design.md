# Database design

Các aggregate mới:

`tuition_fees`, `tuition_fee_items`, `tuition_adjustments`, `payments`, `payment_refunds`, `receipts`, `tuition_notices`, `tuition_notice_items`, `tuition_notice_deliveries`, `bank_accounts`, `audit_logs`.

Sao kê CSV và ứng viên đối soát là dữ liệu tạm trong bộ nhớ, không có bảng lưu trữ riêng. Thông tin ngân hàng của giao dịch chỉ được lưu trên payment/payment batch sau khi xác nhận thành công.

`tuition_payments` không được dùng partial unique index theo `tuition_fee_id` vì
một khoản học phí có thể có nhiều payment `SUCCESS`. Tổng tiền và trạng thái
được bảo vệ trong transaction bằng cách khóa tuition fee và tính lại tổng
payment `SUCCESS`.

```sql
-- Không tạo uq_success_payment_per_tuition_fee.
```

Tiền dùng NUMERIC/Prisma Decimal. Các snapshot notice/receipt không phụ thuộc dữ liệu master thay đổi sau khi phát hành.
