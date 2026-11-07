# Trạng thái hệ thống hiện hành

Tài liệu này là bản tóm tắt triển khai thực tế sau refactor theo mô hình lớp có nhiều môn học.

## Phạm vi sản phẩm

- Không quản lý phòng học và không kiểm tra trùng phòng.
- Điểm danh được lưu thành các phiên riêng theo lớp, không phụ thuộc lịch học;
  một lớp có thể có nhiều phiên trong ngày. Thời điểm phiên được ghi theo giờ
  máy chủ khi lưu. Giáo viên đăng nhập bằng tài khoản được quản trị viên liên
  kết với hồ sơ giáo viên và chỉ xem/sửa lớp/môn được phân công. Học viên đang
  theo học có trạng thái `PRESENT` hoặc `ABSENT`; ghi chú vắng tùy chọn. Giáo
  viên có thể sửa không giới hạn thời gian và mọi thay đổi có audit log.
- Không quản lý kỳ lương, phiếu lương hoặc bảng lương giáo viên.
- Báo cáo thu học phí theo lớp/môn vẫn tính phần doanh thu còn lại từ
  `Teacher.commissionPercent`; đây là chỉ tiêu báo cáo thu, không phải bảng lương.

## Lớp học và môn học

- `Class` chỉ chứa thông tin chung của lớp: mã, tên, thời gian và trạng thái.
- `ClassSubject` là nơi lưu môn học thuộc lớp, giáo viên phụ trách, học phí, số buổi và giới hạn học viên.
- Giới hạn học viên được kiểm tra riêng trên từng `ClassSubject`; lớp không có
  một giới hạn sĩ số dùng chung.
- Một học viên có thể đăng ký một hoặc nhiều `ClassSubject` trong cùng lớp; không bắt buộc học toàn bộ môn.
- Lịch học phải gắn với môn học và lấy giáo viên theo môn đã phân công.
- Thứ trong tuần của lịch học dùng `0..6` (`0` là Chủ nhật).
- Giáo viên xem lớp thông qua các môn được phân công, không qua giáo viên cấp lớp.

## Học phí

- Đăng ký môn và tạo học phí là hai thao tác độc lập.
- Chỉ lớp `ACTIVE` cho phép đăng ký/import/thay đổi enrollment và tạo học phí;
  lớp `DRAFT`, `COMPLETED`, `CANCELLED` chỉ được xem đối với các nghiệp vụ này.
- Khi đăng ký môn, hệ thống chỉ tạo enrollment subject; chưa tạo học phí.
- Chi tiết lớp chỉ hiển thị tổng quan; nghiệp vụ học viên nằm ở `/admin/classes/{classId}/students` và học phí nằm ở `/admin/classes/{classId}/tuition`.
- Trang học phí nhận một kỳ `YYYY-MM`; `Tạo học phí tháng` chỉ tạo các khoản phí. Phương thức thanh toán được chọn ở màn hình thu học phí. Nếu cần gửi thông báo chuyển khoản hàng loạt, nhân viên phải chủ động bấm `Tạo thông báo chuyển khoản` và xác nhận; thao tác này mới tạo payment batch `PENDING`.
- Tại `Thông báo & đợt thu`, có thể chọn một hoặc nhiều kỳ, hoặc để trống để lấy mọi kỳ. Khi lọc lớp, hệ thống lấy học viên thuộc lớp đó rồi lấy học phí của các em ở mọi lớp; phát hành vẫn tạo batch riêng cho từng học sinh và kỳ. Batch chuyển khoản đang chờ được cập nhật nếu phù hợp; batch đã liên kết với dòng sao kê không bị thay đổi. Khi cập nhật batch, tổng tiền, tài khoản nhận tiền và snapshot notice được cập nhật để PDF/QR mới phản ánh thông tin hiện hành. Có thể chọn học sinh ở danh sách batch đang chờ để xuất các thông báo phù hợp bộ lọc; PDF gộp giữ riêng QR và snapshot tài khoản của từng batch.
- Không tạo học phí độc lập ngoài enrollment.
- Enrollment `ACTIVE` và môn `ACTIVE` vẫn tính đủ học phí tháng, không phụ thuộc mức độ tham gia thực tế; enrollment có khoảng tạm nghỉ trong kỳ không phát sinh phí.
- Có thể tạo học phí cho bất kỳ tháng nào trong thời gian của lớp, không phụ
  thuộc ngày đăng ký/tái đăng ký; lớp đã kết thúc/hủy chỉ cho xem enrollment.
