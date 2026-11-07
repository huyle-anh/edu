# Tài liệu nghiệp vụ hệ thống quản lý trung tâm đào tạo

Version: 3.0
Status: Draft
Updated: 2026-06-19

---

# 1. Tổng quan hệ thống

Hệ thống phục vụ quản lý vận hành trung tâm đào tạo.

Các module chính:

- Quản lý người dùng
- Quản lý giáo viên
- Quản lý học viên
- Quản lý lớp học
- Đăng ký học viên
- Quản lý lịch học
- Quản lý học phí
- Tạo yêu cầu thanh toán
- Sinh VietQR thanh toán
- Sinh phiếu báo học phí
- Import sao kê ngân hàng
- Đối soát giao dịch
- Quản lý thanh toán
- Quản lý biên lai
- Báo cáo thu học phí theo lớp và môn học
- Báo cáo thu học phí theo từng ngày
- Audit log hệ thống

Luồng tổng quát:

```text
Student
    ↓
Enroll Class
    ↓
Generate Tuition Fee
    ↓
Create Payment Request
    ↓
Generate VietQR
    ↓
Generate Payment Notice
    ↓
Send Parent Notice
    ↓
Parent Payment
    ↓
Import Bank Statement
    ↓
Auto Reconciliation
    ↓
Create Payment
    ↓
Generate Receipt
```

---

# 2. Quản lý tài khoản người dùng

Mục đích:

Quản lý tài khoản đăng nhập hệ thống.

Bảng:

```text
users
```

Field:

```text
id
email
password_hash
full_name
is_active
created_at
updated_at
```

Rule:

```text
email unique
1 email = 1 account
inactive account cannot login
```

---

# 3. Quản lý giáo viên

Mục đích:

Quản lý hồ sơ giáo viên.

Bảng:

```text
teachers
```

Field:

```text
id
code
full_name
phone
bank_account
specialty
commission_percent
status
```

Status:

```text
ACTIVE
INACTIVE
```

Rule:

```text
teacher.code unique
teacher có thể liên kết tối đa một tài khoản user; tài khoản do quản trị viên tạo
email đăng nhập thuộc user
commission_percent nằm trong khoảng 0..100
commission_percent dùng cho báo cáo thu học phí theo lớp/môn
```

---

# 4. Quản lý học viên

Bảng:

```text
students
```

Field:

```text
id
code
full_name
phone
birthday
parent_name
address
status
```

Status:

```text
ACTIVE
INACTIVE
```

Rule:

```text
student.code unique
học viên không sử dụng email
```

---

# 5. Quản lý lớp học

Bảng:

```text
classes
class_subjects
```

Field:

```text
id
code
name
start_date
end_date
status

class_subjects:
class_id
subject_id
teacher_id nullable
tuition_fee
total_sessions
max_students nullable
status
```

Status:

```text
DRAFT
ACTIVE
COMPLETED
CANCELLED
```

Rule:

```text
class.code unique, chỉ gồm ký tự chữ cái ASCII (A-Z/a-z), chữ số (0-9) và dấu gạch ngang (-)
Sĩ số được giới hạn riêng theo từng class_subject
active_subject_enrollment_count <= class_subject.max_students
Chỉ được đăng ký học viên/thay đổi enrollment và tạo học phí khi class.status = ACTIVE
Lớp DRAFT chỉ dùng để chuẩn bị cấu hình; lớp COMPLETED/CANCELLED chỉ được xem
Không cho xóa nếu đã phát sinh học phí
```

---

# 6. Đăng ký học viên vào lớp

Bảng:

```text
class_students
```

Field:

```text
class_id
student_id
enrolled_at
status
```

Status:

```text
ACTIVE
LEFT
COMPLETED
SUSPENDED
```

Rule:

```text
(class_id,student_id) unique

Không vượt max_students của từng môn được chọn
```

---

# 7. Quản lý lịch học

Bảng:

```text
class_schedules
```

Field:

```text
id
class_id
teacher_id
class_subject_id
day_of_week
start_minute
end_minute
```

Rule:

```text
day_of_week = 0..6 (Chủ nhật..Thứ bảy)

start_time < end_time

Không trùng giáo viên
```

---

# 7.1 Điểm danh

- Giáo viên chọn lớp/môn mình phụ trách và tạo phiên điểm danh độc lập với
  lịch học; một lớp có thể có nhiều phiên trong cùng ngày.
- Phiên chỉ được tạo khi lưu danh sách; hệ thống ghi thời điểm hiện tại từ máy
  chủ, không nhận thời gian do trình duyệt gửi.
