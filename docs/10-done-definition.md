# Done Definition

Version: 1.0
Priority: CRITICAL

Mục đích:

Một task KHÔNG được xem là hoàn thành nếu chưa đạt đủ checklist dưới đây.

---

## 1. Điều kiện hoàn thành bắt buộc

Một task chỉ được DONE khi:

```text
Code đã sửa xong

Không có TypeScript error

Lint pass

Build pass

Không phá business rules

Không duplicate component

Không tạo technical debt mới

Đã test theo test-guidelines.md

Có báo cáo file đã sửa
```

Nếu thiếu một điều kiện:

```text
Task = NOT DONE
```

---

## 2. Static Checks

Bắt buộc chạy:

```bash
npm run typecheck
npm run lint
npm run build
```

Kết quả phải:

```text
PASS
PASS
PASS
```

Không được bỏ qua build nếu sửa:

```text
API
Page
Layout
Schema
Prisma
Database
```

---

## 3. Code Review Checklist

Kiểm tra:

```text
Không dùng any

Không dùng eslint-disable

Không duplicate code

Không hard-code business status

Không thêm thư viện không cần thiết

Có tái sử dụng component chung

Không viết logic sai layer
```

---

## 4. Business Validation

Sau khi sửa phải kiểm tra:

```text
Business rules còn đúng

Permission không bị phá

API contract không thay đổi

Response format không thay đổi

Database relation không bị ảnh hưởng
```

---

## 5. UI Checklist

Nếu sửa UI:

```text
Layout không vỡ

Responsive cơ bản OK

Snackbar hoạt động

Dialog hoạt động

Loading state OK

Empty state OK

Validation hiển thị đúng
```

---

## 6. API Checklist

Nếu sửa API:

```text
Success case pass

Validation fail pass

Not found pass

Permission fail pass

Business rule fail pass

Pagination hoạt động
```

---

## 7. Database Checklist

Nếu sửa Prisma/DB:

```bash
npx prisma validate
npx prisma generate
```

Nếu có migration:

```bash
npx prisma migrate dev
```

Kiểm tra:

```text
Relation đúng

Enum đúng

Seed chạy được
```

---

## 8. Regression Test

Nếu sửa module A phải test module liên quan.

Ví dụ:

### Student sửa

Kiểm tra:

```text
Enrollment

Student Fees

Payment
```

### Payment sửa

Kiểm tra:

```text
Receipt

Student Fee Status

Debt Report

Dashboard Revenue
```

---

## 9. Report Format bắt buộc

Sau khi hoàn thành task phải báo:

```text
Task completed

Files changed:
- src/modules/student/services/student.service.ts
- src/app/api/students/route.ts

Tests:
- npm run typecheck -> PASS
- npm run lint -> PASS
- npm run build -> PASS

Manual tests:
- create student -> PASS
- update student -> PASS
- delete student -> PASS

Known issues:
- none
```

Không được báo:

```text
Done

Fixed

Implemented
```

---

## 10. Conditions = NOT DONE

Task chưa hoàn thành nếu:

```text
Chưa chạy build

Có TypeScript error

Chưa test business flow

Có TODO chưa xử lý nhưng không báo

Có duplicate code mới

Có lint error

Có broken UI
```

---

## 11. Rules for AI Coding Agent

AI bắt buộc:

```text
Sau mỗi chỉnh sửa phải tự kiểm tra checklist

Nếu không chạy được test phải nói rõ lý do

Nếu build fail phải tiếp tục sửa

Nếu chưa chắc phải báo incomplete
```

AI không được:

```text
Nói completed khi chưa test

Nói fixed khi chưa build

Bỏ qua lint/typecheck

Ẩn lỗi chưa xử lý
```

---

## FINAL RULE

Chỉ được phép nói:

```text
Task completed
```

khi toàn bộ checklist PASS.
