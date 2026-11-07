import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { TuitionService } from "@/modules/finance/tuition/services/tuition.service";
import { getAuditContext } from "@/lib/audit";

const routeParamsSchema = z.object({ id: z.string().uuid() });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const rawMonth = request.nextUrl.searchParams.get("month");
    const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).safeParse(rawMonth);
    if (!month.success) {
      return apiError("VALIDATION_ERROR", "Kỳ học phí phải có định dạng YYYY-MM", 400);
    }
    const period = {
      billingYear: Number(month.data.slice(0, 4)),
      billingMonth: Number(month.data.slice(5, 7)),
    };
    const { id } = routeParamsSchema.parse(await params);
    const result = await TuitionService.createClassTuitionFees(
      id,
      period,
      user.id,
      undefined,
      getAuditContext(request),
    );
    return apiSuccess(result, 201);
  } catch (error: unknown) {
    return handleApiError(error, "Không thể tạo học phí tháng");
  }
}
