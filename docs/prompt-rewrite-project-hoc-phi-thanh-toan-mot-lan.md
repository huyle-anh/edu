# PROMPT REWRITE TOÀN BỘ PROJECT QUẢN LÝ HỌC PHÍ VÀ THANH TOÁN

## 1. Mục tiêu

Bạn đang làm việc trên một project quản lý trung tâm giáo dục đã tồn tại.

Mục tiêu là **loại bỏ toàn bộ implementation nghiệp vụ cũ của module học phí và thanh toán**, sau đó thiết kế và viết lại hệ thống mới dựa trên đặc tả trong tài liệu này.

Đây không phải là nhiệm vụ sửa lỗi nhỏ, bổ sung chức năng hoặc refactor từng phần.

Đây là nhiệm vụ:

```text
REWRITE TOÀN BỘ MODULE
```

Phạm vi rewrite bao gồm:

- Source code frontend.
- Source code backend.
- Database schema.
- Migration.
- Seed data.
- API.
- Validation.
- Business logic.
- Permission.
- Audit log.
- Test.
- Tài liệu.
- File cấu hình liên quan.
- Mẫu CSV.
- Mẫu PDF.
- Chức năng import sao kê.
- Chức năng đối soát ngân hàng.

Không được giữ lại code nghiệp vụ cũ chỉ vì code đó đang hoạt động.

Chỉ được tái sử dụng:

- Cấu trúc project chung.
- Authentication.
- Authorization framework.
- Layout chung.
- Shared UI primitives.
- Database connection.
- Logging framework.
- Error-handling framework.
- File storage framework.
- Email, SMS hoặc Zalo integration framework.
- Các utility đã được kiểm chứng và không chứa logic nghiệp vụ cũ.

Nếu shared code hiện tại không phù hợp với thiết kế mới, phải refactor hoặc thay thế.

---

# 2. Phạm vi chức năng

Viết lại toàn bộ module quản lý:

1. Học phí.
2. Chi tiết cấu thành học phí.
3. Giảm giá.
4. Học bổng.
5. Phụ phí.
6. Công nợ.
7. Thanh toán một lần.
8. Thanh toán tiền mặt.
9. Thanh toán chuyển khoản.
10. Thanh toán VietQR.
11. Điều chỉnh học phí.
12. Miễn học phí.
13. Hủy học phí.
14. Thông báo học phí.
15. In thông báo học phí.
16. Gửi thông báo học phí.
17. Biên lai thanh toán.
18. In biên lai.
19. Hoàn tiền.
20. Quản lý tài khoản ngân hàng.
21. Import sao kê CSV.
22. Đối soát giao dịch ngân hàng.
23. Ghép giao dịch tự động.
24. Ghép giao dịch thủ công.
25. Audit log.
26. Phân quyền.

---

# 3. Nguyên tắc thanh toán bắt buộc

## 3.1. Chỉ thanh toán một lần

Mỗi khoản học phí chỉ được thanh toán đúng một lần và toàn bộ số tiền phải được thanh toán trong một giao dịch thành công.

Quan hệ nghiệp vụ:

```text
Một tuition_fee có tối đa một payment SUCCESS.
Một payment chỉ thuộc một tuition_fee.
```

Số tiền thanh toán phải thỏa mãn:

```text
payment.amount = tuition_fee.final_amount
```

Hệ thống không hỗ trợ:

- Chia kỳ thanh toán.
- Lịch trả góp.
- Payment schedule.
- Installment.
- Thanh toán một phần.
- Thanh toán nhiều lần cho cùng một khoản học phí.
- Phân bổ một payment cho nhiều khoản học phí.
- Phân bổ nhiều payment cho một khoản học phí.
- Chuyển phần tiền dư sang khoản học phí khác.
- Quản lý số dư thanh toán thừa.
- Trạng thái `PARTIALLY_PAID`.

Không tạo hoặc không sử dụng các bảng:

```text
payment_allocations
student_credit_balances
payment_schedules
installments
```

## 3.2. Trường hợp thanh toán sai số tiền

```text
payment.amount < tuition_fee.final_amount
    → PAYMENT_AMOUNT_MISMATCH

payment.amount > tuition_fee.final_amount
    → PAYMENT_AMOUNT_MISMATCH

payment.amount = tuition_fee.final_amount
    → được phép xác nhận
```

Không tự động xử lý thanh toán thiếu hoặc thanh toán thừa.

---

# 4. Nguyên tắc rewrite

## 4.1. Không phụ thuộc implementation cũ

Không được giữ nguyên:

- Entity cũ.
- DTO cũ.
- API cũ.
- Service cũ.
- Repository cũ.
- Component cũ.
- Form cũ.
- Hook cũ.
- Validation cũ.
- Database table cũ.
- Migration cũ của module học phí.
- Test cũ không còn phù hợp.
- Tài liệu cũ.
- Tên trường cũ nếu không phù hợp với domain mới.

Code cũ chỉ được dùng để:

- Xác định integration point.
- Xác định dữ liệu cần migration.
- Xác định các module khác đang phụ thuộc.
- Xác định các chức năng thực tế đang được sử dụng.
- So sánh dữ liệu trước và sau migration.

Không được lấy cấu trúc code cũ làm chuẩn thiết kế mới.

## 4.2. Đặc tả mới là nguồn sự thật duy nhất

Thứ tự ưu tiên khi có mâu thuẫn:

```text
1. Đặc tả mới trong tài liệu này.
2. Business rule mới.
3. Thiết kế database mới.
4. API contract mới.
5. Code hiện tại.
6. Tài liệu cũ.
```

Nếu code hoặc tài liệu cũ mâu thuẫn với đặc tả mới, phải loại bỏ hoặc thay thế code cũ.

---

# 5. Quy trình thực hiện bắt buộc

Không bắt đầu viết code ngay.

Phải thực hiện theo thứ tự sau.

## Giai đoạn 1: Phân tích project hiện tại

Kiểm tra toàn bộ project và lập danh sách:

- Module liên quan đến học phí.
- Module liên quan đến thanh toán.
- Module liên quan đến học viên.
- Module liên quan đến lớp học.
- Module liên quan đến đăng ký lớp.
- Module ngân hàng.
- Module PDF.
- Module upload file.
- Module email.
- Module VietQR.
- Module permission.
- Module audit log.
- Database tables hiện tại.
- API hiện tại.
- Dependency giữa các module.
- Job nền hoặc scheduled task.
- Environment variable.
- Test hiện tại.
- Tài liệu hiện tại.

Tạo file:

```text
docs/refactor/current-state-analysis.md
```

