# Audit Report - Hệ thống quản lý trung tâm đào tạo

**Ngày audit:** 2026-06-18  
**Phiên bản tài liệu tham chiếu:** business-rules v1.0, api-contract v1.0, architecture v1.0  
**Phạm vi:** Toàn bộ source code — prisma/schema.prisma, src/app, src/modules, src/lib, middleware.ts  
**Quy tắc:** Chỉ đọc và phân tích. Không sửa code.

> Ghi chú: Đây là báo cáo lịch sử trước đợt cleanup quyền truy cập. Các phát hiện liên quan đến role/permissions đã được thay thế bởi mô hình một quyền dùng chung; xem [09-permissions-matrix.md](./09-permissions-matrix.md).

---

## Tóm tắt nhanh

| Mức độ | Số lượng |
|--------|----------|
| HIGH   | 8        |
| MEDIUM | 9        |
| LOW    | 5        |
| **Tổng** | **22** |

---

## 1. Danh sách vấn đề phát hiện

---

### HIGH-01 — API Response Format không đúng contract

**File:** `src/app/api/students/route.ts`, `teachers`, `classes`, `rooms`, `schedules`, `payments`, `receipts`, `student-fees`  
**Rule vi phạm:** `api-contract.md §2, §3`

Tất cả API routes (trừ `teacher-payroll`) trả response raw thay vì format chuẩn:

```ts
// Hiện tại — SAI
return NextResponse.json(result);
return NextResponse.json(student, { status: 201 });
return NextResponse.json({ error: message }, { status: 400 });

// Chuẩn — phải là
return NextResponse.json({ success: true, data: result });
return NextResponse.json({ success: false, error: { code: "...", message: "..." } }, { status: 400 });
```

**Ảnh hưởng:** Frontend không thể dùng chung response parser. `useList` hook và admin dashboard đang parse sai shape.

---

### HIGH-02 — DELETE không có business rule guard

**File:** `src/modules/student/services/student.service.ts`, `teacher.service.ts`, `class.service.ts`, `room.service.ts`  
**Rule vi phạm:** `business-rules.md §4.3, §3.4, §6.3, §5.3`

Tất cả 4 service này thực hiện hard delete trực tiếp mà không kiểm tra:

```ts
// student.service.ts — KHÔNG có check enrollment, fee, payment, receipt
export async function deleteStudent(id: string): Promise<Student> {
  return prisma.student.delete({ where: { id } });
}

// teacher.service.ts — KHÔNG có check class assignment, payroll
export async function deleteTeacher(id: string): Promise<Teacher> {
  return prisma.teacher.delete({ where: { id } });
}

// class.service.ts — KHÔNG có check student_fee, payment, receipt
export async function deleteClass(id: string): Promise<Class> {
  return prisma.class.delete({ where: { id } });
}

// room.service.ts — KHÔNG có check class, schedule
export async function deleteRoom(id: string): Promise<Room> {
  return prisma.room.delete({ where: { id } });
}
```

**Ảnh hưởng:** Có thể xóa dữ liệu đã phát sinh giao dịch tài chính — vi phạm business rule cốt lõi số 1.

---

### HIGH-03 — HTTP Method sai: dùng PUT thay vì PATCH

**File:** `src/app/api/students/[id]/route.ts`, `teachers/[id]`, `classes/[id]`, `rooms/[id]`, `payments/[id]`, `student-fees/[id]`  
**Rule vi phạm:** `api-contract.md §9`

Contract quy định phải dùng `PATCH` cho update. Tất cả `[id]/route.ts` đang export `PUT`:

```ts
// Hiện tại — SAI
export async function PUT(request: NextRequest, ...) { ... }

// Chuẩn
export async function PATCH(request: NextRequest, ...) { ... }
```

**Ghi chú:** `schedules/[id]/route.ts` đã có workaround `export const PATCH = PUT` nhưng không phải cách làm đúng.

---

### HIGH-04 — Permissions Matrix bị override: STAFF không dùng được gì

**File:** `src/constants/routes.ts`  
**Rule vi phạm:** `permissions-matrix.md`, `api-contract.md §15`

