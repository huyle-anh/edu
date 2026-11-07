import { Prisma, TuitionPaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError } from "@/lib/errors";
import { getVietnamDayEndExclusive, parseVietnamDateStart } from "@/lib/vietnam-time";

export type DailyPaymentReportInput = { date: string };

export type DailyPaymentReportRow = {
  teacherName: string;
  className: string;
  tuitionFee: number;
  count: number;
  total: number;
  note: string;
  studentNames: string;
  billingPeriods: string;
};

export type DailyPaymentReportDetail = {
  paymentNo: string;
  paymentDate: Date;
  studentName: string;
  studentCode: string;
  className: string;
  feeNo: string;
  paymentMethod: string;
  amount: number;
  bankName: string | null;
  bankAccountNo: string | null;
  bankTransactionNo: string | null;
  transactionReference: string | null;
  paymentContent: string | null;
};

export type DailyPaymentReport = {
  date: string;
  rows: DailyPaymentReportRow[];
  details: DailyPaymentReportDetail[];
  paymentCount: number;
  totalCollected: number;
  cashCollected: number;
  bankTransferCollected: number;
};

function getDayRange(date: string) {
  const start = parseVietnamDateStart(date);
  const end = getVietnamDayEndExclusive(date);
  if (!start || !end) throw new ConflictError("Ngày báo cáo không hợp lệ");
  return { start, end };
}

function formatMethod(method: string) {
  return method === "CASH" ? "Tiền mặt" : method === "BANK_TRANSFER" ? "Chuyển khoản" : method;
}

type DailyPaymentReportAccumulator = Omit<DailyPaymentReportRow, "total" | "studentNames"> & {
  total: Prisma.Decimal;
  studentNames: Set<string>;
};

function addRow(
  groups: Map<string, DailyPaymentReportAccumulator>,
  paymentAmount: Prisma.Decimal,
  fee: {
    originalAmount: Prisma.Decimal;
    discountAmount: Prisma.Decimal;
    additionalAmount: Prisma.Decimal;
    finalAmount: Prisma.Decimal;
  },
  item: {
    amount: Prisma.Decimal;
    itemName: string;
    itemType: string;
    unitPrice: Prisma.Decimal;
    classSubject: {
      id: string;
      subject: { name: string };
      teacher: { fullName: string } | null;
      class: { code: string; name: string };
    } | null;
  },
  feeClassName: string,
  paymentMethod: string,
  studentName: string,
  billingPeriod: string,
): Prisma.Decimal {
  const classSubject = item.classSubject;

  const grossAmount = item.amount;
  const ratio = fee.originalAmount.greaterThan(0)
    ? Prisma.Decimal.min(Prisma.Decimal.max(grossAmount.div(fee.originalAmount), 0), 1)
    : new Prisma.Decimal(1);
  const itemFinalAmount = Prisma.Decimal.max(
    grossAmount
      .minus(fee.discountAmount.mul(ratio))
      .plus(fee.additionalAmount.mul(ratio)),
    0,
  );
  const paidAmount = fee.finalAmount.greaterThan(0)
    ? paymentAmount.mul(itemFinalAmount).div(fee.finalAmount)
        .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
    : new Prisma.Decimal(0);
  const teacherName = classSubject
    ? classSubject.teacher?.fullName || "Chưa phân công"
    : "Chưa phân bổ";
  const className = classSubject?.class.name || feeClassName;
  const note = classSubject
    ? `${classSubject.subject.name} · ${formatMethod(paymentMethod)}`
    : `${item.itemName} · ${formatMethod(paymentMethod)}`;
  const key = classSubject
    ? `${classSubject.id}:${Number(item.unitPrice)}`
    : `UNALLOCATED:${item.itemType}:${item.itemName}:${Number(item.unitPrice)}`;
  const current = groups.get(key);
  if (current) {
    current.count += 1;
    current.total = current.total.plus(paidAmount);
    current.studentNames.add(studentName);
    if (!current.billingPeriods.split(", ").includes(billingPeriod)) {
      current.billingPeriods = [...current.billingPeriods.split(", "), billingPeriod].sort().join(", ");
    }
    return paidAmount;
  }
  groups.set(key, {
    teacherName,
    className,
    tuitionFee: item.unitPrice.toNumber(),
    count: 1,
    total: paidAmount,
    note,
    studentNames: new Set([studentName]),
    billingPeriods: billingPeriod,
  });
  return paidAmount;
}

