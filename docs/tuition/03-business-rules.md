# Business rules

1. Không hard-delete financial records.
2. Một tuition fee có thể có nhiều payment SUCCESS.
3. Tổng payment SUCCESS không được vượt final_amount; amount vượt số dư trả lỗi conflict.
4. Không thanh toán PAID, CANCELLED hoặc EXEMPTED.
5. Payment FAILED/CANCELLED có thể tạo lại; payment SUCCESS tiếp theo chỉ được ghi nhận trong phạm vi số dư còn lại.
6. Mọi confirm payment chạy transaction, khóa tuition fee, kiểm tra idempotency/version và tạo receipt/audit atomically.
7. Không sửa snapshot của notice/receipt đã phát hành; thay bằng version/cancel/reissue.
8. Refund mặc định toàn bộ payment SUCCESS, không sửa payment gốc.
9. Bank transaction chỉ confirm một payment batch đang `PENDING` và credit amount phải khớp tuyệt đối với tổng batch; mỗi allocation trong batch phải nằm trong số dư còn lại của fee tương ứng.
10. Học phí `CANCELLED` có thể được khôi phục về `UNPAID`, và học phí `EXEMPTED` có thể được bỏ miễn để khôi phục về `UNPAID`, bằng thao tác có lý do và audit log. Chỉ khôi phục khi chưa có payment SUCCESS, chưa thuộc batch `PENDING`, và lớp chưa `COMPLETED` hoặc `CANCELLED`; nếu đã quá hạn thì trạng thái hiển thị là `OVERDUE`. Khi bỏ miễn, phải xóa `exemption_reason` nhưng giữ nguyên audit log miễn trước đó.
