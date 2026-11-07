# Hướng dẫn UI - Hệ thống quản lý trung tâm đào tạo

Version: 2.0
Style: Admin Dashboard
Ngôn ngữ giao diện: Tiếng Việt
Tech stack: Next.js + React + TypeScript + MUI + React Hook Form + Zod

---

# 1. Mục tiêu UI

Giao diện được thiết kế cho nhân viên trung tâm sử dụng hằng ngày để quản lý:

- Học viên
- Giáo viên
- Lớp học
- Lịch học
- Học phí
- QR thanh toán
- Bill tạm
- Thanh toán
- Biên lai
- Báo cáo

Nguyên tắc chính:

- Dễ hiểu
- Ít thao tác
- Dữ liệu rõ ràng
- Trạng thái dễ nhận biết
- Không làm người dùng phải đoán
- Không hiển thị thuật ngữ kỹ thuật cho người dùng cuối

---

# 2. Phong cách giao diện

Dùng phong cách **Admin Dashboard**.

Bố cục tổng thể:

```text
+------------------------------------------------------+
| Topbar                                               |
+----------------------+-------------------------------+
| Sidebar              | Main Content                  |
|                      |                               |
| Dashboard            | Page title                    |
| Học viên             | Search / Filter               |
| Giáo viên            | Action buttons                |
| Lớp học              | Table / Form / Detail         |
| Học phí              | Pagination                    |
| Thanh toán           |                               |
| Báo cáo              |                               |
+----------------------+-------------------------------+
```

---

# 3. Layout chính

## 3.1 Sidebar

Sidebar nằm bên trái.

Menu gợi ý:

```text
Tổng quan

Quản lý đào tạo
- Học viên
- Giáo viên
- Lớp học
- Đăng ký lớp
- Lịch học

Tài chính
- Học phí
- Bill tạm
- Thanh toán
- Biên lai
- Công nợ

Hệ thống
- Người dùng
- Cấu hình
```

Rule:

- Menu đang chọn phải được highlight.
- Menu có icon.
- Sidebar có thể thu gọn.
- Khi thu gọn chỉ hiển thị icon.
- Không dùng tên tiếng Anh cho menu.

## 3.2 Topbar

Topbar hiển thị:

- Tên hệ thống
- Nút mở/đóng sidebar
- Tên user đang đăng nhập
- Nút đăng xuất

Ví dụ:

```text
Trung tâm đào tạo ABC                      Nguyễn Văn A
```

## 3.3 Main content

Mỗi màn hình gồm:

```text
Page Header
Search / Filter Area
Primary Actions
Data Table
Pagination
```

---

# 4. Quy chuẩn page header

Mỗi page phải có:

- Tiêu đề tiếng Việt
- Mô tả ngắn nếu cần
- Nút thao tác chính nằm bên phải

Ví dụ:

```text
Quản lý học viên
Theo dõi hồ sơ và trạng thái học viên

                                      [+ Thêm học viên]
```

Không dùng title chung chung như:

```text
List
Management
Data
```

---

# 5. Quy chuẩn danh sách

## 5.1 Cấu trúc màn hình list

Màn hình list chuẩn:

```text
[Tiêu đề màn hình]                         [Nút thêm mới]

[Khối tìm kiếm / bộ lọc]

[Bảng dữ liệu]

[Phân trang]
```

## 5.2 Search / Filter

Khối tìm kiếm nên đặt trong `Paper` hoặc `Card`.

Rule:

- Có input tìm kiếm chính.
- Có filter trạng thái nếu module có status.
- Có nút `Tìm kiếm`.
- Có nút `Làm mới`.
- Nhấn Enter trong ô tìm kiếm phải thực hiện tìm kiếm.
- Khi search mới phải reset page về 1.
- Không gọi API liên tục theo từng ký tự nếu chưa debounce.

Ví dụ:

