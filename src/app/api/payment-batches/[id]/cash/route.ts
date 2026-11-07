import { requireApiUser } from "@/lib/api-auth";
import { z } from "zod";
import { apiSuccess, handleApiError } from "@/lib/api";
import { convertPaymentBatchToCash } from "@/modules/finance/payments/services/payment-batch.service";
import { getAuditContext } from "@/lib/audit";
import { cashPaymentSchema } from "@/modules/finance/payments/schemas/payment-batch.schema";

const routeParamsSchema = z.object({ id: z.string().uuid() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const { id } = routeParamsSchema.parse(await params);
    const data = cashPaymentSchema.parse(await request.json());
    return apiSuccess(
      await convertPaymentBatchToCash(id, user.id, data.paymentDate, data.note, getAuditContext(request)),
    );
  } catch (error) {
    return handleApiError(error, "Không thể chuyển đợt thanh toán sang tiền mặt");
  }
}
