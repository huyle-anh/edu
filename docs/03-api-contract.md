# API Contract - Hệ thống quản lý trung tâm đào tạo

Version: 1.0
Priority: HIGH
Mục đích: Quy định chuẩn request/response cho toàn bộ API.

Nếu coding-rules.md và file này mâu thuẫn, ưu tiên file này cho API layer.

---

# 1. Nguyên tắc chung

Mọi API phải tuân thủ:

```text
Response format thống nhất

Không trả dữ liệu raw từ database

Không expose internal error

HTTP status code đúng chuẩn

Pagination thống nhất toàn hệ thống

Validation ở backend là bắt buộc
```

Không được:

```text
Mỗi API trả một kiểu response khác nhau

Frontend phải tự đoán API shape
```

---

# 2. Response chuẩn

Mọi API thành công:

```json
{
  "success": true,
  "data": {}
}
```

Ví dụ:

```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "Nguyễn Văn A"
  }
}
```

---

# 3. Error Response chuẩn

Format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Thông báo lỗi"
  }
}
```

Ví dụ:

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

# 4. HTTP Status Code

## Thành công

```text
200 OK → Query thành công
201 Created → Tạo mới
200 OK → Delete/soft delete thành công và trả response chuẩn
```

## Lỗi

```text
400 Bad Request → Sai input

401 Unauthorized → Chưa login

404 Not Found → Không tồn tại dữ liệu

409 Conflict → Vi phạm unique/business rule

422 Unprocessable Entity → Validation fail

500 Internal Server Error → Lỗi server
```

Ví dụ:

```text
Student code duplicated → 409

Email invalid → 422

Payment amount vượt số tiền còn nợ → 409
```

---

# 5. Pagination chuẩn

Toàn hệ thống dùng:

```text
page
pageSize
```

Không dùng:

```text
offset
limit
startRow
endRow
cursor
```

Request:

```http
GET /api/students?page=1&pageSize=20
```

Khi cần chỉ hiển thị học viên chưa đăng ký trong một lớp, truyền thêm
`excludeClassId={classId}`. Chỉ enrollment đang `ACTIVE` bị loại khỏi danh sách.

Response:

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 120,
      "totalPages": 6
    }
  }
}
```

---

# 6. Search Query chuẩn

Danh sách dùng query param.

Ví dụ:

```http
GET /api/students?search=nguyen&status=ACTIVE&page=1&pageSize=20
```

`GET /api/classes` nhận thêm `statuses` dạng danh sách phân tách bằng dấu phẩy.
Ví dụ `statuses=ACTIVE,COMPLETED` chỉ trả lớp đang hoạt động hoặc đã hoàn
thành; dùng cho bộ chọn lớp trong báo cáo học phí.

Rule:

```text
search = full text search đơn giản

status = filter exact match

Với danh sách học viên và giáo viên, `status` nhận `ACTIVE`, `INACTIVE` hoặc
`ALL`. Giá trị `ALL` trả về cả hồ sơ đang hoạt động và hồ sơ inactive đã được
soft-delete; bỏ qua `status` vẫn giữ mặc định chỉ trả về bản ghi chưa bị
soft-delete.

page mặc định = 1

pageSize mặc định = 20

pageSize max = 100
```

Xuất danh sách học viên theo bộ lọc hiện tại dùng file Excel `.xlsx`:

```http
GET /api/students?export=xlsx&search=nguyen&status=ACTIVE
```

Response thành công là file Excel với `Content-Type`:

```text
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
```

Import học viên từ file Excel vào một lớp dùng mã học viên trong cột MÃ HỌC VIÊN.
Các môn học được chọn gửi lặp lại trong multipart form:

POST /api/classes/{classId}/students/import
Content-Type: multipart/form-data

Form fields:

file = danh-sach-hoc-vien.xlsx
classSubjectIds = UUID môn học (có thể gửi nhiều lần)

