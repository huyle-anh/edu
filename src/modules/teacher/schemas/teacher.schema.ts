import { z } from "zod";

export const teacherCreateSchema = z.object({
  fullName: z.string().min(1, "Tên giáo viên là bắt buộc").max(255, "Tên giáo viên tối đa 255 ký tự"),
  phone: z.string().optional(),
  bankAccount: z.string().optional(),
  specialty: z.string().optional(),
  commissionPercent: z
    .number()
    .min(0, "Tỷ lệ không được âm")
    .max(100, "Tỷ lệ không được vượt quá 100")
    .default(0),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const teacherUpdateSchema = teacherCreateSchema.partial().extend({ code: z.string().trim().min(1).max(50).optional() });

export const teacherFilterSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ALL"]).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
});

export type TeacherCreate = z.infer<typeof teacherCreateSchema>;
export type TeacherUpdate = z.infer<typeof teacherUpdateSchema>;
export type TeacherFilter = z.infer<typeof teacherFilterSchema>;
