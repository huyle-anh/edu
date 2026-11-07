# Prompt tinh chỉnh và đồng bộ UI/UX toàn bộ hệ thống

Hãy kiểm tra và refactor toàn bộ giao diện của project hiện tại nhằm giải quyết các vấn đề:

* Các màn hình chưa dùng chung một phong cách thiết kế.
* Màu sắc, khoảng cách, typography và kích thước component thiếu nhất quán.
* Bố cục chưa tối ưu cho thao tác thực tế.
* Người dùng khó nhận biết hành động chính, trạng thái dữ liệu và bước tiếp theo.
* Một số màn hình có quá nhiều thông tin hoặc nút chức năng.
* Trải nghiệm trên màn hình nhỏ chưa tốt.

## 1. Mục tiêu

Thiết kế lại UI theo hướng:

* Hiện đại, đơn giản và chuyên nghiệp.
* Đồng nhất trên toàn bộ hệ thống.
* Dễ sử dụng cho nhân viên quản lý giáo dục.
* Giảm số lần nhấp chuột trong các nghiệp vụ thường xuyên.
* Giúp người dùng nhanh chóng nhận biết:

  * Đang ở màn hình nào.
  * Dữ liệu đang ở trạng thái nào.
  * Hành động chính cần thực hiện là gì.
  * Có lỗi hoặc dữ liệu cần xử lý hay không.
* Responsive tốt trên desktop, laptop và tablet.
* Ưu tiên desktop vì đây là hệ thống quản trị nội bộ.

Không chỉ thay đổi màu sắc. Cần kiểm tra và cải thiện cả bố cục, luồng thao tác, khả năng đọc dữ liệu và tính nhất quán của component.

## 2. Nguyên tắc thực hiện

Trước khi sửa code:

1. Đọc cấu trúc project và xác định:

   * Framework và thư viện UI đang sử dụng.
   * Layout chung.
   * Các component dùng chung.
   * Theme, typography và hệ thống màu hiện tại.
   * Các màn hình đang bị trùng lặp component.
   * Các pattern UI không nhất quán.

2. Liệt kê các vấn đề UI/UX hiện tại theo từng nhóm:

   * Layout.
   * Navigation.
   * Form.
   * Table.
   * Search và filter.
   * Button và action.
   * Trạng thái nghiệp vụ.
   * Thông báo lỗi.
   * Responsive.
   * Loading, empty state và error state.

3. Đề xuất design system chung trước khi refactor.

4. Sau đó mới triển khai lần lượt các component nền tảng và từng màn hình.

Không thay đổi business logic, API contract, database schema hoặc quy tắc nghiệp vụ nếu không thật sự cần thiết cho UI.

## 3. Design system chung

Xây dựng hoặc chuẩn hóa một design system dùng chung toàn hệ thống.

### 3.1. Màu sắc

Định nghĩa các nhóm màu:

* Primary: hành động chính.
* Secondary: hành động phụ.
* Success: đã hoàn thành, đã thanh toán, đối soát thành công.
* Warning: sắp đến hạn, cần kiểm tra.
* Error: quá hạn, lỗi dữ liệu, đối soát thất bại.
* Info: thông tin bổ sung.
* Neutral: nền, border, text phụ và disabled.

Không hard-code màu riêng tại từng màn hình. Mọi màu phải lấy từ theme hoặc design token.

Đảm bảo độ tương phản và khả năng đọc nội dung.

### 3.2. Typography

Chuẩn hóa:

* Page title.
* Section title.
* Card title.
* Body text.
* Supporting text.
* Table header.
* Label.
* Helper text.
* Error message.

Không sử dụng quá nhiều kích thước hoặc độ đậm khác nhau.

### 3.3. Spacing và kích thước

Sử dụng một spacing scale thống nhất.

Chuẩn hóa:

* Khoảng cách giữa các section.
* Padding của page.
* Padding của card.
* Khoảng cách label và input.
* Chiều cao input.
* Chiều cao button.
* Chiều cao table row.
* Border radius.
* Icon size.

Hạn chế sử dụng giá trị tùy ý tại từng component.

