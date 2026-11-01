# Business Rules - Hệ thống quản lý trung tâm đào tạo

Version: 1.0
Priority: HIGH
Mục đích: Đây là tập luật nghiệp vụ bắt buộc hệ thống phải tuân theo.

Nếu business-requirements.md và file này mâu thuẫn, ưu tiên file này.

---

# 1. Quy tắc chung

1. Không được xóa dữ liệu đã phát sinh giao dịch tài chính.
2. Không được hard delete, ưu tiên soft delete.
3. Không được bypass validation ở frontend hoặc backend.
4. Backend luôn là nơi xác thực nghiệp vụ cuối cùng.
5. UI chỉ hỗ trợ thao tác, không quyết định nghiệp vụ.
6. Mọi thao tác tài chính phải có audit log.

---

# 2. User Rules

## 2.1 Email

Rule:

```text
Mỗi email chỉ tồn tại một lần trong bảng users
```

Không cho phép:

```text
admin@test.com
admin@test.com
```

Constraint:

```text
users.email UNIQUE
```

---

## 2.2 Login

Rule:

```text
Nếu is_active = false thì không được đăng nhập
```

Backend bắt buộc check.

---

## 2.3 Access

User không liên kết hồ sơ giáo viên dùng quyền chung cho các module quản trị.
User liên kết giáo viên chỉ được truy cập module điểm danh và chỉ với lớp/môn
được phân công. Hệ thống không tạo hoặc gán role; backend xác định phạm vi qua
liên kết `User.teacherId`.

---

# 3. Teacher Rules

## 3.1 Teacher Code

Rule:

```text
teacher.code phải unique
```

Ví dụ:

```text
GV001
GV002
```

Không cho phép:

```text
GV001
GV001
```

---

## 3.2 Teacher Profile

Teacher là hồ sơ nghiệp vụ độc lập có thể liên kết tối đa một tài khoản User:

```text
Liên kết tài khoản chỉ phục vụ đăng nhập và phân giới hạn điểm danh
Email đăng nhập thuộc User
```

Thông tin sử dụng:

```text
full_name
phone
bank_account
specialty
commission_percent
```

---

## 3.3 Teacher Commission

Rule:

```text
0 <= commission_percent <= 100
```

Tỷ lệ này chỉ dùng trong báo cáo thu học phí theo lớp và môn học để tính phần
doanh thu còn lại sau tỷ lệ trích. Hệ thống không tạo kỳ lương, phiếu lương hoặc
bảng lương giáo viên.

---

## 3.4 Teacher Delete

Không hard delete teacher. Thao tác xóa trên UI chỉ chuyển teacher sang
`INACTIVE` và lưu `deleted_at` để bảo toàn lịch sử. Teacher đang được gán cho
lớp không bị xóa khỏi dữ liệu; không được dùng teacher `INACTIVE` cho lịch hoặc
phân công mới.

---

# 4. Student Rules

## 4.1 Student Code

Rule:

```text
student.code UNIQUE
```

---

## 4.2 Student Contact

Rule:

```text
Học viên không sử dụng email
Thông tin liên hệ gồm số điện thoại và thông tin phụ huynh
```

---

## 4.3 Student Delete

Không hard delete student. Thao tác xóa trên UI chỉ chuyển student sang
`INACTIVE` và lưu `deleted_at` để bảo toàn enrollment, học phí, payment và
receipt. Student `INACTIVE` không được đăng ký mới vào lớp.

---

# 5. Class Rules

## 5.1 Class Code

Rule:

```text
class.code UNIQUE, chỉ gồm ký tự chữ cái ASCII (A-Z/a-z), chữ số (0-9) và dấu gạch ngang (-)
```

---

## 5.2 Subject Capacity

Rule:

```text
active_enrollment_subject_count <= class_subject.max_students
```

Giới hạn được áp dụng riêng cho từng môn trong lớp. `max_students = null` nghĩa
là môn không giới hạn sĩ số. Không cho đăng ký môn nếu môn đó đã đủ giới hạn.