export async function getDailyPaymentReport(
  input: DailyPaymentReportInput,
): Promise<DailyPaymentReport> {
  const { start, end } = getDayRange(input.date);
  const payments = await prisma.tuitionPayment.findMany({
    where: {
      paymentStatus: TuitionPaymentStatus.SUCCESS,
      paymentDate: { gte: start, lt: end },
    },
    orderBy: [{ paymentDate: "asc" }, { paymentNo: "asc" }],
    select: {
      paymentNo: true,
      paymentDate: true,
      paymentMethod: true,
      amount: true,
      bankAccountId: true,
      bankTransactionNo: true,
      transactionReference: true,
      paymentContent: true,
      paymentBatch: {
        select: {
          bankAccount: {
            select: {
              bankName: true,
              accountNo: true,
            },
          },
        },
      },
      tuitionFee: {
        select: {
          feeNo: true,
          billingYear: true,
          billingMonth: true,
          originalAmount: true,
          discountAmount: true,
          additionalAmount: true,
          finalAmount: true,
          student: { select: { code: true, fullName: true } },
          class: { select: { code: true, name: true } },
          items: {
            select: {
              amount: true,
              itemName: true,
              itemType: true,
              unitPrice: true,
              classSubject: {
                select: {
                  id: true,
                  subject: { select: { name: true } },
                  teacher: { select: { fullName: true } },
                  class: { select: { code: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const bankAccountIds = [
    ...new Set(
      payments
        .map((payment) => payment.bankAccountId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const bankAccounts = bankAccountIds.length
    ? await prisma.bankAccount.findMany({
        where: { id: { in: bankAccountIds } },
        select: { id: true, bankName: true, accountNo: true },
      })
    : [];
  const bankAccountById = new Map(
    bankAccounts.map((account) => [account.id, account]),
  );

  const groups = new Map<string, DailyPaymentReportAccumulator>();
  const details: DailyPaymentReportDetail[] = payments.map((payment) => {
    let allocatedAmount = new Prisma.Decimal(0);
    for (const item of payment.tuitionFee.items) {
      allocatedAmount = allocatedAmount.plus(addRow(
        groups,
        payment.amount,
        payment.tuitionFee,
        item,
        payment.tuitionFee.class.name,
        payment.paymentMethod,
        payment.tuitionFee.student.fullName,
        `THÁNG ${payment.tuitionFee.billingMonth}/${payment.tuitionFee.billingYear}`,
      ));
    }
    const unallocatedAmount = payment.amount.minus(allocatedAmount);
    if (payment.tuitionFee.items.length === 0 || !unallocatedAmount.isZero()) {
      const key = `UNALLOCATED:RESIDUAL:${payment.tuitionFee.class.name}`;
      const current = groups.get(key);
      if (current) {
        current.count += 1;
        current.total = current.total.plus(unallocatedAmount);
      } else {
        groups.set(key, {
          teacherName: "Chưa phân bổ",
          className: payment.tuitionFee.class.name,
          tuitionFee: 0,
          count: 1,
          total: unallocatedAmount,
          note: `Phần chưa gắn item · ${formatMethod(payment.paymentMethod)}`,
          studentNames: new Set([payment.tuitionFee.student.fullName]),
          billingPeriods: `THÁNG ${payment.tuitionFee.billingMonth}/${payment.tuitionFee.billingYear}`,
        });
      }
    }
    return {
      paymentNo: payment.paymentNo,
      paymentDate: payment.paymentDate,
      studentName: payment.tuitionFee.student.fullName,
      studentCode: payment.tuitionFee.student.code,
      className: payment.tuitionFee.class.name,
      feeNo: payment.tuitionFee.feeNo,
      paymentMethod: formatMethod(payment.paymentMethod),
      amount: payment.amount.toNumber(),
      bankName:
        bankAccountById.get(payment.bankAccountId ?? "")?.bankName ??
        payment.paymentBatch?.bankAccount?.bankName ??
        null,
      bankAccountNo:
        bankAccountById.get(payment.bankAccountId ?? "")?.accountNo ??
        payment.paymentBatch?.bankAccount?.accountNo ??
        null,
      bankTransactionNo: payment.bankTransactionNo,
      transactionReference: payment.transactionReference,
      paymentContent: payment.paymentContent,
    };
  });
  const totalCollected = payments.reduce((total, payment) => total.plus(payment.amount), new Prisma.Decimal(0));
  const cashCollected = payments
    .filter((payment) => payment.paymentMethod === "CASH")
    .reduce((total, payment) => total.plus(payment.amount), new Prisma.Decimal(0));
  const bankTransferCollected = payments
    .filter((payment) => payment.paymentMethod === "BANK_TRANSFER")
    .reduce((total, payment) => total.plus(payment.amount), new Prisma.Decimal(0));

  return {
    date: input.date,
    rows: [...groups.values()]
      .map((row) => ({ ...row, studentNames: [...row.studentNames].join(", "), total: row.total.toNumber() }))
      .sort((a, b) => a.teacherName.localeCompare(b.teacherName, "vi")),
    details,
    paymentCount: payments.length,
    totalCollected: totalCollected.toNumber(),
    cashCollected: cashCollected.toNumber(),
    bankTransferCollected: bankTransferCollected.toNumber(),
  };
}
