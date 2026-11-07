# Current-state analysis: học phí và thanh toán

Ngày phân tích: 2026-08-02.

## Kết luận

Project hiện tại là một ứng dụng Next.js + Prisma/PostgreSQL. Module tài chính hiện đang lấy `StudentFee` làm aggregate học phí, lưu `amount`, `discount`, `finalAmount`, `paidAmount`, `outstandingAmount` và trạng thái `UNPAID/PARTIAL/PAID/CANCELLED`. Payment cho phép nhiều bản ghi trên cùng một học phí và có logic thanh toán một phần. Điều này không phù hợp với đặc tả thanh toán một lần.

Rewrite sẽ giữ lại framework chung, authentication/authorization, layout, shared components, Prisma connection, API error handling và PDF primitives nếu không chứa nghiệp vụ cũ. Domain học phí, payment, notice, receipt và bank reconciliation sẽ được thay mới theo các tài liệu trong `docs/tuition/`.

## Phạm vi hiện tại

### Frontend

- Học phí: `src/modules/finance/student-fees/components/StudentFeeForm.tsx`, `StudentFeeList.tsx`.
- Thanh toán: `src/modules/finance/payments/components/PaymentForm.tsx` được dùng trực tiếp trong ngữ cảnh học phí.
- Biên lai: `src/modules/finance/receipts/ReceiptList.tsx`.
- Công nợ: `src/modules/finance/debt-tracking/DebtTrackingList.tsx`.
- Báo cáo doanh thu: `src/modules/finance/reporting/ReportingDashboard.tsx`.
- PDF/QR: `student-fee-asset.service.ts` và các route payment-package.

### Backend/API

- `StudentFeeService`: tạo/sửa/list học phí, tính công nợ, payment request, QR, bill, PDF.
- `PaymentService`: tạo/sửa/xóa payment, confirm, doanh thu, tự tạo receipt.
- `ReceiptService`: phát hành/in/xóa receipt.
- Routes cũ còn lại: `/api/student-fees`, `/api/student-fees/bulk-create`, debt routes, `/api/payments`, confirm/receipt, `/api/receipts`.
- Routes payment-package mới đã được thêm nhưng vẫn dựa trên entity cũ.
- Chưa có module CSV import, bank reconciliation, refund, tuition adjustment, delivery history hoàn chỉnh.

### Database hiện tại

- Có `StudentFee`, `PaymentRequest`, `PaymentQrCode`, `PaymentNotice`, `Payment`, `Receipt`, `PaymentAccount`, `BankTransaction`, `AuditLog`.
- `FeeStatus` còn `PARTIAL` về mặt nghiệp vụ hiện hành.
- `Payment` không có partial unique index cho payment thành công trên một học phí.
- `Payment` liên kết tùy chọn với `PaymentRequest` và `BankTransaction`.
- `Receipt` 1-1 với `Payment` nhưng phát hành đang được gọi từ nhiều luồng.
- `AuditLog` tồn tại trong schema nhưng chưa có coverage ghi log đầy đủ.
- Chưa có các bảng mới: tuition fee items/adjustments, refunds, notice snapshots/deliveries, bank imports/mappings/transactions/candidates.

## Logic phải loại bỏ

- `PARTIAL`, `paidAmount`, `outstandingAmount` và mọi tính toán phân bổ công nợ theo nhiều payment.
- Cho phép tạo nhiều payment cho một học phí hoặc chỉnh sửa amount payment tùy ý.
- Các API/service tạo payment request, QR, bill tạm riêng lẻ nếu không được chuyển thành use case phát hành notice mới.
- `generatePaymentPackage` hiện tại vì nó sinh artifact trên aggregate cũ và không phải notice snapshot mới.
- Delete payment/receipt theo logic cũ; thay bằng cancel/refund theo trạng thái và audit.
- Debt tracking dựa trên `PARTIAL`.
- Seed và UI cũ dùng `studentFee`/`payment` assumptions.

## Code sẽ giữ lại hoặc refactor

- Giữ `src/lib/prisma.ts`, authentication, middleware, API response/error framework, permission framework và layout.
- Giữ shared money/date/table/dialog primitives sau khi kiểm tra không chứa business logic cũ.
- Refactor PDF drawing/QR primitives thành asset adapters cho tuition notice/receipt snapshot.
- Refactor `PaymentAccount` thành `BankAccount` migration có kiểm soát; không xóa dữ liệu gốc trước khi đối chiếu.
- Refactor `AuditLog` để có `entity_type`, before/after, reason, actor metadata đầy đủ.
- Có thể giữ `Student`, `Class`, enrollment nếu relation và quyền phù hợp.

## Dependency cần cập nhật

- Menu/routes/pages admin tài chính.
- Dashboard revenue/debt và payroll vì revenue chỉ tính payment `SUCCESS` mới.
- Seed, Prisma generated client và migration.
- Payment/receipt UI và shared status labels.
- API permission matrix.
- PDF download/storage route.

## Dữ liệu cần migration

- `student_fees` -> `tuition_fees` và tạo `tuition_fee_items` tối thiểu từ amount/discount.
- Payment cũ -> payment mới; giữ lịch sử failed/cancelled.
- Khoản có đúng một payment thành công có thể migrate tự động sau kiểm tra số tiền.
- Khoản có nhiều payment thành công hoặc payment tổng không bằng final amount phải đưa vào báo cáo thủ công.
- Payment notice/request/QR -> notice snapshot mới nếu đủ dữ liệu; nếu thiếu phải đánh dấu migration exception.
- Receipts -> receipt snapshot mới, không làm mất số biên lai.
- BankTransaction -> bank statement import/transaction với trạng thái cần kiểm tra.
- PDF cũ chỉ giữ như file lịch sử, không dùng làm nguồn dữ liệu nghiệp vụ mới.

## Chức năng cũ không còn hỗ trợ

- Thanh toán một phần, trả góp, nhiều payment SUCCESS trên một học phí.
- Payment allocation, credit balance và tự động chuyển tiền dư.
- Nhập amount tùy ý khi xác nhận payment.
- Hard delete dữ liệu tài chính.
- API cũ không thuộc contract mới sau khi phase migration hoàn tất.

## Rủi ro

1. Dữ liệu hiện tại có thể đã phát sinh nhiều payment cho cùng học phí; không được tự động gộp khi chưa có quy tắc.
2. Các module dashboard/payroll đang đọc field và status cũ.
3. File PDF runtime hiện lưu local filesystem, không phù hợp nhiều instance; cần storage adapter.
4. Chưa có test framework trong package scripts; phải bổ sung test setup trước khi xác nhận DoD.
5. Migration schema lớn có nguy cơ downtime và sai lệch tổng tiền.
6. Prompt yêu cầu bank CSV/reconciliation nhưng project chưa có integration CSV thực tế.

## Kế hoạch an toàn

- Hoàn thành tài liệu và schema design trước khi đổi application tables.
- Tạo migration report/read-only audit trước migration chính thức.
- Chạy snapshot totals theo học viên, lớp, tháng trước và sau migration.
- Chỉ chuyển route/menu sang API mới sau khi backend mới đã pass contract tests.
- Giữ rollback SQL/backup procedure; không dùng destructive reset trên database thật.