`API_ROLE_RULES` đang restrict tất cả API về ADMIN-only:

```ts
export const API_ROLE_RULES = [
  { prefix: "/api/classes",       roles: ["ADMIN"] },
  { prefix: "/api/payments",      roles: ["ADMIN"] },
  { prefix: "/api/rooms",         roles: ["ADMIN"] },
  { prefix: "/api/schedules",     roles: ["ADMIN"] },
  { prefix: "/api/student-fees",  roles: ["ADMIN"] },
  { prefix: "/api/students",      roles: ["ADMIN"] },
  { prefix: "/api/teacher-payroll", roles: ["ADMIN"] },
  { prefix: "/api/teachers",      roles: ["ADMIN"] },
];
```

Permissions Matrix quy định STAFF được CRUD student, teacher, class, student-fee, payment, v.v. Nhưng với config này, STAFF sẽ nhận 403 trên toàn bộ API calls.

Đồng thời, `ROLE_ROUTE_RULES` chỉ có `/staff` prefix nhưng không có page nào thực tế ở đó (toàn bộ tính năng nằm ở `/admin/*`), khiến STAFF không thể truy cập bất kỳ UI page nào.

---

### HIGH-05 — Monetary values dùng Float thay vì Decimal

**File:** `prisma/schema.prisma`  
**Rule vi phạm:** `api-contract.md §17`, `coding-rules.md §5`

```prisma
tuitionFee     Float   -- SAI
amount         Float   -- SAI
discount       Float   -- SAI
revenue        Float   -- SAI
salaryAmount   Float   -- SAI
```

Contract quy định phải dùng `Decimal` trong database để tránh floating point precision errors khi tính tiền.

---

### HIGH-06 — Payment validation tính sai `actual_amount`

**File:** `src/modules/finance/payments/services/payment.service.ts` dòng ~40  
**Rule vi phạm:** `business-rules.md §12.1, §9.4`

```ts
// Hiện tại — SAI: so sánh với fee.amount thô
if (totalAfterPayment > fee.amount) {
  throw new Error(...);
}
```

Business rule quy định `actual_amount = amount - discount`. Payment không được vượt `actual_amount`. Đang bỏ qua `discount`.

Tương tự, `calculateDebt()` trong student-fee.service.ts:

```ts
// SAI: không trừ discount
const outstanding = fee.amount - totalPaid;
// Đúng: outstanding = (fee.amount - fee.discount) - totalPaid
```

---

### HIGH-07 — Bulk create student fees không dùng transaction

**File:** `src/modules/finance/student-fees/services/student-fee.service.ts`, method `createBulkFeesForClass`  
**Rule vi phạm:** `api-contract.md §18, §19`, `coding-rules.md §5`

```ts
// Hiện tại — loop individual creates, NO transaction
for (const cs of classStudents) {
  try {
    await prisma.studentFee.create({ ... });
    created++;
  } catch {
    skipped++;  // Silently skip failures — SAI
  }
}
```

Contract yêu cầu: nếu fail 1 record → rollback toàn bộ. Hiện tại đang skip lỗi im lặng và commit partial.

---

### HIGH-08 — Teacher schema thiếu field `fullName`

**File:** `src/modules/teacher/schemas/teacher.schema.ts`, `src/modules/teacher/services/teacher.service.ts`  
**Rule vi phạm:** `business-requirements.md §3`

Prisma schema có `fullName String` (NOT NULL) nhưng:

```ts
// teacher.schema.ts — thiếu fullName
export const teacherCreateSchema = z.object({
  code: z.string()...,
  phone: z.string().optional(),
  email: z.string()...,
  // KHÔNG CÓ fullName
});

// teacher.service.ts — buildTeacherCreateInput thiếu fullName
function buildTeacherCreateInput(data: TeacherCreate) {
  return {
    code: data.code,
    // KHÔNG CÓ fullName — sẽ gây DB constraint error
  };
}
```

Mọi POST `/api/teachers` sẽ fail với Prisma constraint error vì `fullName` không được truyền vào.

---