```text
[Tìm theo mã, tên, số điện thoại...] [Trạng thái] [Tìm kiếm] [Làm mới]
```

## 5.3 Table

Rule:

- Có loading state.
- Có empty state.
- Có pagination.
- Cột thao tác nằm cuối bảng.
- Status dùng Chip.
- Tiền phải format VND.
- Ngày phải format dd/MM/yyyy.
- Không hiển thị UUID nếu không cần.

Empty state:

```text
Không có dữ liệu
```

Nếu đang search:

```text
Không tìm thấy dữ liệu phù hợp
```

Loading state:

- Dùng Skeleton hoặc loading của Table/DataGrid.
- Không để màn hình trắng.

---

# 6. Quy chuẩn form

## 6.1 Công nghệ form

Tất cả form phải dùng:

```text
React Hook Form + Zod
```

Không tự quản lý từng field bằng nhiều `useState` nếu không cần.

## 6.2 Validation

Lỗi field hiển thị ngay dưới field bằng helper text.

Ví dụ:

```text
Mã học viên là bắt buộc
Số tiền phải lớn hơn 0
Ngày kết thúc phải lớn hơn ngày bắt đầu
```

Không dùng alert chung cho lỗi từng field.

## 6.3 Submit

Rule:

- Disable nút lưu khi đang submit.
- Hiển thị loading trên nút lưu.
- Lưu thành công thì đóng dialog hoặc quay lại list.
- Hiển thị snackbar thành công.
- Lỗi thì giữ nguyên form và hiển thị lỗi.

Nhãn nút:

```text
Lưu
Hủy
Cập nhật
Tạo mới
Xóa
Đóng
```

Không dùng:

```text
Submit
OK
Cancel
```

---

# 7. Dialog

Dùng dialog cho:

- Thêm mới
- Chỉnh sửa
- Xác nhận xóa
- Chọn học viên
- Chọn giáo viên
- Chọn lớp
- In bill tạm
- Ghi nhận thanh toán

Rule:

- Title rõ ràng.
- Button chính nằm bên phải.
- Button hủy nằm trước button chính.
- Không đóng dialog khi submit lỗi.
- Form dài dùng `maxWidth="md"` hoặc `maxWidth="lg"`.
- Dialog xác nhận phải có nội dung mô tả hậu quả.

Ví dụ confirm:

```text
Bạn có chắc muốn xóa học viên này?
Dữ liệu đã phát sinh học phí hoặc thanh toán sẽ không được phép xóa.
```

---

# 8. Không dùng select dài

Không dùng Select cho dữ liệu lớn như:

- Học viên
- Giáo viên
- Lớp học
- Khoản học phí

Thay bằng:

```text
TextField readonly + Button chọn
```

Ví dụ:

```text
[ST001 - Nguyễn Văn A] [Chọn học viên]
```

Khi bấm `Chọn học viên`, mở dialog chọn.

---

# 9. Dialog chọn dữ liệu

Áp dụng cho:

- StudentSelectDialog
- TeacherSelectDialog
- ClassSelectDialog
- StudentFeeSelectDialog

Cấu trúc:

```text
Title
Search input
Table
Pagination
Cancel
```

Khi chọn record:

- Trả về `id`
- Hiển thị `code + name`
- Không chỉ hiển thị UUID

Ví dụ:

```text
ST001 - Nguyễn Văn A
GV001 - Trần Thị B
ENG001 - English Beginner
```

---

# 10. Format dữ liệu

## 10.1 Tiền tệ

Tất cả tiền hiển thị dạng VND:

```text
3.000.000 ₫
```

Không hiển thị:

```text
3000000
```

Input tiền:

- Canh phải
- Không cho số âm nếu nghiệp vụ không cho phép
- Có thể hiển thị separator hàng nghìn

## 10.2 Ngày giờ

Ngày:

```text
dd/MM/yyyy
```

Tháng học phí:

```text
yyyy-MM
```

Giờ:

```text
HH:mm
```

