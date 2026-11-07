import { requireApiUser } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api";
import { z } from "zod";
import { generatePaymentBatchNoticePdf } from "@/modules/finance/payments/services/payment-batch-notice-pdf.service";
import { getAuditContext } from "@/lib/audit";

const routeParamsSchema = z.object({ id: z.string().uuid() });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const { id } = routeParamsSchema.parse(await params);
    const result = await generatePaymentBatchNoticePdf(id, user.fullName, user.id, getAuditContext(request));
    const inline = new URL(request.url).searchParams.get("inline") === "1";
    return new Response(result.pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `${inline ? "inline" : "attachment"}; filename=thong-bao-${result.batchNo}.pdf`, "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error, "Không thể xuất PDF thông báo thanh toán tổng");
  }
}
