import { z } from "zod";

export const paymentRefundCreateSchema = z.object({
  paymentId: z.string().uuid(),
  refundMethod: z.enum(["CASH", "BANK_TRANSFER"]),
  reason: z.string().trim().min(1, "Lý do hoàn tiền là bắt buộc").max(500),
});

export const paymentRefundCompleteSchema = z.object({
  refundDate: z.string().datetime().optional(),
  bankTransactionNo: z.string().trim().max(150).optional(),
});

export type PaymentRefundCreate = z.infer<typeof paymentRefundCreateSchema>;
export type PaymentRefundComplete = z.infer<typeof paymentRefundCompleteSchema>;