Không hiển thị ISO raw:

```text
2026-06-18T10:00:00.000Z
```

---

# 11. Status Chip

Status phải hiển thị bằng Chip tiếng Việt.

Ví dụ:

```text
ACTIVE    -> Đang hoạt động
INACTIVE  -> Ngừng hoạt động

DRAFT     -> Nháp
COMPLETED -> Hoàn thành
CANCELLED -> Đã hủy

UNPAID    -> Chưa thanh toán
PAID      -> Đã thanh toán

SENT      -> Đã gửi
PRINTED   -> Đã in
```

Không hiển thị enum raw nếu người dùng không hiểu.

---

# 12. Dashboard

Dashboard là màn hình đầu tiên sau khi đăng nhập.

Nên hiển thị các card thống kê:

```text
Tổng số học viên
Lớp đang học
Học phí chưa thu
Thanh toán hôm nay
```

Các khu vực gợi ý:

```text
1. Thống kê nhanh
2. Công nợ học phí
3. Lịch học hôm nay
4. Thanh toán gần đây
5. Cảnh báo cần xử lý
```

Ví dụ cảnh báo:

```text
- 12 học viên chưa đóng học phí tháng 2026-06
- 3 lớp chưa có lịch học
```

---

# 13. Module Người dùng

## 13.1 List columns

```text
Email
Họ tên
Vai trò
Trạng thái
Ngày tạo
Thao tác
```

## 13.2 Form fields

```text
Email
Họ tên
Mật khẩu
Trạng thái
```

## 13.3 UI rules

- Password chỉ bắt buộc khi tạo mới.
- Khi chỉnh sửa user, không hiển thị password trực tiếp.
- Nếu cần đổi mật khẩu, dùng action riêng `Đổi mật khẩu`.
- Không hiển thị hoặc chỉnh sửa role; mọi user đã đăng nhập dùng chung một quyền.

---

# 14. Module Giáo viên

## 14.1 List columns

```text
Mã GV
Họ tên
Số điện thoại
Chuyên môn
Tỷ lệ trích (%)
Trạng thái
Thao tác
```

## 14.2 Form fields

```text
Họ tên
Số điện thoại
Số tài khoản ngân hàng
Chuyên môn
Tỷ lệ trích (%)
Trạng thái
```

## 14.3 UI rules

- Giáo viên không liên kết tài khoản đăng nhập và không sử dụng email.
- Mã giáo viên được hệ thống tự sinh và không được trùng.
- Tỷ lệ trích nằm trong khoảng `0..100`, dùng cho báo cáo thu học phí theo
  lớp/môn và không đại diện cho một bảng lương.

---

# 15. Module Học viên

## 15.1 List columns

```text
Mã HV
Họ tên
Số điện thoại
Phụ huynh
Trạng thái
Thao tác
```

## 15.2 Form fields

```text
Mã học viên
Họ tên
Số điện thoại
Ngày sinh
Tên phụ huynh
Địa chỉ
Trạng thái
```

## 15.3 UI rules

- Mã học viên bắt buộc.
- Họ tên bắt buộc.
- Trạng thái mặc định là `Đang học`.

---

# 16. Module Lớp học

## 16.1 List columns

```text
Mã lớp
Tên lớp
Giáo viên
Học phí
Số học viên
Trạng thái
Thao tác
```

## 16.2 Form fields

```text
Mã lớp
Tên lớp
Giáo viên phụ trách
Học phí
Tổng số buổi
Ngày bắt đầu
Ngày kết thúc
Trạng thái
```

## 16.3 UI rules

- Giáo viên chọn qua TeacherSelectDialog.
- Không dùng select dài.
- Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.
- Không cho xóa lớp nếu đã phát sinh học phí hoặc thanh toán.

---

# 17. Module Đăng ký học viên vào lớp

Màn hình nên có:

```text
Chi tiết lớp
Trang quản lý học viên
Trang học phí tháng
```

