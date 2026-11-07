import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { createSubject, getSubjects } from "@/modules/class/services/class.service";
import { subjectCreateSchema } from "@/modules/class/schemas/class-subject.schema";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    return apiSuccess(await getSubjects(request.nextUrl.searchParams.get("search") || undefined, request.nextUrl.searchParams.get("includeInactive") === "true"));
  } catch (error: unknown) {
    return handleApiError(error, "Không thể tải môn học");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    return apiSuccess(await createSubject(subjectCreateSchema.parse(await request.json())), 201);
  } catch (error: unknown) {
    return handleApiError(error, "Không thể tạo môn học");
  }
}
