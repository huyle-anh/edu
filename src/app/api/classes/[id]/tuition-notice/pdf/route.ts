import { requireApiUser } from "@/lib/api-auth";
import { apiError, handleApiError } from "@/lib/api";
import { z } from "zod";
import { createClassPaymentBatches, generateClassTuitionNoticePdf } from "@/modules/finance/tuition/services/class-tuition-notice-pdf.service";
import { getAuditContext } from "@/lib/audit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const classId = (await params).id;
    const rawMonth = new URL(request.url).searchParams.get("month");
    const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month phải có định dạng YYYY-MM").safeParse(rawMonth);
    if (!month.success) {
      return apiError("VALIDATION_ERROR", "Kỳ học phí phải có định dạng YYYY-MM", 400);
    }
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return apiError("VALIDATION_ERROR", "Tài khoản nhận tiền là bắt buộc", 400);
    }
    const body = z.object({ bankAccountId: z.string().uuid() }).safeParse(rawBody);
    if (!body.success) {
      return apiError("VALIDATION_ERROR", "Tài khoản nhận tiền là bắt buộc", 400);
    }
    const period = {
      billingYear: Number(month.data.slice(0, 4)),
      billingMonth: Number(month.data.slice(5, 7)),
    };
    const auditContext = getAuditContext(request);
    await createClassPaymentBatches(classId, user.id, period, body.data.bankAccountId, auditContext);
    const result = await generateClassTuitionNoticePdf(classId, user.fullName, user.id, period, auditContext);
    const inline = new URL(request.url).searchParams.get("inline") === "1";
    return new Response(result.pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename=thong-bao-hoc-phi-${result.classCode}.pdf`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error, "Không thể xuất thông báo học phí theo lớp");
  }
}