Rule:

- Chọn học viên qua StudentSelectDialog.
- Không cho thêm trùng học viên.
- Hiển thị danh sách học viên hiện tại của lớp.
- Đăng ký học viên không tự động tạo học phí.
- Trang chi tiết lớp chỉ hiển thị thống kê và liên kết đến nghiệp vụ chuyên biệt.
- Trang quản lý học viên có bộ lọc mã/tên, trạng thái, môn học và kỳ học phí.
- Bảng học viên có thao tác xem chi tiết, quản lý môn, tạm nghỉ và xóa khỏi lớp.
- Bỏ môn là thao tác riêng, không xóa toàn bộ học viên khỏi lớp.
- Môn cuối cùng không hiển thị thao tác bỏ môn; người dùng phải dùng `Rời lớp`.
- Học viên đã `LEFT` xuất hiện lại trong hộp chọn và có thể tái đăng ký môn.
- Tạm nghỉ phải chọn khoảng tháng bắt đầu/kết thúc và lý do; UI phải cho sửa
  hoặc hủy khoảng tạm nghỉ đã tạo.
- Với lớp chưa ở trạng thái `ACTIVE` (`DRAFT`, `COMPLETED` hoặc `CANCELLED`), màn hình chỉ cho xem và khóa toàn bộ nút
  đăng ký, thêm/bỏ môn, rời lớp và quản lý tạm nghỉ.

---

# 18. Module Lịch học

## 18.1 List columns

```text
Lớp
Giáo viên
Thứ
Giờ bắt đầu
Giờ kết thúc
Thao tác
```

## 18.2 Form fields

```text
Lớp
Giáo viên
Thứ trong tuần
Giờ bắt đầu
Giờ kết thúc
```

## 18.3 UI rules

- Khi chọn lớp, tự gợi ý giáo viên mặc định.
- Khi đổi giờ/giáo viên, gọi API check conflict.
- Nếu conflict, hiển thị lỗi rõ ràng.
- Không cho lưu nếu start_time >= end_time.

Ví dụ lỗi:

```text
Giáo viên đã có lớp khác trong cùng khung giờ.
```

---

# 19. Module Học phí

Học phí theo lớp được quản lý tại:

```text
/admin/classes/{classId}/tuition
```

Màn hình có bộ chọn kỳ `YYYY-MM`, thống kê số khoản phí, tổng phải thu, đã thanh toán và còn phải thu.

Các thao tác được tách riêng:

```text
Tạo học phí tháng
Tạo thông báo chuyển khoản
Thu học phí
```

`Tạo học phí tháng` không tạo payment batch. `Tạo thông báo chuyển khoản` là
thao tác riêng, có xác nhận, chỉ dùng khi muốn lập batch `BANK_TRANSFER`
`PENDING` cho cả lớp và xuất PDF; người dùng phải chọn tài khoản nhận tiền trong
dialog xác nhận. Từ từng khoản chưa thu, nhân viên mở `Thu học phí` để chọn
`CASH` hoặc `BANK_TRANSFER` khi thu trực tiếp.

Nếu khoản phí đã thuộc batch chuyển khoản `PENDING`, khoản đó bị khóa để tránh
tạo giao dịch trùng. UI hiển thị mã batch và nút `Xử lý đợt thu` để mở chi tiết
batch; tại đó nhân viên có thể đối soát, hủy hoặc chuyển cả batch sang tiền mặt.
Sau khi vừa tạo batch chuyển khoản trong màn hình `Thu học phí`, bước hoàn tất
cũng hiển thị nút `Đổi sang tiền mặt` với xác nhận đã nhận đủ tiền mặt.

## 19.1 List columns

```text
Mã học viên
Tên học viên
Lớp
Tháng
Số tiền
Đã thu
Còn nợ
Trạng thái
Thao tác
```

## 19.2 Actions

```text
Xem chi tiết
In bill tạm
Ghi nhận thanh toán
```