Tài liệu phải chỉ rõ:

- Code nào sẽ bị xóa.
- Code nào được giữ lại.
- Code nào cần refactor.
- Dependency nào cần cập nhật.
- Dữ liệu nào cần migration.
- Rủi ro khi rewrite.
- Chức năng cũ nào không còn được hỗ trợ.
- Tất cả logic chia kỳ hoặc thanh toán nhiều lần cần xóa.

## Giai đoạn 2: Thiết kế hệ thống mới

Tạo bộ tài liệu mới trước khi triển khai:

```text
docs/tuition/
├── 01-overview.md
├── 02-business-requirements.md
├── 03-business-rules.md
├── 04-screen-specification.md
├── 05-user-flows.md
├── 06-database-design.md
├── 07-api-specification.md
├── 08-permission-design.md
├── 09-audit-log-design.md
├── 10-csv-import-design.md
├── 11-bank-reconciliation-design.md
├── 12-pdf-design.md
├── 13-error-handling.md
├── 14-migration-plan.md
├── 15-test-plan.md
└── 16-deployment-plan.md
```

Tất cả tài liệu cũ của module phải được:

- Xóa.
- Hoặc di chuyển vào thư mục archive.
- Hoặc đánh dấu `DEPRECATED`.

Không để tài liệu cũ và mới cùng tồn tại mà không phân biệt rõ.

## Giai đoạn 3: Thiết kế database mới

Thiết kế lại database PostgreSQL.

Các bảng chính:

```text
tuition_fees
tuition_fee_items
tuition_adjustments

payments
payment_refunds
receipts

tuition_notices
tuition_notice_items
tuition_notice_deliveries

bank_accounts
bank_csv_mappings
bank_statement_imports
bank_statement_transactions
bank_statement_match_candidates

audit_logs
```

Các bảng có thể được tái sử dụng nếu phù hợp:

```text
students
classes
student_enrollments
users
roles
permissions
```

---

# 6. Luồng nghiệp vụ tổng thể

```text
Đăng ký lớp
    ↓
Tạo khoản học phí
    ↓
Thêm chi tiết học phí
    ↓
Áp dụng giảm giá, học bổng hoặc phụ phí
    ↓
Phát hành thông báo học phí
    ↓
In hoặc gửi thông báo
    ↓
Thanh toán toàn bộ một lần
    ↓
Cập nhật trạng thái học phí thành PAID
    ↓
Phát hành biên lai
    ↓
Import sao kê ngân hàng
    ↓
Đối soát giao dịch
    ↓
Điều chỉnh hoặc hoàn tiền khi cần
```

---

# 7. Chức năng học phí

Hệ thống phải hỗ trợ:

- Tạo học phí cho học viên đăng ký lớp.
- Thêm các khoản cấu thành học phí.
- Thêm học phí khóa học.
- Thêm giáo trình.
- Thêm đồng phục.
- Thêm lệ phí thi.
- Thêm phụ phí khác.
- Áp dụng giảm giá.
- Áp dụng học bổng.
- Thiết lập một hạn thanh toán chung.
- Xem tổng tiền phải đóng.
- Xem trạng thái thanh toán.
- Điều chỉnh học phí.
- Miễn học phí.
- Hủy học phí.
- Xem lịch sử thay đổi.
- In thông báo học phí.
- Gửi thông báo học phí.
- Xuất Excel.

Không cho phép chỉnh sửa trực tiếp dữ liệu tài chính đã phát sinh mà không lưu lịch sử.

---

# 8. Trạng thái học phí

Sử dụng các trạng thái:

```text
UNPAID
PAID
OVERDUE
EXEMPTED
CANCELLED
```

Ý nghĩa:

| Trạng thái | Ý nghĩa |
|---|---|
| `UNPAID` | Chưa thanh toán |
| `PAID` | Đã thanh toán đủ |
| `OVERDUE` | Đã quá hạn nhưng chưa thanh toán |
| `EXEMPTED` | Được miễn học phí |
| `CANCELLED` | Khoản học phí đã bị hủy |

Không sử dụng:

```text
PARTIALLY_PAID
```

Quy tắc trạng thái:

```ts
if (status === "CANCELLED" || status === "EXEMPTED") {
  // Giữ nguyên trạng thái nghiệp vụ.
} else if (successfulPaymentExists) {
  status = "PAID";
} else if (dueDate && dueDate < today) {
  status = "OVERDUE";
} else {
  status = "UNPAID";
}
```

---

# 9. Công thức học phí

```text
final_amount =
    original_amount
    - discount_amount
    + additional_amount
```

Trong đó:

- `original_amount`: Học phí gốc.
- `discount_amount`: Tổng số tiền giảm hoặc học bổng.
- `additional_amount`: Tổng phụ phí.
- `final_amount`: Tổng tiền phải thanh toán một lần.

Frontend không được gửi `final_amount` như nguồn sự thật.

Backend phải tự tính lại từ chi tiết học phí.

---

# 10. Chi tiết cấu thành học phí

Các loại khoản phí:

```text
TUITION
MATERIAL
UNIFORM
EXAM_FEE
OTHER_FEE
DISCOUNT
SCHOLARSHIP
```

Ý nghĩa:

| Loại | Ý nghĩa |
|---|---|
| `TUITION` | Học phí khóa học |
| `MATERIAL` | Giáo trình |
| `UNIFORM` | Đồng phục |
| `EXAM_FEE` | Lệ phí thi |
| `OTHER_FEE` | Phụ phí khác |
| `DISCOUNT` | Giảm giá |
| `SCHOLARSHIP` | Học bổng |

Quy tắc:

- Lưu `amount` là số dương.
- Backend xác định cộng hoặc trừ theo `item_type`.
- Không lưu giảm giá dưới dạng số âm.

---

# 11. Màn hình danh sách học phí

Hiển thị:

- Mã học phí.
- Mã học viên.
- Tên học viên.
- Lớp học.
- Khóa học.
- Học phí gốc.
- Số tiền giảm.
- Phụ phí.
- Tổng tiền phải đóng.
- Hạn thanh toán.
- Trạng thái.
- Ngày tạo.
- Người tạo.

Bộ lọc:

- Mã hoặc tên học viên.
- Lớp học.
- Khóa học.
- Trạng thái học phí.
- Hạn thanh toán.
- Chưa thanh toán.
- Quá hạn.
- Khoảng số tiền.
- Ngày tạo.

Chức năng:

