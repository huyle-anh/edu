import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { studentCreateSchema, studentFilterSchema } from "@/modules/student/schemas/student.schema";
import { createStudent, getStudents } from "@/modules/student/services/student.service";
import { buildStudentListExcel } from "@/modules/student/services/student-excel.service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const searchParams = request.nextUrl.searchParams;
    const filter = studentFilterSchema.parse({
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      excludeClassId: searchParams.get("excludeClassId") || undefined,
      page: Number(searchParams.get("page") || "1"),
      pageSize: Number(searchParams.get("pageSize") || "10"),
    });

    if (searchParams.get("export") === "xlsx") {
      const students = [] as Awaited<ReturnType<typeof getStudents>>["items"];
      let currentPage = 1;
      let totalPages = 1;

      do {
        const result = await getStudents({ ...filter, page: currentPage, pageSize: 100 });
        students.push(...result.items);
        totalPages = result.pages;
        currentPage += 1;
      } while (currentPage <= totalPages);

      const filterDescription = [
        filter.search ? `Tìm kiếm: ${filter.search}` : "",
        filter.status && filter.status !== "ALL"
          ? `Trạng thái: ${filter.status === "ACTIVE" ? "Đang hoạt động" : "Ngừng hoạt động"}`
          : "Tất cả trạng thái",
      ]
        .filter(Boolean)
        .join(" | ");
      const file = await buildStudentListExcel(students, filterDescription);

      return new Response(file as BodyInit, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="danh-sach-hoc-vien.xlsx"',
          "Cache-Control": "no-store",
        },
      });
    }

    const result = await getStudents(filter);
    return apiSuccess(result);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to fetch students");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const body = await request.json();
    const data = studentCreateSchema.parse(body);

    const student = await createStudent(data);
    return apiSuccess(student, 201);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to create student");
  }
}
