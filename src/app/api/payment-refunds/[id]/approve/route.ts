import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { z } from "zod";
import { approvePaymentRefund } from "@/modules/finance/refunds/services/payment-refund.service";
import { getAuditContext } from "@/lib/audit";

const routeParamsSchema = z.object({ id: z.string().uuid() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const { id } = routeParamsSchema.parse(await params);
    return apiSuccess(await approvePaymentRefund(id, user.id, getAuditContext(request)));
  } catch (error) {
    return handleApiError(error, "Không thể duyệt hoàn tiền");
  }
}
