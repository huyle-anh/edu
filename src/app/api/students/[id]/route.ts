import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { studentUpdateSchema } from "@/modules/student/schemas/student.schema";
import { getStudentById, updateStudent, deleteStudent } from "@/modules/student/services/student.service";

type Params = Promise<{
  id: string;
}>;

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const { id } = await params;
    const student = await getStudentById(id);
    if (!student) {
      return apiError("NOT_FOUND", "Student not found", 404);
    }
    return apiSuccess(student);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to fetch student");
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const { id } = await params;
    const body = await request.json();
    const data = studentUpdateSchema.parse(body);

    const student = await updateStudent(id, data);
    return apiSuccess(student);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to update student");
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) {
      return user;
    }

    const { id } = await params;
    const student = await deleteStudent(id);
    return apiSuccess(student);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to delete student");
  }
}
