import { z } from "zod";

export const classTuitionReportSchema = z.object({
  classId: z.string().uuid("Lớp học không hợp lệ"),
  classSubjectId: z.string().uuid("Môn học không hợp lệ"),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Kỳ học phí không hợp lệ"),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày bắt đầu không hợp lệ"),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày kết thúc không hợp lệ"),
}).refine((value) => value.fromDate <= value.toDate, {
  message: "Đến ngày phải lớn hơn hoặc bằng Từ ngày",
  path: ["toDate"],
});

export type ClassTuitionReportInput = z.infer<
  typeof classTuitionReportSchema
>;
