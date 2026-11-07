import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { auditFields, type AuditContext } from "@/lib/audit";
import {
  PaymentBatchStatus,
  Prisma,
  TuitionFeeBillingType,
  TuitionFeeStatus,
  TuitionPaymentStatus,
} from "@prisma/client";
import type {
  TuitionFeeStatusUpdate,
  TuitionFeeUpdate,
} from "@/modules/finance/tuition/schemas/tuition.schema";
import {
  getEffectiveTuitionFeeStatus,
  PARTIAL_FEE_STATUS,
} from "@/modules/finance/tuition/utils/tuition-status";
import { getVietnamDayStart } from "@/lib/vietnam-time";

const feeInclude = {
  student: true,
  class: true,
  enrollment: true,
  items: { orderBy: { displayOrder: "asc" as const } },
  payments: {
    where: { paymentStatus: TuitionPaymentStatus.SUCCESS },
    include: { receipt: true },
  },
  paymentAllocations: {
    where: { paymentBatch: { status: PaymentBatchStatus.PENDING } },
    select: {
      paymentBatch: { select: { id: true, batchNo: true, status: true } },
    },
  },
};

export type TuitionBillingPeriod = {
  billingYear: number;
  billingMonth: number;
};

function addPaymentBalances<
  T extends {
    finalAmount: Prisma.Decimal;
    payments: Array<{ amount: Prisma.Decimal }>;
  },
>(fee: T) {
  const paidAmount = fee.payments.reduce(
    (total, payment) => total.add(payment.amount),
    new Prisma.Decimal(0),
  );
  return {
    ...fee,
    paidAmount,
    remainingAmount: Prisma.Decimal.max(fee.finalAmount.sub(paidAmount), 0),
  };
}