## 19.3 Học phí phát sinh từ đăng ký

```text
Không có form tạo học phí độc lập theo từng khoản. Sau khi đăng ký môn, UI hiển
thị trạng thái chưa tạo phí; thao tác `Tạo học phí tháng` của lớp chỉ tạo phí.
Nếu cần thông báo chuyển khoản hàng loạt, người dùng phải bấm riêng `Tạo thông
báo chuyển khoản` và xác nhận trước khi tạo payment batch.
```

Rule:

- Chỉ tạo phí từ enrollment đã tồn tại.
- Chỉ cho đăng ký học viên và tạo học phí khi lớp ở trạng thái `ACTIVE`; lớp chưa
  `ACTIVE` chỉ được xem.
- Tạo phí là thao tác riêng, không chạy tự động khi đăng ký môn.
- Tạo phí theo lớp được thực hiện khi người dùng chọn `Tạo học phí tháng`; tạo thông báo chuyển khoản là thao tác riêng và có xác nhận.
- Bộ chọn kỳ học phí chỉ cho chọn các tháng nằm trong thời gian bắt đầu/kết thúc của lớp.
- Học phí được tính trọn tháng theo mức phí của từng môn, không theo số buổi.
- Chi tiết học phí hiển thị kỳ học phí và thông tin tính trọn tháng trong từng item.
- Một học viên có thể học một phần môn trong lớp.
- Không tạo trùng tuition fee item cho cùng một môn.
- Chi tiết học phí có nút “Thanh toán học phí”.

---

# 20. Module QR thanh toán

QR dialog hiển thị:

```text
Tên học viên
Lớp
Tháng học phí
Số tiền cần thanh toán
Nội dung chuyển khoản
QR Code
```

Actions:

```text
Tải QR
Copy nội dung chuyển khoản
In bill tạm
```

Rule:

- QR hết hạn phải hiển thị cảnh báo.
- Nếu học phí đổi số tiền, yêu cầu tạo lại QR.
- Không hiển thị QR nếu học phí đã thanh toán đủ, trừ khi xem lịch sử.

---

# 21. Module Bill tạm / Phiếu báo học phí

Bill tạm phải ghi rõ:

```text
PHIẾU BÁO HỌC PHÍ
Không phải biên lai thu tiền
```

Nội dung bill:

```text
Mã phiếu
Ngày tạo
Học viên
Lớp
Tháng học phí
Học phí
Giảm giá
Số tiền cần thanh toán
Hạn thanh toán
QR Code
Thông tin chuyển khoản
```

Actions:

```text
In PDF
Gửi email/Zalo
Đánh dấu đã gửi
```

Rule:

- Bill tạm không phải receipt.
- Có thể in lại nhiều lần.
- Có thể gửi lại nhiều lần.
- Khi đã thanh toán đủ, bill tạm chỉ xem lịch sử.

---

# 22. Module Thanh toán

## 22.1 List columns

```text
Mã học phí
Học viên
Lớp
Số tiền thanh toán
Phương thức
Ngày thanh toán
Thao tác
```

## 22.2 Form fields

```text
Khoản học phí
Số tiền còn nợ
Số tiền thanh toán
Phương thức
Ngày thanh toán
Ghi chú
```

## 22.3 UI rules

- Hiển thị `finalAmount`, số tiền đã thu và số tiền còn nợ.
- Cho phép nhập số tiền thanh toán của lần hiện tại, không vượt số tiền còn nợ.
- Hỗ trợ tiếp tục thanh toán các khoản có trạng thái `PARTIAL`.
- Sau khi lưu payment thành công, gợi ý in biên lai.

---

# 23. Module Biên lai

## 23.1 List columns

```text
Số biên lai
Học viên
Lớp
Số tiền
Ngày phát hành
Ngày in
Thao tác
```

## 23.2 UI rules

