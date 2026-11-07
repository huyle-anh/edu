import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api";
import { getAuditContext } from "@/lib/audit";
import { requireApiUser } from "@/lib/api-auth";
import { generatePaymentBatchNoticesPdf } from "@/modules/finance/payments/services/payment-batch-notice-pdf.service";

const schema = z.object({
  batchIds: z.array(z.string().uuid()).min(1).max(5000).superRefine((ids, ctx) => {
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Danh sách đợt thu bị trùng" });
    }
  }),
  scope: z.object({
    months: z.array(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)).min(1).max(120).optional(),
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
    classId: z.string().uuid().optional(),
  }).superRefine((scope, ctx) => {
    if (scope.month && scope.months) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["months"],
        message: "Chỉ được truyền month hoặc months",
      });
    }
    if (scope.months && new Set(scope.months).size !== scope.months.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["months"],
        message: "Danh sách kỳ học phí bị trùng",
      });
    }
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const { batchIds, scope } = schema.parse(await request.json());
    const pdf = await generatePaymentBatchNoticesPdf(
      batchIds,
      user.fullName,
      user.id,
      getAuditContext(request),
      scope
        ? {
          ...(scope.months
            ? {
                billingPeriods: scope.months.map((value) => ({
                  billingYear: Number(value.slice(0, 4)),
                  billingMonth: Number(value.slice(5, 7)),
                })),
              }
            : scope.month
              ? {
                  billingYear: Number(scope.month.slice(0, 4)),
                  billingMonth: Number(scope.month.slice(5, 7)),
                }
              : {}),
            ...(scope.classId ? { classId: scope.classId } : {}),
          }
        : undefined,
    );
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=thong-bao-hoc-phi.pdf",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error, "Không thể xuất PDF thông báo học phí");
  }
}
