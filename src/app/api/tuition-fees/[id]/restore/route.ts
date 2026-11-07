import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { getAuditContext } from "@/lib/audit";
import { TuitionService } from "@/modules/finance/tuition/services/tuition.service";
import { tuitionFeeRestoreSchema } from "@/modules/finance/tuition/schemas/tuition.schema";

const routeParamsSchema = z.object({ id: z.string().uuid() });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const { id } = routeParamsSchema.parse(await params);
    const data = tuitionFeeRestoreSchema.parse(await request.json());
    const fee = await TuitionService.restoreFee(
      id,
      data,
      user.id,
      getAuditContext(request),
    );
    return apiSuccess(fee);
  } catch (error) {
    return handleApiError(error, "Không thể khôi phục học phí");
  }
}
