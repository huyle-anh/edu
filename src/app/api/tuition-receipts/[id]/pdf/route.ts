import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { generateTuitionReceiptPdf } from "@/modules/finance/tuition/services/tuition-receipt-pdf.service";
import { getAuditContext } from "@/lib/audit";

const routeParamsSchema = z.object({ id: z.string().uuid() });

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(); if (user instanceof Response) return user;
    const { id } = routeParamsSchema.parse(await params);
    const inline = request.nextUrl.searchParams.get("inline") === "1";
    const pdf = await generateTuitionReceiptPdf(id, user.id, getAuditContext(request), inline);
    return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `${inline ? "inline" : "attachment"}; filename=bien-lai-hoc-phi.pdf`, "Cache-Control": "no-store" } });
  } catch (error) { return handleApiError(error, "Không thể xuất PDF biên lai"); }
}
