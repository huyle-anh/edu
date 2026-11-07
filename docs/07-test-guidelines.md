# Test Guidelines - Hệ thống quản lý trung tâm đào tạo

Version: 1.0
Priority: HIGH
Mục đích: Quy định cách kiểm tra sau mỗi lần chỉnh sửa code.

---

# 1. Nguyên tắc chung

Sau mỗi chỉnh sửa, không được báo “đã xong” nếu chưa kiểm tra tối thiểu.

Mỗi thay đổi phải trả lời được:

```text
Đã sửa gì?
Đã ảnh hưởng module nào?
Đã test bằng cách nào?
Có lỗi còn lại không?
```

Không được chỉ nói:

```text
Done
Fixed
OK
```

---

# 2. Test level bắt buộc

Tùy loại chỉnh sửa, phải chạy các mức test tương ứng.

## 2.1 Sửa UI nhỏ

Ví dụ:

```text
Canh giữa text
Đổi label
Đổi màu Chip
Sửa layout button
```

Phải chạy:

```bash
npm run typecheck
npm run lint
```

Nếu có thể:

```bash
npm run build
```

Manual test:

```text
Mở màn hình liên quan
Kiểm tra layout không vỡ
Kiểm tra responsive cơ bản
```

---

## 2.2 Sửa form

Ví dụ:

```text
StudentForm
TeacherForm
PaymentForm
ClassForm
```

Phải chạy:

```bash
npm run typecheck
npm run lint
npm run build
```

Manual test:

```text
Create success
Edit success
Validation required
Validation format
Submit loading
Submit error
Reset/cancel
```

---

## 2.3 Sửa API

Ví dụ:

```text
/api/students
/api/payments
/api/student-fees
```

Phải chạy:

```bash
npm run typecheck
npm run lint
npm run build
```

API test:

```text
Success case
Validation error
Not found
Duplicate data
Permission fail nếu có
Business rule fail
```

---

## 2.4 Sửa database / Prisma

Ví dụ:

```text
schema.prisma
migration
seed
relationship
enum
```

Phải chạy:

```bash
npx prisma validate
npx prisma generate
npm run typecheck
npm run build
```

Nếu có DB local:

```bash
npx prisma migrate reset
npm run seed
```

Kiểm tra:

```text
Prisma Studio mở được
Seed data tạo đúng
Relation load được
```

---

## 2.5 Sửa nghiệp vụ tài chính

Ví dụ:

```text
tuition_fees
payment
receipt
QR
bill tạm
```

Bắt buộc test kỹ hơn.

Phải chạy:

```bash
npm run typecheck
npm run lint
npm run build
```

Business test:

```text
Đăng ký môn không tự động tạo học phí
Tạo thông báo chuyển khoản tạo học phí cho item còn thiếu và payment batch `BANK_TRANSFER` `PENDING`
Tạo thông báo chuyển khoản bắt buộc chọn tài khoản ngân hàng active
Không cho chuyển batch `CASH` sang `CASH` qua API đổi phương thức
Khoản phí thuộc batch chuyển khoản `PENDING` hiển thị nút `Xử lý đợt thu`; sau khi tạo batch mới, màn hình `Thu học phí` cho phép `Đổi sang tiền mặt` và phát hành biên lai
Đổi từ chuyển khoản sang tiền mặt sau khi đã nhập mã giao dịch phải xóa mã giao dịch và hoàn tất được thanh toán
Hủy/hoàn batch thành công phải đánh dấu snapshot biên lai tổng là `CANCELLED`
In lại notice PENDING dùng snapshot tài khoản và không sinh QR nếu tài khoản inactive
Tạo học phí không tạo item trùng
Tính phí tháng trọn tháng theo mức phí của từng môn
Enrollment tạm nghỉ không phát sinh học phí tháng
Enrollment ACTIVE nhưng vắng không làm giảm học phí tháng
Có thể tạo học phí cho tháng trước ngày đăng ký/tái đăng ký nếu tháng đó nằm trong thời gian của lớp
Không tạo học phí ngoài thời gian của lớp
Không tạo khoảng tạm nghỉ ngoài thời gian của lớp
Hủy tạm nghỉ giữ bản ghi lịch sử và không còn chặn tạo học phí
Không tạo học phí/item trùng môn
Thanh toán vượt số tiền còn nợ -> CONFLICT
Thanh toán thiếu -> PARTIAL và còn số dư
Thanh toán đủ -> PAID
Thanh toán lần tiếp theo trên cùng học phí -> được phép nếu không vượt số dư
Payment tạo receipt
Receipt không tạo nếu chưa có payment
```

