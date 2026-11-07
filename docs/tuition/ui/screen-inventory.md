# Screen inventory

| Màn hình | Route | Trạng thái | Quyết định |
|---|---|---|---|
| Tuition list | `/admin/tuition-fees` | Đã triển khai | REWRITE |
| Payment | Không còn màn hình riêng | Thanh toán thực hiện trong Tuition list/detail; dữ liệu payment giữ ở domain/API | DELETE UI |
| Receipt | `/admin/receipts` | Đã có, cần mở rộng preview/send | REFACTOR |
| Statement import/reconciliation | `/admin/bank-reconciliation` | Đã có panel | REFACTOR |
| Tuition reports | `/admin/reports` | Đã dùng domain mới | REFACTOR |
| Student-fees/debt legacy | Đã xóa | Không còn | DELETE |