Ví dụ:

```text
class_subject.max_students = 20

đã có 20

=> không cho thêm học viên thứ 21
```

---

## 5.3 Class Delete

Không cho xóa nếu đã phát sinh:

```text
student fee
payment
receipt
```

Với lớp chưa có dữ liệu liên quan, thao tác xóa chỉ chuyển lớp sang `CANCELLED`
và lưu `deleted_at`; không hard delete bản ghi lớp.

---

## 5.4 Class Status

Status hợp lệ:

```text
DRAFT
ACTIVE
COMPLETED
CANCELLED
```

Lớp `DRAFT` và `ACTIVE` được đăng ký học viên. Lớp `DRAFT` chỉ cho phép chuẩn
bị danh sách học viên; thay đổi enrollment sau đăng ký và tạo học phí chỉ thực
hiện khi lớp `ACTIVE`. Lớp `COMPLETED` và `CANCELLED` chỉ được xem. Các API
nghiệp vụ phải kiểm tra điều kiện này ở backend.

Không cho:

```text
DRAFT -> COMPLETED trực tiếp nếu chưa ACTIVE
```

Flow hợp lệ:

```text
DRAFT
→ ACTIVE
→ COMPLETED
```

Khi lớp chuyển từ `ACTIVE` sang `COMPLETED`, trong cùng transaction hệ thống
phải chuyển toàn bộ enrollment `ACTIVE` của lớp và các môn `ACTIVE` tương ứng
sang `COMPLETED`, đồng thời ghi audit log cho từng enrollment. Enrollment và môn
đã hoàn thành chỉ được xem, không được đăng ký lại, bỏ môn, rời lớp hoặc tạm nghỉ.

Hoặc:

```text
DRAFT
→ CANCELLED
```

Lớp `CANCELLED` có thể được khôi phục duy nhất về `ACTIVE`. Khi khôi phục,
hệ thống phải xóa cờ `deleted_at` nếu có và ghi audit log `CLASS_RESTORED`.
Lớp `COMPLETED` không thể khôi phục. Sau khi khôi phục, các nghiệp vụ học
viên, lịch học và tạo học phí được áp dụng lại theo các rule hiện hành.

Khi lớp chuyển sang `CANCELLED`, trong cùng transaction hệ thống hủy các khoản
học phí `UNPAID` hoặc `OVERDUE` chưa có bản ghi thanh toán và không thuộc đợt
thu `PENDING`. Mỗi khoản bị hủy lưu lý do và audit log. Khoản đã thu một phần,
có lịch sử thanh toán hoặc đang thuộc đợt thu `PENDING` được giữ nguyên để xử
lý riêng; không tự động xóa hay hoàn tiền.

Các lớp đã ở trạng thái `CANCELLED` trước khi áp dụng quy tắc này được rà soát
bằng công cụ hồi tố ở chế độ xem trước. Chỉ chạy cập nhật sau khi đã kiểm tra
danh sách lớp và chỉ định rõ lớp cần áp dụng. Công cụ chỉ hủy các khoản
`UNPAID` hoặc `OVERDUE` không có bản ghi thanh toán và không thuộc đợt thu
`PENDING`; mọi khoản khác được giữ nguyên và có thể rà soát riêng.

---

# 6. Enrollment Rules

## 6.1 Duplicate Enrollment

Không cho:

```text
1 student đăng ký 2 lần cùng 1 lớp
```

Unique:

```text
(student_id,class_id)
```

---

## 6.2 Enrollment Capacity

Trước khi đăng ký từng môn phải check:

```text
active_enrollment_subject_count < class_subject.max_students
```

---

## 6.3 Enrollment Remove

Không cho remove học viên nếu:

```text
Đã phát sinh student_fee
```

Trừ khi người dùng đã đăng nhập gửi `force = true` và nhập lý do.

Với bỏ một môn:

