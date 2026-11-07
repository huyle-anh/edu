import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { paymentRefundCreateSchema } from "@/modules/finance/refunds/schemas/payment-refund.schema";
import { createPaymentRefund } from "@/modules/finance/refunds/services/payment-refund.service";
import { getAuditContext } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const data = paymentRefundCreateSchema.parse(await request.json());
    return apiSuccess(await createPaymentRefund(data, user.id, undefined, getAuditContext(request)), 201);
  } catch (error) {
    return handleApiError(error, "Không thể tạo yêu cầu hoàn tiền");
  }
}