### MEDIUM-01 — Pagination param `limit` thay vì `pageSize`

**File:** Toàn bộ service files, route files, `src/hooks/useList.ts`  
**Rule vi phạm:** `api-contract.md §5`

Contract quy định: 

```
page  
pageSize (không dùng limit, offset, cursor)
```

Toàn bộ code đang dùng `limit`. Ví dụ:

```ts
// api/students/route.ts
limit: parseInt(searchParams.get("limit") || "10"),

// useList.ts
params.set("limit", String(limit));
```

---

### MEDIUM-02 — FeeStatus enum sử dụng lowercase

**File:** `src/modules/finance/student-fees/services/student-fee.service.ts`  
**Rule vi phạm:** Prisma schema enum

Prisma enum `FeeStatus { UNPAID PARTIAL PAID }` là uppercase. Service đang lưu lowercase:

```ts
status: "unpaid",   // SAI — phải là "UNPAID"
status: "partial",  // SAI
status: "paid",     // SAI
```

Đồng thời schema validation:

```ts
// student-fee.schema.ts
status: z.enum(["unpaid", "partial", "paid"])  // lowercase không match Prisma enum
```

---

### MEDIUM-03 — createPayment không dùng transaction

**File:** `src/modules/finance/payments/services/payment.service.ts`  
**Rule vi phạm:** `api-contract.md §19`, `coding-rules.md §5`

```ts
// Tạo payment
const payment = await prisma.payment.create({ ... });

// Update fee status — KHÔNG nằm trong cùng transaction
await StudentFeeService.updateFeeStatus(data.studentFeeId);
```

Nếu `updateFeeStatus` fail sau khi payment đã tạo, fee status sẽ bị stale.

---

### MEDIUM-04 — Payroll approve không check ADMIN role

**File:** `src/app/api/teacher-payroll/[id]/approve/route.ts`  
**Rule vi phạm:** `permissions-matrix.md` — "STAFF: Không cho Approve payroll"

```ts
// Chỉ check session tồn tại, không check role
const session = await getSessionFromCookie();
if (!session?.user?.id) {
  return 401;
}
// Thiếu check: if (session.user.role !== "ADMIN") return 403
```

---

### MEDIUM-05 — Enrollment không check capacity

**File:** `src/modules/class/services/class.service.ts`, method `assignStudentToClass`  
**Rule vi phạm:** `business-rules.md §6.2, §7.2`

```ts
export async function assignStudentToClass(classId, studentId) {
  return prisma.classStudent.upsert({
    // Không check student_count < max_students trước khi thêm
    ...
  });
}
```

---

### MEDIUM-06 — Dashboard admin tính toán sai vì thiếu pagination

**File:** `src/app/(protected)/admin/page.tsx`

Dashboard gọi API không có `pageSize`:

```ts
const paymentsRes = await fetch("/api/payments");    // Chỉ lấy 10 record
const feesRes = await fetch("/api/student-fees");   // Chỉ lấy 10 record
```

Tổng doanh thu, nợ học phí hiển thị dựa trên 10 record đầu → số liệu sai hoàn toàn.

---

### MEDIUM-07 — Teacher list response shape không nhất quán

**File:** `src/app/api/teachers/route.ts`

```ts
// teacher/route.ts — SAI: trả { items: result.teachers, ... }
return NextResponse.json({
  items: result.teachers,   // map teachers → items
  total: result.total,
  ...
});
```

Trong khi `getTeachers()` service trả `{ teachers, total, ... }`. Route phải map lại. Các module khác (student, class) trả trực tiếp `result` từ service (cũng sai về contract nhưng ít nhất nhất quán nội bộ).

---

### MEDIUM-08 — Receipt number không đúng format spec

**File:** `src/modules/finance/receipts/services/receipt.service.ts`  
**Rule vi phạm:** `business-rules.md §13.2`

```ts
// Hiện tại: PT1718000000123 (timestamp + random)
const receiptNumber = `PT${timestamp}${random}`;

// Business rules ví dụ: RC2026060001 (prefix + YYYYMM + seq)
```

