CREATE TABLE "class_notice_requests" (
  "idempotency_key" VARCHAR(150) NOT NULL,
  "request_hash" CHAR(64) NOT NULL,
  "class_id" UUID NOT NULL,
  "month" CHAR(7) NOT NULL,
  "bank_account_id" UUID NOT NULL,
  "response" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "class_notice_requests_pkey" PRIMARY KEY ("idempotency_key")
);

CREATE INDEX "idx_class_notice_requests_scope"
  ON "class_notice_requests"("class_id", "month");