```text
Nếu môn đã có học phí:
    chỉ cho force cancel có lý do
    khoản học phí đã phát sinh vẫn được giữ nguyên
    các kỳ sau không tạo thêm phí cho môn đó
```

Không được dùng thao tác bỏ môn cho môn `ACTIVE` cuối cùng. Khi học viên không
còn học môn nào, phải dùng thao tác rời lớp để enrollment chuyển sang `LEFT`.

Remove enrollment không hard-delete bản ghi. Hệ thống đánh dấu enrollment `LEFT` và các môn `DROPPED`; chỉ enrollment `LEFT` mới có thể được kích hoạt lại khi đăng ký lại môn phù hợp. Enrollment `COMPLETED` hoặc `SUSPENDED` không được tự động mở lại.

Khi kích hoạt lại enrollment `LEFT`, giữ nguyên `enrolled_at` để bảo toàn lịch
sử và đặt `current_period_start` thành ngày tái đăng ký. `current_period_start`
chỉ lưu mốc của giai đoạn hiện tại, không giới hạn kỳ được tạo học phí. Các
khoảng nghỉ chưa kết thúc từ giai đoạn cũ được hủy để không ảnh hưởng giai đoạn
mới.

Khoảng tạm nghỉ có thể được sửa hoặc hủy. Hủy chỉ chuyển trạng thái sang
`CANCELLED`, không hard-delete, để bảo toàn lịch sử. Khi sửa vẫn phải kiểm tra không chồng
lấn khoảng nghỉ khác và không phủ tháng đã phát sinh học phí. Mọi thao tác tạo,
sửa, hủy khoảng nghỉ phải ghi audit log. Chỉ khoảng nghỉ `ACTIVE` mới chặn tạo
học phí.

Khoảng tạm nghỉ không được nằm ngoài tháng bắt đầu/kết thúc của lớp.

## 6.4 Enrollment và Student Fee độc lập

Đăng ký học viên vào lớp hoặc môn học không tự động tạo `student_fee`.

Học phí chỉ được tạo bởi thao tác riêng sau khi enrollment đã tồn tại. Một thao tác tạo học phí phải:

```text
Chỉ lấy các môn đang ACTIVE của enrollment
Không tạo trùng tuition_fee_item cho cùng môn
Ghi audit log
Thực hiện trong transaction
```

Nếu học viên đăng ký thêm môn sau khi đã tạo học phí nhưng kỳ đó chưa có payment
`SUCCESS` hoặc payment batch `PENDING`, thao tác tạo học phí lần tiếp theo chỉ tạo
phí cho các môn mới chưa được lập phí. Sau khi đã phát sinh thanh toán thành công,
thành phần item của kỳ được khóa để bảo toàn phân bổ báo cáo và snapshot chứng từ.

## 6.5 Báo cáo thu học phí theo ngày

Báo cáo ngày chỉ tính các payment học phí có trạng thái `SUCCESS` trong ngày
được chọn theo múi giờ Việt Nam. Báo cáo phải phân biệt tổng tiền mặt và tổng
chuyển khoản, đồng thời có chi tiết từng payment để đối soát. Hệ thống không tự
suy diễn chi phí hoặc số tiền nộp quỹ khi chưa có nghiệp vụ tương ứng.

---

# 7. Schedule Rules

`day_of_week` dùng miền `0..6`, trong đó `0` là Chủ nhật và `6` là Thứ bảy.

## 7.1 Time Validation

Rule:

```text
start_time < end_time
```

Không cho:

```text
18:00 → 18:00
20:00 → 18:00
```

---

## 7.2 Teacher Conflict

Không cho giáo viên dạy trùng giờ.

Ví dụ:

```text
Teacher GV001

Monday 18:00 - 20:00
```

Không cho tạo:

```text
Monday 19:00 - 21:00
```

---

# 8. Student Fee Rules

## 8.1 Duplicate Monthly Fee

Không cho tạo trùng:

