import { z } from "zod";

const recordSchema = z.object({
  enrollmentId: z.string().uuid(),
  status: z.enum(["PRESENT", "ABSENT"]),
  note: z.string().trim().max(500).optional().nullable(),
});
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parts = value.split("-").map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 0;
  const day = parts[2] ?? 0;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, "Ngày không hợp lệ");

export const attendanceQuerySchema = z.object({
  classId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  newSession: z.enum(["true", "false"]).optional(),
  fromDate: dateSchema.optional(),
  toDate: dateSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).superRefine((query, context) => {
  if (query.sessionId && (query.classId || query.newSession)) {
    context.addIssue({ code: "custom", message: "Không thể kết hợp sessionId với classId hoặc newSession" });
  }
  if (query.sessionId && (query.fromDate || query.toDate)) {
    context.addIssue({ code: "custom", message: "Không thể kết hợp sessionId với khoảng ngày" });
  }
  if (query.newSession === "true" && (query.fromDate || query.toDate)) {
    context.addIssue({ code: "custom", message: "Không thể kết hợp tạo phiên mới với khoảng ngày" });
  }
  if (query.newSession === "true" && !query.classId) {
    context.addIssue({ code: "custom", message: "Cần chọn lớp để tạo phiên điểm danh" });
  }
  if (Boolean(query.fromDate) !== Boolean(query.toDate) || ((query.fromDate || query.toDate) && !query.classId)) {
    context.addIssue({ code: "custom", message: "Khoảng ngày cần có đủ ngày bắt đầu, ngày kết thúc và lớp" });
  }
  if (query.fromDate && query.toDate && query.fromDate > query.toDate) {
    context.addIssue({ code: "custom", message: "Ngày bắt đầu không được sau ngày kết thúc" });
  }
});

export const attendanceCreateSchema = z.object({
  classId: z.string().uuid(),
  records: z.array(recordSchema).min(1),
});

export const attendanceUpdateSchema = z.object({
  sessionId: z.string().uuid(),
  records: z.array(recordSchema).min(1),
});

export type AttendanceQuery = z.infer<typeof attendanceQuerySchema>;
export type AttendanceCreate = z.infer<typeof attendanceCreateSchema>;
export type AttendanceUpdate = z.infer<typeof attendanceUpdateSchema>;
