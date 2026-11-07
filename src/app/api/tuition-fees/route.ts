import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { TuitionService } from "@/modules/finance/tuition/services/tuition.service";
import { TuitionFeeBillingType, TuitionFeeStatus } from "@prisma/client";
import { z } from "zod";
import { PARTIAL_FEE_STATUS } from "@/modules/finance/tuition/utils/tuition-status";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser(); if (user instanceof Response) return user;
    const params = request.nextUrl.searchParams;
    const pagination = paginationSchema.parse({
      page: params.get("page") ?? undefined,
      pageSize: params.get("pageSize") ?? undefined,
    });
    const rawClassId = params.get("classId");
    if (rawClassId && !z.string().uuid().safeParse(rawClassId).success) {
      return apiError("VALIDATION_ERROR", "Mã lớp không hợp lệ", 422);
    }
    const rawStudentClassId = params.get("studentClassId");
    if (rawStudentClassId && !z.string().uuid().safeParse(rawStudentClassId).success) {
      return apiError("VALIDATION_ERROR", "Mã lớp học viên không hợp lệ", 422);
    }
    const rawStatus = params.get("status");
    const validStatuses = [...Object.values(TuitionFeeStatus), PARTIAL_FEE_STATUS];
    if (rawStatus && !validStatuses.includes(rawStatus as TuitionFeeStatus)) {
      return apiError("VALIDATION_ERROR", "Trạng thái học phí không hợp lệ", 422);
    }
    const rawStatuses = params.get("statuses");
    const statuses = rawStatuses?.split(",").map((value) => value.trim()).filter(Boolean);
    if (rawStatus && rawStatuses) {
      return apiError("VALIDATION_ERROR", "Chỉ được truyền status hoặc statuses", 422);
    }
    if (statuses?.some((value) => !validStatuses.includes(value as TuitionFeeStatus))) {
      return apiError("VALIDATION_ERROR", "Danh sách trạng thái học phí không hợp lệ", 422);
    }
    if (statuses && new Set(statuses).size !== statuses.length) {
      return apiError("VALIDATION_ERROR", "Danh sách trạng thái học phí bị trùng", 422);
    }
    if (rawStatuses !== null && !statuses?.length) {
      return apiError("VALIDATION_ERROR", "Danh sách trạng thái học phí không được để trống", 422);
    }
    const rawUnissuedOnly = params.get("unissuedOnly");
    if (rawUnissuedOnly !== null && !["true", "false"].includes(rawUnissuedOnly)) {
      return apiError("VALIDATION_ERROR", "Tham số unissuedOnly không hợp lệ", 422);
    }
    const status = rawStatus ? rawStatus as TuitionFeeStatus : undefined;
    const rawBillingType = params.get("billingType");
    if (rawBillingType && !Object.values(TuitionFeeBillingType).includes(rawBillingType as TuitionFeeBillingType)) {
      return apiError("VALIDATION_ERROR", "Loại học phí không hợp lệ", 422);
    }
    const billingType = rawBillingType ? rawBillingType as TuitionFeeBillingType : undefined;
    const rawMonth = params.get("month");
    const month = rawMonth ? z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).safeParse(rawMonth) : null;
    if (rawMonth && (!month || !month.success)) return apiError("VALIDATION_ERROR", "Kỳ học phí phải có định dạng YYYY-MM", 400);
    const rawMonths = params.get("months");
    const months = rawMonths !== null
      ? z.array(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)).min(1).max(120).safeParse(rawMonths.split(","))
      : null;
    if (rawMonth && rawMonths !== null) {
      return apiError("VALIDATION_ERROR", "Chỉ được truyền month hoặc months", 400);
    }
    if (rawMonths !== null && (!months?.success || new Set(months.data).size !== months.data.length)) {
      return apiError("VALIDATION_ERROR", "Danh sách kỳ học phí không hợp lệ hoặc bị trùng", 400);
    }
    const billingPeriods = months?.success
      ? months.data.map((value) => ({
          billingYear: Number(value.slice(0, 4)),
          billingMonth: Number(value.slice(5, 7)),
        }))
      : month?.success
        ? [{
            billingYear: Number(month.data.slice(0, 4)),
            billingMonth: Number(month.data.slice(5, 7)),
          }]
        : undefined;
    const filters = {
      studentCode: params.get("studentCode") || undefined,
      classId: params.get("classId") || undefined,
      studentClassId: rawStudentClassId || undefined,
      status,
      statuses: statuses as TuitionFeeStatus[] | undefined,
      search: params.get("search") || undefined,
      unissuedOnly: rawUnissuedOnly === "true",
      billingType,
      billingPeriods,
    };
    const isExport = params.get("export") === "csv";
    let result = await TuitionService.listFees({
      ...filters,
      page: isExport ? 1 : pagination.page,
      pageSize: isExport ? 100 : pagination.pageSize,
    });
    if (isExport) {
      const allItems = [...result.items];
      for (let page = 2; page <= result.pagination.totalPages; page += 1) {
        const nextPage = await TuitionService.listFees({
          ...filters,
          page,
          pageSize: 100,
        });
        allItems.push(...nextPage.items);
      }
      result = { ...result, items: allItems };
      const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
      const rows = [
        ["Mã học phí", "Mã học sinh", "Học sinh", "Lớp", "Loại phí", "Kỳ", "Học phí gốc", "Giảm giá", "Phụ phí", "Tổng phải thu", "Đã thu", "Còn nợ", "Hạn thanh toán", "Trạng thái"],
        ...result.items.map((fee) => [fee.feeNo, fee.student.code, fee.student.fullName, fee.class.name, fee.billingType, `${fee.billingYear}-${String(fee.billingMonth).padStart(2, "0")}`, fee.originalAmount, fee.discountAmount, fee.additionalAmount, fee.finalAmount, fee.paidAmount, fee.remainingAmount, fee.dueDate?.toISOString().slice(0, 10), fee.status]),
      ];
      return new Response(`\uFEFF${rows.map((row) => row.map(escape).join(",")).join("\r\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=tuition-fees.csv" } });
    }
    return apiSuccess(result);
  } catch (error) { return handleApiError(error, "Không thể tải học phí"); }
}
