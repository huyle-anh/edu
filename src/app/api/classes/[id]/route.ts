import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { getAuditContext } from "@/lib/audit";
import { classUpdateSchema } from "@/modules/class/schemas/class.schema";
import { getClassById, updateClass, deleteClass } from "@/modules/class/services/class.service";

type Params = Promise<{
  id: string;
}>;

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const { id } = await params;
    const classData = await getClassById(id);
    if (!classData) {
      return apiError("NOT_FOUND", "Class not found", 404);
    }
    return apiSuccess(classData);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to fetch class");
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const { id } = await params;
    const body = await request.json();
    const data = classUpdateSchema.parse(body);

    const classData = await updateClass(id, data, user.id, getAuditContext(request));
    return apiSuccess(classData);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to update class");
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) {
      return user;
    }

    const { id } = await params;
    const classData = await deleteClass(id);
    return apiSuccess(classData);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to delete class");
  }
}