- UI giới hạn bộ chọn kỳ học phí theo tháng bắt đầu và kết thúc của lớp; backend
  vẫn kiểm tra lại trạng thái lớp và phạm vi kỳ.
- Tái đăng ký giữ lịch sử enrollment cũ và dùng `currentPeriodStart` để lưu mốc
  giai đoạn hiện tại, không dùng mốc này để giới hạn kỳ học phí.
- Bỏ một môn chỉ ảnh hưởng các kỳ sau; khoản đã phát sinh không tự xóa.
- Khi lớp chuyển `ACTIVE -> COMPLETED`, enrollment và môn đang `ACTIVE` được chuyển sang `COMPLETED` cùng transaction, có audit log; lịch sử vẫn hiển thị nhưng chỉ đọc.
- Lớp `CANCELLED` có thể được khôi phục về `ACTIVE`; thao tác xóa `deleted_at` nếu có và ghi audit log `CLASS_RESTORED`. Lớp `COMPLETED` không thể khôi phục.
- Không cho tạo học phí cho lớp `COMPLETED` hoặc `CANCELLED`; không cho tạm nghỉ trong khoảng đã phát sinh học phí.
- Khi lớp chuyển sang `CANCELLED`, khoản học phí `UNPAID`/`OVERDUE` không có lịch sử thanh toán và không thuộc đợt thu `PENDING` được hủy kèm lý do và audit log trong cùng transaction. Khoản đã có lịch sử thanh toán hoặc đang chờ thu được giữ để xử lý riêng.
- Rà soát khoản phí của các lớp đã hủy từ trước bằng `npx tsx scripts/cancel-unpaid-fees-for-cancelled-classes.ts` để xem trước. Chỉ cập nhật sau khi kiểm tra danh sách và chỉ rõ lớp bằng `--class-id`, cùng `--apply --actor-id <user-id>`.
- Dashboard có thể xuất Excel báo cáo thu học phí theo từng ngày, tách tiền mặt/chuyển khoản và kèm chi tiết payment `SUCCESS` theo ngày Việt Nam.
- Dashboard hiển thị riêng tổng thu tiền mặt và tổng thu chuyển khoản; hai số liệu tuân theo bộ lọc ngày và chỉ tính payment `SUCCESS`.
- Xóa học viên/giáo viên/lớp/lịch chỉ là soft delete hoặc chuyển trạng thái; không hard delete bản ghi.
- Thanh toán bắt đầu từ chi tiết học phí bằng nút `Thanh toán học phí`.
- Học phí `EXEMPTED` có thể được bỏ miễn để thu lại bằng lý do bắt buộc; backend
  kiểm tra payment/batch/lớp, giữ lịch sử audit và chuyển về `UNPAID` hoặc hiển
  thị `OVERDUE` nếu đã quá hạn.
- Thông báo thanh toán, biên lai tổng hợp và phiếu thu đều hiển thị các môn đã đăng ký của học viên.

## Thanh toán và đối soát

- Chỉ có hai phương thức: `CASH` và `BANK_TRANSFER`; một khoản học phí có thể
  được thanh toán nhiều lần theo số dư còn nợ.
- `UNPAID` là chưa phát sinh payment thành công, `PARTIAL` là đã thu một phần,
  `PAID` là đã thu đủ. Payment thành công không được làm tổng tiền đã thu vượt
  `finalAmount`.
