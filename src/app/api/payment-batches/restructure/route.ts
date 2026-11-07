import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { getAuditContext } from "@/lib/audit";
import { pendingBatchRestructureSchema } from "@/modules/finance/payments/schemas/payment-batch.schema";
import { restructurePendingBatches } from "@/modules/finance/payments/services/payment-batch.service";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    return apiSuccess(
      await restructurePendingBatches(
        pendingBatchRestructureSchema.parse(await request.json()),
        user.id,
        getAuditContext(request),
      ),
    );
  } catch (error) {
    return handleApiError(error, "Không thể tách hoặc gộp đợt thanh toán");
  }
}