```text
(student_id,class_id,month)
```

Ví dụ:

```text
ST001

ENG001

2026-06
```

Chỉ được tồn tại một lần.

---

## 8.2 Amount Validation

Rule:

```text
amount > 0
```

Không cho:

```text
0
âm
```

---

## 8.3 Discount Validation

Rule:

```text
discount >= 0
discount <= amount
```

Không cho:

```text
amount = 1000000

discount = 1200000
```

---

## 8.4 Actual Amount

Công thức:

```text
actual_amount = amount - discount
```

Không cho lưu:

```text
actual_amount < 0
```

## 8.5 Student Fee Generation

Không tự động tạo học phí khi enrollment được tạo hoặc đăng ký thêm môn.

Học phí được tạo qua thao tác riêng và phải tham chiếu đến enrollment hiện có. Enrollment không có học phí vẫn là enrollment hợp lệ.

## 8.6 Monthly Full-Month Tuition

Mức `ClassSubject.tuitionFee` là học phí chuẩn của một tháng. Khi tạo phí tháng, backend tính trọn mức phí cho từng môn đang đăng ký; không chia theo số buổi, số ngày hoặc ngày đăng ký.

```text
phí môn = phí tháng chuẩn
```

Quy tắc nghỉ:

```text
Enrollment ACTIVE nhưng không đi học -> vẫn tính đủ tháng
Enrollment có khoảng tạm nghỉ bao phủ tháng -> không tạo phí
Đăng ký giữa tháng -> vẫn tính đủ tháng
Ngày đăng ký/tái đăng ký không giới hạn kỳ tạo học phí
Chỉ tạo học phí trong thời gian bắt đầu/kết thúc của lớp
```

Không được thu hẹp thời gian lớp nếu làm học phí hoặc khoảng tạm nghỉ đã tồn tại
nằm ngoài khoảng mới. Khi lớp `COMPLETED` hoặc `CANCELLED`, enrollment chỉ được
xem; không được đăng ký, bỏ môn, rời lớp hoặc thay đổi tạm nghỉ.

---

# 9. QR Payment Rules

## 9.1 QR Generation

QR được tạo động theo `payment_batch` đang `PENDING`, sử dụng tài khoản ngân hàng
đã gắn với batch, tổng `final_amount` và `batchNo` làm nội dung chuyển khoản.

```text
1 payment_batch = 1 QR động tại thời điểm xem/in
```

Không lưu ảnh QR hoặc bản ghi QR riêng trong database.

## 9.2 QR Validity

QR chỉ được tạo khi batch còn `PENDING` và tài khoản nhận tiền còn hoạt động.
Batch `SUCCESS` hoặc `CANCELLED` không được tạo QR mới.

---

# 10. Payment Notice Rules (Bill tạm)

## 10.1 Payment Notice Meaning

Bill tạm:

```text
Không phải biên lai
```

Bill tạm chỉ dùng:

```text
Thông báo khoản cần thanh toán
```

---

## 10.2 Payment Notice Regeneration

Nếu thay đổi:

```text
amount
discount
due_date
```

Với thao tác chỉnh sửa riêng một khoản đã phát hành, batch đang chờ phải được
hủy hoặc thay thế trước khi tạo batch mới. Khi phát hành theo lớp, áp dụng quy
tắc cập nhật batch đang chờ được mô tả bên dưới. PDF notice được tạo lại theo
batch hiện hành và không lưu lịch sử bản PDF trong database.

Việc tạo học phí tháng không tự tạo payment batch. Chỉ thao tác phát hành tại
màn hình `Thông báo & đợt thu` mới tạo batch `BANK_TRANSFER` `PENDING` từ các
khoản học phí còn nợ đã tồn tại; thao tác này không tự tạo học phí. Các khoản
được chọn phải được gom thành tối đa một batch cho mỗi học viên. Nếu học viên
nộp tiền mặt, nhân viên phải thu từ màn hình thanh toán với phương thức `CASH`.

