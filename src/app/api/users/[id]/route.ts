import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { userUpdateSchema } from "@/modules/user/schemas/user.schema";
import { deactivateUser, updateUser } from "@/modules/user/services/user.service";

type Params = Promise<{ id: string }>;

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  try {
    const actor = await requireApiUser();
    if (actor instanceof Response) return actor;
    const { id } = await params;
    return apiSuccess(await updateUser(id, userUpdateSchema.parse(await request.json()), actor.id));
  } catch (error) { return handleApiError(error, "Không thể cập nhật người dùng"); }
}

export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  try {
    const actor = await requireApiUser();
    if (actor instanceof Response) return actor;
    const { id } = await params;
    return apiSuccess(await deactivateUser(id, actor.id));
  } catch (error) { return handleApiError(error, "Không thể khóa người dùng"); }
}
