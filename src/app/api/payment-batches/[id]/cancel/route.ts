import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { getAuditContext } from "@/lib/audit";
import { cancelPaymentBatch } from "@/modules/finance/payments/services/payment-batch.service";

const schema = z.object({ reason: z.string().trim().min(1, "Lý do hủy là bắt buộc").max(500) });
const routeParamsSchema = z.object({ id: z.string().uuid() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const data = schema.parse(await request.json());
    const { id } = routeParamsSchema.parse(await params);
    return apiSuccess(await cancelPaymentBatch(id, user.id, data.reason, getAuditContext(request)));
  } catch (error) {
    return handleApiError(error, "Không thể hủy đợt thanh toán");
  }
}
