import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { bankStatementImportSchema } from "@/modules/finance/bank/schemas/bank-reconciliation.schema";
import { importBankStatement } from "@/modules/finance/bank/services/bank-csv.service";
import { BadRequestError } from "@/lib/errors";
import { getAuditContext } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const sessionQuerySchema = z.object({
  bankAccountId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser(); if (user instanceof Response) return user;
    const query = sessionQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const where = query.bankAccountId ? { bankAccountId: query.bankAccountId } : {};
    const [sessions, total] = await Promise.all([
      prisma.bankStatementImportSession.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          fileName: true,
          bankFormat: true,
          statementFromDate: true,
          statementToDate: true,
          totalRows: true,
          validRows: true,
          invalidRows: true,
          duplicatedRows: true,
          matchedRows: true,
          unmatchedRows: true,
          ignoredRows: true,
          createdAt: true,
          bankAccount: { select: { bankName: true, accountNo: true } },
        },
      }),
      prisma.bankStatementImportSession.count({ where }),
    ]);
    return apiSuccess({ sessions, total, page: query.page, pageSize: query.pageSize });
  } catch (error) {
    return handleApiError(error, "Không thể tải danh sách phiên đối soát");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser(); if (user instanceof Response) return user;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new BadRequestError("File Excel sao kê là bắt buộc");
    if (!file.name.toLowerCase().endsWith(".xlsx")) throw new BadRequestError("File sao kê phải là .xlsx");
    const { bankAccountId } = bankStatementImportSchema.parse({
      bankAccountId: String(form.get("bankAccountId") || ""),
    });
    const result = await importBankStatement({
      buffer: Buffer.from(await file.arrayBuffer()),
      fileName: file.name,
      bankAccountId,
      actorId: user.id,
      auditContext: getAuditContext(request),
    });
    return apiSuccess(result, 201);
  } catch (error) { return handleApiError(error, "Không thể import sao kê ngân hàng"); }
}
