import { PaymentBatchStatus, Prisma, TuitionPaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type { ClassTuitionReportInput } from "@/modules/finance/reports/schemas/class-tuition-report.schema";
import { getVietnamDayEndExclusive, getVietnamDate, parseVietnamDateStart } from "@/lib/vietnam-time";

export type ClassTuitionReportRow = {
  studentCode: string;
  givenName: string;
  familyName: string;
  enrollmentStatus: string;
  tuitionStatus: string;
  assessedAmount: number;
  paidInPeriodAmount: number;
  paidCumulativeAmount: number;
  outstandingAmount: number;
};

export type ClassTuitionReport = {
  classCode: string;
  className: string;
  subjectName: string;
  teacherCode: string;
  teacherName: string;
  commissionPercent: number;
  month: string;
  fromDate: string;
  toDate: string;
  asOfDate: string;
  rows: ClassTuitionReportRow[];
};

function splitStudentName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const familyName = parts.pop() ?? "";

  return {
    givenName: parts.join(" "),
    familyName,
  };
}

function getSubjectFinalAmount(
  fee: {
    originalAmount: Prisma.Decimal;
    discountAmount: Prisma.Decimal;
    additionalAmount: Prisma.Decimal;
    finalAmount: Prisma.Decimal;
    items: Array<{ classSubjectId: string | null; amount: Prisma.Decimal }>;
  },
  classSubjectId: string,
) : Prisma.Decimal {
  const subjectGross = fee.items
    .filter((item) => item.classSubjectId === classSubjectId)
    .reduce((total, item) => total.add(item.amount), new Prisma.Decimal(0));
  if (!subjectGross.greaterThan(0)) return new Prisma.Decimal(0);

  const originalAmount = fee.originalAmount;
  const adjustmentRatio = originalAmount.greaterThan(0)
    ? Prisma.Decimal.min(Prisma.Decimal.max(subjectGross.div(originalAmount), 0), 1)
    : new Prisma.Decimal(1);
  const subjectFinal = Prisma.Decimal.max(
    subjectGross
      .minus(fee.discountAmount.mul(adjustmentRatio))
      .plus(fee.additionalAmount.mul(adjustmentRatio)),
    0,
  );
  return subjectFinal;
}

function getSubjectPaidAmount(
  fee: {
    finalAmount: Prisma.Decimal;
    payments: Array<{ amount: Prisma.Decimal }>;
  },
  subjectFinal: Prisma.Decimal,
) {
  const paymentRatio = fee.finalAmount.greaterThan(0)
    ? subjectFinal.div(fee.finalAmount)
    : new Prisma.Decimal(0);

  return fee.payments
    .reduce(
      (total, payment) => total.plus(payment.amount.mul(paymentRatio)),
      new Prisma.Decimal(0),
    )
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
}

