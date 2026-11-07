import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { classTuitionReportSchema } from "@/modules/finance/reports/schemas/class-tuition-report.schema";
import { getClassTuitionReport } from "@/modules/finance/reports/services/class-tuition-report.service";
import { buildClassTuitionReportExcel } from "@/modules/finance/reports/services/class-tuition-report-excel.service";

export const runtime = "nodejs";

function safeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-");
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;

    const input = classTuitionReportSchema.parse({
      classId: request.nextUrl.searchParams.get("classId"),
      classSubjectId: request.nextUrl.searchParams.get("classSubjectId"),
      month: request.nextUrl.searchParams.get("month"),
      fromDate: request.nextUrl.searchParams.get("fromDate"),
      toDate: request.nextUrl.searchParams.get("toDate"),
    });
    const report = await getClassTuitionReport(input);
    const file = await buildClassTuitionReportExcel(report);
    const fileName = `bao-cao-thu-hoc-phi-${safeFilePart(report.classCode)}-${report.month}.xlsx`;

    return new Response(file as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    return handleApiError(error, "Không thể xuất báo cáo Excel");
  }
}
