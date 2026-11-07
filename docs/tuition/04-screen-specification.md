# Screen specification

- Tuition list/detail/adjustment/exemption/cancellation: snapshot tiền, item, due date, status, history nghiệp vụ và quyền. Lịch sử phải hiển thị thao tác, lý do, thời gian và người thực hiện. Không có màn hình create thủ công.
- Payment create/detail/attempt history: mặc định chọn một fee từ nút `Thu tiền`/`Thu phần còn lại`, tự điền toàn bộ số dư và cho nhập số tiền nhỏ hơn để thu từng phần; `Thu nhiều khoản` là thao tác nâng cao.
- Payment workspace: hiển thị rõ tổng phải thu, đã thu, còn nợ; thông tin bổ sung được thu gọn, tổng batch bằng tổng allocation thực tế.
- Receipt preview/print/cancel: một receipt cho payment, immutable snapshot.
- Refund create/detail: full refund, approval/status.
- Bank account, Excel sao kê BIDV/Techcombank phân tích tạm thời, đối soát theo mã đợt thanh toán và xác nhận; không có lịch sử import chưa xác nhận.

Mọi màn hình cần loading, empty, error, permission, confirmation, chống double submit và pagination stable.
