import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { classCreateSchema, classFilterSchema } from "@/modules/class/schemas/class.schema";
import { createClass, getClasses } from "@/modules/class/services/class.service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const searchParams = request.nextUrl.searchParams;
    const filter = classFilterSchema.parse({
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      statuses: searchParams.get("statuses")?.split(",").filter(Boolean),
      page: Number(searchParams.get("page") || "1"),
      pageSize: Number(searchParams.get("pageSize") || "10"),
    });

    const result = await getClasses(filter);
    return apiSuccess(result);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to fetch classes");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const body = await request.json();
    const data = classCreateSchema.parse(body);

    const newClass = await createClass(data);
    return apiSuccess(newClass, 201);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to create class");
  }
}