## 4. Layout chung

Tạo hoặc chuẩn hóa layout dùng chung gồm:

* Sidebar.
* Header.
* Breadcrumb.
* Page title.
* Page description nếu cần.
* Khu vực page action.
* Main content.
* Thông báo toàn cục.

### Sidebar

* Icon và label phải thống nhất.
* Menu đang được chọn phải dễ nhận biết.
* Nhóm menu theo nghiệp vụ.
* Có thể thu gọn sidebar nếu phù hợp.
* Không để quá nhiều cấp menu nếu không cần thiết.

Nhóm menu đề xuất:

* Tổng quan.
* Học viên.
* Lớp học.
* Học phí.
* Thanh toán.
* Đối soát.
* Phiếu thu.
* Báo cáo.
* Cấu hình.

### Header

Chỉ hiển thị những thông tin cần thiết:

* Tên màn hình hoặc breadcrumb.
* Thông báo nếu có.
* Thông tin người dùng.
* Menu tài khoản.

Không lặp lại quá nhiều thông tin đã có trong sidebar hoặc page title.

## 5. Cấu trúc trang chuẩn

Mỗi màn hình danh sách nên tuân theo cấu trúc:

1. Breadcrumb.
2. Page title và mô tả ngắn.
3. Primary action.
4. Khu vực tìm kiếm và bộ lọc.
5. Thông tin tổng hợp nếu cần.
6. Bảng dữ liệu.
7. Pagination.
8. Empty, loading hoặc error state.

Mỗi màn hình chi tiết hoặc chỉnh sửa nên tuân theo cấu trúc:

1. Breadcrumb.
2. Page title.
3. Trạng thái nghiệp vụ.
4. Các action chính.
5. Nội dung chia thành các section hoặc card hợp lý.
6. Action lưu/hủy đặt tại vị trí dễ thao tác.

Không tạo mỗi màn hình theo một cấu trúc khác nhau nếu cùng loại nghiệp vụ.

## 6. Component dùng chung

Tạo hoặc chuẩn hóa các component sau:

* `AppLayout`
* `PageHeader`
* `Breadcrumbs`
* `SectionCard`
* `SummaryCard`
* `SearchBar`
* `FilterPanel`
* `DataTable`
* `StatusBadge`
* `EmptyState`
* `LoadingState`
* `ErrorState`
* `ConfirmDialog`
* `FormActions`
* `CurrencyDisplay`
* `DateDisplay`
* `FileUpload`
* `ImportResult`
* `Pagination`
* `Toast` hoặc notification
* `FormField`

Không copy cùng một đoạn UI sang nhiều màn hình.

Component phải hỗ trợ đầy đủ:

* Normal.
* Hover.
* Focus.
* Disabled.
* Loading.
* Error.
* Read-only nếu có.

## 7. Button và hành động

Phân cấp button rõ ràng:

* Primary: hành động chính của màn hình.
* Secondary: hành động phụ.
* Text hoặc ghost: thao tác ít quan trọng.
* Danger: xóa, hủy hoặc thao tác không thể khôi phục.

Mỗi khu vực chỉ nên có một hành động primary.

Ví dụ:

* “Tạo thông báo học phí” là primary.
* “Xuất Excel” là secondary.
* “Xóa” là danger.
* Các hành động theo từng dòng nên đặt trong menu nếu có quá nhiều nút.

Button phải có:

* Label rõ nghĩa.
* Icon chỉ khi thực sự hỗ trợ nhận biết.
* Loading state khi đang xử lý.
* Disabled state hợp lý.
* Chống submit hoặc click nhiều lần.

Không sử dụng chỉ icon cho các hành động khó hiểu nếu không có tooltip.

## 8. Form

Chuẩn hóa toàn bộ form:

* Label đặt nhất quán.
* Trường bắt buộc có dấu hiệu rõ ràng.
* Helper text đặt bên dưới input.
* Lỗi validation hiển thị gần trường bị lỗi.
* Thông báo lỗi nghiệp vụ hiển thị ở đầu form.
* Không chỉ sử dụng màu sắc để thể hiện lỗi.
* Format tiền tệ, ngày tháng và số điện thoại thống nhất.
* Các trường liên quan được nhóm cùng một section.
* Trường read-only phải khác disabled và vẫn dễ đọc.

