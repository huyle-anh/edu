import { z } from "zod";

export const dailyPaymentReportSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày báo cáo không hợp lệ"),
});

export type DailyPaymentReportInput = z.infer<typeof dailyPaymentReportSchema>;