API áp dụng toàn bộ nghiệp vụ đăng ký hiện hành cho từng dòng; kết quả trả về số
đăng ký thành công, số dòng bỏ qua và danh sách lỗi theo số dòng Excel.
Lớp phải ở trạng thái `ACTIVE`; lớp `DRAFT`, `COMPLETED` hoặc `CANCELLED` trả
`409 Conflict` và không đăng ký dòng nào.

Xuất danh sách học viên của một lớp dùng mã học viên trong cột MÃ HỌC VIÊN để có
thể import lại:

```http
GET /api/classes/{classId}/students/export
```

API trả về file Excel `.xlsx` gồm các học viên đang học hoặc đã hoàn thành trong
lớp. Khi import lại, người dùng vẫn chọn các môn học áp dụng trong dialog import.

---

# 7. CRUD Pattern chuẩn

Pattern:

```text
GET /api/resource

GET /api/resource/:id

POST /api/resource

PATCH /api/resource/:id

DELETE /api/resource/:id
```

Không dùng:

```text
POST /createStudent

POST /updateStudent
```

---

# 8. Create API Rules

Ví dụ:

```http
POST /api/students
```

Body:

```json
{
  "code": "ST001",
  "fullName": "Nguyễn Văn A",
  "phone": "0901234567"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "uuid"
  }
}
```

Validation:

```text
Zod schema bắt buộc
```

---

# 9. Update API Rules

Ví dụ:

```http
PATCH /api/students/uuid
```

Không dùng PUT.

Rule:

```text
Chỉ update field thay đổi

Phải check record tồn tại
```

Response:

```json
{
  "success": true,
  "data": {
    "updated": true
  }
}
```

---

# 10. Delete API Rules

Ví dụ:

```http
DELETE /api/students/uuid
```

Response:

```json
{
  "success": true,
  "data": {}
}
```

Rule:

```text
Không hard delete dữ liệu tài chính
```

Nếu business không cho xóa:

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Không thể xóa vì đã phát sinh giao dịch"
  }
}
```

---

# 11. Validation Rules

Validation dùng:

```text
Zod
```

Không validate thủ công kiểu:

```ts
if (!email) {
  ...
}
```

Ví dụ:

```ts
const studentSchema = z.object({
  code: z.string().min(1),
  fullName: z.string().min(1),
  email: z.string().email().optional(),
});
```

---

# 12. API Structure

Cấu trúc:

```text
src/app/api/students/route.ts

src/modules/student/
  services/
  schemas/
  types/
```

Không viết toàn bộ logic trong route.

Route chỉ làm:

```text
read request

validate

call service

return response
```

---

# 13. Service Layer Rules

Service chịu trách nhiệm:

```text
Business validation

Prisma query

Transaction

Mapping response
```

Ví dụ:

```ts
export async function createStudent(data: StudentCreateInput) {}
```

Không query Prisma trong route.

Sai:

```ts
export async function POST() {
  await prisma.student.create(...)
}
```

---

# 14. Auth Rules

API private phải check auth.

Rule:

```text
Không API nội bộ nào được public nếu không có lý do rõ ràng
```

Middleware check:

```text
JWT

Session

Token
```

---

# 15. Authentication Rules

Mọi API nghiệp vụ yêu cầu user đã đăng nhập. Không có kiểm tra role ở frontend,
backend hoặc API middleware.

Các business rule độc lập với quyền đăng nhập vẫn phải được kiểm tra ở backend.

---

# 16. Date Format Rules

Frontend gửi:

```json
{
  "birthday": "2026-06-18"
}
```

Không gửi:

```json
{
  "birthday": "18/06/2026"
}
```

Backend convert.

Datetime:

```text
ISO format
```

Ví dụ:

```text
2026-06-18T10:30:00Z
```

---

# 17. Money Rules

Không dùng float JS để tính tiền.

Dùng:

```text
Decimal trong database