- Tạo học phí.
- Xem chi tiết.
- Chỉnh sửa.
- Điều chỉnh học phí.
- Miễn học phí.
- Hủy học phí.
- Thu tiền.
- In thông báo học phí.
- Gửi thông báo học phí.
- Xem lịch sử thanh toán.
- Xem lịch sử điều chỉnh.
- Xuất Excel.

---

# 12. Màn hình thanh toán

## Thông tin học viên

- Mã học viên.
- Họ tên.
- Lớp học.
- Khóa học.
- Người liên hệ.
- Số điện thoại.
- Email.

## Thông tin học phí

- Mã học phí.
- Học phí gốc.
- Giảm giá.
- Học bổng.
- Phụ phí.
- Tổng tiền phải đóng.
- Hạn thanh toán.
- Trạng thái.

## Thông tin thanh toán

- Ngày thanh toán.
- Số tiền thanh toán.
- Phương thức thanh toán.
- Người nộp tiền.
- Nội dung thanh toán.
- Mã giao dịch ngân hàng.
- Tài khoản ngân hàng.
- Ảnh hoặc file chứng từ.
- Ghi chú.

Số tiền thanh toán được mặc định bằng `tuition_fee.final_amount`.

Không cho người dùng xác nhận nếu số tiền khác tổng học phí.

## Chức năng

- Thanh toán toàn bộ.
- Tạo mã VietQR.
- Xác nhận thanh toán.
- Hủy lần thử thanh toán.
- In biên lai.
- Gửi biên lai qua email.
- Xem lịch sử thử thanh toán.
- Hoàn tiền.

Không có:

- Thanh toán một phần.
- Nhập số tiền nhỏ hơn tổng học phí.
- Nhập số tiền lớn hơn tổng học phí.
- Thanh toán nhiều lần.

---

# 13. Phương thức và trạng thái thanh toán

Phương thức:

```text
CASH
BANK_TRANSFER
OTHER
```

Trạng thái:

```text
PENDING
SUCCESS
FAILED
CANCELLED
REFUNDED
```

Ý nghĩa:

| Trạng thái | Ý nghĩa |
|---|---|
| `PENDING` | Đang chờ xử lý |
| `SUCCESS` | Thanh toán thành công |
| `FAILED` | Thanh toán thất bại |
| `CANCELLED` | Lần thử thanh toán bị hủy |
| `REFUNDED` | Giao dịch đã hoàn tiền |

Hệ thống có thể lưu nhiều lần thử `FAILED` hoặc `CANCELLED`.

Hệ thống chỉ được tồn tại tối đa một payment `SUCCESS` cho mỗi khoản học phí.

---

# 14. Thiết kế bảng `tuition_fees`

```sql
CREATE TABLE tuition_fees (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    fee_no               VARCHAR(30) NOT NULL,

    student_id           UUID NOT NULL,
    enrollment_id        UUID NOT NULL,
    class_id             UUID NOT NULL,

    original_amount      NUMERIC(15, 2) NOT NULL DEFAULT 0,
    discount_amount      NUMERIC(15, 2) NOT NULL DEFAULT 0,
    additional_amount    NUMERIC(15, 2) NOT NULL DEFAULT 0,
    final_amount         NUMERIC(15, 2) NOT NULL DEFAULT 0,

    due_date              DATE,
    status                VARCHAR(30) NOT NULL DEFAULT 'UNPAID',

    exemption_reason      TEXT,
    cancellation_reason   TEXT,
    note                  TEXT,

    version               INTEGER NOT NULL DEFAULT 1,

    created_by            UUID NOT NULL,
    updated_by            UUID NOT NULL,
    created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_tuition_fee_no
        UNIQUE (fee_no),

    CONSTRAINT ck_tuition_original_amount
        CHECK (original_amount >= 0),

    CONSTRAINT ck_tuition_discount_amount
        CHECK (discount_amount >= 0),

    CONSTRAINT ck_tuition_additional_amount
        CHECK (additional_amount >= 0),

    CONSTRAINT ck_tuition_final_amount
        CHECK (final_amount >= 0)
);
```

Nếu project là multi-tenant:

- Thêm `tenant_id`.
- Tất cả unique constraint phải bao gồm `tenant_id`.
- Mọi truy vấn phải giới hạn theo tenant.

---

# 15. Thiết kế bảng `tuition_fee_items`

```sql
CREATE TABLE tuition_fee_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tuition_fee_id    UUID NOT NULL,
    item_type         VARCHAR(30) NOT NULL,

    item_name         VARCHAR(255) NOT NULL,
    quantity          NUMERIC(10, 2) NOT NULL DEFAULT 1,
    unit_price        NUMERIC(15, 2) NOT NULL DEFAULT 0,
    amount            NUMERIC(15, 2) NOT NULL DEFAULT 0,

    display_order     INTEGER NOT NULL DEFAULT 0,
    note              TEXT,

    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_tuition_fee_item_fee
        FOREIGN KEY (tuition_fee_id)
        REFERENCES tuition_fees(id),

    CONSTRAINT ck_tuition_fee_item_quantity
        CHECK (quantity > 0),

    CONSTRAINT ck_tuition_fee_item_unit_price
        CHECK (unit_price >= 0),

    CONSTRAINT ck_tuition_fee_item_amount
        CHECK (amount >= 0)
);
```

---

# 16. Thiết kế bảng `payments`

```sql
CREATE TABLE payments (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    payment_no             VARCHAR(30) NOT NULL,
    tuition_fee_id         UUID NOT NULL,
    student_id             UUID NOT NULL,

    payment_date           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    amount                 NUMERIC(15, 2) NOT NULL,

    payment_method         VARCHAR(30) NOT NULL,
    payment_status         VARCHAR(30) NOT NULL DEFAULT 'PENDING',

    bank_account_id        UUID,
    bank_transaction_no    VARCHAR(150),
    transaction_reference  VARCHAR(150),

    payer_name             VARCHAR(255),
    payment_content        VARCHAR(500),
    proof_file_url         TEXT,

    received_by            UUID,
    confirmed_by           UUID,
    confirmed_at           TIMESTAMP,

    failure_reason         TEXT,
    cancellation_reason    TEXT,
    note                   TEXT,

    version                INTEGER NOT NULL DEFAULT 1,

    created_by             UUID NOT NULL,
    updated_by             UUID NOT NULL,
    created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_payment_no
        UNIQUE (payment_no),

    CONSTRAINT fk_payment_tuition_fee
        FOREIGN KEY (tuition_fee_id)
        REFERENCES tuition_fees(id),

    CONSTRAINT ck_payment_amount_positive
        CHECK (amount > 0)
);
```

Tạo partial unique index:

```sql
CREATE UNIQUE INDEX uq_success_payment_per_tuition_fee
ON payments(tuition_fee_id)
WHERE payment_status = 'SUCCESS';
```

Partial unique index bảo đảm:

- Có thể lưu nhiều lần thử thất bại.
- Có thể lưu lần thử bị hủy.
- Chỉ có một payment thành công cho mỗi khoản học phí.

Không tạo bảng `payment_allocations`.

---

# 17. Validation thanh toán

```ts
if (tuitionFee.status === "PAID") {
  throw new BusinessException("TUITION_ALREADY_PAID");
}

if (tuitionFee.status === "CANCELLED") {
  throw new BusinessException("TUITION_CANCELLED");
}

if (tuitionFee.status === "EXEMPTED") {
  throw new BusinessException("TUITION_EXEMPTED");
}

if (paymentAmount !== tuitionFee.finalAmount) {
  throw new BusinessException("PAYMENT_AMOUNT_MISMATCH");
}
```

Các validation bắt buộc:

- Không thanh toán học phí đã `PAID`.
- Không thanh toán học phí đã `CANCELLED`.
- Không thanh toán học phí đã `EXEMPTED`.
- Không xác nhận nếu số tiền khác `final_amount`.
- Không xác nhận cùng một payment hai lần.
- Không tạo payment thành công thứ hai.
- Không cho client gửi trạng thái học phí tùy ý.
- Không cho client tự quyết định số tiền cuối cùng.
- Phải kiểm tra optimistic locking hoặc row locking.

---

# 18. Transaction xác nhận thanh toán

Toàn bộ quy trình phải chạy trong một database transaction:

```text
1. Khóa tuition_fees.
2. Kiểm tra version.
3. Kiểm tra học phí chưa PAID.
4. Kiểm tra học phí chưa CANCELLED.
5. Kiểm tra học phí chưa EXEMPTED.
6. Kiểm tra chưa có payment SUCCESS.
7. Kiểm tra payment.amount = tuition_fee.final_amount.
8. Tạo hoặc xác nhận payment.
9. Cập nhật tuition_fees.status = PAID.
10. Tạo receipt.
11. Ghi audit log.
12. Commit.
```

Nếu bất kỳ bước nào lỗi:

```text
Rollback toàn bộ transaction.
```

Phải có idempotency để tránh tạo payment trùng khi client gửi lại request.

---

# 19. Thông báo học phí

Thông báo học phí được phát hành trước khi học viên thanh toán.

Thông báo học phí khác với biên lai:

- Thông báo học phí: yêu cầu học viên thanh toán.
- Biên lai: xác nhận trung tâm đã nhận tiền.

## Nội dung thông báo

- Mã thông báo.
- Thông tin trung tâm.
- Mã học viên.
- Tên học viên.
- Lớp học.
- Khóa học.
- Ngày bắt đầu học.
- Chi tiết các khoản phí.
- Học phí gốc.
- Giảm giá.
- Học bổng.
- Phụ phí.
- Tổng tiền phải đóng.
- Hạn thanh toán.
- Ngân hàng.
- Số tài khoản.
- Tên chủ tài khoản.
- Nội dung chuyển khoản.
- Mã VietQR.
- Ghi chú.
- Ngày phát hành.
- Người phát hành.

## Trạng thái thông báo

```text
DRAFT
ISSUED
CANCELLED
REPLACED
```

Quy tắc:

- Không sửa trực tiếp thông báo đã `ISSUED`.
- Khi học phí thay đổi, tạo thông báo mới.
- Thông báo cũ chuyển thành `REPLACED` hoặc `CANCELLED`.
- Nội dung thông báo phải lưu snapshot.

## Phương thức gửi

```text
EMAIL
SMS
ZALO
PRINT
```

## Trạng thái gửi

```text
PENDING
SENT
FAILED
```

---

# 20. Thiết kế bảng `tuition_notices`

Các cột chính:

```text
id
notice_no
tuition_fee_id
issued_at
issued_by
student_code
student_name
class_name
course_name
original_amount
discount_amount
additional_amount
final_amount
due_date
bank_name
bank_account_no
bank_account_name
transfer_content
qr_code_url
pdf_file_url
status
replacement_notice_id
cancellation_reason
cancelled_by
cancelled_at
created_at
```

Thông tin học viên, lớp học, tiền và ngân hàng phải lưu dưới dạng snapshot.

---

# 21. Thiết kế bảng `tuition_notice_items`

Các cột chính:

```text
id
tuition_notice_id
item_type
item_name
quantity
unit_price
amount
display_order
```

Dữ liệu được sao chép từ `tuition_fee_items` tại thời điểm phát hành.

---

# 22. Thiết kế bảng `tuition_notice_deliveries`

Các cột chính:

```text
id
tuition_notice_id
delivery_method
recipient
status
sent_at
failed_at
failure_reason
created_at
```

---

# 23. Biên lai thanh toán

Biên lai được phát hành sau khi payment thành công.

Nội dung:

- Mã biên lai.
- Mã payment.
- Mã học phí.
- Thông tin học viên.
- Người nộp tiền.
- Số tiền.
- Số tiền bằng chữ.
- Phương thức thanh toán.
- Nội dung thanh toán.
- Ngày thanh toán.
- Người thu tiền.
- Người phát hành.
- File PDF.
- Mã QR tra cứu.

Trạng thái:

```text
ISSUED
CANCELLED
```

Không sửa biên lai đã phát hành.

Nếu biên lai sai:

```text
1. Hủy biên lai cũ.
2. Ghi lý do.
3. Phát hành biên lai mới theo quy trình được phê duyệt.
```

---

# 24. Thiết kế bảng `receipts`

Các cột chính:

```text
id
receipt_no
payment_id
issued_at
issued_by
receiver_name
amount
amount_in_words
pdf_file_url
email_sent_at
status
cancellation_reason
cancelled_by
cancelled_at
created_at
```

Ràng buộc:

```text
UNIQUE(payment_id)
```

---

# 25. Điều chỉnh học phí

Hỗ trợ:

```text
DISCOUNT
SCHOLARSHIP
ADD_FEE
REDUCE_FEE
EXEMPTION
CANCELLATION
TRANSFER_CLASS
```

Mỗi điều chỉnh phải lưu:

- Khoản học phí.
- Loại điều chỉnh.
- Số tiền điều chỉnh.
- Số tiền trước điều chỉnh.
- Số tiền sau điều chỉnh.
- Lý do.
- Người tạo.
- Người phê duyệt.
- Thời gian phê duyệt.

Quy tắc:

