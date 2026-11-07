import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { z } from "zod";
import { subjectUpdateSchema } from "@/modules/class/schemas/class-subject.schema";
import { updateSubject } from "@/modules/class/services/class.service";

type Params = Promise<{ id: string }>;
const routeParamsSchema = z.object({ id: z.string().uuid() });

export async function PATCH(request: NextRequest, context: { params?: Params }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const { id } = routeParamsSchema.parse(await context.params);
    return apiSuccess(await updateSubject(id, subjectUpdateSchema.parse(await request.json())));
  } catch (error: unknown) {
    return handleApiError(error, "Không thể cập nhật môn học");
  }
}