number chỉ để hiển thị
```

Backend tự tính:

```text
payment_status
```

Backend lấy `finalAmount` và tổng payment SUCCESS từ database. Request có thể
gửi `amounts` theo từng `tuitionFeeId`; amount phải lớn hơn 0 và không vượt số
tiền còn nợ. Nếu không gửi amount cho một khoản, backend tự dùng toàn bộ số dư
còn lại của khoản đó. Mỗi lần payment SUCCESS tạo một receipt riêng.

Ví dụ:

```json
{
  "tuitionFeeIds": ["fee-uuid"],
  "idempotencyKey": "collect-fee-20260920-0001",
  "amounts": { "fee-uuid": 1000000 },
  "paymentMethod": "CASH",
  "paymentDate": "2026-09-20"
}
```

API `POST /api/payment-batches` bắt buộc nhận khóa idempotency duy nhất cho
mỗi lần thu. Khóa có thể gửi qua header `Idempotency-Key` hoặc field
`idempotencyKey` trong body; nếu gửi cả hai thì phải giống nhau. Retry cùng
khóa và cùng nội dung sẽ trả lại payment batch đã tạo, không tạo thêm payment.
Dùng lại khóa cho nội dung khác phải trả `409 CONFLICT`.

---

# 18. Bulk API Rules

Ví dụ:

```http
POST /api/classes/{classId}/tuition-fees?month=YYYY-MM
```

Request không cần body. `classId` nằm trên path và `month` nằm trên query.

Flow:

```text
Tìm enrollment ACTIVE và môn ACTIVE trong lớp

Tạo hoặc bổ sung tuition_fee và tuition_fee_items cho kỳ được chọn

Không tạo payment batch, QR hoặc PDF ở endpoint này

Commit transaction
```

Response:

```json
{
  "success": true,
  "data": {
    "created": 20,
    "skipped": 3,
    "failed": [
      {
        "studentId": "uuid",
        "studentCode": "HV015",
        "studentName": "Nguyễn Văn Dũng",
        "reason": "Không thể bổ sung môn vào học phí tháng đang chờ thanh toán"
      }
    ]
  }
}
```

Nếu một học viên vi phạm quy tắc nghiệp vụ (khoản tháng đang chờ thanh toán,
đã hủy/miễn nhưng có môn mới, không có môn tính phí…), học viên đó được bỏ qua
và trả về trong `failed` kèm lý do; các học viên khác vẫn được tạo học phí.
Lỗi hệ thống hoặc lỗi cấp lớp (lớp không `ACTIVE`, kỳ ngoài thời gian lớp) vẫn
rollback toàn bộ.

---

# 19. Transaction API Rules

Các API bắt buộc transaction:

```text
Create student fee + QR + bill

