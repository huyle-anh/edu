import { requireApiUser } from "@/lib/api-auth";
import { apiSuccess, handleApiError } from "@/lib/api";
import { z } from "zod";
import { getPaymentBatchQr } from "@/modules/finance/payments/services/payment-batch.service";
import { getAuditContext } from "@/lib/audit";

const routeParamsSchema = z.object({ id: z.string().uuid() });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const user = await requireApiUser(); if (user instanceof Response) return user; const { id } = routeParamsSchema.parse(await params); return apiSuccess(await getPaymentBatchQr(id, user.id, getAuditContext(request))); } catch (error) { return handleApiError(error, "Không thể tạo QR thanh toán tổng"); } }
