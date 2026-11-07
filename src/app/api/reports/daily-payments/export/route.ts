import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { dailyPaymentReportSchema } from "@/modules/finance/reports/schemas/daily-payment-report.schema";
import { getDailyPaymentReport } from "@/modules/finance/reports/services/daily-payment-report.service";
import { buildDailyPaymentReportExcel } from "@/modules/finance/reports/services/daily-payment-report-excel.service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const input = dailyPaymentReportSchema.parse({
      date: request.nextUrl.searchParams.get("date"),
    });
    const report = await getDailyPaymentReport(input);
    const file = await buildDailyPaymentReportExcel(report);
    return new Response(file as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="bao-cao-thu-hoc-phi-ngay-${report.date}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    return handleApiError(error, "Không thể xuất báo cáo thu học phí theo ngày");
  }
}
