import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { attendanceCreateSchema, attendanceQuerySchema, attendanceUpdateSchema } from "@/modules/attendance/schemas/attendance.schema";
import { createAttendance, getAttendanceClasses, getAttendanceSession, getAttendanceSessions, getNewAttendanceRoster, updateAttendance } from "@/modules/attendance/services/attendance.service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser({ allowTeacher: true });
    if (user instanceof Response) return user;
    const query = attendanceQuerySchema.parse({
      classId: request.nextUrl.searchParams.get("classId") || undefined,
      sessionId: request.nextUrl.searchParams.get("sessionId") || undefined,
      newSession: request.nextUrl.searchParams.get("newSession") || undefined,
      fromDate: request.nextUrl.searchParams.get("fromDate") || undefined,
      toDate: request.nextUrl.searchParams.get("toDate") || undefined,
      page: request.nextUrl.searchParams.get("page") || undefined,
      pageSize: request.nextUrl.searchParams.get("pageSize") || undefined,
    });
    if (query.sessionId) return apiSuccess(await getAttendanceSession(query.sessionId, user.teacherId ?? null));
    if (query.classId && query.newSession === "true") return apiSuccess(await getNewAttendanceRoster(query.classId, user.teacherId ?? null));
    if (query.classId) return apiSuccess(await getAttendanceSessions(query.classId, query, user.teacherId ?? null));
    return apiSuccess(await getAttendanceClasses(query, user.teacherId ?? null));
  } catch (error) {
    return handleApiError(error, "Không thể tải dữ liệu điểm danh");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser({ allowTeacher: true });
    if (user instanceof Response) return user;
    const saved = await createAttendance(attendanceCreateSchema.parse(await request.json()), user.id, user.teacherId ?? null);
    return apiSuccess(saved);
  } catch (error) {
    return handleApiError(error, "Không thể tạo phiên điểm danh");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireApiUser({ allowTeacher: true });
    if (user instanceof Response) return user;
    const saved = await updateAttendance(attendanceUpdateSchema.parse(await request.json()), user.id, user.teacherId ?? null);
    return apiSuccess(saved);
  } catch (error) {
    return handleApiError(error, "Không thể lưu điểm danh");
  }
}
