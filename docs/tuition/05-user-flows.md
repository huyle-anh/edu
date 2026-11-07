# User flows

## Tuition

Chọn lớp ACTIVE -> chọn các môn -> đăng ký enrollment subject -> chọn kỳ trong thời gian lớp -> tạo tuition fee items -> tính final amount -> mở chi tiết học phí -> thanh toán.

## Bỏ miễn để thu lại

Mở khoản phí `EXEMPTED` -> nhập lý do bỏ miễn -> backend khóa cùng lớp và khoản
phí -> kiểm tra chưa có payment `SUCCESS`, chưa thuộc batch `PENDING`, lớp chưa
`COMPLETED`/`CANCELLED` -> xóa `exemption_reason` -> chuyển về `UNPAID` hoặc
hiển thị `OVERDUE` nếu đã quá hạn -> ghi audit -> thu tiền.

## Cash/bank/VietQR payment

Mở fee -> backend lấy final_amount -> tạo payment attempt PENDING -> nhận/xác nhận -> lock fee -> kiểm tra amount/status/idempotency -> SUCCESS -> fee PAID -> receipt -> audit.

## Refund

Chọn payment SUCCESS -> tạo refund PENDING -> approve -> complete toàn bộ -> payment REFUNDED -> fee UNPAID/OVERDUE -> xử lý receipt/audit.

## Excel bank reconciliation

Upload -> parse trong bộ nhớ -> loại trùng với payment đã xác nhận -> tìm `batchNo` trong nội dung và kiểm tra tổng tiền -> xác nhận payment batch transactionally. Chỉ payment/payment batch, receipt và audit sau xác nhận được lưu.
