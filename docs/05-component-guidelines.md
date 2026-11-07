# Component Guidelines - Hệ thống quản lý trung tâm đào tạo

Version: 1.0
Priority: HIGH
Mục đích: Quy định thống nhất toàn bộ component UI dùng chung trong dự án.

Nếu component đã tồn tại, AI coding agent bắt buộc tái sử dụng, không tự tạo component mới trùng chức năng.

---

# 1. Nguyên tắc chung

Mọi module trong hệ thống phải ưu tiên dùng component dùng chung.

Không được:

```text
Mỗi màn hình tự tạo TextField riêng

Mỗi màn hình tự format tiền khác nhau

Mỗi màn hình tự tạo Dialog riêng

Mỗi màn hình tự render status khác nhau
```

Mục tiêu:

```text
UI thống nhất

Code dễ maintain

Tái sử dụng component tối đa

Không duplicate code
```

Nguyên tắc:

```text
Nếu component đã tồn tại → bắt buộc dùng lại

Nếu chưa có → tạo component chung trước

Không tạo logic UI riêng lẻ trong page
```

---

# 2. Cấu trúc component chung

Cấu trúc thư mục:

```text
src/components/

  forms/
  data-display/
  dialogs/
  feedback/
  layout/
  common/
```

Chi tiết:

```text
src/components/forms
  AppTextField.tsx
  AppNumberField.tsx
  AppMoneyField.tsx
  AppDateField.tsx
  AppMonthField.tsx
  AppTimeField.tsx
  AppSelectField.tsx
  AppSwitchField.tsx
  AppTextareaField.tsx

src/components/data-display
  AppStatusChip.tsx
  BaseTable.tsx
  RowActions.tsx

src/components/dialogs
  ConfirmDialog.tsx
  StudentSelectDialog.tsx
  TeacherSelectDialog.tsx
  ClassSelectDialog.tsx

src/components/feedback
  LoadingOverlay.tsx
  EmptyState.tsx

src/components/common
  SectionCard.tsx
  PageHeader.tsx
```

---

# 3. Text Input

Dùng cho:

```text
Họ tên
Email
Mã
Địa chỉ
Tên lớp
Chuyên môn
```

Không được dùng trực tiếp:

```tsx
<TextField />
```

Phải dùng:

```tsx
<AppTextField
  control={control}
  name="fullName"
  label="Họ tên"
  required
/>
```

Rule:

```text
Tự bind React Hook Form

Tự show helperText

Tự show error

fullWidth mặc định
```

Không lặp lại:

```tsx
<Controller />
```

ở từng page nếu không cần.

---

# 4. Number Input

Dùng cho:

```text

Số buổi học

Số lượng học viên tối đa

Tỷ lệ commission
```

Không dùng:

```tsx
<TextField type="number" />
```

Phải dùng:

```tsx
<AppNumberField
  control={control}
  name="capacity"
  label="Sức chứa"
  min={1}
  max={100}
/>
```

Rule:

```text
Chỉ nhập số

Không cho nhập chữ

Có min/max

Submit trả number
```

Không để:

```text
string
```

---

# 5. Money Input

Dùng cho:

```text
Học phí

Payment amount

Discount

Revenue

Center fee
```

Không dùng:

```tsx
<TextField />
```

Phải dùng:

```tsx
<AppMoneyField
  control={control}
  name="amount"
  label="Số tiền"
/>
```

Rule:

```text
Format VND

Canh phải

Không cho nhập âm

Không cho nhập ký tự lạ

Submit value là number
```

Hiển thị:

```text
3.000.000 ₫
```

Không hiển thị:

```text
3000000
```

---

# 6. Date Input

Dùng cho:

```text
Ngày sinh

Ngày bắt đầu lớp

Ngày kết thúc lớp

Payment date

Receipt date
```

Phải dùng:

```tsx
<AppDateField
  control={control}
  name="startDate"
  label="Ngày bắt đầu"
/>
```

Rule:

Hiển thị:

```text
dd/MM/yyyy
```

Submit:

```text
yyyy-MM-dd
```

Không hiển thị:

```text
2026-06-18T00:00:00Z
```

---

# 7. Month Input

Dùng cho:

```text
Tháng học phí

Tháng lương
```

Phải dùng:

```tsx
<AppMonthField
  control={control}
  name="month"
  label="Tháng"
/>
```

Format submit:

```text
yyyy-MM
```

Ví dụ:

```text
2026-06
```

---

# 8. Time Input

Dùng cho:

```text
Giờ bắt đầu

Giờ kết thúc
```

Phải dùng:

```tsx
<AppTimeField
  control={control}
  name="startTime"
  label="Giờ bắt đầu"
/>
```

Format:

```text
HH:mm
```

Ví dụ:

```text
18:30
```

---

# 9. Select Field

Chỉ dùng select cho dữ liệu nhỏ.

Cho phép:

```text
Status

Role

Payment method

Day of week
```

Ví dụ:

```tsx
<AppSelectField
  control={control}
  name="status"
  label="Trạng thái"
  options={studentStatusOptions}
/>
```

Không dùng select cho:

```text
Student

Teacher

Class


Student Fee
```

---

# 10. Select Dialog Pattern

