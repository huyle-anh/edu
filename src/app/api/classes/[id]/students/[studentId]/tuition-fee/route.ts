import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { TuitionService } from "@/modules/finance/tuition/services/tuition.service";
import { getAuditContext } from "@/lib/audit";

type Params = Promise<{
  id: string;
  studentId: string;
}>;

const routeParamsSchema = z.object({
  id: z.string().uuid("Mã lớp học không hợp lệ"),
  studentId: z.string().uuid("Mã học viên không hợp lệ"),
});

export async function POST(
  request: NextRequest,
  context: { params?: Params },
) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;

    const rawRouteParams = await context.params;
    const routeParams = rawRouteParams
      ? routeParamsSchema.parse(rawRouteParams)
      : undefined;
    if (!routeParams?.id || !routeParams.studentId) {
      return apiError("BAD_REQUEST", "Thiếu mã lớp hoặc học viên", 400);
    }
    const rawMonth = new URL(request.url).searchParams.get("month");
    const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).safeParse(rawMonth);
    if (!month.success) {
      return apiError("VALIDATION_ERROR", "Kỳ học phí phải có định dạng YYYY-MM", 400);
    }
    const billingYear = Number(month.data.slice(0, 4));
    const billingMonth = Number(month.data.slice(5, 7));

    const fee = await TuitionService.createFromEnrollment(
      {
        classId: routeParams.id,
        studentId: routeParams.studentId,
        billingYear,
        billingMonth,
      },
      user.id,
      undefined,
      undefined,
      getAuditContext(request),
    );
    return apiSuccess(fee, 201);
  } catch (error: unknown) {
    return handleApiError(error, "Không thể tạo học phí từ đăng ký");
  }
}
