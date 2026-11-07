# Audit log design

Audit mọi create/update/adjust/exempt/cancel payment/notice/receipt/refund/import/match/confirm/ignore/reverse.

Record gồm `entity_type`, `entity_id`, `action`, `data_before`, `data_after`, `reason`, `performed_by`, `performed_at`, `ip_address`, `user_agent`. Audit nằm cùng transaction với nghiệp vụ tài chính.
