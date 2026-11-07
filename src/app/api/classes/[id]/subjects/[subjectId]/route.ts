import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { getAuditContext } from "@/lib/audit";
import { z } from "zod";
import { classSubjectUpdateSchema } from "@/modules/class/schemas/class-subject.schema";
import { removeClassSubject, updateClassSubject } from "@/modules/class/services/class.service";

type Params = Promise<{ id: string; subjectId: string }>;
const routeParamsSchema = z.object({ id: z.string().uuid(), subjectId: z.string().uuid() });

async function getIds(context: { params?: Params }) {
  return routeParamsSchema.parse(await context.params);
}

export async function PATCH(request: NextRequest, context: { params?: Params }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const { id, subjectId } = await getIds(context);
    return apiSuccess(
      await updateClassSubject(
        id,
        subjectId,
        classSubjectUpdateSchema.parse(await request.json()),
        user.id,
        getAuditContext(request),
      ),
    );
  } catch (error: unknown) { return handleApiError(error, "Không thể cập nhật môn học"); }
}

export async function DELETE(request: NextRequest, context: { params?: Params }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const { id, subjectId } = await getIds(context);
    await removeClassSubject(id, subjectId, user.id, getAuditContext(request));
    return apiSuccess({ id: subjectId });
  } catch (error: unknown) { return handleApiError(error, "Không thể xóa môn học"); }
}