- Receipt chỉ có sau payment.
- Không tạo receipt trực tiếp nếu chưa có payment.
- Cho phép in lại.
- Không cho sửa số tiền receipt nếu payment đã cố định.

Phân biệt rõ:

```text
Bill tạm: thông báo cần thanh toán
Biên lai: xác nhận đã thu tiền
```

---

# 24. Snackbar / Toast

Thông báo thành công:

```text
Đã lưu thành công
Đã xóa thành công
Đã đăng ký môn thành công
Đã tạo học phí thành công
Đã ghi nhận thanh toán
Đã in bill tạm
Đã tạo biên lai
```

Thông báo lỗi:

```text
Không thể lưu dữ liệu
Dữ liệu đã tồn tại
Có lỗi xảy ra, vui lòng thử lại
Không thể thanh toán vượt số tiền còn nợ
Học viên đã đăng ký các môn học được chọn
```

Không hiển thị lỗi kỹ thuật raw cho người dùng cuối.

---

# 25. Confirm Dialog

Các action bắt buộc confirm:

- Xóa dữ liệu
- Hủy lớp
- Đăng ký môn không tự động phát sinh học phí
- Tạo học phí riêng từ enrollment
- Ghi nhận thanh toán
- Tạo biên lai

Ví dụ:

```text
Bạn có chắc muốn ghi nhận thanh toán này?
Sau khi ghi nhận, trạng thái học phí sẽ được cập nhật.
```

---

# 26. Access UI

- Mọi user đã đăng nhập nhìn thấy cùng sidebar và cùng các action.
- UI không ẩn hoặc disable action theo role.
- API vẫn phải yêu cầu đăng nhập.

---

# 27. Responsive

Ưu tiên desktop.

Nhưng tablet/mobile phải dùng được cơ bản:

- Table có horizontal scroll.
- Dialog không vượt màn hình.
- Button không bị tràn.
- Form field fullWidth trên mobile.
- Sidebar có thể collapse.

---

# 28. Accessibility

Rule:

- Input phải có label.
- Button phải có text rõ ràng.
- Icon button phải có tooltip.
- Không dùng màu làm thông tin duy nhất.
- Error message phải đọc được.
- Tab order hợp lý.

---

# 29. Code organization

Khuyến nghị cấu trúc:

```text
src/
  app/
  components/
  layouts/
  modules/
    students/
      components/
      hooks/
      services/
      schemas/
      types/
    teachers/
    classes/
    student-fees/
    payments/
  utils/
  constants/
```

Mỗi module nên có:

```text
components
hooks
services
schemas
types
```

Không để một page quá dài.

---

# 30. Quy tắc code UI

Không dùng:

```text
any
eslint-disable
document.querySelector
hard-code API response
hard-code business status text nhiều nơi
```

Nên dùng:

```text
TypeScript type rõ ràng
Zod schema
Service layer gọi API
Constants cho status labels
Helper format tiền/ngày
Reusable components
```

---

# 31. Checklist sau khi implement mỗi module

Phải kiểm tra:

```bash
npm run lint
npm run typecheck
npm run build
```

Test thủ công:

```text
List
Search
Pagination
Create
Edit
Delete
Validation
Empty state
Loading state
Error state
Authentication
```

---

# 32. Quy tắc dành cho Codex / AI coding agent

Khi implement UI:

1. Đọc file business-requirements.md trước.
2. Đọc business-rules.md nếu có.
3. Đọc api-contract.md nếu có.
4. Không tự ý thay đổi nghiệp vụ.
5. Không đổi tên field nếu không cập nhật toàn bộ stack.
6. Không thêm thư viện mới nếu chưa cần.
7. Ưu tiên component tái sử dụng.
8. Sau khi sửa phải chạy lint/typecheck/build.
9. Nếu API chưa có, tạo service interface rõ ràng.
10. Nếu rule nghiệp vụ chưa rõ, thêm TODO rõ ràng thay vì tự suy diễn.
