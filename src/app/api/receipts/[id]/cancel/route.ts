import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { z } from "zod";
import { cancelTuitionReceipt } from "@/modules/finance/receipts/services/receipt-cancellation.service";
import { getAuditContext } from "@/lib/audit";

const cancelSchema = z.object({
  reason: z.string().trim().min(1, "Lý do hủy là bắt buộc").max(500),
});
const routeParamsSchema = z.object({ id: z.string().uuid() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const { reason } = cancelSchema.parse(await request.json());
    const { id } = routeParamsSchema.parse(await params);

    const receipt = await cancelTuitionReceipt(id, user.id, reason, getAuditContext(request));

    return apiSuccess(receipt);
  } catch (error) {
    return handleApiError(error, "Không thể hủy biên lai");
  }
}
