# Báo cáo triển khai refactor học phí/thanh toán

## Đã hoàn thành

- Phân tích hiện trạng và lập tài liệu thiết kế trong `docs/tuition/`.
- Bổ sung domain one-time tuition: học phí, item, adjustment, payment, refund, receipt, notice, audit và bank reconciliation.
- Quy tắc thanh toán mới: chọn nhiều khoản, mỗi khoản thanh toán đúng `final_amount`, một khoản chỉ có một payment SUCCESS, idempotency key và cập nhật trạng thái PAID trong transaction.
- Thêm API `/api/tuition-fees` và chuyển `/api/payments` sang luồng tra cứu theo mã học sinh và thanh toán nhiều khoản.
- UI payments bắt buộc mã học sinh, hiển thị checkbox từng khoản, tổng tiền, phương thức và xác nhận một lần.
- Seed cleanup đã sửa theo khóa ngoại.
- Đã triển khai parser sao kê `;`/Windows-1252, import transaction, hash chống trùng, tách credit/debit và tạo match candidates.
- Đã import file `sao ke.csv`: 40 dòng, 32 ghi có, 8 ghi nợ; 8 ghi nợ được đánh dấu `IGNORED`, 32 ghi có đang `UNMATCHED` vì database hiện chưa có khoản tuition fee tương ứng.
- Kiểm tra: Prisma validate, generate, migrate deploy, seed, typecheck, lint và build đều đạt.

## Kết quả dữ liệu

- Migration deploy: không còn migration chờ áp dụng.
- Seed: hoàn tất.
- Audit legacy nhiều payment SUCCESS: 0 dòng.
- Sao kê import: `06273da4-b2ef-4c9c-ae90-8290b81238c4`.

## Đã hoàn tất phần còn thiếu

- Màn hình `/admin/bank-reconciliation` cho import CSV và duyệt candidate.
- Xác nhận đối soát tạo payment BANK_TRANSFER SUCCESS, cập nhật học phí PAID, receipt và audit trong transaction.
- QR VietQR payload/data URL cho các khoản được chọn.
- PDF phiếu thu mới tại `/api/tuition-receipts/:id/pdf`.
- Đã cutover Payments/Receipts UI và revenue report sang domain mới; xóa PaymentService/ReceiptService legacy, các endpoint confirm/receipt/print cũ và các endpoint payment-package cũ.

## Lưu ý cutover

- Đã xóa vật lý các bảng legacy `student_fees`, `payments`, `payment_requests` cùng các bảng phụ thuộc cũ `payment_accounts`, `payment_qr_codes`, `payment_notices`, `receipts`, `bank_transactions` và các enum legacy liên quan.
- Đã xóa các route, service, schema, page và menu cũ phụ thuộc nhóm bảng trên. Luồng vận hành hiện dùng domain `TuitionFee`/`TuitionPayment`/`TuitionReceipt`.
- Migration destructive đã được deploy thành công; truy vấn trực tiếp `information_schema` xác nhận ba bảng `student_fees`, `payments`, `payment_requests` không còn tồn tại.