Khi rời màn hình mà có thay đổi chưa lưu, phải cảnh báo người dùng.

Sau khi lưu thành công:

* Hiển thị thông báo rõ ràng.
* Cập nhật lại dữ liệu.
* Không làm mất trạng thái không cần thiết.
* Điều hướng hợp lý theo nghiệp vụ.

## 9. Bảng dữ liệu

Cải thiện bảng theo hướng dễ đọc và dễ thao tác:

* Header dễ phân biệt.
* Căn phải số tiền và số lượng.
* Căn giữa các cột trạng thái ngắn.
* Căn trái nội dung văn bản.
* Format tiền tệ thống nhất.
* Trạng thái hiển thị bằng badge.
* Action đặt ở cột cuối.
* Có hover cho row.
* Có tooltip nếu nội dung bị cắt.
* Có sticky header khi bảng dài.
* Có horizontal scroll trên màn hình nhỏ.
* Có pagination rõ ràng.
* Giữ bộ lọc khi chuyển trang hoặc xem chi tiết rồi quay lại nếu có thể.

Tránh:

* Quá nhiều cột không cần thiết.
* Nhiều button lớn trong từng dòng.
* Màu nền quá mạnh.
* Border dày hoặc dày đặc.
* Hiển thị UUID hay dữ liệu kỹ thuật không cần thiết.

## 10. Search và filter

Tách rõ:

* Tìm kiếm nhanh.
* Bộ lọc nâng cao.
* Nút áp dụng nếu cần.
* Nút xóa điều kiện lọc.

Các điều kiện đang áp dụng phải dễ nhận biết.

Nếu có nhiều bộ lọc:

* Cho phép thu gọn/mở rộng.
* Hiển thị số lượng filter đang được áp dụng.
* Có chức năng “Xóa tất cả”.
* Không để filter cũ tiếp tục áp dụng khi control đã bị ẩn.

## 11. Trạng thái hệ thống

Chuẩn hóa trạng thái nghiệp vụ bằng `StatusBadge`.

Ví dụ học phí:

* Chưa phát hành.
* Đã phát hành.
* Chưa thanh toán.
* Đã thanh toán.
* Quá hạn.
* Đã hủy.

Ví dụ đối soát:

* Chờ đối soát.
* Khớp tự động.
* Cần kiểm tra.
* Đã xác nhận.
* Không khớp.
* Đã bỏ qua.

Mỗi trạng thái phải có:

* Label tiếng Việt rõ ràng.
* Màu sắc thống nhất.
* Quy tắc sử dụng chung trên danh sách, chi tiết và dashboard.

Không để cùng một trạng thái có màu hoặc tên khác nhau giữa các màn hình.

## 12. Các trạng thái UI bắt buộc

Mọi màn hình lấy dữ liệu phải xử lý:

* Initial loading.
* Refreshing.
* Empty state.
* Không có kết quả tìm kiếm.
* API error.
* Permission denied.
* Success notification.
* Validation error.

Không hiển thị bảng trống mà không giải thích.

Empty state cần có:

* Tiêu đề.
* Mô tả ngắn.
* Hành động tiếp theo nếu phù hợp.

## 13. Tinh chỉnh từng màn hình nghiệp vụ

### 13.1. Dashboard

Hiển thị các thông tin quan trọng:

* Tổng học phí cần thu.
* Số tiền đã thu.
* Số tiền chưa thu.
* Số học viên chưa thanh toán.
* Số khoản quá hạn.
* Số giao dịch cần đối soát.

Các card chỉ hiển thị thông tin hỗ trợ ra quyết định.

Cho phép click vào card để mở danh sách tương ứng nếu phù hợp.

Bên dưới có thể hiển thị:

* Học phí sắp đến hạn.
* Giao dịch chưa đối soát.
* Hoạt động gần đây.

### 13.2. Danh sách học phí

Bộ lọc đề xuất:

