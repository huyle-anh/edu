# Excel bank statement import design

Import xử lý file trong bộ nhớ, không lưu file, import record hoặc transaction tạm vào database. Kết quả phân tích được trả về giao diện cùng token đối soát có chữ ký và thời hạn.

Hiện hỗ trợ file Excel `.xlsx` theo format BIDV và Techcombank. BIDV hỗ trợ bảng cột `Ngày giao dịch`, `Nội dung giao dịch`, `Số tiền`, `Số dư`, `Mã giao dịch`. Techcombank hỗ trợ bảng `NGAY`, `DIEN GIAI`, `CHI TIET`, `NO`, `CO`, `SO DU`. Mỗi ngân hàng có parser riêng; các ngân hàng chưa có parser sẽ bị từ chối. Giao dịch ghi nợ bị bỏ qua. Giao dịch ghi có được tự động ghép khi nội dung chứa đúng mã đợt thanh toán và số tiền bằng tổng đợt. Nếu một giao dịch thanh toán gộp nhiều QR, giao diện hiển thị các nhóm payment batch đang chờ có tổng tiền khớp để người dùng chọn thủ công. Backend luôn kiểm tra lại trạng thái, phương thức, tài khoản ngân hàng, số tiền và toàn bộ phân bổ trước khi xác nhận.

Chống trùng dựa trên transaction hash/mã giao dịch của các payment hoặc payment batch đã xác nhận. Chỉ khi người dùng xác nhận, hệ thống mới tạo payment, receipt và audit log.

Một giao dịch ngân hàng chỉ được dùng một lần. Khi đối soát nhóm, toàn bộ batch phải
cùng một học sinh, cùng tài khoản ngân hàng, đang `PENDING`, là `BANK_TRANSFER`, và tổng
`payment_batch.total_amount` phải bằng chính xác số tiền ghi có. Việc xác nhận nhóm
thực hiện trong một transaction; mỗi batch tạo payment và biên lai riêng nhưng dùng
chung mã giao dịch ngân hàng.

CLI: `npm run bank:import -- "/path/to/sao ke.xlsx" [bank-account-id]` (hiện hỗ trợ BIDV và Techcombank).

API: `POST /api/bank-statement-imports` với multipart fields `file` và `bankAccountId`; xác nhận qua `POST /api/bank-reconciliations`.
