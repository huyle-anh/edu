# Component design

- `CurrencyInput`: định dạng VND, không dùng floating point để tính backend.
- `StatusBadge`: nhãn + màu + text, không chỉ dựa vào màu.
- `TuitionList`: filter/table/loading/empty/error.
- `PaymentForm`: one-fee payment, read-only amount, dynamic method fields, confirmation dialog.
- `ReceiptList`: read-only receipt table và PDF action.
- `BankReconciliationPanel`: import, đối soát theo mã đợt thanh toán và xác nhận payment batch.
