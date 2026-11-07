import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { importStudentsToClass } from "@/modules/class/services/class-student-import.service";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function POST(request: NextRequest, context: { params: Params }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;

    const { id } = await context.params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return apiError("BAD_REQUEST", "Vui lòng chọn file Excel", 400);
    }
    if (!file.name.toLocaleLowerCase().endsWith(".xlsx")) {
      return apiError("BAD_REQUEST", "Chỉ hỗ trợ file Excel .xlsx", 400);
    }

    const classSubjectIds = z
      .array(z.string().uuid())
      .min(1, "Hãy chọn ít nhất một môn học")
      .parse(
        form
          .getAll("classSubjectIds")
          .filter((value): value is string => typeof value === "string"),
      );

    const result = await importStudentsToClass(
      id,
      Buffer.from(await file.arrayBuffer()),
      classSubjectIds,
      user.id,
    );
    return apiSuccess(result, 201);
  } catch (error: unknown) {
    return handleApiError(error, "Không thể import học viên vào lớp");
  }
}
