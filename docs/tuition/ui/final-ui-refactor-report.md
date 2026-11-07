# Báo cáo refactor UI

## Đã thực hiện

- Thêm route `/admin/tuition-fees` và `TuitionList` với filter mã học sinh/trạng thái, bảng tổng tiền và trạng thái chuẩn.
- Giữ danh sách/chi tiết/sửa học phí với optimistic calculation, version/reason validation và khóa sửa sau PAID; loại bỏ form tạo học phí thủ công.
- Viết lại `PaymentForm`: một học phí cho mỗi payment, amount read-only, phương thức động, dialog xác nhận và PDF receipt.
- Thêm issue notice/replacement notice, xem notice trên tuition detail và refund toàn bộ payment cho ADMIN.
- Nâng cấp import sao kê thành flow upload/config/preview/import và chỉ bật đối soát khi amount khớp chính xác.
- API đăng ký lớp tự động tạo một tuition fee với mã `HP-YYYYMMDD-XXXXXX`, item học phí theo `Class.tuitionFee`, trong cùng transaction với enrollment; đăng ký trùng không tạo fee trùng.
- Mã học viên và mã giáo viên được backend tự sinh lần lượt theo dạng `HS-YYYYMMDD-XXXXXX` và `GV-YYYYMMDD-XXXXXX`; form tạo mới không còn cho nhập mã thủ công.
- Receipt list có detail dialog/preview và tuition list có export CSV áp dụng đúng bộ lọc hiện tại.
- Classes UX được gom về class detail với tab thông tin, lịch học, học sinh và học phí; danh sách lớp có lọc trạng thái và các chỉ số giáo viên/học sinh/lịch.
- Đã bỏ menu và màn hình CRUD lịch học độc lập; lịch học được quản lý trong chi tiết lớp. Màn hình lịch của giáo viên vẫn giữ nguyên.
- Backend payment đổi sang `tuitionFeeId`, bảo vệ `TUITION_ALREADY_PAID`, `TUITION_CANCELLED`, `TUITION_EXEMPTED`.
- Menu điều hướng bổ sung Học phí; các menu/page/API legacy đã được xóa ở migration trước.
- Tạo bộ tài liệu UI trong thư mục này.

## Đã loại bỏ

UI hỗ trợ thanh toán từng phần, nhập số tiền nhỏ hơn số dư còn lại và hiển thị trạng thái `PARTIAL`. Batch nhiều khoản hiển thị phân bổ theo đúng số tiền thực tế của từng khoản; không cho phép thanh toán vượt số dư hoặc tạo tiền dư.

## Kiểm tra

Chạy `npm run typecheck`, `npm run lint`, `npm run build` sau khi hoàn tất thay đổi. Không có screenshot tự động trong môi trường hiện tại; kiểm tra trực tiếp các route sau đăng nhập.

## Còn lại

Gửi email/SMS/Zalo thật, permission code chi tiết theo từng action và bộ component/integration/E2E test tự động vẫn cần bổ sung. Các API external delivery chưa tồn tại trong project nên chưa giả lập việc gửi thành công.
