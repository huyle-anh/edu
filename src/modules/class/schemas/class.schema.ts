import { z } from "zod";

const classFieldsSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Mã lớp là bắt buộc")
    .max(50)
    .regex(/^[A-Za-z0-9-]+$/, "Mã lớp chỉ được gồm chữ cái a-z, số và dấu -"),
  name: z.string().trim().min(1, "Tên lớp là bắt buộc").max(100),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z
    .enum(["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"])
    .default("DRAFT"),
});

const validateDateRange = <T extends { startDate?: string; endDate?: string }>(data: T, ctx: z.RefinementCtx) => {
  if (data.startDate && data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: "Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu",
    });
  }
};

export const classCreateSchema = classFieldsSchema.superRefine(validateDateRange);
export const classUpdateSchema = classFieldsSchema.partial().superRefine(validateDateRange);

export const classFilterSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
  statuses: z.array(z.enum(["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"])).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
});

export type ClassCreate = z.infer<typeof classCreateSchema>;
export type ClassUpdate = z.infer<typeof classUpdateSchema>;
export type ClassFilter = z.infer<typeof classFilterSchema>;
