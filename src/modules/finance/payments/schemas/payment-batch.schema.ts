import { z } from "zod";

const moneyInput = z.union([
  z.number().finite().positive(),
  z.string().regex(/^\d+(?:\.\d{1,2})?$/, "Số tiền không hợp lệ"),
]);

export const paymentDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày nhận phải có định dạng YYYY-MM-DD");

export const paymentBatchCreateSchema = z
  .object({
    tuitionFeeIds: z.array(z.string().uuid()).min(1).max(100),
    idempotencyKey: z.string().trim().min(1).max(150).optional(),
    /** Optional per-fee amounts. Missing entries mean the current remaining balance. */
    amounts: z.record(z.string().uuid(), moneyInput).optional(),
    paymentMethod: z.enum(["CASH", "BANK_TRANSFER"]),
    paymentDate: paymentDateSchema.optional(),
    bankAccountId: z.string().uuid().optional(),
    transactionReference: z.string().trim().max(150).optional(),
    payerName: z.string().trim().max(255).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.amounts) {
      for (const feeId of Object.keys(data.amounts)) {
        if (!data.tuitionFeeIds.includes(feeId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["amounts", feeId],
            message: "Khoản học phí không nằm trong danh sách thanh toán",
          });
        }
      }
    }
    if (data.paymentMethod === "CASH" && !data.paymentDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paymentDate"],
        message: "Ngày nhận tiền mặt là bắt buộc",
      });
    }
    if (data.paymentMethod === "BANK_TRANSFER" && data.paymentDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paymentDate"],
        message: "Ngày chuyển khoản được lấy từ sao kê khi đối soát",
      });
    }
  });

export const cashPaymentSchema = z.object({
  paymentDate: paymentDateSchema,
  note: z.string().trim().max(500, "Ghi chú tối đa 500 ký tự").optional(),
});

export const noticeBatchCreateSchema = z.object({
  tuitionFeeIds: z
    .array(z.string().uuid())
    .min(1)
    .max(500)
    .superRefine((ids, ctx) => {
      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Danh sách khoản học phí bị trùng",
        });
      }
    }),
  mode: z.enum(["GROUPED", "SEPARATE", "BY_STUDENT"]),
  bankAccountId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(1).max(150),
});

export const classNoticeBatchCreateSchema = z.object({
  classId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Kỳ học phí không hợp lệ").optional(),
  months: z.array(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Kỳ học phí không hợp lệ")).min(1).max(120).optional(),
  bankAccountId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(1).max(150),
}).superRefine((data, ctx) => {
  if (data.month && data.months) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["months"],
      message: "Chỉ được truyền month hoặc months",
    });
  }
  if (data.months && new Set(data.months).size !== data.months.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["months"],
      message: "Danh sách kỳ học phí bị trùng",
    });
  }
});

export const pendingBatchRestructureSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("SPLIT"),
    sourceBatchId: z.string().uuid(),
    reason: z.string().trim().min(1, "Lý do là bắt buộc").max(500),
    idempotencyKey: z.string().trim().min(1).max(150),
  }),
  z.object({
    operation: z.literal("MERGE"),
    batchIds: z.array(z.string().uuid()).min(2).max(100),
    reason: z.string().trim().min(1, "Lý do là bắt buộc").max(500),
    idempotencyKey: z.string().trim().min(1).max(150),
  }),
]);

export type PaymentBatchCreate = z.infer<typeof paymentBatchCreateSchema>;
export type NoticeBatchCreate = z.infer<typeof noticeBatchCreateSchema>;
export type ClassNoticeBatchCreate = z.infer<
  typeof classNoticeBatchCreateSchema
>;
export type PendingBatchRestructure = z.infer<
  typeof pendingBatchRestructureSchema
>;