- Tài khoản giáo viên chỉ truy cập phiên thuộc lớp/môn đang được phân công.
- Danh sách gồm enrollment/môn có hiệu lực tại ngày Việt Nam của thời điểm tạo;
  học viên tạm nghỉ trong tháng đó không xuất hiện. Khi sửa phiên, học viên đã
  được lưu trong phiên vẫn được giữ lại.
- Checkbox chọn là có mặt; bỏ chọn là vắng. Ghi chú vắng tùy chọn.
- Giáo viên được sửa không giới hạn; hệ thống lưu lịch sử thay đổi.

# 8. Quản lý học phí

Bảng:

```text
tuition_fees
```

Field:

```text
id
student_id
class_id
billing_year
billing_month
enrollment_id
original_amount
discount_amount
additional_amount
final_amount
due_date
status
note
created_at
updated_at
```

Status:

```text
UNPAID
PAID
OVERDUE
EXEMPTED
CANCELLED
```

Rule:

```text
(student_id,class_id,billing_year,billing_month) unique cho học phí MONTHLY

final_amount = amount - discount

Một học phí có thể có nhiều payment SUCCESS.

Tổng payment SUCCESS không được vượt `final_amount`.

Thanh toán thiếu được phép và làm học phí chuyển sang `PARTIAL`; thanh toán đủ
chuyển sang `PAID`. Không cho thanh toán vượt số tiền còn nợ.
```

Học phí theo tháng được tính trọn tháng theo từng môn:

```text
phí môn = phí tháng chuẩn
```

Enrollment có khoảng tạm nghỉ bao phủ tháng không phát sinh học phí; enrollment còn `ACTIVE` phát sinh đủ phí tháng dù học viên vắng hoặc đăng ký giữa tháng. Ngày đăng ký không giới hạn kỳ được tạo học phí; kỳ được chọn chỉ cần nằm trong thời gian của lớp.

---

# 9. Payment batch

Thanh toán bắt đầu từ một hoặc nhiều khoản học phí của cùng một học viên.
Các khoản được gom vào một `payment_batch`; mỗi allocation phải lớn hơn 0 và
không vượt số tiền còn nợ của khoản học phí tương ứng.

Các bảng hiện hành:

```text
payment_batches
payment_allocations
tuition_payments
tuition_receipts
payment_batch_receipts
```

Phương thức duy nhất:

```text
CASH
BANK_TRANSFER
```

Rule:

```text
Cho phép thanh toán từng phần nhiều lần.
Tổng các payment SUCCESS của một tuition fee không được vượt `final_amount`.
Payment SUCCESS phải có amount bằng số tiền đã nhận của lần thanh toán đó.
CASH hoàn tất ngay trong transaction.
BANK_TRANSFER tạo batch PENDING và chỉ hoàn tất sau đối soát.
```

---

# 10. QR thanh toán động

QR được sinh động từ payment batch và tài khoản ngân hàng đang hoạt động:

```text
AMOUNT = payment_batch.total_amount
CONTENT = payment_batch.batch_no
```

Không tạo bảng hoặc lưu lịch sử QR. QR chỉ có hiệu lực khi batch còn `PENDING`,
phương thức là `BANK_TRANSFER` và batch đã gắn tài khoản nhận tiền.

---

# 11. Thông báo và biên lai

PDF thông báo học phí và biên lai được sinh động từ dữ liệu hiện tại/snapshot
của payment batch. Không có luồng gửi email/SMS tự động trong phiên bản này.

Rule:

```text
Batch SUCCESS sinh payment, receipt theo từng tuition fee và receipt tổng hợp.
Receipt đã phát hành không bị xóa; nếu hủy phải có lý do và audit log.
Receipt CANCELLED không được xuất lại PDF. Nếu receipt thuộc payment batch đã
thành công, thao tác hủy sẽ hoàn tác toàn bộ batch atomically: hủy các payment
và receipt liên quan, mở lại học phí về `UNPAID`/`OVERDUE`, chuyển batch sang
`CANCELLED` và ghi audit log.
```

---

# 12. Import và đối soát sao kê ngân hàng

Mỗi lần import tạo một phiên sao kê và lưu lịch sử các dòng sao kê, trạng thái
phân tích, file nguồn, khoảng ngày, số dư và mapping đợt thanh toán. Token trong
phiên vẫn chỉ có thời hạn ngắn để xác nhận an toàn; lịch sử đã lưu được dùng để
tra cứu và xuất báo cáo theo ngày. Chỉ giao dịch ghi có mới được đối soát.

