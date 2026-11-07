# Phân tích UI hiện tại

## Phạm vi

Đã rà soát các route `/admin/receipts`, `/admin/bank-reconciliation`, `/admin/reports`, API tuition/payment/receipt/bank, Sidebar, `PaymentForm`, `ReceiptList`, `BankReconciliationPanel`, `CurrencyInput` và service/schema tương ứng.

| Thành phần | Route/API/component | Đánh giá |
|---|---|---|
| Danh sách học phí | `/admin/tuition-fees`, `/api/tuition-fees`, `TuitionList` | REWRITE |
| Thanh toán | `/api/payments`, `PaymentForm` | Dùng trong Tuition list/detail |
| Lịch sử payment | Receipts, Reports, Bank reconciliation | Theo dõi qua các màn hình nghiệp vụ tương ứng |
| Biên lai | `/admin/receipts`, `ReceiptList` | REFACTOR |
| Import/đối soát sao kê | `/admin/bank-reconciliation`, `BankReconciliationPanel` | REFACTOR |
| Báo cáo doanh thu/công nợ | `/admin/reports`, `ReportingDashboard` | REFACTOR |
| Input tiền | `CurrencyInput` | KEEP |
| Menu cũ student-fees/debt-tracking | route/page/menu legacy | DELETE |

## Vấn đề đã xác định

- Payment workspace gom nhiều học phí của cùng học viên thành một batch; mỗi payment sinh ra sau xác nhận vẫn gắn đúng một tuition fee và đúng toàn bộ `final_amount`.
- Nút xác nhận còn mơ hồ và thiếu dialog xác nhận nghiệp vụ.
- UI cũ chưa có danh sách học phí độc lập với bộ lọc trạng thái chuẩn.
- Trạng thái được hiển thị trực tiếp bằng mã máy, chưa có nhãn và màu/ý nghĩa nhất quán.
- Import/đối soát phân tích trong bộ nhớ; chỉ giữ kết quả tạm trong phiên làm việc và chỉ lưu payment/receipt sau xác nhận.

## Logic không còn sử dụng

UI hỗ trợ thanh toán từng phần và hiển thị số dư; backend vẫn chặn tiền dư. Batch nhiều khoản phân bổ theo amount thực tế của từng khoản. Các route/module legacy đã bị xóa trong đợt cutover database.