* Từ khóa học viên.
* Lớp học.
* Trạng thái.
* Khoảng thời gian.
* Hạn thanh toán.

Cột đề xuất:

* Mã học viên.
* Họ tên.
* Lớp.
* Số tiền.
* Hạn thanh toán.
* Trạng thái.
* Ngày thanh toán.
* Thao tác.

Hành động chính:

* Tạo thông báo học phí.
* In thông báo học phí.
* Xuất danh sách.

Do hệ thống chỉ thanh toán một lần cho mỗi khoản học phí:

* Không hiển thị kỳ thanh toán.
* Không hiển thị tiến độ thanh toán nhiều đợt.
* Không thiết kế chức năng chia nhỏ số tiền.
* Trạng thái phải thể hiện rõ chưa thanh toán hoặc đã thanh toán toàn bộ.

### 13.3. Chi tiết học phí

Chia nội dung thành các section:

* Thông tin học viên.
* Thông tin lớp học.
* Thông tin khoản học phí.
* Hạn thanh toán.
* Trạng thái thanh toán.
* Thông tin giao dịch đã đối soát.
* Lịch sử thay đổi.

Các hành động có thể gồm:

* Chỉnh sửa trước khi phát hành.
* Phát hành thông báo học phí.
* In thông báo học phí.
* Xác nhận thanh toán.
* In phiếu thu.
* Hủy khoản học phí nếu nghiệp vụ cho phép.

Chỉ hiển thị hành động hợp lệ với trạng thái hiện tại.

### 13.4. Màn hình thanh toán

Tập trung vào luồng xác nhận thanh toán một lần:

1. Chọn học viên hoặc khoản học phí.
2. Hiển thị số tiền phải thanh toán.
3. Nhập hoặc chọn thông tin giao dịch.
4. Kiểm tra thông tin.
5. Xác nhận thanh toán.
6. Hiển thị kết quả.
7. Cho phép in phiếu thu.

Không tạo giao diện chia kỳ hoặc thanh toán nhiều lần.

Thông tin quan trọng như số tiền, học viên và trạng thái phải nổi bật nhưng không sử dụng màu quá mạnh.

### 13.5. Đối soát sao kê CSV

Thiết kế theo workflow rõ ràng:

1. Tải lên file CSV.
2. Kiểm tra định dạng file.
3. Preview dữ liệu.
4. Hiển thị kết quả tự động ghép giao dịch.
5. Cho phép xử lý các dòng không khớp.
6. Xác nhận đối soát.
7. Hiển thị kết quả tổng hợp.

Hiển thị summary:

* Tổng số giao dịch.
* Số giao dịch khớp.
* Số giao dịch cần kiểm tra.
* Số giao dịch bị lỗi.
* Tổng số tiền.

Phân nhóm kết quả bằng tab hoặc filter:

* Tất cả.
* Khớp tự động.
* Cần kiểm tra.
* Không khớp.
* Đã xác nhận.

Mỗi dòng cần thể hiện:

* Ngày giao dịch.
* Nội dung chuyển khoản.
* Số tiền.
* Học viên/khoản học phí được đề xuất.
* Mức độ khớp hoặc lý do không khớp.
* Trạng thái.
* Hành động.

Không tự động xác nhận những giao dịch không đủ điều kiện.

### 13.6. Phiếu thu và thông báo học phí

Thiết kế màn hình preview trước khi in.

Cung cấp các hành động:

* Xem trước.
* In.
* Tải PDF nếu hệ thống hỗ trợ.

Bản in phải:

* Không chứa sidebar, button hoặc thành phần điều hướng.
* Hiển thị đầy đủ thông tin đơn vị, học viên, số tiền và ngày tháng.
* Có layout phù hợp khổ giấy.
* Không bị cắt nội dung.
* Format tiền tệ và ngày tháng thống nhất.

## 14. Responsive

Desktop:

* Tận dụng chiều rộng hợp lý.
* Không kéo nội dung quá rộng gây khó đọc.
* Table có thể hiển thị nhiều cột.

Tablet:

* Sidebar có thể thu gọn.
* Filter có thể chuyển thành panel.
* Action không được tràn màn hình.

