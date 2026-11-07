import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { getAuditContext } from "@/lib/audit";
import {
  deleteEnrollmentPause,
  pauseStudentEnrollment,
  updateEnrollmentPause,
} from "@/modules/class/services/class.service";

const pauseSchema = z.object({
  startMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  endMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  reason: z.string().max(500).optional(),
});

const updatePauseSchema = pauseSchema.extend({
  pauseId: z.string().uuid(),
});

const deletePauseSchema = z.object({
  pauseId: z.string().uuid(),
});

const routeParamsSchema = z.object({
  id: z.string().uuid("Mã lớp học không hợp lệ"),
  studentId: z.string().uuid("Mã học viên không hợp lệ"),
});

type Params = Promise<{
  id: string;
  studentId: string;
}>;

export async function POST(
  request: NextRequest,
  context: { params: Params },
) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const { id, studentId } = routeParamsSchema.parse(await context.params);
    const data = pauseSchema.parse(await request.json());
    const result = await pauseStudentEnrollment(id, studentId, data, user.id, getAuditContext(request));
    return apiSuccess(result, 201);
  } catch (error: unknown) {
    return handleApiError(error, "Không thể tạo thời gian tạm nghỉ");
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Params },
) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const { id, studentId } = routeParamsSchema.parse(await context.params);
    const { pauseId, ...data } = updatePauseSchema.parse(await request.json());
    const result = await updateEnrollmentPause(
      id,
      studentId,
      pauseId,
      data,
      user.id,
      getAuditContext(request),
    );
    return apiSuccess(result);
  } catch (error: unknown) {
    return handleApiError(error, "Không thể sửa thời gian tạm nghỉ");
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Params },
) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const { id, studentId } = routeParamsSchema.parse(await context.params);
    const { pauseId } = deletePauseSchema.parse(await request.json());
    const result = await deleteEnrollmentPause(id, studentId, pauseId, user.id, getAuditContext(request));
    return apiSuccess(result);
  } catch (error: unknown) {
    return handleApiError(error, "Không thể hủy thời gian tạm nghỉ");
  }
}
