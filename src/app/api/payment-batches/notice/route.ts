import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { getAuditContext } from "@/lib/audit";
import { noticeBatchCreateSchema } from "@/modules/finance/payments/schemas/payment-batch.schema";
import { createNoticeBatches } from "@/modules/finance/payments/services/payment-batch.service";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    return apiSuccess(
      await createNoticeBatches(
        noticeBatchCreateSchema.parse(await request.json()),
        user.id,
        getAuditContext(request),
      ),
      201,
    );
  } catch (error) {
    return handleApiError(error, "Không thể phát hành thông báo học phí");
  }
}