- Không sửa hoặc xóa trực tiếp bản ghi điều chỉnh.
- Khi cần sửa, tạo bản ghi điều chỉnh ngược.
- Sau mỗi điều chỉnh phải tính lại `final_amount`.
- Nếu đã phát hành thông báo học phí, phải phát hành thông báo mới.
- Không cho điều chỉnh học phí đã thanh toán thành công nếu chưa có quy trình hủy hoặc hoàn tiền phù hợp.

---

# 26. Hoàn tiền

Hỗ trợ hoàn tiền toàn bộ payment đã thành công.

Do hệ thống chỉ thanh toán một lần toàn bộ, mặc định hoàn tiền phải là toàn bộ số tiền đã thanh toán.

Thông tin hoàn tiền:

- Mã hoàn tiền.
- Payment gốc.
- Số tiền hoàn.
- Phương thức hoàn.
- Ngày hoàn.
- Mã giao dịch ngân hàng.
- Lý do.
- Người tạo.
- Người phê duyệt.
- Trạng thái.

Trạng thái:

```text
PENDING
APPROVED
COMPLETED
REJECTED
CANCELLED
```

Sau khi hoàn tiền hoàn tất:

- Payment chuyển thành `REFUNDED`.
- Tính lại trạng thái học phí.
- Học phí có thể chuyển về `UNPAID` hoặc `OVERDUE`.
- Hủy hoặc cập nhật trạng thái biên lai theo quy trình.
- Ghi audit log.
- Không sửa trực tiếp dữ liệu payment gốc.

---

# 27. Import sao kê ngân hàng CSV

Thiết kế màn hình import sao kê.

## Thông tin import

- Ngân hàng.
- Tài khoản ngân hàng.
- File CSV.
- Encoding.
- Dấu phân cách.
- Dòng tiêu đề.
- Dòng bắt đầu dữ liệu.
- Định dạng ngày.
- Định dạng số tiền.
- Cấu hình ánh xạ cột.

Encoding:

```text
UTF-8
UTF-8 BOM
Windows-1258
Shift-JIS
```

Delimiter:

```text
comma
semicolon
tab
```

Các cột hệ thống:

```text
transaction_date
value_date
bank_transaction_no
description
sender_name
sender_account_no
sender_bank_code
credit_amount
debit_amount
balance_amount
currency_code
```

Chức năng:

- Chọn file.
- Xem trước dữ liệu.
- Ánh xạ cột.
- Lưu cấu hình CSV.
- Kiểm tra dữ liệu.
- Import.
- Xem kết quả import.
- Tải danh sách lỗi.
- Hủy lần import.

---

# 28. Trạng thái import sao kê

```text
UPLOADED
VALIDATING
VALIDATED
PROCESSING
COMPLETED
PARTIALLY_COMPLETED
FAILED
CANCELLED
```

Mỗi lần import lưu:

- Tên file.
- Đường dẫn file.
- Hash file.
- Tổng số dòng.
- Số dòng hợp lệ.
- Số dòng lỗi.
- Số dòng trùng.
- Số dòng ghép được.
- Số dòng không ghép được.
- Người import.
- Thời gian import.
- Lỗi tổng thể.

Sử dụng `file_hash` để ngăn import trùng cùng một file.

---

# 29. Đối soát giao dịch ngân hàng

Một giao dịch sao kê chỉ được ghép với một khoản học phí.

Quan hệ:

```text
bank_statement_transaction
    ↓
một tuition_fee
    ↓
một payment SUCCESS
```

Thứ tự tự động ghép:

```text
1. Mã thông báo học phí.
2. Mã học phí.
3. Mã học viên.
4. Payment reference.
5. Nội dung VietQR.
6. Số điện thoại.
7. Tên học viên hoặc phụ huynh.
8. Số tiền.
```

Chỉ tự động xác nhận khi:

- Có đúng một kết quả.
- Reference khớp chính xác.
- Giao dịch chưa được xử lý.
- Học phí chưa thanh toán.
- Học phí chưa hủy.
- Học phí chưa miễn.
- `credit_amount = tuition_fee.final_amount`.

Nếu số tiền không bằng chính xác tổng học phí:

```text
AMOUNT_MISMATCH
```

Không tự động phân bổ tiền thiếu hoặc tiền dư.

---

# 30. Trạng thái đối soát

```text
IMPORTED
AUTO_MATCHED
MANUAL_MATCHED
CONFIRMED
UNMATCHED
AMBIGUOUS
DUPLICATED
AMOUNT_MISMATCH
IGNORED
REVERSED
ERROR
```

Ý nghĩa:

| Trạng thái | Ý nghĩa |
|---|---|
| `IMPORTED` | Đã import |
| `AUTO_MATCHED` | Hệ thống tự động ghép |
| `MANUAL_MATCHED` | Người dùng ghép thủ công |
| `CONFIRMED` | Đã tạo payment thành công |
| `UNMATCHED` | Không tìm thấy dữ liệu |
| `AMBIGUOUS` | Có nhiều kết quả |
| `DUPLICATED` | Giao dịch trùng |
| `AMOUNT_MISMATCH` | Số tiền không khớp |
| `IGNORED` | Người dùng bỏ qua |
| `REVERSED` | Đã hoàn tác đối soát |
| `ERROR` | Dữ liệu lỗi |

---

# 31. Màn hình kết quả đối soát

Hiển thị:

- Trạng thái.
- Ngày giao dịch.
- Mã giao dịch ngân hàng.
- Nội dung chuyển khoản.
- Tên người chuyển.
- Tài khoản người chuyển.
- Số tiền vào.
- Học viên đề xuất.
- Khoản học phí đề xuất.
- Mã thông báo học phí.
- Tổng học phí.
- Sai lệch số tiền.
- Phương pháp ghép.
- Điểm khớp.
- Người xác nhận.
- Thời gian xác nhận.

Bộ lọc:

- Ngày giao dịch.
- Ngân hàng.
- Tài khoản ngân hàng.
- Trạng thái đối soát.
- Số tiền.
- Nội dung chuyển khoản.
- Mã giao dịch.
- Học viên.
- Lớp học.

Chức năng:

- Xác nhận đối soát.
- Ghép thủ công.
- Chọn kết quả đề xuất.
- Bỏ qua giao dịch.
- Hoàn tác đối soát.
- Xem học phí.
- Xem thông báo học phí.
- Xem file sao kê gốc.
- Xuất kết quả đối soát.

---

# 32. Transaction xác nhận đối soát

