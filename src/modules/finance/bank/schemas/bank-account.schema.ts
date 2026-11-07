import { z } from "zod";

export const bankAccountCreateSchema = z.object({
  bankCode: z.string().trim().min(1, "Mã ngân hàng là bắt buộc").max(50),
  bankName: z.string().trim().min(1, "Tên ngân hàng là bắt buộc").max(255),
  accountNo: z.string().trim().min(1, "Số tài khoản là bắt buộc").max(100),
  accountName: z.string().trim().min(1, "Tên chủ tài khoản là bắt buộc").max(255),
  branchName: z.string().trim().max(255).optional().or(z.literal("")),
  currencyCode: z.string().trim().min(1).max(10).default("VND"),
});

export const bankAccountUpdateSchema = bankAccountCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type BankAccountCreate = z.infer<typeof bankAccountCreateSchema>;
export type BankAccountUpdate = z.infer<typeof bankAccountUpdateSchema>;
