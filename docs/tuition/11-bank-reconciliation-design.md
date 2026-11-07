# Bank reconciliation design

Transaction hash gồm bank account, mã giao dịch hoặc nội dung dòng. Phiên import
và dòng sao kê được lưu để tra cứu/báo cáo; token xác nhận vẫn chỉ tồn tại tạm
thời. Payment đã xác nhận lưu transaction hash trong `transaction_reference` và
liên kết lại với dòng sao kê lịch sử.
Đối soát chỉ xét batch `BANK_TRANSFER` đang `PENDING`, đã gắn đúng tài khoản
ngân hàng được import và có số tiền ghi có bằng chính xác tổng đợt thanh toán.
Hệ thống ưu tiên `batchNo` xuất hiện trong nội dung giao dịch. Nếu không có
`batchNo`, giao diện hiển thị các batch hợp lệ cùng số tiền để người dùng chọn
thủ công. Nếu một giao dịch gộp nhiều QR của cùng một học sinh, giao diện hiển thị
các nhóm batch có tổng tiền khớp để người dùng chọn. Backend nhận diện học sinh
bằng `studentId`, không dùng riêng tên hiển thị. Backend vẫn xác thực token,
phương thức, tài khoản, trạng thái batch và toàn bộ allocation.

Chỉ cho xác nhận khi tìm được đúng payment batch đang `PENDING` và số tiền khớp.
Với nhóm, tất cả batch phải cùng học sinh, cùng tài khoản, là `BANK_TRANSFER`, đang
`PENDING`, và tổng tiền phải bằng số tiền giao dịch. Xác nhận nhóm là một transaction nguyên tử:
nếu một batch lỗi thì không batch nào được hoàn tất. Các trạng thái phân tích tạm
thời là `AUTO_MATCHED`, `UNMATCHED`, `DUPLICATED`, `IGNORED`; trạng thái xác nhận
cuối cùng nằm ở payment batch `SUCCESS`, các payment phân bổ, receipt và audit log.
