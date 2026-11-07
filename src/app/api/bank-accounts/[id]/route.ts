import { handleApiError, apiSuccess } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { z } from "zod";
import { bankAccountUpdateSchema } from "@/modules/finance/bank/schemas/bank-account.schema";
import { updateBankAccount } from "@/modules/finance/bank/services/bank-account.service";
import { getAuditContext } from "@/lib/audit";

const routeParamsSchema = z.object({ id: z.string().uuid() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const user = await requireApiUser(); if (user instanceof Response) return user; const { id } = routeParamsSchema.parse(await params); return apiSuccess(await updateBankAccount(id, bankAccountUpdateSchema.parse(await request.json()), user.id, getAuditContext(request))); }
  catch (error) { return handleApiError(error, "Không thể cập nhật tài khoản ngân hàng"); }
}
