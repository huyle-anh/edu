# Development Rules - Education Center

Đây là tài liệu gốc cho toàn bộ dự án.

Trạng thái triển khai hiện hành được tóm tắt tại [11-current-system.md](./11-current-system.md). Khi tài liệu đặc tả cũ còn mô tả tạo học phí thủ công, áp dụng quy trình hiện hành trong tài liệu này và các business rules mới.

User quản trị đã đăng nhập dùng quyền chung; tài khoản liên kết giáo viên chỉ
được vào điểm danh lớp được phân công. Chi tiết tại
[09-permissions-matrix.md](./09-permissions-matrix.md).

Nghiệp vụ điểm danh giáo viên đã được bổ sung theo đặc tả trong
`11-current-system.md`. Nghiệp vụ phòng học và bảng lương giáo viên vẫn nằm
ngoài phạm vi. Báo cáo thu học phí theo lớp/môn vẫn sử dụng tỷ lệ trích của
giáo viên để tính phần còn lại của doanh thu; đây là báo cáo thu, không phải
bảng lương. Mọi mô tả bảng lương còn sót trong migration, báo cáo audit hoặc
tài liệu refactor cũ chỉ là lịch sử kỹ thuật, không phải yêu cầu hiện hành.

Mọi AI Coding Agent (Codex, GitHub Copilot, Claude Code…) bắt buộc đọc file này trước khi sửa code.

---

# 1. Document Priority (thứ tự ưu tiên)

Nếu nhiều file mâu thuẫn, ưu tiên theo thứ tự sau:

```text
Priority 1 → business-rules.md

Priority 2 → business-requirements.md

Priority 3 → api-contract.md

Priority 4 → architecture.md

Priority 5 → permissions-matrix.md

Priority 6 → component-guidelines.md

Priority 7 → ui-guidelines.md

Priority 8 → coding-rules.md

Priority 9 → test-guidelines.md

Priority 10 → done-definition.md
```

---

# 2. Khi thực hiện task phải đọc file nào

## Nếu sửa Database

Bắt buộc đọc:

```text
business-requirements.md
business-rules.md
architecture.md
coding-rules.md
done-definition.md
```

---

## Nếu sửa API

Bắt buộc đọc:

```text
business-rules.md
api-contract.md
permissions-matrix.md
coding-rules.md
test-guidelines.md
done-definition.md
```

---

## Nếu sửa UI

Bắt buộc đọc:

```text
ui-guidelines.md
component-guidelines.md
business-rules.md
coding-rules.md
test-guidelines.md
done-definition.md
```

---

## Nếu sửa business logic

Bắt buộc đọc:

```text
business-rules.md
api-contract.md
architecture.md
coding-rules.md
test-guidelines.md
done-definition.md
```

---

# 3. Không được phép

AI không được:

```text
Tự thay đổi business rules

Đổi API contract

Tạo component duplicate

Bypass permission

Hard delete dữ liệu tài chính

Bỏ qua build/test rồi báo done
```

---

# 4. Quy trình bắt buộc

Mọi task phải theo flow:

```text
Read docs

Analyze impact

Implement code

Run tests

Run build

Check business rules

Review changed files

Report result
```

---

# 5. Final Rule

Không được phép báo:

```text
Done

Fixed

Implemented
```

nếu chưa pass:

```bash
npm run lint
npm run typecheck
npm run build
```
