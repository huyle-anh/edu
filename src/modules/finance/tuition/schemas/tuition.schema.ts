import { z } from "zod";

const decimal = z.coerce.number().finite().nonnegative();

export const tuitionFeeUpdateSchema = z.object({
  discountAmount: decimal.optional(),
  additionalAmount: decimal.optional(),
  dueDate: z.string().date().nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  version: z.number().int().positive(),
  reason: z.string().trim().min(1).max(500),
});

export const tuitionFeeStatusSchema = z.object({
  status: z.enum(["EXEMPTED", "CANCELLED"]),
  reason: z.string().trim().min(1, "Lý do là bắt buộc").max(500),
  version: z.number().int().positive(),
});

export const tuitionFeeRestoreSchema = z.object({
  reason: z.string().trim().min(1, "Lý do là bắt buộc").max(500),
  version: z.number().int().positive(),
});

export type TuitionFeeUpdate = z.infer<typeof tuitionFeeUpdateSchema>;
export type TuitionFeeStatusUpdate = z.infer<typeof tuitionFeeStatusSchema>;
export type TuitionFeeRestore = z.infer<typeof tuitionFeeRestoreSchema>;