Khi phát hành theo lớp và kỳ, hệ thống lấy toàn bộ khoản học phí tháng còn nợ
trong lớp/kỳ, bao gồm khoản chưa phát hành và khoản đang thuộc batch
`BANK_TRANSFER` `PENDING`. Mỗi thông báo theo lớp/kỳ chỉ được chứa khoản thuộc
đúng lớp và kỳ đã chọn. Khoản chưa phát hành chỉ được thêm vào batch chuyển
khoản đang chờ nếu mọi khoản đã có trong batch đều thuộc cùng lớp và kỳ; nếu
không có batch phù hợp, hệ thống tạo batch mới. Batch ngoài lớp/kỳ được giữ
nguyên. Khoản mục tiêu đã nằm trong batch ngoài phạm vi không được phát hành
lại; nhân viên phải xử lý batch đó trước để tránh thông báo/QR có khoản ngoài
lớp/kỳ được chọn. Nếu cập nhật batch cùng phạm vi, hệ thống cập nhật tổng tiền,
tài khoản nhận tiền và snapshot thông báo trong cùng transaction để QR/PDF mới
phản ánh số tiền và tài khoản hiện hành.
Khoản đã thanh toán không được đưa vào batch mới. Mọi batch được cập nhật hoặc
tạo phải có audit log.
Batch đang được liên kết với dòng sao kê không bị sửa phân bổ hoặc đổi tài khoản;
khoản mới được phát hành thành batch khác để không làm sai lệch dữ liệu đối soát.
Nếu khoản mục tiêu đã được phân bổ một phần trong batch có liên kết sao kê,
không thể tăng phân bổ tại lần phát hành này; cần hoàn tất đối soát trước.

---

## 10.3 Bill History

Cho phép xuất/in lại nhiều lần khi batch còn `PENDING`; hệ thống hiện chưa gửi
email/SMS và chưa lưu lịch sử số lần xuất/in. Notice dùng snapshot tài khoản đã
gắn với batch; nếu tài khoản không còn active thì không sinh QR mới và PDF phải
cảnh báo người nộp liên hệ trung tâm trước khi chuyển khoản.
Có thể gộp PDF của nhiều batch `PENDING` `BANK_TRANSFER` dù khác học viên hoặc
tài khoản nhận tiền; mỗi thông báo phải giữ QR và snapshot tài khoản riêng của
batch tương ứng.

---

# 11. Payment Rules

## 11.1 Payment Amount

Hệ thống cho phép thanh toán nhiều lần cho từng học phí.

```text
0 < payment.amount <= tuition_fee.final_amount - paid_amount
paid_amount = SUM(payment SUCCESS của tuition_fee)
```

Backend nhận số tiền của lần thanh toán để ghi nhận số tiền thực tế, nhưng luôn
tự tính số dư và từ chối thanh toán vượt số tiền còn nợ.

---

## 11.2 Payment Methods

Cho phép:

```text
cash
transfer
```

Không cho method khác.

---

## 11.2.1 Ngày nhận tiền

Thanh toán `CASH` bắt buộc nhập ngày nhận tiền. Ngày này được lưu vào
`paymentDate` của payment và payment batch, đồng thời được dùng trong báo cáo
thu học phí theo ngày và hiển thị là ngày thu trên biên lai.

Khi chuyển một batch `BANK_TRANSFER` đang `PENDING` sang `CASH`, người dùng
cũng phải nhập ngày nhận tiền mặt. Ngày tạo phiếu báo vẫn giữ nguyên; ngày nhận
tiền mặt là ngày được dùng để ghi nhận thanh toán.

Thanh toán `BANK_TRANSFER` không nhập ngày nhận ở màn hình thu tiền; ngày thanh
toán được lấy từ ngày giao dịch trong sao kê khi đối soát.

Khi chuyển batch sang tiền mặt, ghi chú là tùy chọn và được lưu vào nội dung
thanh toán của batch và payment.

