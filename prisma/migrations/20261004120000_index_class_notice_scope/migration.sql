CREATE INDEX "idx_tuition_fees_class_month_type_status"
ON "tuition_fees"("class_id", "billing_year", "billing_month", "billing_type", "status");

CREATE INDEX "idx_tuition_payments_batch_id"
ON "tuition_payments"("payment_batch_id");
