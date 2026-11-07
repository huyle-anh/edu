import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { importStudentsCsv } from "@/modules/student/services/student-import.service";
import { BadRequestError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new BadRequestError("Vui lòng chọn file CSV");
    }

    const result = await importStudentsCsv(Buffer.from(await file.arrayBuffer()));
    return apiSuccess(result, 201);
  } catch (error: unknown) {
    return handleApiError(error, "Không thể import học viên");
  }
}
