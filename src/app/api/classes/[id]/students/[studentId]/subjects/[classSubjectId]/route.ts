import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { getAuditContext } from "@/lib/audit";
import { removeSubjectFromEnrollment } from "@/modules/class/services/class.service";
import { z } from "zod";

const removeSubjectSchema = z.object({
  force: z.boolean().optional().default(false),
  reason: z.string().trim().max(500).optional(),
});

const routeParamsSchema = z.object({
  id: z.string().uuid("Mã lớp học không hợp lệ"),
  studentId: z.string().uuid("Mã học viên không hợp lệ"),
  classSubjectId: z.string().uuid("Mã môn học trong lớp không hợp lệ"),
});

type Params = Promise<{
  id: string;
  studentId: string;
  classSubjectId: string;
}>;

export async function DELETE(
  request: Request,
  context: { params: Params },
) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const { id, studentId, classSubjectId } = routeParamsSchema.parse(await context.params);
    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const options = removeSubjectSchema.parse(body);
    const result = await removeSubjectFromEnrollment(
      id,
      studentId,
      classSubjectId,
      user.id,
      options,
      getAuditContext(request),
    );
    return apiSuccess(result);
  } catch (error: unknown) {
    return handleApiError(error, "Không thể bỏ môn học của học viên");
  }
}