```text
1. Khóa bank_statement_transaction.
2. Kiểm tra chưa CONFIRMED.
3. Kiểm tra payment_id chưa tồn tại.
4. Khóa tuition_fee.
5. Kiểm tra version.
6. Kiểm tra học phí chưa PAID.
7. Kiểm tra học phí chưa CANCELLED.
8. Kiểm tra học phí chưa EXEMPTED.
9. Kiểm tra credit_amount = tuition_fee.final_amount.
10. Tạo payment với payment_method = BANK_TRANSFER.
11. Cập nhật payment_status = SUCCESS.
12. Cập nhật tuition_fee.status = PAID.
13. Tạo receipt.
14. Liên kết payment_id với giao dịch sao kê.
15. Cập nhật reconciliation_status = CONFIRMED.
16. Ghi audit log.
17. Commit.
```

Nếu lỗi:

```text
Rollback toàn bộ transaction.
```

Phải có idempotency để không tạo hai payment cho cùng một dòng sao kê.

---

# 33. Phát hiện giao dịch trùng

Tạo `transaction_hash` từ:

```text
bank_account_id
bank_transaction_no
transaction_date
credit_amount
debit_amount
description
sender_account_no
```

Ví dụ:

```ts
const transactionHash = sha256(
  [
    bankAccountId,
    bankTransactionNo ?? "",
    transactionDate.toISOString(),
    creditAmount.toString(),
    debitAmount.toString(),
    normalize(description),
    senderAccountNo ?? "",
  ].join("|"),
);
```

Tạo unique constraint:

```text
bank_account_id + transaction_hash
```

Không chỉ dựa vào mã giao dịch ngân hàng.

---

# 34. Các bảng ngân hàng

## `bank_accounts`

Các cột chính:

```text
id
bank_code
bank_name
account_no
account_name
branch_name
currency_code
is_active
created_by
updated_by
created_at
updated_at
```

Ràng buộc:

```text
UNIQUE(bank_code, account_no)
```

## `bank_csv_mappings`

Các cột chính:

```text
id
bank_code
mapping_name
delimiter
encoding
header_row
data_start_row
date_format
transaction_date_column
value_date_column
transaction_no_column
description_column
sender_name_column
sender_account_column
credit_amount_column
debit_amount_column
balance_column
is_default
is_active
created_by
updated_by
created_at
updated_at
```

## `bank_statement_imports`

Các cột chính:

```text
id
bank_account_id
file_name
file_url
file_hash
encoding
delimiter
date_format
total_rows
valid_rows
invalid_rows
duplicated_rows
matched_rows
unmatched_rows
import_status
error_message
imported_by
imported_at
confirmed_by
confirmed_at
created_at
```

Ràng buộc:

```text
UNIQUE(bank_account_id, file_hash)
```

## `bank_statement_transactions`

Các cột chính:

```text
id
statement_import_id
bank_account_id
row_no
bank_transaction_no
transaction_date
value_date
description
sender_name
sender_account_no
sender_bank_code
credit_amount
debit_amount
balance_amount
currency_code
transaction_hash
reconciliation_status
match_score
match_method
matched_student_id
matched_tuition_fee_id
matched_notice_id
payment_id
error_code
error_message
confirmed_by
confirmed_at
created_at
updated_at
```

Ràng buộc:

```text
UNIQUE(bank_account_id, transaction_hash)
```

## `bank_statement_match_candidates`

Các cột chính:

```text
id
statement_transaction_id
student_id
tuition_fee_id
tuition_notice_id
match_method
match_score
matched_reference
amount_difference
is_selected
created_at
```

Phương thức ghép:

```text
NOTICE_NO
TUITION_FEE_NO
STUDENT_CODE
PAYMENT_REFERENCE
PHONE_NUMBER
STUDENT_NAME
PARENT_NAME
AMOUNT
MANUAL
```

---

# 35. Migration dữ liệu cũ

Không được xóa database cũ ngay nếu đang có dữ liệu thực tế.

Phải tạo migration plan:

```text
1. Backup database hiện tại.
2. Đánh giá chất lượng dữ liệu cũ.
3. Mapping bảng cũ sang bảng mới.
4. Mapping trạng thái cũ sang trạng thái mới.
5. Mapping payment cũ.
6. Mapping thông báo học phí cũ.
7. Mapping biên lai cũ.
8. Phát hiện dữ liệu chia kỳ.
9. Phát hiện học phí có nhiều payment thành công.
10. Báo cáo dữ liệu không tương thích với quy tắc thanh toán một lần.
11. Chạy migration thử nghiệm.
12. So sánh tổng học phí trước và sau.
13. So sánh tổng đã thu trước và sau.
14. Đối chiếu theo từng học viên.
15. Chạy migration chính thức.
16. Giữ bảng cũ ở chế độ read-only.
17. Chỉ xóa bảng cũ sau nghiệm thu.
```

## Xử lý dữ liệu cũ có nhiều lần thanh toán

Vì hệ thống mới chỉ hỗ trợ một payment thành công, không được tự động gộp dữ liệu mà không có quy tắc rõ ràng.

Phải tạo báo cáo:

```text
migration-multiple-payments-report.csv
```

Báo cáo gồm:

- Mã học phí cũ.
- Học viên.
- Tổng học phí.
- Danh sách payment.
- Tổng đã thu.
- Số lượng payment thành công.
- Đề xuất xử lý.
- Trạng thái xử lý thủ công.

Chỉ migration tự động các khoản học phí:

- Chưa thanh toán.
- Hoặc có đúng một payment thành công.
- Hoặc đã có quy tắc nghiệp vụ được phê duyệt để gộp lịch sử.

Không làm mất lịch sử thanh toán cũ.

Nếu cần giữ lịch sử nhiều payment, có thể lưu trong bảng archive hoặc migration history, nhưng application mới không được sử dụng chúng như payment nghiệp vụ hiện hành.

---

# 36. Quy tắc xóa code cũ

Sau khi implementation mới hoàn tất và test thành công:

- Xóa component cũ.
- Xóa API cũ.
- Xóa service cũ.
- Xóa DTO cũ.
- Xóa validation cũ.
- Xóa repository cũ.
- Xóa schema cũ.
- Xóa migration thử nghiệm không còn dùng.
- Xóa test cũ không còn hợp lệ.
- Xóa permission cũ.
- Xóa menu cũ.
- Xóa route cũ.
- Xóa tài liệu cũ.
- Xóa environment variable không còn dùng.
- Xóa dependency không còn dùng.
- Xóa toàn bộ logic chia kỳ.
- Xóa toàn bộ logic thanh toán một phần.
- Xóa toàn bộ logic payment allocation.
- Xóa toàn bộ UI nhập số tiền tùy ý.