## 11.3 Payment Uniqueness

```text
1 student_fee có thể có nhiều payment SUCCESS, nhưng tổng amount không vượt
`final_amount`.
```

Payment `FAILED` hoặc `CANCELLED` vẫn được lưu để tra cứu lịch sử, nhưng không
được tính là đã thanh toán và không được tạo receipt.

## 11.4 Khôi phục miễn học phí

Học phí `EXEMPTED` có thể được khôi phục về trạng thái có thể thu bằng thao tác
có lý do và audit log. Trạng thái lưu là `UNPAID`; khi hiển thị, hệ thống tự
chuyển thành `OVERDUE` nếu đã quá hạn.

Chỉ cho khôi phục khi khoản học phí chưa có payment `SUCCESS`, chưa thuộc batch
`PENDING`, và lớp chưa `COMPLETED` hoặc `CANCELLED`. Khi khôi phục, xóa
`exemption_reason`, tăng `version` và giữ nguyên toàn bộ lịch sử miễn học phí.

---

## 11.5 Payment Status Update

Trạng thái học phí được tính theo tổng payment SUCCESS:

```text
Chưa có payment SUCCESS -> UNPAID hoặc OVERDUE
Tổng payment SUCCESS nằm giữa 0 và final_amount -> PARTIAL
Tổng payment SUCCESS bằng final_amount -> PAID
```

Sau khi đã `PAID`, không cho tạo thêm payment SUCCESS.

---

# 12. Receipt Rules

## 12.1 Receipt Creation

Receipt chỉ tạo khi:

```text
payment đã tồn tại
```

Không cho tạo trực tiếp.

---

## 12.2 Receipt Number

Rule:

```text
receipt_number UNIQUE
```

Ví dụ:

```text
RC2026060001
```

---

## 12.3 Receipt Edit

Không cho sửa:

```text
amount
payment_id
```

Sau khi receipt đã phát hành.

---

## 12.4 Receipt Delete

Không cho xóa receipt.

Cho phép:

```text
cancel receipt
```

Khi hủy một receipt thuộc payment batch đã thành công, hệ thống hoàn tác toàn bộ
batch trong một transaction: các payment chuyển `CANCELLED`, các receipt liên
quan bị hủy, học phí được mở lại thành `UNPAID` hoặc `OVERDUE`, batch chuyển
`CANCELLED` và ghi audit log. Không cho xuất lại receipt tổng đã hoàn tác.

---

## 12.5 Refund Rules

Chỉ hỗ trợ hoàn toàn bộ payment. Không cho nhập hoặc thay đổi số tiền hoàn từ
frontend.

```text
refund.amount = payment.amount
```

Payment độc lập chỉ hoàn chính payment đó. Nếu payment thuộc batch, hệ thống
phải tạo và xử lý yêu cầu hoàn cho toàn bộ payment `SUCCESS` trong batch.

Điều kiện tạo yêu cầu:

```text
payment.status = SUCCESS
payment_batch.status = SUCCESS nếu payment thuộc batch
không có refund đang hoạt động trên payment hoặc batch
reason bắt buộc, tối đa 500 ký tự
```

Transition được hỗ trợ:

```text
PENDING -> APPROVED -> COMPLETED
```

Quy tắc phương thức:

```text
CASH: không có bank_transaction_no
BANK_TRANSFER: bắt buộc có bank_transaction_no khi hoàn tất
```

Khi hoàn tất phải chạy trong một transaction:

```text
refund -> COMPLETED
payment -> REFUNDED
receipt -> CANCELLED
tuition_fee -> UNPAID hoặc OVERDUE theo due_date
payment_batch -> CANCELLED nếu có batch
ghi đầy đủ audit log
```

Receipt tổng của batch `CANCELLED` không được xuất lại. Mọi user đã đăng nhập
dùng chung quyền tạo, duyệt và hoàn tất refund theo access model hiện hành.

