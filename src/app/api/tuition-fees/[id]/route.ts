import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { TuitionService } from "@/modules/finance/tuition/services/tuition.service";
import { tuitionFeeStatusSchema, tuitionFeeUpdateSchema } from "@/modules/finance/tuition/schemas/tuition.schema";
import { getAuditContext } from "@/lib/audit";

const routeParamsSchema = z.object({ id: z.string().uuid() });

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const user = await requireApiUser(); if (user instanceof Response) return user; const { id } = routeParamsSchema.parse(await params); return apiSuccess(await TuitionService.getFee(id)); } catch (error) { return handleApiError(error, "Không thể tải học phí"); } }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const user = await requireApiUser(); if (user instanceof Response) return user; const { id } = routeParamsSchema.parse(await params); return apiSuccess(await TuitionService.updateFee(id, tuitionFeeUpdateSchema.parse(await request.json()), user.id, getAuditContext(request))); } catch (error) { return handleApiError(error, "Không thể cập nhật học phí"); } }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const user = await requireApiUser(); if (user instanceof Response) return user; const { id } = routeParamsSchema.parse(await params); return apiSuccess(await TuitionService.updateStatus(id, tuitionFeeStatusSchema.parse(await request.json()), user.id, getAuditContext(request))); } catch (error) { return handleApiError(error, "Không thể thay đổi trạng thái học phí"); } }