---

# 3. Static checks

Luôn ưu tiên chạy:

```bash
npm run typecheck
npm run lint
npm run build
```

Ý nghĩa:

```text
typecheck -> lỗi TypeScript

lint -> lỗi coding style

build -> lỗi runtime/build Next.js
```

Không được bỏ qua build nếu sửa:

```text
route
page
layout
schema
Prisma
API
```

---

# 4. Unit test

Nếu project có unit test:

```bash
npm run test
```

Nên test các hàm:

```text
formatCurrency
formatDate
checkScheduleConflict
```

---

# 5. API test checklist

Mỗi API CRUD nên test:

```text
GET list
GET detail
POST create
PATCH update
DELETE delete
Search
Pagination
Validation error
Duplicate error
Not found
Business rule error
```

Response phải đúng:

```json
{
  "success": true,
  "data": {}
}
```

Lỗi phải đúng:

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "..."
  }
}
```

---

# 6. UI manual test checklist

Mỗi màn hình CRUD phải test:

```text
Mở màn hình
Danh sách load được
Search hoạt động
Pagination hoạt động
Create thành công
Edit thành công
Delete có confirm
Validation hiển thị đúng
Snackbar thành công/lỗi
Loading state
Empty state
```

---

# 7. Form test checklist

Mỗi form phải test:

```text
Field bắt buộc
Email format
Number min/max
Money không âm
Date hợp lệ
Start date <= end date
Submit thành công
Submit lỗi backend
Cancel
Reset
```

---

# 8. Payment flow test

Khi sửa payment/học phí, bắt buộc test flow:

```text
1. Đăng ký một hoặc nhiều môn trong lớp
2. Xác nhận đăng ký chưa tự động tạo học phí
3. Mở chi tiết học phí và sinh QR/bill tạm (nếu có)
4. Xác nhận thanh toán thiếu `finalAmount`
5. Kiểm tra trạng thái `PARTIAL` và số dư còn lại
6. Kiểm tra receipt của lần thanh toán được tạo
7. Thanh toán tiếp phần còn lại và kiểm tra trạng thái `PAID`
8. Thử thanh toán vượt số dư ở backend và xác nhận bị từ chối
```

---

# 9. Schedule conflict test

Khi sửa lịch học, bắt buộc test:

```text
Tạo lịch hợp lệ

Tạo lịch trùng giáo viên

Tạo hoặc cập nhật lịch có start_time >= end_time

Đổi giáo viên

Đổi giờ
```

---

# 10. Regression checklist

Sau khi sửa module A, kiểm tra module liên quan.

Ví dụ:

## Sửa Student

Kiểm tra thêm:

```text
Enrollment
Student Fees
Payment
```

## Sửa Class

Kiểm tra thêm:

```text
Schedule
Enrollment
Student Fees
```

Khi chuyển lớp `ACTIVE -> COMPLETED`, kiểm tra enrollment và các môn đang
`ACTIVE` chuyển sang `COMPLETED`, audit log được ghi, danh sách học viên vẫn
hiển thị để xem và mọi thao tác thay đổi bị từ chối.

Kiểm tra thêm: lớp `DRAFT` không cho đăng ký/import/thay đổi enrollment và không
cho tạo học phí; các API trả `409 Conflict`. Bộ chọn kỳ học phí không cho chọn
tháng ngoài khoảng bắt đầu/kết thúc của lớp.

## Sửa Payment

Kiểm tra thêm:

```text
Student Fee status
Receipt
Dashboard revenue
Debt report
```

---

# 11. Báo cáo kết quả test

Sau khi hoàn thành, AI/dev phải báo theo format:

```text
Đã sửa:
- ...

Đã test:
- npm run typecheck: pass
- npm run lint: pass
- npm run build: pass
- Manual test: create/edit/delete student pass

Chưa test được:
- ...
Lý do:
- ...
```

Không được ghi chung chung:

```text
Đã test xong
```

---

# 12. Rules for AI Coding Agent

AI bắt buộc:

```text
Sau mỗi chỉnh sửa phải chạy hoặc đề xuất test tương ứng

Không được báo hoàn thành nếu chưa nêu test đã chạy

Nếu không chạy được test phải nói rõ lý do

Nếu sửa nghiệp vụ tài chính phải test business flow

Nếu sửa DB phải chạy prisma validate/generate
```

AI không được:

```text
Bỏ qua test vì sửa nhỏ

Chỉ kiểm tra bằng mắt nếu có thay đổi API/DB

Nói pass khi chưa chạy
```
