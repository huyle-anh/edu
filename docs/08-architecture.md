# Architecture - Hệ thống quản lý trung tâm đào tạo

Version: 1.0
Priority: HIGH

## 1. Nguyên tắc kiến trúc

* Tách rõ UI, Business Logic, Data Access.
* Không viết business logic trong component React.
* Không query database trực tiếp từ API route.
* Không import chéo module lung tung.
* Mỗi module độc lập tương đối.

Kiến trúc bắt buộc:

```text
UI Layer
↓
Hook Layer
↓
Service Layer (frontend)
↓
API Layer
↓
Service Layer (backend)
↓
Prisma Repository
↓
PostgreSQL
```

---

## 2. Cấu trúc thư mục

```text
src/

app/
  (protected)/
  login/
  api/

modules/
  students/
  teachers/
  classes/
  schedules/
  student-fees/
  payments/
  receipts/

components/
  forms/
  dialogs/
  data-display/
  layout/
  feedback/

hooks/

lib/
  prisma.ts
  auth.ts

utils/
constants/
types/
schemas/
```

---

## 3. Module structure chuẩn

Ví dụ Student:

```text
src/modules/student/

components/
hooks/
services/
schemas/
types/
constants/
```

Không để:

```text
page.tsx > 500 lines
```

---

## 4. Frontend Rules

Page chỉ làm:

```text
Render UI
Call hook
Handle local UI state
```

Không làm:

```text
Business validation
API logic phức tạp
Transform data lớn
```

---

## 5. API Route Rules

Ví dụ:

```text
src/app/api/students/route.ts
```

Route chỉ làm:

```text
Read request
Validate request
Check auth
Call service
Return response
```

Không làm:

```ts
await prisma.student.create()
```

trực tiếp trong route.

---

## 6. Backend Service Rules

Service chịu trách nhiệm:

* Business validation
* Database transaction
* Prisma query
* Mapping response

Ví dụ:

```ts
createStudent()
updatePayment()
generateStudentFee()
createReceipt()
```

---

## 7. Transaction Layer

Bắt buộc transaction cho:

```text
Create student fee + QR + bill
Create payment + update fee status + receipt
```

Prisma:

```ts
prisma.$transaction(async (tx) => {})
```

---

## 8. Forbidden Architecture

Không được:

```text
Page → fetch trực tiếp lung tung
Page → gọi Prisma
Route → chứa 300 dòng business logic
Component → query database
```

---

## 9. AI Agent Rules

AI bắt buộc:

* Kiểm tra structure trước khi tạo file mới
* Không phá folder structure
* Không thêm service trùng chức năng
* Không đặt logic sai layer