Ngoài format sai, việc dùng `Math.random()` có thể tạo collision trong hệ thống concurrent.

---

### MEDIUM-09 — Teacher email rule chưa enforce

**File:** `src/modules/teacher/services/teacher.service.ts`  
**Rule vi phạm:** `business-rules.md §3.3`

Khi teacher có `userId != null`, email phải lấy từ `users.email`, không cho sửa riêng. Hiện tại `updateTeacher` vẫn cho update `email` bình thường không check `userId`.

---

### LOW-01 — `pages/_document.tsx` còn sót trong App Router project

**File:** `src/pages/_document.tsx`

Project đang dùng Next.js App Router nhưng còn file legacy Pages Router. Có thể gây conflict.

---

### LOW-02 — `eslint-disable` trong code

**File:** `src/hooks/useList.ts` dòng 65  
**Rule vi phạm:** `coding-rules.md §1`

```ts
// eslint-disable-next-line react-hooks/exhaustive-deps
```

---

### LOW-03 — Module thiếu `hooks/` và `types/` folders theo architecture

**Files:** `src/modules/student/`, `src/modules/teacher/`, `src/modules/room/`, `src/modules/class/`  
**Rule vi phạm:** `architecture.md §3`

Mỗi module phải có:

```
components/
hooks/      ← thiếu
services/
schemas/
types/      ← thiếu
```

Hiện chỉ có `components/`, `services/`, `schemas/`.

---

### LOW-04 — `staff/` route không có actual pages

**File:** `src/app/(protected)/staff/page.tsx`

Page này chỉ hiện "Staff Workspace" placeholder. Không có pages thực cho STAFF. Toàn bộ feature đang ở `/admin/*` và STAFF không vào được vì `ROLE_ROUTE_RULES` không cover `/admin/*`.

---

### LOW-05 — `amount.min(0)` thay vì `amount.min(1)` trong fee schema

**File:** `src/modules/finance/student-fees/schemas/student-fee.schema.ts`  
**Rule vi phạm:** `business-rules.md §9.2` — "amount > 0"

```ts
amount: z.number().min(0, "Amount must be positive"),  // min(0) cho phép amount = 0
// Đúng: z.number().min(1, ...)  hoặc .positive()
```

---

## 2. Source code đang lệch so với docs

| Điểm lệch | Docs nói | Code đang làm |
|-----------|----------|---------------|
| Response format | `{ success, data }` / `{ success, error: { code, message } }` | Raw data / `{ error: string }` |
| HTTP method update | `PATCH` | `PUT` |
| Pagination param | `pageSize` | `limit` |
| Money type | `Decimal` | `Float` |
| Delete guard | Check trước khi xóa | Hard delete trực tiếp |
| Payment overpay check | Không vượt `actual_amount` (`amount - discount`) | Chỉ check `amount` (không trừ discount) |
| Bulk fee transaction | Rollback toàn bộ nếu fail | Skip lỗi, commit partial |
| FeeStatus enum | `UNPAID / PARTIAL / PAID` | `unpaid / partial / paid` |
| Receipt number format | `RC{YYYYMM}{seq}` | `PT{timestamp}{random}` |
| STAFF permissions | Có quyền CRUD nhiều module | Bị 403 toàn bộ |
| Teacher fullName | Required field | Không có trong schema/service |
| Teacher email rule | Nếu userId != null, không cho sửa email | Cho sửa email thoải mái |
| Payroll approve | Chỉ ADMIN | Chỉ check có session |
| Enrollment capacity | Check trước khi enroll | Không check |
| Dashboard stats | Tính toàn bộ data | Tính trên 10 records |

---

## 3. Thứ tự nên refactor

Ưu tiên theo mức độ risk và dependency:

1. **Teacher schema `fullName`** — Hiện đang broken, mọi create teacher đều fail
2. **FeeStatus enum lowercase** — Data corruption khi lưu
3. **Payment `actual_amount` calc** — Logic tài chính sai
4. **Delete guards** — Có thể xóa mất dữ liệu tài chính
5. **Bulk fee transaction** — Partial commit, inconsistent state
6. **API Response format** — Ảnh hưởng toàn bộ frontend
7. **HTTP PUT → PATCH** — API contract violation
8. **Permissions / STAFF access** — Role-based access broken
9. **Float → Decimal** — Data integrity dài hạn
10. **Pagination `limit` → `pageSize`** — Breaking change cần sync frontend+backend

