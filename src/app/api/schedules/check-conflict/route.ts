import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { getScheduleConflicts } from "@/modules/schedule/services/schedule.service";

const checkScheduleConflictSchema = z
  .object({
    teacherId: z.string().uuid("teacherId is invalid").optional(),
    classId: z.string().uuid("classId is invalid").optional(),
    dayOfWeek: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(0).max(1439),
    excludeScheduleId: z.string().uuid().optional(),
  })
  .refine((data) => Boolean(data.teacherId), {
    message: "teacherId là bắt buộc",
    path: ["teacherId"],
  })
  .refine((data) => data.startMinute < data.endMinute, {
    message: "endMinute must be greater than startMinute",
    path: ["endMinute"],
  });

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const body: unknown = await request.json();

    const data = checkScheduleConflictSchema.parse(body);

    const conflicts = await getScheduleConflicts(
      {
        teacherId: data.teacherId,
        classId: data.classId,
        dayOfWeek: data.dayOfWeek,
        startMinute: data.startMinute,
        endMinute: data.endMinute,
      },
      data.excludeScheduleId,
    );

    return apiSuccess({
      hasConflict: conflicts.length > 0,
      conflicts,
    });
  } catch (error: unknown) {
    return handleApiError(error, "Failed to check schedule conflict");
  }
}
