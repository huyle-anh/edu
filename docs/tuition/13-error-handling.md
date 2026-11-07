# Error handling

Ổn định các mã: `TUITION_ALREADY_PAID`, `TUITION_CANCELLED`, `TUITION_EXEMPTED`, `PAYMENT_AMOUNT_MISMATCH`, `PAYMENT_ALREADY_CONFIRMED`, `IDEMPOTENCY_CONFLICT`, `STATEMENT_DUPLICATE`, `AMOUNT_MISMATCH`, `PERMISSION_DENIED`, `VERSION_CONFLICT`.

Controller không chứa nghiệp vụ; lỗi domain được map qua API error handler, không trả raw exception cho UI.