Create payment + update fee status + receipt
```

Không commit từng bước riêng.

Ví dụ Prisma:

```ts
await prisma.$transaction(async (tx) => {})
```

## 19.2 Xuất báo cáo thu học phí theo ngày

```http
GET /api/reports/daily-payments/export?date=YYYY-MM-DD
```

API trả file Excel gồm bảng tổng hợp theo giáo viên/lớp/mức phí và sheet chi
tiết payment. Chỉ payment `SUCCESS` trong ngày theo múi giờ Việt Nam được tính.

Tên file trả về có dạng:

```text
bao-cao-thu-hoc-phi-ngay-YYYY-MM-DD.xlsx
```

---

# 19.1 Enrollment và tạo học phí tách rời

## 19.1.0 Đóng lớp

```http
PATCH /api/classes/{classId}
```

Khi cập nhật `status` từ `ACTIVE` sang `COMPLETED`, API chuyển atomically toàn
bộ enrollment `ACTIVE` trong lớp và các môn `ACTIVE` của chúng sang
`COMPLETED`, đồng thời ghi audit log theo từng enrollment. Dữ liệu enrollment
đã hoàn thành vẫn được trả về ở API danh sách học viên để chỉ xem.

## 19.1.0.1 Khôi phục lớp đã hủy

```http
PATCH /api/classes/{classId}
```

Body:

```json
{
  "status": "ACTIVE"
}
```

API chỉ chấp nhận chuyển trạng thái `CANCELLED` sang `ACTIVE`. Khi thành công,
API xóa `deleted_at` nếu có và ghi audit log `CLASS_RESTORED`. Không thể khôi
phục lớp `COMPLETED`.

## 19.1.1 Đăng ký học viên

```http
POST /api/classes/{classId}/students
```

Body:

```json
{
  "studentId": "uuid",
  "classSubjectIds": ["uuid"]
}
```

API này chỉ tạo hoặc bổ sung enrollment subject. API không tạo `tuition_fee`.
Lớp phải ở trạng thái `ACTIVE`; lớp `DRAFT`, `COMPLETED` hoặc `CANCELLED` bị từ
chối với `409 Conflict`.
Khi tái đăng ký enrollment `LEFT`, backend giữ ngày đăng ký ban đầu, đặt
`currentPeriodStart` cho giai đoạn mới và xóa các khoảng nghỉ chưa kết thúc của
giai đoạn cũ. `currentPeriodStart` chỉ phục vụ lưu lịch sử giai đoạn hiện tại,
không giới hạn kỳ được tạo học phí.

## 19.1.2 Tạo học phí từ enrollment

```http
POST /api/classes/{classId}/students/{studentId}/tuition-fee
```

API yêu cầu user đã đăng nhập, query bắt buộc `month=YYYY-MM`, không cần body. Backend sẽ:

```text
Tìm enrollment của học viên trong lớp
Lấy các môn ACTIVE chưa có tuition fee item
Tạo tuition_fee và tuition_fee_items trong một transaction
Ghi audit log
```

Lớp phải ở trạng thái `ACTIVE`. Kỳ `month` phải nằm trong thời gian của lớp;
không giới hạn theo ngày đăng ký hoặc tái đăng ký của học viên. Lớp chưa ACTIVE
hoặc kỳ nằm ngoài thời gian lớp trả `409 Conflict`.

Nếu tất cả môn đã được lập phí, API trả `409 Conflict`. Enrollment không có học phí vẫn hợp lệ và có thể bị xóa theo Enrollment Remove Rules.

## 19.1.3 Quản lý môn và tạm nghỉ

```http
DELETE /api/classes/{classId}/students/{studentId}/subjects/{classSubjectId}
```

Bỏ một môn khỏi enrollment. Nếu kỳ hiện tại đã có học phí, khoản đã phát sinh được giữ nguyên; môn bị bỏ không được tính cho các kỳ sau.

```http
POST /api/classes/{classId}/students/{studentId}/pause
```

Body:

```json
{
  "startMonth": "2026-09",
  "endMonth": "2026-09",
  "reason": "Nghỉ phép"
}
```

Trong khoảng tạm nghỉ, học viên không phát sinh học phí tháng.

```http
PATCH /api/classes/{classId}/students/{studentId}/pause
```

Body gồm `pauseId`, `startMonth`, `endMonth`, `reason`. Khoảng mới không được
trùng khoảng nghỉ khác hoặc phủ kỳ đã phát sinh học phí.

Với cả tạo và sửa, khoảng nghỉ không được nằm ngoài thời gian của lớp.

Các API thay đổi enrollment trả `409 Conflict` khi lớp chưa ở trạng thái
`ACTIVE` (`DRAFT`, `COMPLETED` hoặc `CANCELLED`).

```http
DELETE /api/classes/{classId}/students/{studentId}/pause
```

Body gồm `pauseId`. API chuyển khoảng tạm nghỉ sang `CANCELLED` và ghi audit
log; không xóa bản ghi hoặc enrollment.

## 19.1.4 Tạo học phí tháng theo lớp

```http
POST /api/classes/{classId}/tuition-fees?month=YYYY-MM
```

API chỉ tạo học phí, chưa tạo payment batch và chưa xuất thông báo. Mỗi môn ACTIVE được tính trọn mức `ClassSubject.tuitionFee` của tháng; enrollment được tạm nghỉ trong kỳ sẽ được bỏ qua.
Học viên vi phạm quy tắc tạo học phí được bỏ qua và trả về trong `failed` (xem mục 18).
Kỳ yêu cầu chỉ cần nằm trong thời gian của lớp; không phụ thuộc ngày đăng ký hoặc
ngày tái đăng ký của học viên. Lớp phải ở trạng thái `ACTIVE`; lớp `DRAFT`,
`COMPLETED` hoặc `CANCELLED` trả `409 Conflict`.

## 19.1.5 API cũ tạo thông báo chuyển khoản theo lớp

```http
POST /api/classes/{classId}/tuition-notice/pdf
```

Query bắt buộc:

```text
month=YYYY-MM
```

Body bắt buộc:

```json
{
  "bankAccountId": "uuid"
}
```

Endpoint này được giữ để tương thích API; giao diện quản trị không còn gọi
endpoint này. Endpoint không tự tạo học phí: chỉ phát hành đợt thu từ các khoản
học phí tháng còn nợ đã tồn tại của lớp/kỳ (quy tắc 10.2). Luồng giao diện hiện hành tạo học phí riêng, sau đó phát hành từ
các khoản đã tồn tại tại `POST /api/payment-batches/notice`.

## 19.1.6 Phát hành thông báo từ các khoản học phí đã chọn

```http
POST /api/payment-batches/notice
```

Body gồm `tuitionFeeIds` (1–500 UUID), `mode: "BY_STUDENT"`,
`bankAccountId` và `idempotencyKey`. Backend kiểm tra khoản còn nợ, chưa thuộc
batch đang chờ, tài khoản nhận tiền đang hoạt động; sau đó gom các khoản theo
học viên và tạo một batch `BANK_TRANSFER` `PENDING` cho mỗi học viên. API không
tạo học phí.

## 19.1.6.1 Phát hành toàn bộ công nợ theo lớp và kỳ

```http
POST /api/payment-batches/notice/class
```

Body gồm `classId`, `month` (`YYYY-MM`), `bankAccountId` và `idempotencyKey`.
Backend lấy toàn bộ học phí MONTHLY còn nợ của lớp/kỳ đã chọn, gồm khoản chưa
phát hành và khoản thuộc batch `PENDING`; không đưa khoản đã thanh toán vào
batch. Mỗi batch được trả về chỉ chứa học phí thuộc `month` đã chọn. Khoản chưa
phát hành chỉ được thêm vào batch chuyển khoản đang chờ nếu mọi khoản đã có
trong batch đều thuộc cùng kỳ; nếu không có batch cùng kỳ, API tạo batch mới.
Batch khác kỳ được giữ nguyên. Nếu khoản mục tiêu đã nằm trong batch nhiều kỳ,
API trả `409 CONFLICT` yêu cầu xử lý batch đó trước. Phân bổ hiện tại được giữ
nguyên nếu đã bằng số dư còn nợ; nếu thấp hơn, API tăng phân bổ đến số dư còn
lại. Khi cập nhật, API cập nhật tổng tiền, tài khoản nhận tiền, snapshot notice
và audit log trong cùng transaction. Các phân bổ khác cùng kỳ được giữ nguyên.
Phản hồi trả danh sách
batch để xuất PDF gộp qua endpoint PDF hiện có, `updatedBatchCount` và
`replacedBatchCount` (luôn bằng 0 để tương thích với client cũ). Batch đang được
liên kết với dòng sao kê không bị sửa phân bổ hoặc đổi tài khoản; khoản mới được
tạo thành batch khác. Nếu các batch trả về không thể gộp PDF do khác tài khoản,
API từ chối và yêu cầu dùng đúng tài khoản nhận tiền hoặc hoàn tất đối soát trước.
Nếu khoản mục tiêu đã phân bổ một phần trong batch đang liên kết sao kê, API từ
chối cập nhật và yêu cầu hoàn tất đối soát trước.
Retry với cùng `idempotencyKey` và cùng nội dung trả lại kết quả ban đầu; dùng lại
khóa với nội dung khác trả `409 CONFLICT`.

## 19.1.7 Xuất PDF gộp thông báo

```http
POST /api/payment-batches/notice/pdf
```

Body gồm `batchIds` (1–5000 UUID). Tất cả batch phải đang `PENDING`, dùng phương
thức `BANK_TRANSFER` và cùng một tài khoản nhận tiền. Response thành công là
file PDF gộp các thông báo.

---

## 19.1.8 Ngày nhận khi thanh toán tiền mặt

Khi gọi `POST /api/payment-batches`, nếu `paymentMethod` là `CASH`, body bắt
buộc có `paymentDate` dạng `YYYY-MM-DD`:

```json
{
  "tuitionFeeIds": ["uuid"],
  "paymentMethod": "CASH",
  "paymentDate": "2026-09-20"
}
```

Khi chuyển batch chuyển khoản đang chờ sang tiền mặt:

```http
POST /api/payment-batches/{batchId}/cash
```

Body bắt buộc:

```json
{
  "paymentDate": "2026-09-20",
  "note": "Đã nhận tiền mặt tại quầy"
}
```

Ngày này được lưu cho payment, payment batch và dùng trong báo cáo. Batch
`BANK_TRANSFER` lấy ngày thanh toán từ sao kê khi đối soát, không từ body tạo
phiếu báo. `note` là tùy chọn và được lưu là nội dung thanh toán.

# 19.2 Refund APIs

Tạo yêu cầu hoàn tiền toàn bộ:

```http
POST /api/payment-refunds
```

```json
{
  "paymentId": "uuid",
  "refundMethod": "CASH",
  "reason": "Thu nhầm học phí"
}
```

Duyệt toàn bộ nhóm refund của payment batch:

```http
POST /api/payment-refunds/{refundId}/approve
```

Hoàn tất refund:

```http
POST /api/payment-refunds/{refundId}/complete
```

Body hoàn tiền mặt có thể rỗng. Hoàn chuyển khoản bắt buộc gửi mã giao dịch:

```json
{
  "refundDate": "2026-09-12T10:00:00.000Z",
  "bankTransactionNo": "RF-TXN-001"
}
```

Các endpoint refund yêu cầu đăng nhập, chỉ hoàn toàn bộ payment hoặc toàn bộ
batch, trả `409 CONFLICT` nếu sai trạng thái và thực hiện thay đổi tài chính
trong transaction.

---

# 20. API Naming Rules

Database:

```text
snake_case
```

TypeScript:

```text
camelCase
```

JSON response:

```text
camelCase
```

Ví dụ:

```json
{
  "fullName": "Nguyễn Văn A",
  "createdAt": "..."
}
```

Không trả:

```json
{
  "full_name": "...",
  "created_at": "..."
}
```

---

# 21. Error Code chuẩn

Mã lỗi đang dùng:

```text
VALIDATION_ERROR

