import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { z } from "zod";
import { paymentRefundCompleteSchema } from "@/modules/finance/refunds/schemas/payment-refund.schema";
import { completePaymentRefund } from "@/modules/finance/refunds/services/payment-refund.service";
import { getAuditContext } from "@/lib/audit";

const routeParamsSchema = z.object({ id: z.string().uuid() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const data = paymentRefundCompleteSchema.parse(await request.json());
    const { id } = routeParamsSchema.parse(await params);
    return apiSuccess(await completePaymentRefund(id, user.id, data, getAuditContext(request)));
  } catch (error) {
    return handleApiError(error, "Không thể hoàn tất hoàn tiền");
  }
}
