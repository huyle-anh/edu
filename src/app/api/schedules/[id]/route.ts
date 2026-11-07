import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { classScheduleUpdateSchema } from "@/modules/schedule/schemas/schedule.schema";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { BadRequestError } from "@/lib/errors";
import {
  getClassScheduleById,
  updateClassSchedule,
  deleteClassSchedule,
  ScheduleConflictError,
} from "@/modules/schedule/services/schedule.service";

type Params = Promise<{ id: string }>;

async function getScheduleId(context: { params?: Params }) {
  const routeParams = await context.params;
  if (!routeParams?.id) throw new BadRequestError("SCHEDULE_ID_REQUIRED");
  return routeParams.id;
}

export async function GET(
  _request: NextRequest,
  context: { params?: Params },
) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const id = await getScheduleId(context);
    const schedule = await getClassScheduleById(id);
    if (!schedule) {
      return apiError("NOT_FOUND", "Schedule not found", 404);
    }
    return apiSuccess(schedule);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "SCHEDULE_ID_REQUIRED") return apiError("BAD_REQUEST", "Thiếu mã lịch học", 400);
    return handleApiError(error, "Failed to fetch schedule");
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params?: Params },
) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const id = await getScheduleId(context);
    const existingSchedule = await getClassScheduleById(id);
    if (!existingSchedule) {
      return apiError("NOT_FOUND", "Không tìm thấy lịch học", 404);
    }

    const body = await request.json();
    const data = classScheduleUpdateSchema.parse(body);

    const { schedule } = await updateClassSchedule(id, data);
    return apiSuccess(schedule);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "SCHEDULE_ID_REQUIRED") return apiError("BAD_REQUEST", "Thiếu mã lịch học", 400);
    if (error instanceof ScheduleConflictError) {
      return apiError("CONFLICT", error.message, 409, {
        conflicts: error.conflicts,
      });
    }

    return handleApiError(error, "Failed to update schedule");
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params?: Params },
) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const id = await getScheduleId(context);
    const schedule = await deleteClassSchedule(id);
    return apiSuccess(schedule);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "SCHEDULE_ID_REQUIRED") return apiError("BAD_REQUEST", "Thiếu mã lịch học", 400);
    return handleApiError(error, "Failed to delete schedule");
  }
}
