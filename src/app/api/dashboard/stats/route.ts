import { apiError, apiSuccess } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { toDecimal } from "@/lib/decimal";
import { TuitionFeeStatus } from "@prisma/client";
import { PARTIAL_FEE_STATUS } from "@/modules/finance/tuition/utils/tuition-status";
import { prisma } from "@/lib/prisma";
import {
  getVietnamDayEndExclusive,
  getVietnamDayStart,
  parseVietnamDateStart,
} from "@/lib/vietnam-time";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) {
      return user;
    }

    const params = new URL(request.url).searchParams;
    const dateFrom = params.get("dateFrom");
    const dateTo = params.get("dateTo");
    const paymentDate: { gte?: Date; lt?: Date } = {};
    if (dateFrom) {
      const start = parseVietnamDateStart(dateFrom);
      if (!start) return apiError("VALIDATION_ERROR", "Ngày bắt đầu không hợp lệ", 400);
      paymentDate.gte = start;
    }
    if (dateTo) {
      const end = getVietnamDayEndExclusive(dateTo);
      if (!end) return apiError("VALIDATION_ERROR", "Ngày kết thúc không hợp lệ", 400);
      paymentDate.lt = end;
    }
    if (paymentDate.gte && paymentDate.lt && paymentDate.gte >= paymentDate.lt) {
      return apiError("VALIDATION_ERROR", "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc", 400);
    }
    const asOf = new Date();
    const todayStart = getVietnamDayStart(asOf);
    const overdueWhere = {
      OR: [
        { status: "OVERDUE" as const },
        { status: "UNPAID" as const, dueDate: { lt: todayStart } },
        { status: PARTIAL_FEE_STATUS, dueDate: { lt: todayStart } },
      ],
    };
    const [paymentAggregate, cashPaymentAggregate, bankTransferPaymentAggregate, tuitionFeeAggregate, debtAggregate, overdueFees, activeClasses, activeStudents, pendingBatches] =
      await Promise.all([
        prisma.tuitionPayment.aggregate({ where: { paymentStatus: "SUCCESS", ...(Object.keys(paymentDate).length ? { paymentDate } : {}) },
          _sum: {
            amount: true,
          },
        }),
        prisma.tuitionPayment.aggregate({
          where: {
            paymentStatus: "SUCCESS",
            paymentMethod: "CASH",
            ...(Object.keys(paymentDate).length ? { paymentDate } : {}),
          },
          _sum: { amount: true },
        }),
        prisma.tuitionPayment.aggregate({
          where: {
            paymentStatus: "SUCCESS",
            paymentMethod: "BANK_TRANSFER",
            ...(Object.keys(paymentDate).length ? { paymentDate } : {}),
          },
          _sum: { amount: true },
        }),
        prisma.tuitionFee.aggregate({
          where: { status: { in: [TuitionFeeStatus.UNPAID, PARTIAL_FEE_STATUS, TuitionFeeStatus.PAID, TuitionFeeStatus.OVERDUE] } },
          _sum: {
            finalAmount: true,
          },
        }),
        prisma.$queryRaw<Array<{ total: import("@prisma/client").Prisma.Decimal }>>`
          SELECT COALESCE(SUM(tf.final_amount - COALESCE(paid.total_paid, 0)), 0) AS total
          FROM tuition_fees tf
          LEFT JOIN (
            SELECT tuition_fee_id, SUM(amount) AS total_paid
            FROM tuition_payments
            WHERE payment_status = 'SUCCESS'::tuition_payment_status
            GROUP BY tuition_fee_id
          ) paid ON paid.tuition_fee_id = tf.id
          WHERE tf.status IN ('UNPAID'::tuition_fee_status, 'PARTIAL'::tuition_fee_status, 'OVERDUE'::tuition_fee_status)
        `.then((rows) => rows[0]?.total ?? toDecimal(0)),
        prisma.tuitionFee.count({ where: overdueWhere }),
        prisma.class.count({
          where: {
            status: "ACTIVE",
          },
        }),
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(DISTINCT cs.student_id)::bigint AS count
          FROM class_students cs
          JOIN classes c ON c.id = cs.class_id
          JOIN students s ON s.id = cs.student_id
          WHERE cs.status = 'ACTIVE'::enrollment_status
            AND c.status = 'ACTIVE'::class_status
            AND s.status = 'ACTIVE'::student_status
        `.then((rows) => Number(rows[0]?.count ?? 0)),
        prisma.paymentBatch.count({ where: { status: "PENDING" } }),
      ]);
    const totalRevenue = paymentAggregate._sum.amount ?? toDecimal(0);
    const cashCollected = cashPaymentAggregate._sum.amount ?? toDecimal(0);
    const bankTransferCollected = bankTransferPaymentAggregate._sum.amount ?? toDecimal(0);
    const totalFeeAmount = tuitionFeeAggregate._sum?.finalAmount ?? toDecimal(0);
    const totalCollected = totalRevenue;
    const totalDebt = debtAggregate;

    return apiSuccess({
      totalFeeAmount,
      totalRevenue,
      totalDebt: totalDebt.greaterThan(0) ? totalDebt : toDecimal(0),
      totalCollected,
      cashCollected,
      bankTransferCollected,
      activeClasses,
      activeStudents,
      overdueFees,
      pendingBatches,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return apiError("INTERNAL_ERROR", "Failed to fetch dashboard stats", 500);
  }
}