Các dữ liệu lớn phải dùng dialog.

Danh sách:

```text
StudentSelectDialog

TeacherSelectDialog

ClassSelectDialog

StudentFeeSelectDialog
```

Pattern:

```text
Readonly text field

Button chọn

Mở dialog

Search

Table

Pagination

Select
```

Ví dụ:

```text
[ST001 - Nguyễn Văn A] [Chọn]
```

Không làm:

```tsx
<Select>
  1000 students...
</Select>
```

---

# 11. Status Chip

Không render status raw.

Sai:

```tsx
{row.status}
```

Đúng:

```tsx
<AppStatusChip
  value={row.status}
  module="student"
/>
```

Ví dụ mapping:

```text
ACTIVE → Đang hoạt động

INACTIVE → Ngừng hoạt động

PAID → Đã thanh toán

UNPAID → Chưa thanh toán
```

Màu sắc thống nhất.

---

# 12. Base Table

Tất cả màn hình list phải dùng:

```tsx
<BaseTable />
```

Không tự tạo table mới cho từng module.

BaseTable hỗ trợ:

```text
Loading

Pagination

Search

Empty state

Sorting

Action column
```

---

# 13. Row Actions

Không viết icon action riêng từng màn hình.

Sai:

```tsx
<IconButton>
<Edit />
</IconButton>

<IconButton>
<Delete />
</IconButton>
```

Phải dùng:

```tsx
<RowActions
  onView={...}
  onEdit={...}
  onDelete={...}
/>
```

Actions chuẩn:

```text
View

Edit

Delete
```

Hoặc:

```text
Print

Download

Approve
```

---

# 14. Confirm Dialog

Dùng chung:

```tsx
<ConfirmDialog />
```

Không tạo confirm dialog riêng.

Ví dụ:

```tsx
<ConfirmDialog
  title="Xóa học viên"
  message="Bạn có chắc muốn xóa?"
  onConfirm={...}
/>
```

---

# 15. Snackbar

Dùng chung hook:

```tsx
useAppSnackbar()
```

Không dùng:

```tsx
alert()
```

Ví dụ:

```tsx
showSuccess("Đã lưu thành công")

showError("Có lỗi xảy ra")
```

---

# 16. Loading State

Dùng chung:

```tsx
<LoadingOverlay />
```

Hoặc:

```tsx
<CircularProgress />
```

Không để màn hình trắng khi loading API.

---

# 17. Empty State

Dùng component:

```tsx
<EmptyState />
```

Không viết text rải rác.

Ví dụ:

```text
Không có dữ liệu

Không tìm thấy kết quả phù hợp
```

---

# 18. Helper Functions

Toàn project dùng helper chung.

```text
formatCurrency()

formatDate()

formatMonth()

formatTime()

formatStatusLabel()
```

Ví dụ:

```tsx
formatCurrency(3000000)
```

Kết quả:

```text
3.000.000 ₫
```

Không format thủ công trong page.

Sai:

```tsx
amount.toLocaleString()
```

---

# 19. Form Layout

Form dài phải chia section.

Ví dụ:

```text
Thông tin cơ bản

Thông tin liên hệ

Thông tin tài chính
```

Dùng component:

```tsx
<SectionCard />
```

Ví dụ:

```tsx
<SectionCard title="Thông tin cơ bản">
```

Không tạo form quá dài một khối.

---

# 20. Page Header

Dùng chung:

```tsx
<PageHeader />
```

Ví dụ:

```tsx
<PageHeader
  title="Quản lý học viên"
  description="Quản lý thông tin học viên"
  actions={...}
/>
```

Không tự viết header mỗi màn hình.

---

# 21. React Hook Form Rules

Mọi form dùng:

```text
React Hook Form
```

Không làm:

```tsx
const [name, setName] = useState("")
```

Không tạo:

```tsx
onChange={(e)=>setValue(e.target.value)}
```

nếu field có thể bind RHF.

---

# 22. Không duplicate code

Không được:

```text
5 màn hình có 5 MoneyField khác nhau

5 màn hình có 5 ConfirmDialog khác nhau
```

Nguyên tắc:

```text
Nếu code giống nhau > 2 lần

Phải refactor component chung
```

---

# 23. Quy tắc tạo component mới

Nếu chưa có component.

Phải kiểm tra:

```text
src/components/
```

Nếu chưa tồn tại:

```text
Tạo component generic trước
```

Không tạo component dùng một lần nếu có thể reusable.

---

# 24. Rules cho AI Coding Agent

AI không được:

```text
Tạo TextField trực tiếp trong form

Tạo MoneyField riêng cho từng page

Format tiền thủ công

Format ngày thủ công

Tạo ConfirmDialog riêng

Tạo StatusChip riêng
```

AI bắt buộc:

```text
Kiểm tra src/components trước

Tái sử dụng component

Ưu tiên component generic

Không duplicate UI code
```

---

# 25. Final Rule

Trước khi tạo component mới, AI phải tự hỏi:

```text
Component này đã tồn tại chưa?

Có thể tái sử dụng component cũ không?

Có đang duplicate code không?
```

Nếu câu trả lời là:

```text
Có
```

Thì:

```text
Không được tạo component mới
```
