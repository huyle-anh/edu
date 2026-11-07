import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { teacherUpdateSchema } from "@/modules/teacher/schemas/teacher.schema";
import { getTeacherById, updateTeacher, deleteTeacher } from "@/modules/teacher/services/teacher.service";

type Params = Promise<{
  id: string;
}>;

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const { id } = await params;
    const teacher = await getTeacherById(id);
    if (!teacher) {
      return apiError("NOT_FOUND", "Teacher not found", 404);
    }
    return apiSuccess(teacher);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to fetch teacher");
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const { id } = await params;
    const body = await request.json();
    const data = teacherUpdateSchema.parse(body);

    const teacher = await updateTeacher(id, data);
    return apiSuccess(teacher);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to update teacher");
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) {
      return user;
    }

    const { id } = await params;
    const teacher = await deleteTeacher(id);
    return apiSuccess(teacher);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to delete teacher");
  }
}
