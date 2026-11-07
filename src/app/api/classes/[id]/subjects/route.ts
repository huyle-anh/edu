import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { BadRequestError } from "@/lib/errors";
import { requireApiUser } from "@/lib/api-auth";
import { getAuditContext } from "@/lib/audit";
import { addClassSubject, getClassSubjects } from "@/modules/class/services/class.service";
import { classSubjectCreateSchema } from "@/modules/class/schemas/class-subject.schema";

type Params = Promise<{ id: string }>;

async function getClassId(context: { params?: Params }) {
  const routeParams = await context.params;
  if (!routeParams?.id) {
    throw new BadRequestError("CLASS_ID_REQUIRED");
  }
  return routeParams.id;
}

export async function GET(_request: NextRequest, context: { params?: Params }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    return apiSuccess(await getClassSubjects(await getClassId(context)));
  } catch (error: unknown) {
    return handleApiError(error, "Không thể tải môn học của lớp");
  }
}

export async function POST(request: NextRequest, context: { params?: Params }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const id = await getClassId(context);
    return apiSuccess(
      await addClassSubject(
        id,
        classSubjectCreateSchema.parse(await request.json()),
        user.id,
        getAuditContext(request),
      ),
      201,
    );
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "CLASS_ID_REQUIRED") {
      return apiError("BAD_REQUEST", "Thiếu mã lớp học", 400);
    }
    return handleApiError(error, "Không thể thêm môn học vào lớp");
  }
}