---

## 4. Refactor Roadmap theo từng Phase

---

### Phase 1 — Critical Bug Fixes (Ưu tiên: P0 — Làm trước, ảnh hưởng production)

**Mục tiêu:** Fix các lỗi đang gây data corruption hoặc runtime errors

**Việc cần làm:**
- [ ] Fix teacher schema: thêm `fullName` vào `teacherCreateSchema` và `buildTeacherCreateInput`
- [ ] Fix FeeStatus enum: đổi `"unpaid"/"partial"/"paid"` → `"UNPAID"/"PARTIAL"/"PAID"` trong student-fee.service.ts và student-fee.schema.ts
- [ ] Fix payment validation: dùng `fee.amount - fee.discount` thay vì `fee.amount` trong createPayment và calculateDebt
- [ ] Fix `studentFeeCreateSchema` amount validation: `min(0)` → `z.number().positive()`

**Rủi ro:** Low — pure bugfixes, không thay đổi behavior của data đúng  
**Dependency:** Không phụ thuộc phase khác  
**Checklist sau phase:**
- POST `/api/teachers` tạo được teacher với fullName
- Tạo payment không vượt `amount - discount`
- FeeStatus trong DB lưu đúng uppercase

---

### Phase 2 — Business Rules Guards (Ưu tiên: P1 — Bảo vệ data integrity)

**Mục tiêu:** Thêm guard trước mọi delete operation theo business rules

**Việc cần làm:**
- [ ] `deleteStudent`: check không có `classStudents`, `studentFees`, `payments` trước khi xóa
- [ ] `deleteTeacher`: check không có `classes` (as teacherId), `payrolls` trước khi xóa
- [ ] `deleteClass`: check không có `studentFees` có payment/receipt trước khi xóa
- [ ] `deleteRoom`: check không có `classes`, `classSchedules` trước khi xóa
- [ ] `removeStudentFromClass`: check không có `studentFees` trước khi remove (trừ ADMIN force)
- [ ] `assignStudentToClass`: check `student_count < max_students` trước khi enroll
- [ ] Fix payroll approve: thêm role check `session.user.role === "ADMIN"`

**Rủi ro:** Medium — thay đổi behavior của delete, có thể break existing admin workflows nếu họ đã dùng delete thoải mái  
**Dependency:** Cần hoàn thành Phase 1  
**Checklist sau phase:**
- DELETE teacher đang có class assignment → 409
- DELETE student đang có studentFee → 409
- Enroll khi class full → 409
- STAFF không thể approve payroll

---

### Phase 3 — Transaction Consistency (Ưu tiên: P1)

**Mục tiêu:** Đảm bảo mọi multi-step operation là atomic

**Việc cần làm:**
- [ ] Wrap `createPayment + updateFeeStatus` trong `prisma.$transaction()`
- [ ] Refactor `createBulkFeesForClass` sang `prisma.$transaction()` thay vì for-loop với try-catch
- [ ] Verify teacher-payroll creation đã dùng transaction (đã có — chỉ verify)

**Rủi ro:** Low — chỉ thêm transaction wrapper, không đổi logic  
**Dependency:** Phase 1, Phase 2  
**Checklist sau phase:**
- Bulk fee create: nếu 1 record fail → toàn bộ rollback
- Payment create + fee status update là atomic

---

### Phase 4 — API Contract Alignment (Ưu tiên: P2)

**Mục tiêu:** Chuẩn hóa toàn bộ API theo contract

**Việc cần làm:**
- [ ] Chuẩn hóa response format tất cả routes → `{ success: true, data: ... }` / `{ success: false, error: { code, message } }`
- [ ] Đổi tất cả `PUT` → `PATCH` trong `[id]/route.ts` files
- [ ] Đổi pagination param `limit` → `pageSize` (cần sync cả frontend hooks và backend)
- [ ] Fix error status codes: dùng 409 cho conflict, 422 cho validation fail thay vì 400 cho tất cả
- [ ] Fix receipt number format: `RC{YYYYMM}{seq}` với sequential counter thay vì timestamp+random