UNAUTHORIZED

NOT_FOUND

CONFLICT

INTERNAL_ERROR

BAD_REQUEST
```

Không tự tạo error code lung tung.

---

# 22. API Performance Rules

Không query N+1.

Sai:

```text
Load classes

For each class

Query teacher
```

Đúng:

```ts
include: {
  teacher: true
}
```

Pagination bắt buộc cho list API.

Không trả:

```text
10000 records
```

---

# 19.3 Điểm danh giáo viên

```http
GET /api/attendance
GET /api/attendance?classId={uuid}
GET /api/attendance?classId={uuid}&fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
GET /api/attendance?classId={uuid}&newSession=true
GET /api/attendance?sessionId={uuid}
POST /api/attendance
PUT /api/attendance
```

`GET` không có query trả các lớp/môn được phép điểm danh. `GET` có `classId`
trả các phiên đã lưu gần nhất của lớp; có thể truyền đồng thời `fromDate` và
`toDate` để lọc theo ngày Việt Nam, bao gồm cả hai đầu mút. Thêm
`newSession=true` trả roster để tạo phiên mới. `GET` có `sessionId` trả thông
tin phiên, roster, trạng thái đã lưu và lịch sử chỉnh sửa.

`POST` nhận `classId` và danh sách enrollment với trạng thái
`PRESENT`/`ABSENT`; ghi chú vắng tùy chọn. Backend lấy thời điểm hiện tại, xác
minh lớp/môn được phân công, enrollment còn hợp lệ và lưu phiên, các dòng điểm
danh cùng audit log trong transaction. Mỗi `POST` hợp lệ tạo một phiên riêng,
kể cả khi cùng lớp đã có phiên trong ngày.

`PUT` nhận `sessionId` và danh sách enrollment để cập nhật phiên đã lưu. Backend
xác minh quyền truy cập, kiểm tra roster và lưu các dòng điểm danh cùng audit
log trong transaction. Thời điểm tạo phiên không thay đổi khi sửa.

# 19.4 Báo cáo đối soát ngân hàng theo ngày

```http
POST /api/bank-reconciliation-reports
```

Body:

```json
{
  "bankAccountId": "uuid",
  "fromDate": "2026-10-01",
  "toDate": "2026-10-31",
  "scope": "ALL"
}
```

`scope` nhận `ALL`, `MATCHED` hoặc `UNMATCHED`. Báo cáo lọc theo ngày giao dịch
ngân hàng, lấy dữ liệu từ tất cả phiên sao kê đã lưu của tài khoản và trả file
Excel. API vẫn hỗ trợ request cũ dùng `statementToken` để xuất báo cáo cho phiên
đang mở.

Khi báo cáo theo ngày gộp nhiều phiên, các bản ghi có cùng `transaction_hash`
được gộp thành một giao dịch; dòng `DUPLICATED` không xuất hiện trong báo cáo.
Nếu một bản ghi đã được `CONFIRMED`, trạng thái đó được ưu tiên qua các lần
import trùng tiếp theo. Nếu chưa xác nhận, báo cáo dùng trạng thái từ phiên
import mới nhất. Lịch sử phiên import vẫn lưu từng lần import và số dòng trùng
để tra cứu. Tổng ghi có và ghi nợ được tính trên các giao dịch đã gộp và luôn
cùng phạm vi với `scope`. Chỉ `ALL` mới kiểm tra được chênh lệch số dư của sao
kê; báo cáo lọc `MATCHED`/`UNMATCHED` không đưa ra kết luận cân sao kê.

```http
GET /api/bank-statement-imports?page=1&pageSize=20&bankAccountId=uuid
```

API trả danh sách phiên import mới nhất, thông tin tài khoản, khoảng ngày sao kê
và bộ đếm trạng thái. Các bộ đếm khớp được cập nhật khi xác nhận thủ công.

---

# 23. Logging Rules

Log:

```text
request id

user id

action

execution time
```

Không log:

```text
password

token

bank account full number
```

---

# 24. API Test Rules

Test cases tối thiểu:

```text
Create success

Create duplicate

Update success

Delete success

Delete fail

Validation fail

Permission fail

Business rule fail
```

---

# 25. Rules for AI Coding Agent

AI không được:

```text
Đổi API response structure

Trả raw prisma error

Bypass validation

Không dùng pagination

Hard-code response shape khác chuẩn
```

AI bắt buộc:

```text
Đọc api-contract.md trước khi code

Giữ nguyên response format

Giữ nguyên error format

Nếu API mới phải theo cùng contract
```