Không để code cũ dưới dạng comment.

Không tạo thư mục:

```text
old
legacy
backup
temp
new-version
v2
```

trong source code chính.

Lịch sử code đã có Git quản lý.

---

# 37. Yêu cầu frontend

Frontend mới phải:

- Dùng component chung nếu phù hợp.
- Không sao chép logic tính tiền.
- Dùng validation schema thống nhất.
- Có unsaved changes guard.
- Có loading state.
- Có empty state.
- Có error state.
- Có permission guard.
- Có confirmation trước thao tác tài chính.
- Chống double submit.
- Không optimistic update cho thao tác tài chính.
- Hiển thị lỗi backend theo field và business error.
- Hỗ trợ pagination.
- Hỗ trợ stable sorting.
- Hỗ trợ filter.
- Export toàn bộ kết quả, không chỉ trang hiện tại.
- Hiển thị tiền theo VND.
- Không dùng floating-point để tính tiền.
- Không hiển thị chức năng thanh toán một phần.
- Không cho sửa số tiền thanh toán khác `final_amount`.

Các màn hình cần viết lại:

```text
Tuition List
Tuition Detail
Tuition Create
Tuition Adjustment
Payment Create
Payment Detail
Payment Attempt History
Tuition Notice Preview
Tuition Notice History
Receipt Preview
Refund Create
Bank Account List
CSV Mapping
Statement Import
Statement Import Preview
Reconciliation List
Reconciliation Detail
Manual Match
```

---

# 38. Yêu cầu backend

Backend mới phải:

- Tách domain rõ ràng.
- Controller không chứa business logic.
- Repository không quyết định business rule.
- Có application service hoặc use case.
- Có transaction boundary rõ ràng.
- Có domain validation.
- Có permission check.
- Có tenant isolation.
- Có idempotency.
- Có optimistic lock hoặc row lock.
- Có audit log.
- Có error code ổn định.
- Có API contract rõ ràng.
- Có pagination và stable secondary sort.
- Có export query riêng.
- Có file validation.
- Có CSV injection prevention.
- Có hash chống file và giao dịch trùng.
- Có partial unique index chống payment thành công trùng.
- Không tạo hoặc sử dụng payment allocation.

---

# 39. API mới

Không cần giữ backward compatibility với API cũ, trừ khi có consumer bên ngoài đã được xác nhận.

API đề xuất:

```text
/api/tuition-fees
/api/payments
/api/payment-refunds
/api/tuition-notices
/api/receipts
/api/bank-accounts
/api/bank-statement-imports
/api/bank-statement-transactions
/api/bank-reconciliations
```

API thanh toán không nhận danh sách allocation.

Request xác nhận thanh toán chỉ cần:

```json
{
  "tuitionFeeId": "uuid",
  "paymentMethod": "CASH",
  "paymentDate": "2026-08-02T10:00:00+07:00",
  "payerName": "Nguyễn Văn A",
  "note": null,
  "idempotencyKey": "unique-key"
}
```

Backend lấy `final_amount` từ `tuition_fees`.

Nếu request có trường `amount`, backend vẫn phải kiểm tra chính xác bằng `final_amount`.

---

# 40. Phân quyền

```text
TUITION_VIEW
TUITION_CREATE
TUITION_UPDATE
TUITION_ADJUST
TUITION_EXEMPT
TUITION_CANCEL
TUITION_EXPORT

PAYMENT_VIEW
PAYMENT_CREATE
PAYMENT_CONFIRM
PAYMENT_CANCEL
PAYMENT_REFUND

TUITION_NOTICE_VIEW
TUITION_NOTICE_ISSUE
TUITION_NOTICE_PRINT
TUITION_NOTICE_SEND
TUITION_NOTICE_CANCEL

RECEIPT_VIEW
RECEIPT_ISSUE
RECEIPT_PRINT
RECEIPT_SEND
RECEIPT_CANCEL

BANK_ACCOUNT_MANAGE
BANK_CSV_MAPPING_MANAGE
BANK_STATEMENT_IMPORT
BANK_STATEMENT_VIEW
BANK_STATEMENT_RECONCILE
BANK_STATEMENT_CONFIRM
BANK_STATEMENT_IGNORE
BANK_STATEMENT_REVERSE
```

Người được quyền import sao kê không mặc định có quyền xác nhận payment.

---

# 41. Audit log

Lưu audit log cho:

- Tạo học phí.
- Sửa học phí.
- Điều chỉnh học phí.
- Miễn học phí.
- Hủy học phí.
- Tạo payment.
- Xác nhận payment.
- Hủy lần thử payment.
- Hoàn tiền.
- Phát hành thông báo.
- Hủy thông báo.
- Gửi email, SMS hoặc Zalo.
- Phát hành biên lai.
- Hủy biên lai.
- Import sao kê.
- Thay đổi mapping CSV.
- Ghép thủ công.
- Xác nhận đối soát.
- Bỏ qua giao dịch.
- Hoàn tác đối soát.

Audit log phải lưu:

```text
entity_type
entity_id
action
data_before
data_after
reason
performed_by
performed_at
ip_address
user_agent
```

---

# 42. Validation bắt buộc

- Số tiền học phí không âm.
- Số tiền payment lớn hơn 0.
- Payment amount phải bằng `final_amount`.
- Không thanh toán học phí đã `PAID`.
- Không thanh toán học phí đã `CANCELLED`.
- Không thanh toán học phí đã `EXEMPTED`.
- Không xác nhận cùng payment hai lần.
- Không tồn tại hai payment `SUCCESS`.
- Không sửa chứng từ đã phát hành.
- Không hoàn tiền vượt số tiền đã thanh toán.
- Không xác nhận sao kê có số tiền không khớp.
- Không import file trùng.
- Không import giao dịch trùng.
- Kiểm tra optimistic locking.
- Kiểm tra tenant isolation.
- File CSV đúng định dạng và dung lượng.
- Chặn CSV injection khi xuất dữ liệu.
- Chuẩn hóa nội dung chuyển khoản.
- Kiểm tra hash giao dịch.
- Chống double submit.
- Chống concurrent confirmation.

---

# 43. Test bắt buộc

## Unit test

- Tính học phí.
- Tính giảm giá.
- Tính phụ phí.
- Tính `final_amount`.
- Cập nhật trạng thái `UNPAID`.
- Cập nhật trạng thái `OVERDUE`.
- Cập nhật trạng thái `PAID`.
- Từ chối thanh toán thiếu.
- Từ chối thanh toán thừa.
- Từ chối payment thành công thứ hai.
- Điều chỉnh học phí.
- Miễn học phí.
- Hủy học phí.
- Hoàn tiền.
- Ghép giao dịch sao kê.
- Phát hiện giao dịch trùng.
- Tính match score.

