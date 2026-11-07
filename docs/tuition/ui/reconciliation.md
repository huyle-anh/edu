# Reconciliation

Mỗi bank transaction chỉ ghép một payment batch bằng `batchNo`. Chỉ bật xác nhận khi nội dung chứa đúng `batchNo`, credit bằng chính xác `totalAmount`, batch đang `PENDING` và transaction chưa xác nhận.