export async function getClassTuitionReport(
  input: ClassTuitionReportInput,
): Promise<ClassTuitionReport> {
  const collectionStart = parseVietnamDateStart(input.fromDate);
  const collectionEndExclusive = getVietnamDayEndExclusive(input.toDate);
  const asOfDate = getVietnamDate();
  const asOfEndExclusive = getVietnamDayEndExclusive(asOfDate);
  if (!collectionStart || !collectionEndExclusive || !asOfEndExclusive) {
    throw new ConflictError("Khoảng ngày báo cáo không hợp lệ");
  }
  const classSubject = await prisma.classSubject.findFirst({
    where: {
      id: input.classSubjectId,
      classId: input.classId,
    },
    include: {
      class: { select: { code: true, name: true } },
      subject: { select: { name: true } },
      teacher: {
        select: {
          id: true,
          code: true,
          fullName: true,
          commissionPercent: true,
          status: true,
        },
      },
    },
  });

  if (!classSubject || !["ACTIVE", "COMPLETED"].includes(classSubject.status)) {
    throw new NotFoundError("Không tìm thấy môn học thuộc lớp đã chọn");
  }

  if (!classSubject.teacher) {
    throw new ConflictError("Môn học chưa được phân công giáo viên");
  }

  const enrollments = await prisma.classStudent.findMany({
    where: {
      classId: input.classId,
      tuitionFees: {
        some: {
          classId: input.classId,
          items: { some: { classSubjectId: input.classSubjectId } },
        },
      },
    },
    select: {
      status: true,
      student: { select: { code: true, fullName: true } },
      tuitionFees: {
        where: {
          classId: input.classId,
          items: { some: { classSubjectId: input.classSubjectId } },
        },
        select: {
          originalAmount: true,
          discountAmount: true,
          additionalAmount: true,
          finalAmount: true,
          billingYear: true,
          billingMonth: true,
          status: true,
          items: {
            select: { classSubjectId: true, amount: true },
          },
          payments: {
            where: {
              paymentStatus: TuitionPaymentStatus.SUCCESS,
              paymentDate: { lt: asOfEndExclusive },
              OR: [
                { paymentBatch: { is: null } },
                { paymentBatch: { status: PaymentBatchStatus.SUCCESS } },
              ],
            },
            select: { amount: true, paymentDate: true },
          },
        },
      },
    },
    orderBy: { student: { fullName: "asc" } },
  });

  return {
    classCode: classSubject.class.code,
    className: classSubject.class.name,
    subjectName: classSubject.subject.name,
    teacherCode: classSubject.teacher.code,
    teacherName: classSubject.teacher.fullName,
    commissionPercent: Number(classSubject.teacher.commissionPercent),
    month: input.month,
    fromDate: input.fromDate,
    toDate: input.toDate,
    asOfDate,
    rows: enrollments
      .map((enrollment) => {
        const { givenName, familyName } = splitStudentName(
          enrollment.student.fullName,
        );
        const feeBreakdown = enrollment.tuitionFees.map((fee) => {
          const subjectFinalAmount = getSubjectFinalAmount(fee, input.classSubjectId);
          const allPaid = getSubjectPaidAmount(fee, subjectFinalAmount);
          const paidInPeriod = getSubjectPaidAmount({
            ...fee,
            payments: fee.payments.filter((payment) =>
              payment.paymentDate >= collectionStart && payment.paymentDate < collectionEndExclusive,
            ),
          }, subjectFinalAmount);
          const isSelectedBillingMonth = fee.billingYear === Number(input.month.slice(0, 4)) &&
            fee.billingMonth === Number(input.month.slice(5, 7));
          const isCollectible = fee.status !== "CANCELLED" && fee.status !== "EXEMPTED";
          return {
            isSelectedBillingMonth,
            isCollectible,
            subjectFinalAmount,
            allPaid,
            paidInPeriod,
            status: fee.status,
          };
        });
        const selectedMonthFees = feeBreakdown.filter((fee) => fee.isSelectedBillingMonth);
        const tuitionStatus = selectedMonthFees.map((fee) => fee.status).join(", ") || "NO_FEE";
        const assessed = feeBreakdown.reduce((total, fee) =>
          fee.isSelectedBillingMonth && fee.isCollectible
            ? total.add(fee.subjectFinalAmount)
            : total,
        new Prisma.Decimal(0)).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
        const cumulative = feeBreakdown.reduce((total, fee) =>
          fee.isSelectedBillingMonth && fee.isCollectible
            ? total.add(fee.allPaid)
            : total,
        new Prisma.Decimal(0)).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
        const paidInPeriod = feeBreakdown.reduce((total, fee) => total.add(fee.paidInPeriod), new Prisma.Decimal(0))
          .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
        const outstanding = Prisma.Decimal.max(assessed.sub(cumulative), 0);

        return {
          studentCode: enrollment.student.code,
          givenName,
          familyName,
          enrollmentStatus: enrollment.status,
          tuitionStatus,
          assessedAmount: assessed.toNumber(),
          paidInPeriodAmount: paidInPeriod.toNumber(),
          paidCumulativeAmount: Prisma.Decimal.min(cumulative, assessed).toNumber(),
          outstandingAmount: outstanding.toNumber(),
        };
      })
      .filter((row) => row.assessedAmount > 0 || row.paidInPeriodAmount > 0 || row.tuitionStatus.includes("EXEMPTED") || row.tuitionStatus.includes("CANCELLED")),
  };
}