Mobile:

* Ưu tiên xem thông tin và các thao tác cơ bản.
* Table rộng được scroll ngang hoặc chuyển sang card khi phù hợp.
* Button phải đủ lớn để thao tác.
* Không để dialog hoặc form vượt viewport.

## 15. Accessibility

Đảm bảo:

* Có focus state rõ ràng.
* Có thể thao tác bằng bàn phím.
* Input có label hợp lệ.
* Icon button có accessible name.
* Màu sắc đủ độ tương phản.
* Không dùng màu sắc làm phương thức duy nhất để thể hiện trạng thái.
* Dialog quản lý focus đúng.
* Thông báo lỗi có thể được nhận biết bởi screen reader nếu thư viện hỗ trợ.

## 16. Yêu cầu về code

* Tận dụng thư viện UI hiện tại của project.
* Không cài thêm thư viện UI mới nếu chưa cần thiết.
* Không trộn nhiều UI framework.
* Loại bỏ style inline và giá trị hard-code khi có thể.
* Đưa màu sắc, spacing, typography và component variants vào theme.
* Tách component hợp lý, nhưng không over-engineering.
* Giữ strict TypeScript.
* Không sử dụng `any` nếu không cần thiết.
* Không làm thay đổi API hoặc nghiệp vụ hiện có.
* Không xóa chức năng đang hoạt động.
* Không tạo mock data trong production code.
* Không để lại component cũ không còn sử dụng.
* Bảo đảm text hiển thị bằng tiếng Việt thống nhất.
* Chạy formatter, lint, type-check và test sau khi sửa.

## 17. Trình tự triển khai

Thực hiện theo thứ tự:

1. Audit UI hiện tại.
2. Chuẩn hóa theme và design token.
3. Refactor layout chung.
4. Xây dựng component dùng chung.
5. Refactor các màn hình danh sách.
6. Refactor các màn hình chi tiết và form.
7. Refactor màn hình thanh toán.
8. Refactor màn hình đối soát CSV.
9. Refactor giao diện in.
10. Kiểm tra responsive.
11. Kiểm tra accessibility.
12. Xóa code UI cũ không còn sử dụng.
13. Chạy toàn bộ kiểm tra chất lượng.

Sau mỗi giai đoạn, bảo đảm project vẫn build và chạy được.

## 18. Kết quả cần bàn giao

Sau khi hoàn thành, cung cấp:

* Danh sách vấn đề UI/UX đã phát hiện.
* Design system đã áp dụng.
* Danh sách component dùng chung đã tạo hoặc refactor.
* Danh sách màn hình đã chỉnh sửa.
* Những thay đổi về luồng thao tác.
* Các file chính đã thay đổi.
* Kết quả lint, type-check, test và build.
* Những vấn đề còn lại hoặc đề xuất cải thiện tiếp theo.

## 19. Tiêu chí nghiệm thu

Công việc chỉ được xem là hoàn thành khi:

* Tất cả màn hình sử dụng cùng theme và design language.
* Cùng một loại hành động có cùng cách hiển thị.
* Cùng một trạng thái có cùng label và màu sắc.
* Form, table, button và filter có cách sử dụng thống nhất.
* Không còn style hard-code trùng lặp đáng kể.
* Người dùng nhận biết được hành động chính trên mỗi màn hình.
* Các nghiệp vụ thường xuyên có luồng thao tác rõ ràng.
* Mọi màn hình có loading, empty và error state.
* Không xuất hiện lỗi TypeScript.
* Lint, test và build thành công.
* Không làm thay đổi business logic hiện có.
* Giao diện hoạt động tốt trên desktop và tablet.
* Không còn bất kỳ UI nào liên quan đến chia kỳ hoặc thanh toán học phí nhiều lần.

Hãy bắt đầu bằng việc kiểm tra code hiện tại và lập bảng audit UI/UX. Sau đó trình bày kế hoạch refactor theo từng giai đoạn trước khi sửa code. Khi triển khai, hãy hoàn thành lần lượt từng giai đoạn, không dừng lại chỉ sau phần phân tích.
