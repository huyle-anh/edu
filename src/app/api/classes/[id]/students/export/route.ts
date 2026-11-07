import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { buildClassStudentListExcel } from "@/modules/class/services/class-student-export.service";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;

    const { id } = z.object({ id: z.string().uuid() }).parse(await params);
    const { file, classCode } = await buildClassStudentListExcel(id);
    const safeClassCode = classCode.replace(/[^A-Za-z0-9_-]/g, "-") || "lop";

    return new Response(file as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="danh-sach-hoc-vien-${safeClassCode}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    return handleApiError(error, "Không thể xuất danh sách học viên");
  }
}