## Integration test

- Tạo học phí.
- Thanh toán tiền mặt.
- Thanh toán chuyển khoản.
- Thanh toán VietQR.
- Từ chối amount mismatch.
- Từ chối thanh toán trùng.
- Sinh biên lai.
- Phát hành thông báo.
- Hoàn tiền.
- Import CSV.
- Đối soát tự động.
- Ghép thủ công.
- Transaction rollback.
- Concurrent payment.
- Concurrent reconciliation.
- Tenant isolation.
- Permission.

## E2E test

- Luồng học phí đầy đủ.
- Luồng thanh toán tiền mặt một lần.
- Luồng VietQR.
- Luồng import CSV.
- Luồng tự động đối soát.
- Luồng ghép thủ công.
- Luồng sai số tiền.
- Luồng hoàn tiền.
- Luồng phát hành lại thông báo.
- Luồng in biên lai.
- Luồng gửi thông báo học phí.

---

# 44. Index đề xuất

```text
tuition_fees(student_id)
tuition_fees(class_id)
tuition_fees(status)
tuition_fees(due_date)
tuition_fees(student_id, status)

payments(student_id)
payments(tuition_fee_id)
payments(payment_status)
payments(payment_date)
payments(transaction_reference)

tuition_notices(tuition_fee_id)
tuition_notices(status)
tuition_notices(issued_at)

bank_statement_imports(bank_account_id)
bank_statement_imports(import_status)

bank_statement_transactions(transaction_date)
bank_statement_transactions(reconciliation_status)
bank_statement_transactions(bank_transaction_no)
bank_statement_transactions(matched_student_id)
bank_statement_transactions(matched_tuition_fee_id)
bank_statement_transactions(payment_id)
```

Bắt buộc có:

```sql
CREATE UNIQUE INDEX uq_success_payment_per_tuition_fee
ON payments(tuition_fee_id)
WHERE payment_status = 'SUCCESS';
```

---

# 45. Definition of Done

Module chỉ hoàn tất khi:

- Code mới build thành công.
- Lint không lỗi.
- Type check không lỗi.
- Unit test thành công.
- Integration test thành công.
- E2E test quan trọng thành công.
- Migration chạy thành công.
- Migration recovery plan đã được kiểm chứng.
- Tổng học phí trước và sau migration khớp.
- Tổng tiền đã thu trước và sau migration được giải trình.
- Dữ liệu nhiều payment cũ được báo cáo và xử lý.
- Không còn route cũ.
- Không còn menu cũ.
- Không còn API cũ.
- Không còn bảng cũ được application sử dụng.
- Không còn dead code.
- Không còn tài liệu cũ chưa đánh dấu deprecated.
- Không còn code chia kỳ.
- Không còn code thanh toán một phần.
- Không còn `payment_allocations`.
- Không còn `student_credit_balances`.
- Permission mới hoạt động.
- Tenant isolation được kiểm chứng.
- Export không chỉ xuất trang hiện tại.
- Transaction rollback đúng.
- Không tạo payment thành công trùng.
- Không import sao kê trùng.
- PDF thông báo học phí hoạt động.
- PDF biên lai hoạt động.
- Audit log đầy đủ.
- Tài liệu mới phản ánh đúng implementation.

---

# 46. Cách tổ chức triển khai

Thực hiện theo phase:

```text
Phase 1: Current-state analysis
Phase 2: New domain and documentation
Phase 3: New database schema
Phase 4: Data migration analysis
Phase 5: Backend implementation
Phase 6: Frontend implementation
Phase 7: CSV import and reconciliation
Phase 8: PDF and notification
Phase 9: Tests
Phase 10: Remove legacy code
Phase 11: Final verification
```

Tạo commit riêng cho từng nhóm thay đổi.

Không trộn tất cả các thay đổi vào một commit lớn.

---

# 47. Kết quả đầu ra cần cung cấp

Trước khi sửa code, phải trả về:

1. Phân tích project hiện tại.
2. Danh sách file sẽ xóa.
3. Danh sách file sẽ giữ.
4. Danh sách file sẽ tạo mới.
5. Danh sách bảng sẽ xóa hoặc ngừng sử dụng.
6. Database schema mới.
7. Kế hoạch migration dữ liệu.
8. Báo cáo dữ liệu cũ có nhiều payment.
9. Kế hoạch triển khai theo phase.
10. Rủi ro.
11. Tiêu chí nghiệm thu.

Trong quá trình triển khai, sau mỗi phase phải cập nhật:

- File đã tạo.
- File đã sửa.
- File đã xóa.
- Migration đã thêm.
- Test đã thêm.
- Test đã chạy.
- Lỗi còn tồn tại.
- Rủi ro chưa giải quyết.

Cuối cùng tạo:

```text
docs/refactor/final-refactor-report.md
```

Báo cáo cuối phải xác nhận:

- Implementation cũ đã bị loại bỏ.
- Logic chia kỳ đã bị loại bỏ.
- Logic thanh toán một phần đã bị loại bỏ.
- Các bảng cũ không còn được sử dụng.
- Dữ liệu đã được migration.
- Các trường hợp nhiều payment cũ đã được xử lý.
- Tổng học phí trước và sau migration.
- Tổng tiền đã thu trước và sau migration.
- Các test đã chạy.
- Các chức năng đã hoàn tất.
- Các vấn đề còn tồn tại.
- Hướng dẫn deploy.
- Hướng dẫn rollback.

---

# 48. Yêu cầu thực thi cuối cùng

Hãy sử dụng tài liệu này làm đặc tả nguồn duy nhất để rewrite toàn bộ module học phí và thanh toán trong project hiện tại.

Không sửa chắp vá code cũ.

Không giữ backward compatibility với nghiệp vụ cũ nếu không có yêu cầu rõ ràng.

Không triển khai chia kỳ thanh toán.

Không triển khai thanh toán một phần.

Không triển khai nhiều payment thành công cho một học phí.

Không triển khai payment allocation.

Mọi khoản học phí phải được thanh toán toàn bộ trong đúng một giao dịch thành công.
# Tài liệu lịch sử - không còn là đặc tả triển khai

Tài liệu này lưu prompt/đặc tả cũ để tham khảo. Các đoạn mô tả tạo học phí thủ công, notice, refund hoặc module đã cleanup không áp dụng cho code hiện hành. Xem [11-current-system.md](./11-current-system.md) và các tài liệu business rules mới.