---

# 13. Delete Policy

Nguyên tắc:

```text
Không hard delete dữ liệu tài chính
```

Không xóa:

```text
student_fee
payment
receipt
```

Chỉ:

```text
soft delete
inactive
cancel
```

---

# 14. Audit Log Rules

## 14.1 Attendance

- Giáo viên chọn lớp/môn được phân công và tạo một phiên điểm danh độc lập với
  lịch học. Một lớp có thể có nhiều phiên trong cùng ngày.
- Phiên được tạo khi lưu danh sách điểm danh; `session_at` do máy chủ ghi nhận
  theo thời điểm hiện tại. Client không được tự gửi hoặc sửa thời điểm này.
- User liên kết Teacher chỉ xem/sửa phiên thuộc lớp/môn đang được phân công cho
  Teacher đó; backend bắt buộc kiểm tra phân công với cả tạo và sửa phiên.
- Roster được xác định theo enrollment/môn có hiệu lực tại ngày Việt Nam của
  `session_at`: học viên đã bắt đầu và chưa rời/bỏ môn; học viên tạm nghỉ trong
  tháng đó không nằm trong roster. Khi sửa phiên, các dòng đã ghi nhận trước đó
  vẫn được giữ trong roster để không mất khả năng chỉnh sửa lịch sử.
- Trạng thái chỉ gồm `PRESENT` và `ABSENT`. Checkbox chọn là `PRESENT`; bỏ chọn
  là `ABSENT`. Ghi chú vắng không bắt buộc, tối đa 500 ký tự.
- Giáo viên được sửa không giới hạn thời gian. Mỗi lần tạo/cập nhật lưu audit
  before/after cùng người thực hiện và thời điểm.

Bắt buộc lưu audit log cho:

```text
Payment created
Payment updated
Receipt created
Student fee generated
QR generated dynamically
Bill generated dynamically
Refund created
Refund approved
Refund completed
```

Đăng ký học viên và tạo học phí là hai audit event riêng biệt.

Khi hoàn tất lớp, việc chuyển enrollment và môn học đang `ACTIVE` sang
`COMPLETED` cũng phải ghi audit log.

Thông tin cần lưu:

```text
user_id
action
table_name
record_id
old_data
new_data
created_at
```

---

# 15. API Rules

Mọi API phải validate backend.

Không tin tưởng frontend.

Bắt buộc check:

```text
Permission

Business validation

Database constraints
```

Response chuẩn:

```json
{
  "success": true,
  "data": {}
}
```

Lỗi:

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Không thể thanh toán vượt số tiền còn nợ"
  }
}
```

---

# 16. Transaction Rules

Các thao tác sau phải dùng database transaction.

```text
Create student fee + QR + bill

Create payment + update fee status + create receipt

Complete refund + cancel receipts + reopen fees + cancel batch

```

Không được commit từng bước riêng lẻ.

---

# 17. Security Rules

Không cho:

```text
Frontend quyết định permission

Client gửi amount đã tính sẵn rồi backend tin tưởng
```

Backend phải tự tính lại:

```text
actual_amount
payment_status

paid_amount = tổng payment SUCCESS của tuition fee

remaining_amount = final_amount - paid_amount
```

Payment SUCCESS của từng lần thu có amount bằng số tiền thực nhận; tổng payment
SUCCESS không được vượt `final_amount`. Khi `paid_amount` nằm giữa 0 và
`final_amount`, học phí có trạng thái `PARTIAL`.

---

# 18. Rules for AI Coding Agent

AI không được:

```text
Tự thay đổi business logic

Bỏ validation để code nhanh hơn

Cho phép delete dữ liệu tài chính

Tạo receipt khi chưa có payment

Cho phép payment vượt số tiền còn nợ
```

AI bắt buộc:

```text
Đọc business-rules.md trước khi code

Ưu tiên business-rules hơn UI

Nếu chưa rõ nghiệp vụ phải thêm TODO
```
