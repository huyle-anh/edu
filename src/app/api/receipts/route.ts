import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { Prisma, ReceiptStatus } from "@prisma/client";
import { getVietnamDayEndExclusive, parseVietnamDateStart } from "@/lib/vietnam-time";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;

    const params = new URL(request.url).searchParams;
    const rawPage = params.get("page");
    const rawPageSize = params.get("pageSize");
    const page = rawPage ? Number(rawPage) : 1;
    const pageSize = rawPageSize ? Number(rawPageSize) : 20;
    if (!Number.isInteger(page) || page < 1) {
      return apiError("VALIDATION_ERROR", "Trang không hợp lệ", 422);
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      return apiError("VALIDATION_ERROR", "Kích thước trang không hợp lệ", 422);
    }
    const search = params.get("search")?.trim();
    const rawStatus = params.get("status");
    if (rawStatus && !Object.values(ReceiptStatus).includes(rawStatus as ReceiptStatus)) {
      return apiError("VALIDATION_ERROR", "Trạng thái biên lai không hợp lệ", 422);
    }
    const status = rawStatus ? rawStatus as ReceiptStatus : undefined;
    const dateFrom = params.get("dateFrom");
    const dateTo = params.get("dateTo");
    const issuedAt: { gte?: Date; lt?: Date } = {};
    if (dateFrom) {
      const start = parseVietnamDateStart(dateFrom);
      if (!start) return apiError("VALIDATION_ERROR", "Ngày bắt đầu không hợp lệ", 400);
      issuedAt.gte = start;
    }
    if (dateTo) {
      const end = getVietnamDayEndExclusive(dateTo);
      if (!end) return apiError("VALIDATION_ERROR", "Ngày kết thúc không hợp lệ", 400);
      issuedAt.lt = end;
    }
    if (issuedAt.gte && issuedAt.lt && issuedAt.gte >= issuedAt.lt) {
      return apiError("VALIDATION_ERROR", "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc", 400);
    }
    const where = {
      ...(status ? { status } : {}),
      ...(Object.keys(issuedAt).length ? { issuedAt } : {}),
      ...(search ? {
        OR: [
          { receiptNo: { contains: search, mode: "insensitive" as const } },
          { payment: { paymentNo: { contains: search, mode: "insensitive" as const } } },
          { payment: { tuitionFee: { feeNo: { contains: search, mode: "insensitive" as const } } } },
          { payment: { tuitionFee: { student: { code: { contains: search, mode: "insensitive" as const } } } } },
          { payment: { tuitionFee: { student: { fullName: { contains: search, mode: "insensitive" as const } } } } },
          { receiverName: { contains: search, mode: "insensitive" as const } },
        ],
      } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.tuitionReceipt.findMany({
        where,
        select: {
          id: true,
          receiptNo: true,
          issuedAt: true,
          receiverName: true,
          amount: true,
          status: true,
          payment: {
            select: {
              paymentNo: true,
              paymentMethod: true,
              tuitionFee: {
                select: {
                  feeNo: true,
                  student: { select: { id: true, code: true, fullName: true } },
                  class: { select: { name: true } },
                  items: {
                    select: {
                      itemName: true,
                      classSubject: {
                        select: { subject: { select: { name: true } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { issuedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.tuitionReceipt.count({ where }),
    ]);
    const printedAtRows = items.length
      ? await prisma.$queryRaw<Array<{ id: string; printedAt: Date | null }>>(
          Prisma.sql`SELECT id, printed_at AS "printedAt"
            FROM tuition_receipts
            WHERE id IN (${Prisma.join(items.map((item) => Prisma.sql`${item.id}::uuid`))})`,
        )
      : [];
    const printedAtById = new Map(printedAtRows.map((row) => [row.id, row.printedAt]));
    return apiSuccess({
      items: items.map((item) => ({
        ...item,
        printedAt: printedAtById.get(item.id) ?? null,
      })),
      total,
      page,
      pageSize,
      pages: Math.ceil(total / pageSize),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    return handleApiError(error, "Không thể tải biên lai");
  }
}
