import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import {
  teacherCreateSchema,
  teacherFilterSchema,
} from "@/modules/teacher/schemas/teacher.schema";
import {
  createTeacher,
  getTeachers,
} from "@/modules/teacher/services/teacher.service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const searchParams = request.nextUrl.searchParams;
    const filter = teacherFilterSchema.parse({
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      page: Number(searchParams.get("page") || "1"),
      pageSize: Number(searchParams.get("pageSize") || "10"),
    });

    const result = await getTeachers(filter);
    return apiSuccess({
      items: result.teachers,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      pages: result.pages,
      pagination: result.pagination,
    });
  } catch (error: unknown) {
    return handleApiError(error, "Failed to fetch teachers");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const body = await request.json();
    const data = teacherCreateSchema.parse(body);

    const teacher = await createTeacher(data);
    return apiSuccess(teacher, 201);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to create teacher");
  }
}