async function generateTuitionFeeNo(
  tx: Prisma.TransactionClient,
  period: TuitionBillingPeriod,
) {
  const prefix = `HP-${period.billingYear}${String(period.billingMonth).padStart(2, "0")}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
    if (
      !(await tx.tuitionFee.findUnique({
        where: { feeNo: candidate },
        select: { id: true },
      }))
    )
      return candidate;
  }
  throw new ConflictError("Không thể tạo mã học phí tự động, vui lòng thử lại");
}

export class TuitionService {
  static async listFees(params: {
    studentCode?: string;
    classId?: string;
    studentClassId?: string;
    status?: TuitionFeeStatus;
    statuses?: TuitionFeeStatus[];
    search?: string;
    unissuedOnly?: boolean;
    billingType?: TuitionFeeBillingType;
    billingYear?: number;
    billingMonth?: number;
    billingPeriods?: Array<{ billingYear: number; billingMonth: number }>;
    page: number;
    pageSize: number;
  }) {
    const page = Number.isFinite(params.page)
      ? Math.max(Math.floor(params.page), 1)
      : 1;
    const pageSize = Number.isFinite(params.pageSize)
      ? Math.min(Math.max(Math.floor(params.pageSize), 1), 100)
      : 50;
    const asOf = new Date();
    const todayStart = getVietnamDayStart(asOf);
    const getStatusFilter = (
      status: TuitionFeeStatus,
    ): Prisma.TuitionFeeWhereInput =>
      status === TuitionFeeStatus.OVERDUE
        ? {
            OR: [
              { status: TuitionFeeStatus.OVERDUE },
              { status: TuitionFeeStatus.UNPAID, dueDate: { lt: todayStart } },
              { status: PARTIAL_FEE_STATUS, dueDate: { lt: todayStart } },
            ],
          }
        : status === TuitionFeeStatus.UNPAID
          ? {
              status: TuitionFeeStatus.UNPAID,
              OR: [{ dueDate: null }, { dueDate: { gte: todayStart } }],
            }
          : status === PARTIAL_FEE_STATUS
            ? {
                status: PARTIAL_FEE_STATUS,
                OR: [{ dueDate: null }, { dueDate: { gte: todayStart } }],
              }
            : { status };
    const statuses = params.statuses?.length
      ? params.statuses
      : params.status
        ? [params.status]
        : [];
    const statusFilters = statuses.map(getStatusFilter);
    const search = params.search?.trim();
    const searchFilter: Prisma.TuitionFeeWhereInput = search
      ? {
          OR: [
            { feeNo: { contains: search, mode: "insensitive" } },
            { student: { code: { contains: search, mode: "insensitive" } } },
            {
              student: { fullName: { contains: search, mode: "insensitive" } },
            },
            { class: { code: { contains: search, mode: "insensitive" } } },
            { class: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {};
    const where: Prisma.TuitionFeeWhereInput = {
      ...(statusFilters.length
        ? { AND: [{ OR: statusFilters }, searchFilter] }
        : search
          ? searchFilter
          : {}),
      ...(params.billingType ? { billingType: params.billingType } : {}),
      ...(params.unissuedOnly ? { paymentAllocations: { none: {} } } : {}),
      ...(params.studentCode || params.studentClassId
        ? {
            student: {
              ...(params.studentCode
                ? {
                    code: {
                      equals: params.studentCode,
                      mode: "insensitive" as const,
                    },
                  }
                : {}),
              ...(params.studentClassId
                ? {
                    enrollments: {
                      some: {
                        classId: params.studentClassId,
                        status: { in: ["ACTIVE", "COMPLETED", "LEFT"] },
                      },
                    },
                  }
                : {}),
            },
          }
        : {}),
      ...(params.classId ? { classId: params.classId } : {}),
      ...(params.billingYear ? { billingYear: params.billingYear } : {}),
      ...(params.billingMonth ? { billingMonth: params.billingMonth } : {}),
      ...(params.billingPeriods?.length
        ? {
            OR: params.billingPeriods.map((period) => ({
              billingYear: period.billingYear,
              billingMonth: period.billingMonth,
            })),
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.tuitionFee.findMany({
        where,
        include: feeInclude,
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.tuitionFee.count({ where }),
    ]);
    const effectiveItems = items.map((fee) => {
      const balanced = addPaymentBalances(fee);
      return {
        ...balanced,
        status: getEffectiveTuitionFeeStatus(
          balanced.status,
          balanced.dueDate,
          asOf,
        ),
      };
    });
    return {
      items: effectiveItems,
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
    };
  }

  static async getFee(id: string) {
    const fee = await prisma.tuitionFee.findUnique({
      where: { id },
      include: feeInclude,
    });
    if (!fee) throw new NotFoundError("Không tìm thấy khoản học phí");
    const auditLogs = await prisma.tuitionAuditLog.findMany({
      where: { entityType: "TUITION_FEE", entityId: id },
      orderBy: { performedAt: "desc" },
      select: {
        id: true,
        action: true,
        reason: true,
        performedAt: true,
        performedBy: true,
      },
    });
    const actorIds = [...new Set(auditLogs.map((log) => log.performedBy))];
    const actors = actorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, fullName: true },
        })
      : [];
    const actorNames = new Map(
      actors.map((actor) => [actor.id, actor.fullName]),
    );
    const balanced = addPaymentBalances(fee);
    return {
      ...balanced,
      status: getEffectiveTuitionFeeStatus(balanced.status, balanced.dueDate),
      auditLogs: auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        reason: log.reason,
        performedAt: log.performedAt,
        performedByName: actorNames.get(log.performedBy) ?? "Không xác định",
      })),
    };
  }

  static async createFromEnrollment(
    data: { classId: string; studentId: string } & TuitionBillingPeriod,
    actorId: string,
    transaction?: Prisma.TransactionClient,
    options: { allowExistingComplete?: boolean; classPeriodLockHeld?: boolean } = {},
    auditContext?: AuditContext,
  ) {
    const execute = async (tx: Prisma.TransactionClient) => {
      const periodStart = new Date(
        Date.UTC(data.billingYear, data.billingMonth - 1, 1),
      );
      const periodEnd = new Date(
        Date.UTC(data.billingYear, data.billingMonth, 0),
      );
      if (!options.classPeriodLockHeld) {
        await tx.$executeRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`class:${data.classId}`}))`,
        );
        await tx.$executeRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`${data.classId}:${data.billingYear}:${data.billingMonth}`}))`,
        );
      }
      const enrollmentRef = await tx.classStudent.findUnique({
        where: {
          classId_studentId: {
            classId: data.classId,
            studentId: data.studentId,
          },
        },
        select: { id: true },
      });
      if (!enrollmentRef) {
        throw new NotFoundError("Không tìm thấy đăng ký học viên trong lớp");
      }
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`enrollment:${enrollmentRef.id}`}))`,
      );
      const enrollment = await tx.classStudent.findUnique({
        where: { id: enrollmentRef.id },
        include: {
          class: true,
          subjects: {
            where: {
              status: "ACTIVE",
              classSubject: {
                status: "ACTIVE",
                subject: { status: "ACTIVE" },
              },
            },
            include: { classSubject: { include: { subject: true } } },
          },
        },
      });
      if (!enrollment) {
        throw new NotFoundError("Không tìm thấy đăng ký học viên trong lớp");
      }
      if (enrollment.class.status !== "ACTIVE") {
        throw new ConflictError(
          "Chỉ có thể tạo học phí khi lớp đang hoạt động",
        );
      }
      if (
        (enrollment.class.startDate &&
          enrollment.class.startDate > periodEnd) ||
        (enrollment.class.endDate && enrollment.class.endDate < periodStart)
      ) {
        throw new ConflictError("Kỳ học phí nằm ngoài thời gian của lớp học");
      }
      if (enrollment.subjects.length === 0) {
        throw new ConflictError("Học viên chưa đăng ký môn học nào");
      }

      if (enrollment.status === "SUSPENDED") {
        throw new ConflictError("Học viên đang được bảo lưu trong tháng này");
      }
      if (enrollment.status !== "ACTIVE") {
        throw new ConflictError("Học viên không còn ở trạng thái đang học");
      }
      const pause = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM enrollment_pauses
        WHERE enrollment_id = ${enrollment.id}::uuid
          AND status = 'ACTIVE'::enrollment_pause_status
          AND start_month <= ${periodEnd}::date
          AND end_month >= ${periodStart}::date
        LIMIT 1
      `;
      if (pause.length > 0) {
        throw new ConflictError(
          `Học viên đang tạm nghỉ trong tháng ${data.billingMonth}/${data.billingYear}`,
        );
      }

      // Lock the period fee row so pending-batch checks and amount updates stay consistent with createPaymentBatch.
      await tx.$queryRaw(Prisma.sql`
        SELECT id FROM tuition_fees
        WHERE student_id = ${data.studentId}::uuid
          AND class_id = ${data.classId}::uuid
          AND billing_year = ${data.billingYear}
          AND billing_month = ${data.billingMonth}
          AND billing_type = 'MONTHLY'::tuition_fee_billing_type
        FOR UPDATE
      `);
      const existingFee = await tx.tuitionFee.findFirst({
        where: {
          studentId: data.studentId,
          classId: data.classId,
          billingYear: data.billingYear,
          billingMonth: data.billingMonth,
          billingType: TuitionFeeBillingType.MONTHLY,
        },
        include: {
          items: { select: { classSubjectId: true, displayOrder: true } },
          payments: {
            where: { paymentStatus: TuitionPaymentStatus.SUCCESS },
            select: { id: true },
          },
          paymentAllocations: {
            where: { paymentBatch: { status: PaymentBatchStatus.PENDING } },
            select: { paymentBatchId: true },
          },
        },
      });
      const billedSubjectIds = new Set(
        (existingFee?.items ?? [])
          .map((item) => item.classSubjectId)
          .filter((value): value is string => Boolean(value)),
      );
      const subjectsToCalculate = enrollment.subjects.filter(
        (subject) => !billedSubjectIds.has(subject.classSubjectId),
      );
      if (subjectsToCalculate.length === 0 && existingFee) {
        if (!options.allowExistingComplete) {
          throw new ConflictError("Khoản học phí tháng đã được tạo đầy đủ");
        }
        const result = await tx.tuitionFee.findUnique({
          where: { id: existingFee.id },
          include: feeInclude,
        });
        if (!result) throw new NotFoundError("Không tìm thấy khoản học phí");
        return result;
      }

      if (
        existingFee &&
        (existingFee.payments.length > 0 ||
          existingFee.paymentAllocations.length > 0 ||
          existingFee.status === TuitionFeeStatus.PAID ||
          existingFee.status === TuitionFeeStatus.EXEMPTED ||
          existingFee.status === TuitionFeeStatus.CANCELLED)
      ) {
        throw new ConflictError(
          existingFee.payments.length > 0
            ? "Không thể bổ sung môn vào học phí tháng đã có thanh toán thành công"
            : existingFee.paymentAllocations.length > 0
              ? "Không thể bổ sung môn vào học phí tháng đang chờ thanh toán"
              : "Không thể bổ sung môn vào học phí đã được miễn hoặc hủy",
        );
      }

      const calculationItems = [];
      for (const subject of subjectsToCalculate) {
        const monthlyAmount =
          subject.tuitionFeeOverride ?? subject.classSubject.tuitionFee;
        const amount = monthlyAmount.toDecimalPlaces(0);
        if (amount.isZero()) continue;
        calculationItems.push({ subject, amount });
      }
      if (calculationItems.length === 0) {
        throw new ConflictError(
          `Không có buổi học đủ điều kiện để tạo học phí tháng ${data.billingMonth}/${data.billingYear}`,
        );
      }

      const originalAmount = calculationItems.reduce(
        (total, item) => total.add(item.amount),
        new Prisma.Decimal(0),
      );
      const classEnd = enrollment.class.endDate
        ? new Date(enrollment.class.endDate)
        : null;
      const dueDate = classEnd && classEnd < periodEnd ? classEnd : periodEnd;
      const nextDisplayOrder = existingFee
        ? Math.max(-1, ...existingFee.items.map((item) => item.displayOrder)) +
          1
        : 0;
      const fee = existingFee
        ? await tx.tuitionFee.update({
            where: { id: existingFee.id },
            data: {
              originalAmount: { increment: originalAmount },
              finalAmount: { increment: originalAmount },
              version: { increment: 1 },
              updatedBy: actorId,
            },
          })
        : await tx.tuitionFee.create({
            data: {
              feeNo: await generateTuitionFeeNo(tx, data),
              studentId: data.studentId,
              enrollmentId: enrollment.id,
              classId: data.classId,
              billingYear: data.billingYear,
              billingMonth: data.billingMonth,
              billingType: TuitionFeeBillingType.MONTHLY,
              originalAmount,
              discountAmount: 0,
              additionalAmount: 0,
              finalAmount: originalAmount,
              dueDate,
              createdBy: actorId,
              updatedBy: actorId,
            },
          });
      await tx.tuitionFeeItem.createMany({
        data: calculationItems.map((item, index) => ({
          tuitionFeeId: fee.id,
          classSubjectId: item.subject.classSubjectId,
          itemType: "TUITION" as const,
          itemName: `Học phí tháng ${String(data.billingMonth).padStart(2, "0")}/${data.billingYear} — ${item.subject.classSubject.subject.name}`,
          quantity: 1,
          unitPrice: item.amount,
          amount: item.amount,
          note: `Tính trọn học phí tháng ${String(data.billingMonth).padStart(2, "0")}/${data.billingYear}`,
          displayOrder: nextDisplayOrder + index,
        })),
      });
      await tx.tuitionAuditLog.create({
        data: {
          entityType: "ENROLLMENT",
          entityId: enrollment.id,
          action: "TUITION_FEE_CREATED",
          dataAfter: {
            classId: data.classId,
            studentId: data.studentId,
            classSubjectIds: calculationItems.map(
              (item) => item.subject.classSubjectId,
            ),
            tuitionFeeId: fee.id,
            billingYear: data.billingYear,
            billingMonth: data.billingMonth,
            calculationMode: "FULL_MONTH",
          },
          performedBy: actorId,
          ...auditFields(auditContext),
        },
      });
      await tx.tuitionAuditLog.create({
        data: {
          entityType: "TUITION_FEE",
          entityId: fee.id,
          action: existingFee
            ? "UPDATED_MONTHLY_FROM_ENROLLMENT"
            : "CREATED_MONTHLY_FROM_ENROLLMENT",
          dataAfter: {
            enrollmentId: enrollment.id,
            classId: data.classId,
            studentId: data.studentId,
            classSubjectIds: calculationItems.map(
              (item) => item.subject.classSubjectId,
            ),
            billingYear: data.billingYear,
            billingMonth: data.billingMonth,
            originalAmount: originalAmount.toString(),
            finalAmount: fee.finalAmount.toString(),
          },
          performedBy: actorId,
          ...auditFields(auditContext),
        },
      });

      const result = await tx.tuitionFee.findUnique({
        where: { id: fee.id },
        include: feeInclude,
      });
      if (!result) throw new NotFoundError("Không tìm thấy khoản học phí");
      return result;
    };
    return transaction ? execute(transaction) : prisma.$transaction(execute);
  }

  static async createClassTuitionFees(
    classId: string,
    period: TuitionBillingPeriod,
    actorId: string,
    transaction?: Prisma.TransactionClient,
    auditContext?: AuditContext,
  ) {
    const execute = async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`class:${classId}`}))`,
      );
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`${classId}:${period.billingYear}:${period.billingMonth}`}))`,
      );
      const classData = await tx.class.findUnique({
        where: { id: classId },
        select: { status: true, startDate: true, endDate: true },
      });
      if (!classData) throw new NotFoundError("Không tìm thấy lớp học");
      if (classData.status !== "ACTIVE") {
        throw new ConflictError(
          "Chỉ có thể tạo học phí khi lớp đang hoạt động",
        );
      }
      const periodStart = new Date(
        Date.UTC(period.billingYear, period.billingMonth - 1, 1),
      );
      const periodEnd = new Date(
        Date.UTC(period.billingYear, period.billingMonth, 0),
      );
      if (
        (classData.startDate && classData.startDate > periodEnd) ||
        (classData.endDate && classData.endDate < periodStart)
      ) {
        throw new ConflictError("Kỳ học phí nằm ngoài thời gian của lớp học");
      }
      const enrollments = await tx.classStudent.findMany({
        where: {
          classId,
          status: "ACTIVE",
        },
        select: {
          id: true,
          studentId: true,
          student: { select: { code: true, fullName: true } },
          subjects: {
            where: {
              status: "ACTIVE",
              classSubject: {
                status: "ACTIVE",
                subject: { status: "ACTIVE" },
              },
            },
            select: { id: true },
          },
        },
      });
      const pausedEnrollments = await tx.$queryRaw<
        Array<{ enrollmentId: string }>
      >`
        SELECT enrollment_id AS "enrollmentId" FROM enrollment_pauses
        WHERE status = 'ACTIVE'::enrollment_pause_status
          AND start_month <= ${periodEnd}::date
          AND end_month >= ${periodStart}::date
          AND enrollment_id IN (
            SELECT id FROM class_students WHERE class_id = ${classId}::uuid AND status = 'ACTIVE'::enrollment_status
          )
      `;
      const pausedEnrollmentIds = new Set(
        pausedEnrollments.map((pause) => pause.enrollmentId),
      );
      const existingFees = enrollments.length
        ? await tx.tuitionFee.findMany({
            where: {
              classId,
              studentId: { in: enrollments.map((enrollment) => enrollment.studentId) },
              billingYear: period.billingYear,
              billingMonth: period.billingMonth,
              billingType: TuitionFeeBillingType.MONTHLY,
            },
            select: {
              studentId: true,
              items: { select: { id: true } },
            },
          })
        : [];
      const existingFeeByStudent = new Map(
        existingFees.map((fee) => [fee.studentId, fee]),
      );
      let created = 0;
      let skipped = 0;
      const failed: Array<{
        studentId: string;
        studentCode: string;
        studentName: string;
        reason: string;
      }> = [];
      for (const enrollment of enrollments) {
        if (
          pausedEnrollmentIds.has(enrollment.id) ||
          enrollment.subjects.length === 0
        ) {
          skipped += 1;
          continue;
        }
        const existingFee = existingFeeByStudent.get(enrollment.studentId);
        let result;
        try {
          result = await TuitionService.createFromEnrollment(
            { classId, studentId: enrollment.studentId, ...period },
            actorId,
            tx,
            { allowExistingComplete: true, classPeriodLockHeld: true },
            auditContext,
          );
        } catch (error) {
          // Business errors are thrown before any write for this student, so the
          // rest of the class can continue. Database errors still abort everything.
          if (!(error instanceof ConflictError || error instanceof NotFoundError))
            throw error;
          failed.push({
            studentId: enrollment.studentId,
            studentCode: enrollment.student.code,
            studentName: enrollment.student.fullName,
            reason: error.message,
          });
          continue;
        }
        if (existingFee && result.items.length === existingFee.items.length) {
          skipped += 1;
        } else {
          created += 1;
        }
      }
      return { created, skipped, failed };
    };
    return transaction
      ? execute(transaction)
      : prisma.$transaction(execute, { timeout: 60_000 });
  }

  static async updateFee(
    id: string,
    data: TuitionFeeUpdate,
    actorId: string,
    auditContext?: AuditContext,
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT id FROM tuition_fees WHERE id = ${id}::uuid FOR UPDATE`,
      );
      const current = await tx.tuitionFee.findUnique({
        where: { id },
        include: {
          payments: { where: { paymentStatus: TuitionPaymentStatus.SUCCESS } },
          paymentAllocations: {
            where: { paymentBatch: { status: PaymentBatchStatus.PENDING } },
            select: { paymentBatch: { select: { batchNo: true } } },
          },
        },
      });
      if (!current) throw new NotFoundError("Không tìm thấy khoản học phí");
      if (current.version !== data.version)
        throw new ConflictError(
          "Khoản học phí đã thay đổi, vui lòng tải lại",
          "VERSION_CONFLICT",
        );
      if (
        current.status !== TuitionFeeStatus.UNPAID &&
        current.status !== TuitionFeeStatus.OVERDUE
      ) {
        throw new ConflictError(
          "Chỉ có thể sửa khoản học phí chưa thu hoặc quá hạn",
        );
      }
      if (current.payments.length)
        throw new ConflictError("Không thể sửa khoản học phí đã thanh toán");
      if (current.paymentAllocations.length)
        throw new ConflictError(
          `Không thể sửa khoản học phí đang chờ thanh toán trong đợt ${current.paymentAllocations[0]?.paymentBatch.batchNo}`,
        );
      const discountAmount = new Prisma.Decimal(
        data.discountAmount ?? current.discountAmount,
      );
      const additionalAmount = new Prisma.Decimal(
        data.additionalAmount ?? current.additionalAmount,
      );
      if (discountAmount.greaterThan(current.originalAmount))
        throw new ConflictError("Số tiền giảm không được vượt học phí gốc");
      const finalAmount = current.originalAmount
        .sub(discountAmount)
        .add(additionalAmount);
      if (!additionalAmount.greaterThanOrEqualTo(0))
        throw new ConflictError("Số tiền phụ thu không hợp lệ");
      if (!finalAmount.greaterThan(0))
        throw new ConflictError("Số tiền cuối không hợp lệ");
      const updated = await tx.tuitionFee.update({
        where: { id },
        data: {
          discountAmount,
          additionalAmount,
          finalAmount,
          dueDate:
            data.dueDate === undefined
              ? undefined
              : data.dueDate
                ? new Date(`${data.dueDate}T00:00:00.000Z`)
                : null,
          note: data.note,
          version: { increment: 1 },
          updatedBy: actorId,
        },
        include: feeInclude,
      });
      await tx.tuitionAuditLog.create({
        data: {
          entityType: "TUITION_FEE",
          entityId: id,
          action: "UPDATE",
          reason: data.reason,
          dataBefore: current as unknown as Prisma.InputJsonValue,
          dataAfter: updated as unknown as Prisma.InputJsonValue,
          performedBy: actorId,
          ...auditFields(auditContext),
        },
      });
      const balanced = addPaymentBalances(updated);
      return {
        ...balanced,
        status: getEffectiveTuitionFeeStatus(balanced.status, balanced.dueDate),
      };
    });
  }

  static async updateStatus(
    id: string,
    data: TuitionFeeStatusUpdate,
    actorId: string,
    auditContext?: AuditContext,
  ) {
    return prisma.$transaction(async (tx) => {
      const feeReference = await tx.tuitionFee.findUnique({
        where: { id },
        select: { classId: true },
      });
      if (!feeReference)
        throw new NotFoundError("Không tìm thấy khoản học phí");
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`class:${feeReference.classId}`}))`,
      );
      await tx.$executeRaw(
        Prisma.sql`SELECT id FROM tuition_fees WHERE id = ${id}::uuid FOR UPDATE`,
      );
      const current = await tx.tuitionFee.findUnique({
        where: { id },
        include: {
          payments: { where: { paymentStatus: TuitionPaymentStatus.SUCCESS } },
          paymentAllocations: {
            where: { paymentBatch: { status: PaymentBatchStatus.PENDING } },
            select: { paymentBatch: { select: { batchNo: true } } },
          },
        },
      });
      if (!current) throw new NotFoundError("Không tìm thấy khoản học phí");
      if (current.version !== data.version)
        throw new ConflictError(
          "Khoản học phí đã thay đổi, vui lòng tải lại",
          "VERSION_CONFLICT",
        );
      if (current.payments.length)
        throw new ConflictError(
          "Không thể miễn hoặc hủy khoản học phí đã thanh toán",
        );
      if (current.paymentAllocations.length)
        throw new ConflictError(
          `Không thể miễn hoặc hủy khoản học phí đang chờ thanh toán trong đợt ${current.paymentAllocations[0]?.paymentBatch.batchNo}`,
        );
      if (
        current.status !== TuitionFeeStatus.UNPAID &&
        current.status !== TuitionFeeStatus.OVERDUE
      ) {
        throw new ConflictError(
          "Khoản học phí không còn ở trạng thái có thể miễn hoặc hủy",
        );
      }

      const updated = await tx.tuitionFee.update({
        where: { id },
        data: {
          status: data.status,
          exemptionReason:
            data.status === TuitionFeeStatus.EXEMPTED ? data.reason : null,
          cancellationReason:
            data.status === TuitionFeeStatus.CANCELLED ? data.reason : null,
          version: { increment: 1 },
          updatedBy: actorId,
        },
        include: feeInclude,
      });
      await tx.tuitionAuditLog.create({
        data: {
          entityType: "TUITION_FEE",
          entityId: id,
          action:
            data.status === TuitionFeeStatus.EXEMPTED ? "EXEMPT" : "CANCEL",
          reason: data.reason,
          dataBefore: current as unknown as Prisma.InputJsonValue,
          dataAfter: updated as unknown as Prisma.InputJsonValue,
          performedBy: actorId,
          ...auditFields(auditContext),
        },
      });
      const balanced = addPaymentBalances(updated);
      return {
        ...balanced,
        status: getEffectiveTuitionFeeStatus(balanced.status, balanced.dueDate),
      };
    });
  }

  static async restoreFee(
    id: string,
    data: { reason: string; version: number },
    actorId: string,
    auditContext?: AuditContext,
  ) {
    return prisma.$transaction(async (tx) => {
      const feeReference = await tx.tuitionFee.findUnique({
        where: { id },
        select: { classId: true },
      });
      if (!feeReference)
        throw new NotFoundError("Không tìm thấy khoản học phí");
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`class:${feeReference.classId}`}))`,
      );
      await tx.$executeRaw(
        Prisma.sql`SELECT id FROM tuition_fees WHERE id = ${id}::uuid FOR UPDATE`,
      );
      const current = await tx.tuitionFee.findUnique({
        where: { id },
        include: {
          class: { select: { status: true } },
          payments: { where: { paymentStatus: TuitionPaymentStatus.SUCCESS } },
          paymentAllocations: {
            where: { paymentBatch: { status: PaymentBatchStatus.PENDING } },
            select: { paymentBatch: { select: { batchNo: true } } },
          },
        },
      });
      if (!current) throw new NotFoundError("Không tìm thấy khoản học phí");
      if (current.version !== data.version)
        throw new ConflictError(
          "Khoản học phí đã thay đổi, vui lòng tải lại",
          "VERSION_CONFLICT",
        );
      if (
        current.status !== TuitionFeeStatus.CANCELLED &&
        current.status !== TuitionFeeStatus.EXEMPTED
      )
        throw new ConflictError(
          "Chỉ có thể khôi phục khoản học phí đã hủy hoặc đã miễn",
        );
      if (
        current.class.status === "COMPLETED" ||
        current.class.status === "CANCELLED"
      )
        throw new ConflictError(
          "Không thể khôi phục học phí của lớp đã kết thúc hoặc đã hủy",
        );
      if (current.payments.length)
        throw new ConflictError(
          "Không thể khôi phục khoản học phí đã có thanh toán thành công",
        );
      if (current.paymentAllocations.length)
        throw new ConflictError(
          `Không thể khôi phục khoản học phí đang chờ thanh toán trong đợt ${current.paymentAllocations[0]?.paymentBatch.batchNo}`,
        );

      const updated = await tx.tuitionFee.update({
        where: { id },
        data: {
          status: TuitionFeeStatus.UNPAID,
          cancellationReason: null,
          exemptionReason: null,
          version: { increment: 1 },
          updatedBy: actorId,
        },
        include: feeInclude,
      });
      await tx.tuitionAuditLog.create({
        data: {
          entityType: "TUITION_FEE",
          entityId: id,
          action:
            current.status === TuitionFeeStatus.EXEMPTED
              ? "TUITION_FEE_EXEMPTION_REVERSED"
              : "TUITION_FEE_RESTORED",
          reason: data.reason,
          dataBefore: current as unknown as Prisma.InputJsonValue,
          dataAfter: updated as unknown as Prisma.InputJsonValue,
          performedBy: actorId,
          ...auditFields(auditContext),
        },
      });
      const balanced = addPaymentBalances(updated);
      return {
        ...balanced,
        status: getEffectiveTuitionFeeStatus(balanced.status, balanced.dueDate),
      };
    });
  }
}
