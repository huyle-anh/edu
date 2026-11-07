# Coding Rules - Education Center

Version: 1.0
Tech stack: Next.js + TypeScript + Prisma + PostgreSQL + MUI + React Hook Form + Zod

---

# 1. Nguyên tắc chung

* Không tự ý thay đổi nghiệp vụ.
* Luôn đọc `docs/business-rules.md` trước khi code.
* Không sửa nhiều module không liên quan.
* Không thêm thư viện mới nếu chưa cần.
* Không bỏ validation để code nhanh hơn.
* Không dùng `any`.
* Không dùng `eslint-disable`.
* Không dùng `document.querySelector`.
* Không hard-code dữ liệu nghiệp vụ trong UI.

---

# 2. TypeScript Rules

Bắt buộc:

```ts
strict: true
noImplicitAny: true
noUncheckedIndexedAccess: true
```

Không dùng:

```ts
any
as any
// @ts-ignore
// @ts-expect-error nếu không có lý do rõ ràng
```

Ưu tiên:

```ts
type
interface
z.infer<typeof schema>
Prisma generated types
```

---

# 3. Folder Structure

Mỗi module nên có cấu trúc:

```text
src/modules/student/
  components/
  hooks/
  services/
  schemas/
  types/
```

Không để toàn bộ logic trong `page.tsx`.

---

# 4. API Rules

API phải theo format:

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

API bắt buộc validate:

* Auth
* Permission
* Input schema
* Business rules
* Database constraints

---

# 5. Prisma Rules

* Không query trực tiếp trong component.
* Prisma chỉ dùng ở server/service layer.
* Transaction bắt buộc cho nghiệp vụ nhiều bước.

Bắt buộc transaction cho:

```text
create tuition fees theo lớp
create tuition fees + payment batches khi tạo thông báo
create payment + update fee status + receipt
```

Không hard delete dữ liệu tài chính:

```text
tuition_fees
payments
receipts
```

---

# 6. React Rules

* Form dùng React Hook Form.
* Validation dùng Zod.
* Không quản lý form bằng nhiều `useState`.
* Không gọi API trực tiếp rải rác trong component.
* Tách API call vào service/hook.

Không làm:

```ts
const [name, setName] = useState("");
const [email, setEmail] = useState("");
```

Nên làm:

```ts
const form = useForm<FormData>({
  resolver: zodResolver(schema),
});
```

---

# 7. UI Rules

* Giao diện tiếng Việt.
* Dùng MUI.
* Status dùng Chip.
* Tiền format VND.
* Ngày format `dd/MM/yyyy`.
* Không dùng select dài cho student/class/teacher.
* Dùng dialog chọn dữ liệu.

---

# 8. Error Handling

Không hiển thị lỗi kỹ thuật raw cho user.

Không hiển thị:

```text
PrismaClientKnownRequestError
Foreign key constraint failed
```

Hiển thị:

```text
Không thể xóa dữ liệu vì đã phát sinh nghiệp vụ liên quan.
```

---

# 9. Naming Rules

Database:

```text
snake_case
```

TypeScript:

```text
camelCase
```

Prisma dùng `@map` để mapping.

Ví dụ:

```prisma
fullName String @map("full_name")
createdAt DateTime @map("created_at")
```

---

# 10. Test Commands

Sau khi sửa code phải chạy:

```bash
npm run lint
npm run typecheck
npm run build
```

Nếu có test:

```bash
npm run test
```

---

# 11. Rules for AI Agent

AI coding agent bắt buộc:

1. Đọc `docs/business-requirements.md`.
2. Đọc `docs/business-rules.md`.
3. Đọc `docs/ui-guidelines.md`.
4. Không tự đổi schema nếu chưa cần.
5. Không bỏ rule nghiệp vụ.
6. Không tạo receipt nếu chưa có payment.
7. Payment SUCCESS không được làm tổng tiền đã thu vượt `tuitionFee.finalAmount`; payment từng phần phải cập nhật số dư và trạng thái học phí trong cùng transaction.
8. Không hard delete dữ liệu tài chính.
9. Sau khi sửa phải báo rõ file đã sửa.
10. Nếu chưa chắc, thêm TODO rõ ràng thay vì tự suy diễn.