- Mỗi payment thành công tạo một receipt riêng; payment batch có thể gom nhiều
  khoản học phí và mỗi allocation có thể là toàn bộ hoặc một phần số dư của
  khoản đó.
- Thanh toán tiền mặt bắt buộc nhập `paymentDate` là ngày nhận tiền; khi đổi batch chuyển khoản đang chờ sang tiền mặt cũng bắt buộc nhập ngày nhận. Chuyển khoản lấy ngày thực tế từ sao kê khi đối soát.
- Batch `BANK_TRANSFER` bắt buộc gắn đúng một tài khoản ngân hàng nhận tiền.
- Đối soát chỉ chọn batch `BANK_TRANSFER` đang `PENDING`, cùng tài khoản và đúng tổng tiền.
- Mỗi phiên import sao kê và từng dòng giao dịch được lưu; có thể xuất báo cáo đối soát theo ngày giao dịch ngân hàng trên các phiên đã lưu.
- QR được sinh động theo payment batch, không lưu lịch sử QR.
- QR được sinh tại máy chủ theo chuẩn VietQR/NAPAS (không gọi dịch vụ ảnh bên ngoài); màn hình thanh toán và PDF thông báo dùng chung một hàm sinh QR và cùng snapshot tài khoản của batch. Mã ngân hàng phải là mã viết tắt được hỗ trợ (VCB, BIDV, TCB, MB…) hoặc mã BIN 6 số; nếu không, hệ thống báo rõ thay vì hiển thị QR.
- Nội dung chuyển khoản (trong QR, PDF và nút sao chép) gồm mã đợt viết liền không dấu gạch, tên viết tắt học viên và tên lớp không dấu, tối đa 25 ký tự theo chuẩn VietQR, ví dụ `PB20261021600506 NVAN TOA`. Mã đợt luôn đứng đầu và đầy đủ; đối soát sao kê chỉ dựa vào mã đợt nên vẫn khớp cả nội dung cũ `PB PB-...`.
- Hủy receipt của payment batch thành công sẽ hoàn tác toàn bộ batch, mở lại các khoản học phí và ghi audit log.
- Hoàn tiền chỉ hỗ trợ toàn bộ payment hoặc toàn bộ batch, theo luồng
  `PENDING -> APPROVED -> COMPLETED`; khi hoàn tất, payment chuyển `REFUNDED`,
  receipt bị hủy, học phí được mở lại và batch chuyển `CANCELLED`.

## Người dùng

- Quản lý người dùng tại `/admin/users`.
- CRUD gồm email, họ tên, mật khẩu và trạng thái.
- Mọi người dùng đã đăng nhập dùng chung một quyền truy cập; không còn role hoặc màn hình phân quyền.
- Xóa người dùng là khóa mềm tài khoản; không xóa vật lý.
- API `/api/users` yêu cầu đăng nhập và không bao giờ trả về `passwordHash`.

## Giáo viên và học viên

- Giáo viên là hồ sơ nghiệp vụ độc lập; có thể liên kết với tối đa một tài khoản
  `User` để đăng nhập. Email đăng nhập thuộc tài khoản User.
- Trạng thái giáo viên chỉ gồm `ACTIVE` và `INACTIVE`.
- Giáo viên có tỷ lệ trích `0..100%` phục vụ báo cáo thu học phí theo lớp/môn.
- Học viên không sử dụng email; thông tin liên hệ gồm số điện thoại và phụ huynh.

## Prisma và dữ liệu cũ

- Các bảng/enum đã không còn được sử dụng đã được loại khỏi schema và migration cleanup.
- Các thuộc tính cấp lớp cũ `teacherId`, `tuitionFee`, `totalSessions` đã bị loại bỏ; dữ liệu tương ứng nằm ở `ClassSubject`.
- Dữ liệu phát triển có thể reset và seed lại bằng quy trình Prisma của dự án.

## Kiểm tra bắt buộc

```bash
npm run typecheck
npm run lint
npm run build
```