Luồng:

```text
Import sao kê
      ↓
Tìm batch PENDING cùng tài khoản ngân hàng và đúng số tiền
      ↓
Ưu tiên batch_no trong nội dung giao dịch
      ↓
Nếu không có batch_no: người dùng chọn một candidate cùng số tiền
      ↓
Backend xác thực token, tài khoản, phương thức, trạng thái và số tiền
      ↓
Hoàn tất payment batch atomically
```

Không đối soát được batch `CASH`, batch khác tài khoản, batch không `PENDING`
hoặc giao dịch có số tiền không khớp tuyệt đối.

---

# 13. Audit log

Bảng:

```text
audit_logs
```

Field:

```text
id
entity_type
entity_id
action
old_data
new_data
created_by
created_at
```

Ví dụ:

```text
PAYMENT_CREATED

PAYMENT_CONFIRMED

RECEIPT_PRINTED

FEE_CANCELLED
```

---

# 14. Luồng phát sinh học phí hiện hành

```text
1. Backend kiểm tra lớp đang ở trạng thái `ACTIVE`.
2. Nhân viên chọn học viên và các môn muốn đăng ký trong lớp.
3. Backend kiểm tra học viên chưa đăng ký các môn đó.
4. Tạo enrollment subject cho từng môn hợp lệ.
5. Hoàn tất đăng ký; chưa tạo học phí ở bước này.
6. Nhân viên chọn `Tạo học phí tháng` cho lớp; thao tác này chỉ tạo tuition fee và tuition fee item.
7. Nhân viên mở màn hình `Thông báo & đợt thu`, lọc theo kỳ/lớp và chọn các khoản còn nợ đã tạo.
8. Khi phát hành, backend tự gom các khoản đã chọn theo học viên, tạo batch `BANK_TRANSFER` `PENDING` và PDF gộp; không tự tạo học phí ở bước này.
9. Trường hợp thu trực tiếp, người dùng mở chi tiết học phí hoặc màn hình thu học phí để chọn `CASH` hoặc `BANK_TRANSFER`.

Không tạo học phí độc lập ngoài enrollment; mọi khoản học phí phải truy được về lớp, học viên và môn học. Đăng ký và tạo học phí là hai thao tác độc lập.
```

---

# 15. Luồng thanh toán

```text
Parent chuyển khoản QR

hoặc

Staff thu tiền mặt
```

---

# 16. Luồng xác nhận thanh toán

```text
1. Import bank statement
2. Tìm payment batch BANK_TRANSFER đang PENDING, cùng tài khoản và đúng số tiền
3. Ưu tiên match batch_no trong nội dung giao dịch
4. Nếu không có batch_no, nhân viên chọn batch hợp lệ cùng số tiền
5. Backend xác thực token và hoàn tất batch trong một transaction
6. Tạo tuition payment SUCCESS, cập nhật tuition fee PAID
7. Sinh receipt theo khoản và receipt tổng hợp
8. In hoặc xuất chứng từ
```

---

# 17. Hoàn tiền

Hệ thống chỉ hoàn toàn bộ số tiền của payment, không hỗ trợ hoàn một phần.

Nếu payment thuộc một payment batch, yêu cầu hoàn áp dụng cho toàn bộ các
payment `SUCCESS` trong batch đó; không được hoàn riêng một khoản.

Luồng trạng thái được hỗ trợ:

```text
PENDING -> APPROVED -> COMPLETED
```

Quy tắc:

```text
Chỉ payment SUCCESS thuộc batch SUCCESS mới được tạo yêu cầu hoàn
Mỗi payment/batch chỉ có một nhóm yêu cầu hoàn đang hoạt động
Lý do hoàn tiền là bắt buộc
Phương thức hoàn chỉ gồm CASH và BANK_TRANSFER
Hoàn BANK_TRANSFER bắt buộc có bank_transaction_no
Hoàn CASH không được có bank_transaction_no
```

Khi hoàn tất, toàn bộ thao tác chạy trong một transaction:

```text
Payment -> REFUNDED
Receipt theo từng payment -> CANCELLED
Tuition fee -> UNPAID hoặc OVERDUE theo due_date
Payment batch -> CANCELLED
Receipt tổng không còn được phép xuất PDF
Ghi audit log cho refund, payment, fee, receipt và batch
```

Mọi user đã đăng nhập dùng chung quyền tạo, duyệt và hoàn tất yêu cầu hoàn tiền
theo mô hình truy cập hiện hành.

---
