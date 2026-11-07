# Navigation flow

```mermaid
flowchart TD
  A[Danh sách học phí] --> B[Chi tiết học phí]
  B --> C[Thu tiền / Thu phần còn lại]
  C --> D[Chọn số tiền mặc định là số dư]
  D --> E[Xác nhận]
  E --> F[PARTIAL hoặc PAID và phát hành biên lai]
  J[Import sao kê] --> K[Phân tích trong bộ nhớ]
  K --> L[Đối soát một giao dịch - một học phí]
  L --> F
  F --> I[Receipt PDF]
```

Routes chính: `/admin/classes`, `/admin/tuition-fees`, `/admin/receipts`, `/admin/bank-reconciliation`. Thao tác thường ngày bắt đầu bằng `Thu tiền` hoặc `Thu phần còn lại`, hệ thống tự chọn một khoản và điền toàn bộ số dư; `Thu nhiều khoản` là chế độ nâng cao. Lịch sử thu xem tại Biên lai, Báo cáo và payment/payment batch đã xác nhận. Quản lý lịch học nằm trong `/admin/classes/:id` → tab `Lịch học`; không còn màn hình CRUD lịch học độc lập cho ADMIN/STAFF.