**Rủi ro:** High — breaking change cho toàn bộ API consumers. Cần update `useList.ts` và tất cả component gọi API cùng lúc  
**Dependency:** Phase 1, 2, 3  
**Checklist sau phase:**
- Tất cả API responses có `{ success, data }` shape
- Frontend `useList` hook parse đúng
- Receipt numbers unique và đúng format

---

### Phase 5 — Permissions & Role Access (Ưu tiên: P2)

**Mục tiêu:** Implement đúng permissions matrix

**Việc cần làm:**
- [ ] Cập nhật `API_ROLE_RULES` theo permissions matrix: STAFF có quyền trên students, teachers, classes, student-fees, payments, receipts
- [ ] Tạo actual pages cho STAFF ở `/staff/*` hoặc tái cấu trúc routing
- [ ] Hoặc: dùng chung `/admin/*` pages nhưng filter UI theo role (render actions khác nhau cho ADMIN vs STAFF)
- [ ] Thêm backend role check vào từng API nếu cần per-action granularity (e.g., STAFF không thể delete, chỉ ADMIN)
- [ ] Thêm TEACHER-specific read endpoints (chỉ xem class/schedule của mình)
- [ ] Enforce teacher email rule: nếu `userId != null`, không cho update email field riêng

**Rủi ro:** High — ảnh hưởng toàn bộ user experience, cần thiết kế lại routing strategy  
**Dependency:** Phase 4  
**Checklist sau phase:**
- STAFF login được và dùng được student, class, payment features
- TEACHER chỉ thấy data của mình
- STAFF không approve payroll được

---

### Phase 6 — Data Type & Long-term Integrity (Ưu tiên: P3)

**Mục tiêu:** Fix technical debt về data types

**Việc cần làm:**
- [ ] Migrate `Float` → `Decimal` trong Prisma schema cho tất cả monetary fields (`tuitionFee`, `amount`, `discount`, `revenue`, `salaryAmount`, `centerFee`, `fee`, `salary`, `commissionPercentage`)
- [ ] Update tất cả service code để handle `Decimal` type thay vì `number`
- [ ] Xóa `src/pages/_document.tsx` (legacy)
- [ ] Thêm `hooks/` và `types/` folders vào các modules còn thiếu
- [ ] Fix dashboard stats: thêm aggregate query thay vì fetch paginated rồi sum

**Rủi ro:** High — migration schema yêu cầu Prisma migrate, cần backup data trước  
**Dependency:** Tất cả phases trước  
**Checklist sau phase:**
- Tính lương không có floating point errors
- Dashboard tính đúng tổng doanh thu

---

## 5. Dependency map giữa các phases

```
Phase 1 (Bug Fixes)
    ↓
Phase 2 (Delete Guards) → Phase 3 (Transactions)
    ↓                          ↓
Phase 4 (API Contract)
    ↓
Phase 5 (Permissions)
    ↓
Phase 6 (Data Types + Cleanup)
```

Phase 2 và 3 có thể song song sau Phase 1.  
Phase 4 phải chờ Phase 1+2+3 để không conflict.  
Phase 6 phải làm cuối vì schema migration ảnh hưởng tất cả layers.

---

## Ghi chú bổ sung

1. **Không có audit log** — Business rules §1.6 yêu cầu audit log cho mọi thao tác tài chính. Hiện không có bảng hoặc logic nào cho điều này.
2. **Không có QR code và Payment Notice** — `business-requirements.md §10, §11` mô tả `payment_qr_codes` table và bill tạm, nhưng không tồn tại trong schema.prisma hay codebase.
3. **`payroll/` module folder song song với `finance/teacher-payroll/`** — `src/modules/payroll/services/` tồn tại bên cạnh `src/modules/finance/teacher-payroll/`. Có thể là duplicate/dead code.
