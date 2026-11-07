# API specification

Root resources:

```text
/api/tuition-fees
/api/payment-batches
/api/receipts
/api/bank-accounts
/api/bank-statement-imports
/api/bank-reconciliations
/api/bank-reconciliation-reports
```

Thanh toán được tạo qua `POST /api/payment-batches`; backend tự tính số dư còn lại từ `finalAmount` và tổng payment `SUCCESS`, sau đó kiểm tra số tiền của lần thu không vượt số dư. Request có thể gửi amount theo từng khoản học phí để hỗ trợ thanh toán nhiều lần. Phương thức `CASH` hoặc `BANK_TRANSFER` được chọn tại màn hình thu học phí. Riêng thao tác chủ động tạo thông báo chuyển khoản theo lớp mới tạo các batch `BANK_TRANSFER` `PENDING`; không tạo batch khi chỉ bấm `Tạo học phí tháng`. Batch chuyển khoản ở trạng thái `PENDING` sẽ được xác nhận qua đối soát ngân hàng hoặc hủy trước khi chuyển sang phương thức thanh toán khác.

Khôi phục khoản học phí đã hủy hoặc bỏ miễn học phí:

```http
POST /api/tuition-fees/{tuitionFeeId}/restore
```

Body:

```json
{
  "reason": "Bỏ miễn do miễn nhầm, cần thu lại",
  "version": 1
}
```

API khôi phục `CANCELLED` hoặc `EXEMPTED` về `UNPAID`, giữ nguyên bản ghi và ghi audit log. Với `EXEMPTED`, API xóa `exemption_reason` và ghi action `TUITION_FEE_EXEMPTION_REVERSED`. Nếu hạn thanh toán đã qua, trạng thái trả về được hiển thị là `OVERDUE`. API từ chối khi khoản phí đã có payment `SUCCESS`, đang thuộc batch `PENDING`, hoặc lớp đã `COMPLETED`/`CANCELLED`.

API chi tiết học phí trả thêm `auditLogs`, gồm thao tác, lý do, thời gian và tên
người thực hiện để màn hình chi tiết hiển thị lịch sử nghiệp vụ.

`POST /api/tuition-fees` không còn được hỗ trợ. Học phí được tạo trong transaction riêng từ enrollment qua API tạo học phí theo lớp hoặc theo học viên; lớp phải ở trạng thái `ACTIVE`; client chỉ gửi kỳ `YYYY-MM`, không được tự gửi số tiền. Kỳ học phí phải nằm trong thời gian của lớp và không bị giới hạn bởi ngày đăng ký.

`POST /api/bank-statement-imports` chỉ parse và trả kết quả tạm thời; không lưu file hoặc transaction sao kê. `POST /api/bank-reconciliations` nhận token xác nhận và chỉ tạo payment/receipt sau khi backend kiểm tra lại toàn bộ điều kiện nghiệp vụ.

`POST /api/bank-reconciliation-reports` xuất Excel từ phiên sao kê tạm thời. Request chỉ nhận `bankAccountId`, `statementToken`, phạm vi xuất (`ALL`, `MATCHED`, `UNMATCHED`) và token của toàn bộ dòng giao dịch trong phiên. Backend kiểm tra chữ ký phiên, tài khoản, tính đầy đủ của các dòng, mapping batch và dữ liệu batch hiện tại trước khi tạo file; client không được tự gửi số tiền, trạng thái, học viên, batch hoặc biên lai để làm dữ liệu báo cáo.

Response giữ `{ success, data }` hoặc `{ success: false, error: { code, message, details } }`.
