import {
  Prisma,
  TuitionFeeStatus,
  TuitionPaymentStatus,
  PaymentBatchStatus,
} from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { auditFields, type AuditContext } from "@/lib/audit";
import type {
  ClassNoticeBatchCreate,
  NoticeBatchCreate,
  PaymentBatchCreate,
  PendingBatchRestructure,
} from "../schemas/payment-batch.schema";
import { parseVietnamDateStart } from "@/lib/vietnam-time";
import { vietnameseAmountInWords } from "@/lib/vietnamese-amount";
import {
  buildVietQrDataUrl,
  unsupportedVietQrBankMessage,
} from "@/modules/finance/tuition/services/vietqr.service";
import { buildTransferContent } from "../utils/transfer-content";
import {
  getEffectiveTuitionFeeStatus,
  PARTIAL_FEE_STATUS,
  getStoredTuitionFeeStatus,
} from "@/modules/finance/tuition/utils/tuition-status";
import {
  parseDocumentSnapshot,
  savePaymentBatchNoticeSnapshot,
  toFeeSnapshot,
  type DocumentSnapshot,
} from "./payment-document-snapshot";

function parsePaymentDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parseVietnamDateStart(value);
  if (!parsed) throw new ConflictError("Ngày nhận không hợp lệ");
  return parsed;
}

async function lockTuitionFeeRows(
  tx: Prisma.TransactionClient,
  feeIds: string[],
) {
  if (!feeIds.length) return;
  await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM tuition_fees
    WHERE id IN (${Prisma.join(feeIds.map((id) => Prisma.sql`${id}::uuid`))})
    ORDER BY id
    FOR UPDATE
  `);
}

async function lockPaymentBatchRows(
  tx: Prisma.TransactionClient,
  batchIds: string[],
) {
  if (!batchIds.length) return;
  await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM payment_batches
    WHERE id IN (${Prisma.join(batchIds.map((id) => Prisma.sql`${id}::uuid`))})
    ORDER BY id
    FOR UPDATE
  `);
}

async function lockTeacherRows(
  tx: Prisma.TransactionClient,
  teacherIds: string[],
) {
  if (!teacherIds.length) return;
  await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM teachers
    WHERE id IN (${Prisma.join(teacherIds.map((id) => Prisma.sql`${id}::uuid`))})
    ORDER BY id
    FOR UPDATE
  `);
}

async function lockStudentRows(
  tx: Prisma.TransactionClient,
  studentIds: string[],
) {
  const sortedIds = [...new Set(studentIds)].sort();
  if (!sortedIds.length) return;
  await tx.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtext(student_id))
    FROM (VALUES ${Prisma.join(sortedIds.map((id) => Prisma.sql`(${id})`))}) AS students(student_id)
    ORDER BY student_id
  `);
}

function sumSuccessfulPayments(payments: Array<{ amount: Prisma.Decimal }>) {
  return payments.reduce(
    (total, payment) => total.add(payment.amount),
    new Prisma.Decimal(0),
  );
}

async function generateBatchNo(tx: Prisma.TransactionClient) {
  const prefix = `PB-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
  for (let index = 0; index < 5; index += 1) {
    const candidate = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
    if (
      !(await tx.paymentBatch.findUnique({
        where: { batchNo: candidate },
        select: { id: true },
      }))
    )
      return candidate;
  }
  throw new ConflictError("Không thể tạo mã thanh toán tổng, vui lòng thử lại");
}

function sameNullableText(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  return (left?.trim() || null) === (right?.trim() || null);
}

async function findIdempotentBatch(
  tx: Prisma.TransactionClient,
  data: PaymentBatchCreate,
) {
  if (!data.idempotencyKey) return null;

  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`payment-idempotency:${data.idempotencyKey}`}))`,
  );
  const existingRows = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT id FROM payment_batches WHERE idempotency_key = ${data.idempotencyKey} LIMIT 1 FOR UPDATE`,
  );
  const existingId = existingRows[0]?.id;
  const existing = existingId
    ? await tx.paymentBatch.findUnique({
        where: { id: existingId },
        include: {
          allocations: {
            include: {
              tuitionFee: {
                include: {
                  payments: {
                    where: { paymentStatus: TuitionPaymentStatus.SUCCESS },
                    select: { amount: true, paymentBatchId: true },
                  },
                },
              },
            },
          },
          student: true,
          receipt: true,
        },
      })
    : null;
  if (!existing) return null;

  const requestedFeeIds = new Set(data.tuitionFeeIds);
  const existingFeeIds = new Set(
    existing.allocations.map((allocation) => allocation.tuitionFeeId),
  );
  const sameFees =
    requestedFeeIds.size === data.tuitionFeeIds.length &&
    requestedFeeIds.size === existingFeeIds.size &&
    [...requestedFeeIds].every((feeId) => existingFeeIds.has(feeId));
  const sameAmounts =
    sameFees &&
    existing.allocations.every((allocation) => {
      const requested = data.amounts?.[allocation.tuitionFeeId];
      const paidAmount = sumSuccessfulPayments(allocation.tuitionFee.payments);
      const existingBatchAmount = sumSuccessfulPayments(
        allocation.tuitionFee.payments.filter(
          (payment) => payment.paymentBatchId === existing.id,
        ),
      );
      const remainingAmount = allocation.tuitionFee.finalAmount
        .sub(paidAmount)
        .add(existingBatchAmount);
      const expectedAmount =
        requested === undefined
          ? remainingAmount
          : new Prisma.Decimal(requested);
      return expectedAmount.equals(allocation.amount);
    });
  const requestedCashDate =
    data.paymentMethod === "CASH"
      ? parsePaymentDate(data.paymentDate)
      : undefined;
  const samePaymentDate =
    data.paymentMethod !== "CASH" ||
    (requestedCashDate !== undefined &&
      existing.paymentDate.getTime() === requestedCashDate.getTime());
  const reconciliationMetadataChanged =
    existing.status === PaymentBatchStatus.SUCCESS &&
    existing.paymentMethod === "BANK_TRANSFER";
  const sameRequest =
    existing.paymentMethod === data.paymentMethod &&
    (data.paymentMethod === "CASH"
      ? existing.bankAccountId === null
      : existing.bankAccountId === data.bankAccountId) &&
    (reconciliationMetadataChanged ||
      (sameNullableText(
        existing.transactionReference,
        data.transactionReference,
      ) &&
        sameNullableText(existing.paymentContent, data.note))) &&
    sameNullableText(existing.payerName, data.payerName) &&
    sameFees &&
    sameAmounts &&
    samePaymentDate;
  if (!sameRequest) {
    throw new ConflictError(
      "Idempotency-Key đã được dùng cho request thanh toán khác",
      "IDEMPOTENCY_CONFLICT",
    );
  }
  return existing;
}

export async function completePaymentBatch(
  tx: Prisma.TransactionClient,
  batchId: string,
  actorId: string,
  data?: {
    paymentDate?: Date;
    bankAccountId?: string;
    bankTransactionNo?: string;
    transactionReference?: string;
    paymentContent?: string;
  },
  auditContext?: AuditContext,
) {
  // Serialize completion of the same batch before creating payments/receipts.
  await tx.$executeRaw(
    Prisma.sql`SELECT id FROM payment_batches WHERE id = ${batchId}::uuid FOR UPDATE`,
  );
  const batch = await tx.paymentBatch.findUnique({
    where: { id: batchId },
    include: {
      allocations: {
        include: {
          tuitionFee: {
            include: {
              class: true,
              items: {
                include: { classSubject: { include: { subject: true } } },
              },
            },
          },
        },
      },
      student: true,
    },
  });
  if (!batch) throw new NotFoundError("Không tìm thấy đợt thanh toán");

  if (batch.status === PaymentBatchStatus.SUCCESS) return batch;
  if (batch.status !== PaymentBatchStatus.PENDING)
    throw new ConflictError("Đợt thanh toán không còn chờ xử lý");

  if (!batch.allocations.length)
    throw new ConflictError("Đợt thanh toán không có khoản học phí");

  const allocationTotal = batch.allocations.reduce(
    (total, allocation) => total.add(allocation.amount),
    new Prisma.Decimal(0),
  );
  if (!allocationTotal.equals(batch.totalAmount))
    throw new ConflictError(
      "Tổng phân bổ không khớp tổng thanh toán",
      "AMOUNT_MISMATCH",
    );

  const teacherIds = [
    ...new Set(
      batch.allocations.flatMap((allocation) =>
        allocation.tuitionFee.items
          .map((item) => item.classSubject?.teacherId)
          .filter((teacherId): teacherId is string => Boolean(teacherId)),
      ),
    ),
  ].sort();
  await lockTeacherRows(tx, teacherIds);
  const feeIds = batch.allocations.map((allocation) => allocation.tuitionFeeId);
  await lockTuitionFeeRows(tx, feeIds);
  const lockedFees = await tx.tuitionFee.findMany({
    where: { id: { in: feeIds } },
    include: {
      payments: {
        where: { paymentStatus: TuitionPaymentStatus.SUCCESS },
        select: { id: true, amount: true },
      },
    },
  });
  if (lockedFees.length !== feeIds.length) {
    throw new NotFoundError("Không tìm thấy đầy đủ các khoản học phí");
  }
  const lockedFeeById = new Map(lockedFees.map((fee) => [fee.id, fee]));
  const paidAmounts = new Map<string, Prisma.Decimal>();
  for (const allocation of batch.allocations) {
    const fee = lockedFeeById.get(allocation.tuitionFeeId);
    if (!fee) throw new NotFoundError("Không tìm thấy khoản học phí");
    const paidAmount = sumSuccessfulPayments(fee.payments);
    paidAmounts.set(fee.id, paidAmount);
    const remainingAmount = fee.finalAmount.sub(paidAmount);
    if (!remainingAmount.greaterThan(0))
      throw new ConflictError(
        "Học phí đã được thanh toán đủ",
        "TUITION_ALREADY_PAID",
      );
    if (
      fee.status !== TuitionFeeStatus.UNPAID &&
      fee.status !== PARTIAL_FEE_STATUS &&
      fee.status !== TuitionFeeStatus.OVERDUE
    )
      throw new ConflictError(
        `Học phí ${fee.feeNo} không còn đủ điều kiện thanh toán`,
        fee.status === TuitionFeeStatus.CANCELLED
          ? "TUITION_CANCELLED"
          : fee.status === TuitionFeeStatus.EXEMPTED
            ? "TUITION_EXEMPTED"
            : undefined,
      );
    if (!allocation.amount.greaterThan(0))
      throw new ConflictError(
        "Số tiền thanh toán phải lớn hơn 0",
        "PAYMENT_AMOUNT_MISMATCH",
      );
    if (allocation.amount.greaterThan(remainingAmount))
      throw new ConflictError(
        `Số tiền phân bổ của ${fee.feeNo} vượt số tiền còn nợ`,
        "PAYMENT_AMOUNT_MISMATCH",
      );
  }
  const paymentReceiptIssuedAt = new Date();
  const paymentDate = data?.paymentDate || batch.paymentDate;
  const bankAccountId = data?.bankAccountId ?? batch.bankAccountId;
  const bankTransactionNo =
    data?.bankTransactionNo?.trim() || batch.bankTransactionNo?.trim() || null;
  const transactionReference =
    data?.transactionReference?.trim() ||
    batch.transactionReference?.trim() ||
    null;
  if (batch.paymentMethod === "BANK_TRANSFER" && !bankAccountId) {
    throw new ConflictError(
      "Thanh toán chuyển khoản phải có tài khoản nhận tiền",
    );
  }
  if (
    batch.paymentMethod === "BANK_TRANSFER" &&
    !bankTransactionNo &&
    !transactionReference
  ) {
    throw new ConflictError(
      "Thanh toán chuyển khoản phải có mã giao dịch hoặc mã tham chiếu",
    );
  }
  if (
    batch.paymentMethod === "BANK_TRANSFER" &&
    data?.bankAccountId &&
    batch.bankAccountId &&
    data.bankAccountId !== batch.bankAccountId
  ) {
    throw new ConflictError(
      "Tài khoản ngân hàng không khớp với đợt thanh toán",
    );
  }
  if (
    batch.paymentMethod === "CASH" &&
    (bankAccountId ||
      batch.bankTransactionNo ||
      batch.transactionReference ||
      data?.bankAccountId ||
      data?.bankTransactionNo)
  ) {
    throw new ConflictError(
      "Thanh toán tiền mặt không được chứa thông tin giao dịch ngân hàng",
    );
  }
  const feeStatusUpdates: Array<{ id: string; status: TuitionFeeStatus }> = [];
  const auditEntries: Prisma.TuitionAuditLogCreateManyInput[] = [];
  for (const [index, allocation] of batch.allocations.entries()) {
    const sequence = String(index + 1).padStart(3, "0");
    const batchToken = batch.batchNo.slice(-20);
    const receiptNo = `REC-${batchToken}-${sequence}`;
    const receiverName = batch.payerName?.trim() || batch.student.fullName;
    const receiptSnapshot = {
      version: 1 as const,
      receiptNo,
      issuedAt: paymentReceiptIssuedAt.toISOString(),
      student: { code: batch.student.code, fullName: batch.student.fullName },
      receiverName,
      tuitionFee: toFeeSnapshot(allocation.tuitionFee, allocation.amount),
      amount: allocation.amount.toString(),
      paymentMethod: batch.paymentMethod,
    };
    const payment = await tx.tuitionPayment.create({
      data: {
        paymentNo: `PAY-${batchToken}-${sequence}`,
        tuitionFeeId: allocation.tuitionFeeId,
        studentId: batch.studentId,
        paymentBatchId: batch.id,
        paymentDate,
        amount: allocation.amount,
        paymentMethod: batch.paymentMethod,
        paymentStatus: TuitionPaymentStatus.SUCCESS,
        bankAccountId,
        bankTransactionNo:
          batch.paymentMethod === "CASH" ? undefined : bankTransactionNo,
        transactionReference:
          batch.paymentMethod === "CASH" ? undefined : transactionReference,
        payerName: batch.payerName,
        paymentContent: data?.paymentContent || batch.paymentContent,
        receivedBy: actorId,
        confirmedBy: actorId,
        confirmedAt: new Date(),
        createdBy: actorId,
        updatedBy: actorId,
        receipt: {
          create: {
            receiptNo,
            issuedBy: actorId,
            receiverName,
            amount: allocation.amount,
            amountInWords: vietnameseAmountInWords(allocation.amount.toString()),
            snapshot: receiptSnapshot as unknown as Prisma.InputJsonValue,
          },
        },
      },
      include: { receipt: true },
    });
    const receipt = payment.receipt;
    if (!receipt) {
      throw new ConflictError("Không thể tạo biên lai cho khoản thanh toán");
    }
    auditEntries.push(
      {
        entityType: "TUITION_RECEIPT",
        entityId: receipt.id,
        action: "CREATED",
        dataAfter: {
          receiptNo: receipt.receiptNo,
          paymentId: payment.id,
          paymentBatchId: batch.id,
          amount: receipt.amount.toString(),
        },
        performedBy: actorId,
        ...auditFields(auditContext),
      },
      {
        entityType: "TUITION_PAYMENT",
        entityId: payment.id,
        action: "SUCCESS",
        dataAfter: {
          paymentId: payment.id,
          tuitionFeeId: allocation.tuitionFeeId,
          amount: allocation.amount.toString(),
          receiptId: receipt.id,
          paymentBatchId: batch.id,
        },
        performedBy: actorId,
        ...auditFields(auditContext),
      },
    );
    const paidAmount = (
      paidAmounts.get(allocation.tuitionFeeId) ?? new Prisma.Decimal(0)
    ).add(allocation.amount);
    const lockedFee = lockedFeeById.get(allocation.tuitionFeeId)!;
    const nextStatus = getStoredTuitionFeeStatus(
      lockedFee.finalAmount,
      paidAmount,
    );
    feeStatusUpdates.push({ id: allocation.tuitionFeeId, status: nextStatus });
    auditEntries.push({
      entityType: "TUITION_FEE",
      entityId: allocation.tuitionFeeId,
      action: nextStatus === TuitionFeeStatus.PAID ? "PAID" : "PARTIAL",
      dataAfter: {
        paymentId: payment.id,
        paymentBatchId: batch.id,
        status: nextStatus,
      },
      performedBy: actorId,
      ...auditFields(auditContext),
    });
  }
  await tx.$executeRaw(Prisma.sql`
    UPDATE tuition_fees AS fee
    SET status = payload.status::tuition_fee_status,
        version = fee.version + 1,
        updated_by = ${actorId}::uuid,
        updated_at = CURRENT_TIMESTAMP
    FROM (VALUES ${Prisma.join(feeStatusUpdates.map(({ id, status }) =>
      Prisma.sql`(${id}::uuid, ${status}::text)`,
    ))}) AS payload(id, status)
    WHERE fee.id = payload.id
  `);
  const batchReceiptSnapshot = {
    version: 1 as const,
    receiptNo: `BRC-${batch.batchNo}`.slice(0, 40),
    issuedAt: paymentReceiptIssuedAt.toISOString(),
    student: { code: batch.student.code, fullName: batch.student.fullName },
    receiverName: batch.payerName?.trim() || batch.student.fullName,
    fees: batch.allocations.map((allocation) =>
      toFeeSnapshot(allocation.tuitionFee, allocation.amount),
    ),
    amount: batch.totalAmount.toString(),
    paymentMethod: batch.paymentMethod,
  };
  const batchReceipt = await tx.paymentBatchReceipt.create({
    data: {
      receiptNo: batchReceiptSnapshot.receiptNo,
      paymentBatchId: batch.id,
      issuedBy: actorId,
      receiverName: batch.payerName?.trim() || batch.student.fullName,
      amount: batch.totalAmount,
      snapshot: batchReceiptSnapshot as unknown as Prisma.InputJsonValue,
    },
  });
  auditEntries.push({
    entityType: "PAYMENT_BATCH_RECEIPT",
    entityId: batchReceipt.id,
    action: "CREATED",
    dataAfter: {
      receiptNo: batchReceipt.receiptNo,
      paymentBatchId: batch.id,
      amount: batchReceipt.amount.toString(),
    },
    performedBy: actorId,
    ...auditFields(auditContext),
  });
  const completed = await tx.paymentBatch.update({
    where: { id: batch.id },
    data: {
      status: PaymentBatchStatus.SUCCESS,
      paymentDate,
      bankAccountId,
      bankTransactionNo:
        batch.paymentMethod === "CASH" ? null : bankTransactionNo,
      transactionReference:
        batch.paymentMethod === "CASH" ? null : transactionReference,
      paymentContent: data?.paymentContent || batch.paymentContent,
      confirmedBy: actorId,
      confirmedAt: new Date(),
      updatedBy: actorId,
    },
    include: { allocations: true, receipt: true },
  });
  auditEntries.push({
    entityType: "PAYMENT_BATCH",
    entityId: batch.id,
    action: "SUCCESS",
    dataBefore: { status: batch.status },
    dataAfter: {
      status: completed.status,
      paymentDate: completed.paymentDate.toISOString(),
      totalAmount: completed.totalAmount.toString(),
      allocationCount: completed.allocations.length,
    },
    performedBy: actorId,
    ...auditFields(auditContext),
  });
  await tx.tuitionAuditLog.createMany({ data: auditEntries });
  return completed;
}

export async function createPaymentBatch(
  data: PaymentBatchCreate,
  actorId: string,
  transaction?: Prisma.TransactionClient,
  auditContext?: AuditContext,
) {
  const execute = async (tx: Prisma.TransactionClient) => {
    const existingIdempotentBatch = await findIdempotentBatch(tx, data);
    if (existingIdempotentBatch) return existingIdempotentBatch;
    if (data.paymentMethod === "CASH" && !data.paymentDate) {
      throw new ConflictError("Ngày nhận tiền mặt là bắt buộc");
    }
    if (data.paymentMethod === "BANK_TRANSFER" && data.paymentDate) {
      throw new ConflictError(
        "Ngày chuyển khoản được lấy từ sao kê khi đối soát",
      );
    }
    const requestedPaymentDate = parsePaymentDate(data.paymentDate);
    const feeRefs = await tx.tuitionFee.findMany({
      where: { id: { in: data.tuitionFeeIds } },
      select: { id: true, studentId: true },
    });
    if (feeRefs.length !== data.tuitionFeeIds.length)
      throw new NotFoundError("Không tìm thấy đầy đủ các khoản học phí");
    const studentId = feeRefs[0]?.studentId;
    if (!studentId || feeRefs.some((fee) => fee.studentId !== studentId))
      throw new ConflictError("Chỉ được gom học phí của cùng một học viên");
    if (data.paymentMethod === "CASH" && data.bankAccountId)
      throw new ConflictError(
        "Thanh toán tiền mặt không được gắn tài khoản ngân hàng",
      );
    if (data.paymentMethod === "CASH" && data.transactionReference)
      throw new ConflictError(
        "Thanh toán tiền mặt không được có mã giao dịch ngân hàng",
      );
    if (data.paymentMethod === "BANK_TRANSFER" && !data.bankAccountId)
      throw new ConflictError(
        "Thanh toán chuyển khoản phải có tài khoản nhận tiền",
      );
    let bankAccountSnapshot: DocumentSnapshot["bankAccount"];
    if (data.bankAccountId) {
      await tx.$executeRaw(
        Prisma.sql`SELECT id FROM bank_accounts WHERE id = ${data.bankAccountId}::uuid FOR UPDATE`,
      );
      const bankAccount = await tx.bankAccount.findUnique({
        where: { id: data.bankAccountId },
        select: {
          id: true,
          isActive: true,
          bankCode: true,
          bankName: true,
          accountNo: true,
          accountName: true,
        },
      });
      if (!bankAccount || !bankAccount.isActive)
        throw new ConflictError("Tài khoản ngân hàng không hoạt động");
      bankAccountSnapshot = {
        bankCode: bankAccount.bankCode,
        bankName: bankAccount.bankName,
        accountNo: bankAccount.accountNo,
        accountName: bankAccount.accountName,
      };
    }
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${studentId}))`,
    );

    // Serialize fee edits and payment completion before reading amounts/statuses.
    await lockTuitionFeeRows(tx, data.tuitionFeeIds);

    const fees = await tx.tuitionFee.findMany({
      where: { id: { in: data.tuitionFeeIds } },
      include: {
        student: true,
        class: true,
        items: { include: { classSubject: { include: { subject: true } } } },
      },
    });
    if (fees.length !== data.tuitionFeeIds.length)
      throw new NotFoundError("Không tìm thấy đầy đủ các khoản học phí");
    if (fees.some((fee) => fee.studentId !== studentId))
      throw new ConflictError("Chỉ được gom học phí của cùng một học viên");
    if (
      fees.some(
        (fee) =>
          fee.status !== TuitionFeeStatus.UNPAID &&
          fee.status !== PARTIAL_FEE_STATUS &&
          fee.status !== TuitionFeeStatus.OVERDUE,
      )
    )
      throw new ConflictError(
        "Danh sách có học phí không còn đủ điều kiện thanh toán",
        fees.some((fee) => fee.status === TuitionFeeStatus.CANCELLED)
          ? "TUITION_CANCELLED"
          : fees.some((fee) => fee.status === TuitionFeeStatus.EXEMPTED)
            ? "TUITION_EXEMPTED"
            : undefined,
      );
    if (fees.some((fee) => !fee.finalAmount.greaterThan(0)))
      throw new ConflictError("Học phí phải có số tiền lớn hơn 0");
    const paid = await tx.tuitionPayment.findMany({
      where: {
        tuitionFeeId: { in: data.tuitionFeeIds },
        paymentStatus: TuitionPaymentStatus.SUCCESS,
      },
      select: { tuitionFeeId: true, amount: true },
    });
    const paidByFee = new Map<string, Prisma.Decimal>();
    for (const payment of paid) {
      paidByFee.set(
        payment.tuitionFeeId,
        (paidByFee.get(payment.tuitionFeeId) ?? new Prisma.Decimal(0)).add(
          payment.amount,
        ),
      );
    }
    const requestedAmounts = new Map<string, Prisma.Decimal>();
    for (const fee of fees) {
      const paidAmount = paidByFee.get(fee.id) ?? new Prisma.Decimal(0);
      const remainingAmount = fee.finalAmount.sub(paidAmount);
      if (!remainingAmount.greaterThan(0))
        throw new ConflictError(
          `Học phí ${fee.feeNo} đã được thanh toán đủ`,
          "TUITION_ALREADY_PAID",
        );
      const rawAmount = data.amounts?.[fee.id];
      const amount =
        rawAmount === undefined
          ? remainingAmount
          : new Prisma.Decimal(rawAmount);
      if (!amount.greaterThan(0) || amount.greaterThan(remainingAmount))
        throw new ConflictError(
          `Số tiền thanh toán của ${fee.feeNo} vượt số tiền còn nợ`,
          "PAYMENT_AMOUNT_MISMATCH",
        );
      requestedAmounts.set(fee.id, amount);
    }
    const totalAmount = [...requestedAmounts.values()].reduce(
      (sum, amount) => sum.add(amount),
      new Prisma.Decimal(0),
    );
    const selectedFeeIds = new Set(data.tuitionFeeIds);
    const pendingBatches = await tx.paymentBatch.findMany({
      where: { studentId, status: PaymentBatchStatus.PENDING },
      include: { allocations: true, receipt: true },
    });
    const duplicate = pendingBatches.find(
      (candidate) =>
        candidate.allocations.length === selectedFeeIds.size &&
        candidate.allocations.every((allocation) =>
          selectedFeeIds.has(allocation.tuitionFeeId),
        ),
    );
    if (duplicate) {
      const samePaymentMethod = duplicate.paymentMethod === data.paymentMethod;
      const sameBankAccount =
        data.paymentMethod === "BANK_TRANSFER"
          ? duplicate.bankAccountId === data.bankAccountId
          : duplicate.bankAccountId === null;
      const sameAmounts = duplicate.allocations.every((allocation) => {
        const expectedAmount = requestedAmounts.get(allocation.tuitionFeeId);
        if (!expectedAmount) return false;
        return allocation.amount.equals(expectedAmount);
      });
      if (!samePaymentMethod || !sameBankAccount || !sameAmounts) {
        throw new ConflictError(
          `Các khoản học phí đã thuộc đợt ${duplicate.batchNo} với thông tin thanh toán khác`,
        );
      }
      return duplicate;
    }
    if (
      pendingBatches.some((candidate) =>
        candidate.allocations.some((allocation) =>
          selectedFeeIds.has(allocation.tuitionFeeId),
        ),
      )
    )
      throw new ConflictError(
        "Một hoặc nhiều học phí đang thuộc đợt thanh toán chờ đối soát",
      );
    const batch = await tx.paymentBatch.create({
      data: {
        batchNo: await generateBatchNo(tx),
        studentId,
        totalAmount,
        paymentMethod: data.paymentMethod,
        status: PaymentBatchStatus.PENDING,
        paymentDate: requestedPaymentDate,
        bankAccountId:
          data.paymentMethod === "BANK_TRANSFER"
            ? data.bankAccountId
            : undefined,
        transactionReference: data.transactionReference,
        payerName: data.payerName,
        paymentContent: data.note,
        createdBy: actorId,
        updatedBy: actorId,
        allocations: {
          create: fees.map((fee) => ({
            tuitionFeeId: fee.id,
            amount: requestedAmounts.get(fee.id)!,
          })),
        },
      },
      include: {
        allocations: { include: { tuitionFee: true } },
        student: true,
      },
    });
    if (data.idempotencyKey) {
      await tx.$executeRaw(
        Prisma.sql`UPDATE payment_batches SET idempotency_key = ${data.idempotencyKey} WHERE id = ${batch.id}::uuid`,
      );
    }
    if (data.paymentMethod === "BANK_TRANSFER") {
      await savePaymentBatchNoticeSnapshot(tx, batch.id, {
        version: 1,
        student: {
          code: fees[0]!.student.code,
          fullName: fees[0]!.student.fullName,
        },
        fees: fees.map((fee) =>
          toFeeSnapshot(fee, requestedAmounts.get(fee.id)),
        ),
        ...(bankAccountSnapshot ? { bankAccount: bankAccountSnapshot } : {}),
      });
    }
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "PAYMENT_BATCH",
        entityId: batch.id,
        action: "CREATED",
        dataAfter: {
          status: batch.status,
          paymentMethod: batch.paymentMethod,
          totalAmount: batch.totalAmount.toString(),
          tuitionFeeIds: data.tuitionFeeIds,
        },
        performedBy: actorId,
        ...auditFields(auditContext),
      },
    });
    if (data.paymentMethod === "CASH")
      return completePaymentBatch(
        tx,
        batch.id,
        actorId,
        {
          paymentDate: requestedPaymentDate,
        },
        auditContext,
      );
    return batch;
  };
  return transaction ? execute(transaction) : prisma.$transaction(execute);
}

export async function createNoticeBatches(
  data: NoticeBatchCreate,
  actorId: string,
  auditContext?: AuditContext,
) {
  return prisma.$transaction(
    async (tx) => {
      const feeRefs = await tx.tuitionFee.findMany({
        where: { id: { in: data.tuitionFeeIds } },
        select: { id: true, studentId: true },
        orderBy: [{ studentId: "asc" }, { id: "asc" }],
      });
      if (feeRefs.length !== data.tuitionFeeIds.length) {
        throw new NotFoundError("Không tìm thấy đầy đủ các khoản học phí");
      }

      const studentIds = new Set(feeRefs.map((fee) => fee.studentId));
      if (data.mode === "GROUPED" && studentIds.size !== 1) {
        throw new ConflictError("Chỉ được gộp học phí của cùng một học sinh");
      }

      const groups =
        data.mode === "GROUPED"
          ? [feeRefs]
          : data.mode === "BY_STUDENT"
            ? [
                ...feeRefs
                  .reduce((byStudent, fee) => {
                    const group = byStudent.get(fee.studentId) ?? [];
                    group.push(fee);
                    byStudent.set(fee.studentId, group);
                    return byStudent;
                  }, new Map<string, typeof feeRefs>())
                  .values(),
              ]
            : feeRefs.map((fee) => [fee]);
      const batches = [];
      for (const [index, group] of groups.entries()) {
        const batch = await createPaymentBatch(
          {
            tuitionFeeIds: group.map((fee) => fee.id),
            paymentMethod: "BANK_TRANSFER",
            bankAccountId: data.bankAccountId,
            idempotencyKey: `${data.idempotencyKey}-${index + 1}`.slice(0, 150),
          },
          actorId,
          tx,
          auditContext,
        );
        batches.push(batch);
      }

      return {
        batches: batches.map((batch) => ({
          id: batch.id,
          batchNo: batch.batchNo,
          totalAmount: batch.totalAmount,
        })),
      };
    },
    { timeout: 30_000 },
  );
}

async function createClassNoticeBatchesForPeriod(
  tx: Prisma.TransactionClient,
  data: ClassNoticeBatchCreate & { studentIds: string[] },
  actorId: string,
  auditContext?: AuditContext,
) {
  if (!data.month) {
    throw new ConflictError("Kỳ học phí là bắt buộc cho từng đợt phát hành");
  }
  const year = Number(data.month.slice(0, 4));
  const month = Number(data.month.slice(5, 7));
  const requestHash = createHash("sha256")
    .update(JSON.stringify({
      classId: data.classId,
      month: data.month,
      bankAccountId: data.bankAccountId,
    }))
    .digest("hex");

      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`class-notice-idempotency:${data.idempotencyKey}`}))`,
      );
      const previousRequests = await tx.$queryRaw<
        Array<{ requestHash: string; response: Prisma.JsonValue }>
      >(Prisma.sql`
        SELECT request_hash AS "requestHash", response
        FROM class_notice_requests
        WHERE idempotency_key = ${data.idempotencyKey}
        FOR UPDATE
      `);
      const previousRequest = previousRequests[0];
      if (previousRequest) {
        if (previousRequest.requestHash !== requestHash) {
          throw new ConflictError(
            "Idempotency-Key đã được dùng cho request phát hành khác",
            "IDEMPOTENCY_CONFLICT",
          );
        }
        return previousRequest.response as {
          batches: Array<{ id: string; batchNo: string; totalAmount: number }>;
          replacedBatchCount: number;
          updatedBatchCount: number;
        };
      }

      const targetFees = await tx.tuitionFee.findMany({
        where: {
          studentId: { in: data.studentIds },
          billingType: "MONTHLY",
          billingYear: year,
          billingMonth: month,
          status: {
            in: [
              TuitionFeeStatus.UNPAID,
              PARTIAL_FEE_STATUS,
              TuitionFeeStatus.OVERDUE,
            ],
          },
        },
        select: { id: true, studentId: true },
        orderBy: { id: "asc" },
      });
      if (!targetFees.length) {
        throw new ConflictError(
          "Lớp và kỳ đã chọn không có khoản học phí còn nợ",
        );
      }
      const targetFeeIds = targetFees.map((fee) => fee.id);
      const targetFeeIdSet = new Set(targetFeeIds);
      const initialPendingBatches = await tx.paymentBatch.findMany({
        where: {
          status: PaymentBatchStatus.PENDING,
          studentId: { in: [...new Set(targetFees.map((fee) => fee.studentId))] },
        },
        select: { id: true, studentId: true },
      });
      await tx.$executeRaw(
        Prisma.sql`SELECT id FROM bank_accounts WHERE id = ${data.bankAccountId}::uuid FOR UPDATE`,
      );
      const bankAccount = await tx.bankAccount.findUnique({
        where: { id: data.bankAccountId },
        select: {
          isActive: true,
          bankCode: true,
          bankName: true,
          accountNo: true,
          accountName: true,
        },
      });
      if (!bankAccount || !bankAccount.isActive) {
        throw new ConflictError("Tài khoản ngân hàng không hoạt động");
      }
      const bankAccountSnapshot = {
        bankCode: bankAccount.bankCode,
        bankName: bankAccount.bankName,
        accountNo: bankAccount.accountNo,
        accountName: bankAccount.accountName,
      };
      await lockStudentRows(tx, [
        ...targetFees.map((fee) => fee.studentId),
        ...initialPendingBatches.map((batch) => batch.studentId),
      ]);
      const pendingBatchCandidates = await tx.paymentBatch.findMany({
        where: {
          status: PaymentBatchStatus.PENDING,
          studentId: { in: [...new Set(targetFees.map((fee) => fee.studentId))] },
        },
        select: { id: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      await lockPaymentBatchRows(
        tx,
        pendingBatchCandidates.map((batch) => batch.id),
      );
      let pendingBatches = await tx.paymentBatch.findMany({
        where: {
          status: PaymentBatchStatus.PENDING,
          studentId: { in: [...new Set(targetFees.map((fee) => fee.studentId))] },
        },
        include: {
          allocations: true,
          student: true,
          statementRowLinks: { select: { isConfirmed: true } },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      const pendingBatchIds = new Set(
        pendingBatchCandidates.map((batch) => batch.id),
      );
      const newlyObservedBatchIds = pendingBatches
        .map((batch) => batch.id)
        .filter((batchId) => !pendingBatchIds.has(batchId));
      if (newlyObservedBatchIds.length) {
        await lockPaymentBatchRows(tx, newlyObservedBatchIds);
        pendingBatches = await tx.paymentBatch.findMany({
          where: {
            status: PaymentBatchStatus.PENDING,
            studentId: { in: [...new Set(targetFees.map((fee) => fee.studentId))] },
          },
          include: {
            allocations: true,
            student: true,
            statementRowLinks: { select: { isConfirmed: true } },
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        });
      }
      const affectedFeeIds = [
        ...new Set([
          ...targetFeeIds,
          ...pendingBatches.flatMap((batch) =>
            batch.allocations.map((allocation) => allocation.tuitionFeeId),
          ),
        ]),
      ].sort();
      await lockTuitionFeeRows(tx, affectedFeeIds);

      const currentTargetAllocations = await tx.paymentAllocation.findMany({
        where: {
          tuitionFeeId: { in: targetFeeIds },
          paymentBatch: { status: PaymentBatchStatus.PENDING },
        },
        select: { tuitionFeeId: true, paymentBatchId: true },
      });
      const knownTargetAllocations = pendingBatches.flatMap((batch) =>
        batch.allocations
          .filter((allocation) => targetFeeIdSet.has(allocation.tuitionFeeId))
          .map((allocation) => ({
            tuitionFeeId: allocation.tuitionFeeId,
            paymentBatchId: batch.id,
          })),
      );
      const knownAllocationKeys = new Set(
        knownTargetAllocations.map(
          (allocation) => `${allocation.tuitionFeeId}:${allocation.paymentBatchId}`,
        ),
      );
      if (
        currentTargetAllocations.length !== knownTargetAllocations.length ||
        currentTargetAllocations.some(
          (allocation) =>
            !knownAllocationKeys.has(
              `${allocation.tuitionFeeId}:${allocation.paymentBatchId}`,
            ),
        )
      ) {
        throw new ConflictError(
          "Các khoản học phí vừa được đưa vào đợt thu khác; hãy tải lại danh sách và thử lại",
        );
      }

      const eligibleFees = await tx.tuitionFee.findMany({
        where: { id: { in: affectedFeeIds } },
        include: {
          student: true,
          class: true,
          items: { include: { classSubject: { include: { subject: true } } } },
          payments: {
            where: { paymentStatus: TuitionPaymentStatus.SUCCESS },
            select: { amount: true },
          },
        },
      });
      const feeById = new Map(eligibleFees.map((fee) => [fee.id, fee]));
      const chargeableStatuses = new Set<TuitionFeeStatus>([
        TuitionFeeStatus.UNPAID,
        PARTIAL_FEE_STATUS,
        TuitionFeeStatus.OVERDUE,
      ]);
      const outstanding = affectedFeeIds.flatMap((id) => {
        const fee = feeById.get(id);
        if (!fee || !chargeableStatuses.has(fee.status)) return [];
        const remaining = fee.finalAmount.sub(
          sumSuccessfulPayments(fee.payments),
        );
        return remaining.greaterThan(0) ? [fee] : [];
      });
      const outstandingTargetFees = outstanding.filter((fee) =>
        targetFeeIdSet.has(fee.id),
      );
      if (!outstandingTargetFees.length) {
        throw new ConflictError(
          "Các khoản học phí đã được thanh toán hoặc không còn đủ điều kiện phát hành",
        );
      }

      const pendingBatchByFee = new Map<
        string,
        {
          batch: (typeof pendingBatches)[number];
          allocation: (typeof pendingBatches)[number]["allocations"][number];
        }
      >();
      for (const batch of pendingBatches) {
        for (const allocation of batch.allocations) {
          if (!targetFeeIdSet.has(allocation.tuitionFeeId)) continue;
          const containsOtherScope = batch.allocations.some((item) => {
            const allocatedFee = feeById.get(item.tuitionFeeId);
            return allocatedFee &&
              (allocatedFee.billingYear !== year ||
                allocatedFee.billingMonth !== month ||
                allocatedFee.billingType !== "MONTHLY");
          });
          if (containsOtherScope) {
            throw new ConflictError(
              `Khoản học phí lớp và kỳ đã chọn đang nằm trong đợt ${batch.batchNo} cùng khoản ngoài phạm vi; hãy xử lý đợt đó trước khi phát hành riêng`,
            );
          }
          const existingAllocation = pendingBatchByFee.get(
            allocation.tuitionFeeId,
          );
          if (existingAllocation && existingAllocation.batch.id !== batch.id) {
            throw new ConflictError(
              "Một khoản học phí đang nằm trong nhiều đợt chờ; hãy kiểm tra đợt thu trước",
            );
          }
          if (batch.paymentMethod !== "BANK_TRANSFER") {
            throw new ConflictError(
              `Khoản học phí đang thuộc đợt ${batch.batchNo}; hãy xử lý đợt đó trước`,
            );
          }
          pendingBatchByFee.set(allocation.tuitionFeeId, { batch, allocation });
        }
      }

      type TargetFeeUpdate = {
        fee: (typeof outstandingTargetFees)[number];
        amount: Prisma.Decimal;
        allocationId?: string;
      };
      const newTargetFeesByStudent = new Map<string, TargetFeeUpdate[]>();
      const resultBatches = new Map<
        string,
        { id: string; batchNo: string; totalAmount: Prisma.Decimal }
      >();
      for (const fee of outstandingTargetFees) {
        const remaining = fee.finalAmount.sub(sumSuccessfulPayments(fee.payments));
        const existingAllocation = pendingBatchByFee.get(fee.id);
        if (existingAllocation) {
          const { batch, allocation } = existingAllocation;
          if (allocation.amount.greaterThan(remaining)) {
            throw new ConflictError(
              `Phân bổ của ${fee.feeNo} vượt số tiền còn nợ; hãy xử lý đợt ${batch.batchNo} trước`,
            );
          }
          resultBatches.set(batch.id, {
            id: batch.id,
            batchNo: batch.batchNo,
            totalAmount: batch.totalAmount,
          });
          if (allocation.amount.lessThan(remaining)) {
            if (batch.statementRowLinks.length) {
              throw new ConflictError(
                `Đợt ${batch.batchNo} đang được ghép với sao kê; hãy hoàn tất đối soát trước khi bổ sung phần còn nợ`,
              );
            }
            const group = newTargetFeesByStudent.get(fee.studentId) ?? [];
            group.push({
              fee,
              amount: remaining.sub(allocation.amount),
              allocationId: allocation.id,
            });
            newTargetFeesByStudent.set(fee.studentId, group);
          }
        } else {
          const group = newTargetFeesByStudent.get(fee.studentId) ?? [];
          group.push({ fee, amount: remaining });
          newTargetFeesByStudent.set(fee.studentId, group);
        }
      }

      let updatedBatchCount = 0;
      const updatedBatchIds = new Set<string>();
      const batchUpdates = new Map<
        string,
        {
          batch: (typeof pendingBatches)[number];
          feeUpdates: TargetFeeUpdate[];
        }
      >();
      for (const [studentId, feeUpdates] of newTargetFeesByStudent) {
        const allocationUpdates = feeUpdates.filter(
          (feeUpdate) => feeUpdate.allocationId,
        );
        for (const feeUpdate of allocationUpdates) {
          const existing = pendingBatchByFee.get(feeUpdate.fee.id);
          if (!existing) {
            throw new ConflictError("Không tìm thấy phân bổ đang chờ cần cập nhật");
          }
          const plan = batchUpdates.get(existing.batch.id) ?? {
            batch: existing.batch,
            feeUpdates: [],
          };
          plan.feeUpdates.push(feeUpdate);
          batchUpdates.set(existing.batch.id, plan);
        }

        const feesToAdd = feeUpdates.filter(
          (feeUpdate) => !feeUpdate.allocationId,
        );
        if (!feesToAdd.length) continue;
        const studentBatches = pendingBatches.filter(
          (batch) => batch.studentId === studentId &&
            batch.paymentMethod === "BANK_TRANSFER" &&
            batch.statementRowLinks.length === 0 &&
            batch.allocations.every((allocation) => {
              const allocatedFee = feeById.get(allocation.tuitionFeeId);
              return allocatedFee &&
                allocatedFee.billingYear === year &&
                allocatedFee.billingMonth === month &&
                allocatedFee.billingType === "MONTHLY";
            }),
        );
        const anchorBatch = studentBatches.find((batch) =>
          batch.allocations.some((allocation) =>
            targetFeeIdSet.has(allocation.tuitionFeeId),
          ),
        ) ?? studentBatches[0];

        if (!anchorBatch) {
          const batch = await createPaymentBatch(
            {
              tuitionFeeIds: feesToAdd.map((feeUpdate) => feeUpdate.fee.id),
              paymentMethod: "BANK_TRANSFER",
              bankAccountId: data.bankAccountId,
            },
            actorId,
            tx,
            auditContext,
          );
          resultBatches.set(batch.id, {
            id: batch.id,
            batchNo: batch.batchNo,
            totalAmount: batch.totalAmount,
          });
          continue;
        }
        const plan = batchUpdates.get(anchorBatch.id) ?? {
          batch: anchorBatch,
          feeUpdates: [],
        };
        plan.feeUpdates.push(...feesToAdd);
        batchUpdates.set(anchorBatch.id, plan);
      }

      for (const { batch, feeUpdates } of batchUpdates.values()) {
        const currentAllocationTotal = batch.allocations.reduce(
          (sum, allocation) => sum.add(allocation.amount),
          new Prisma.Decimal(0),
        );
        if (!currentAllocationTotal.equals(batch.totalAmount)) {
          throw new ConflictError(
            `Tổng phân bổ của đợt ${batch.batchNo} không khớp tổng tiền; hãy kiểm tra đợt thu trước`,
          );
        }
        const amountByFeeId = new Map(
          batch.allocations.map((allocation) => [
            allocation.tuitionFeeId,
            allocation.amount,
          ]),
        );
        const updateAmountByAllocationId = new Map<string, Prisma.Decimal>();
        for (const feeUpdate of feeUpdates) {
          const currentAmount = amountByFeeId.get(feeUpdate.fee.id) ??
            new Prisma.Decimal(0);
          amountByFeeId.set(
            feeUpdate.fee.id,
            currentAmount.add(feeUpdate.amount),
          );
          if (feeUpdate.allocationId) {
            updateAmountByAllocationId.set(
              feeUpdate.allocationId,
              currentAmount.add(feeUpdate.amount),
            );
          }
        }
        const increase = feeUpdates.reduce(
          (sum, feeUpdate) => sum.add(feeUpdate.amount),
          new Prisma.Decimal(0),
        );
        const nextTotal = batch.totalAmount.add(increase);
        const batchFeeIds = [...amountByFeeId.keys()];
        const snapshot: DocumentSnapshot = {
          version: 1,
          student: {
            code: batch.student.code,
            fullName: batch.student.fullName,
          },
          fees: batchFeeIds.map((feeId) => {
            const fee = feeById.get(feeId);
            if (!fee) {
              throw new ConflictError(
                "Không tải được đầy đủ khoản phí của đợt đang chờ",
              );
            }
            const amount = amountByFeeId.get(feeId);
            if (!amount) {
              throw new ConflictError("Không xác định được số tiền còn phải thu");
            }
            return toFeeSnapshot(fee, amount);
          }),
          bankAccount: bankAccountSnapshot,
        };

        const updated = await tx.paymentBatch.updateMany({
          where: {
            id: batch.id,
            status: PaymentBatchStatus.PENDING,
            paymentMethod: "BANK_TRANSFER",
          },
          data: {
            totalAmount: nextTotal,
            bankAccountId: data.bankAccountId,
            updatedBy: actorId,
          },
        });
        if (updated.count !== 1) {
          throw new ConflictError(
            "Đợt thu vừa được xử lý; hãy tải lại danh sách và thử lại",
          );
        }
        for (const [allocationId, amount] of updateAmountByAllocationId) {
          await tx.paymentAllocation.update({
            where: { id: allocationId },
            data: { amount },
          });
        }
        const newFeeUpdates = feeUpdates.filter(
          (feeUpdate) => !feeUpdate.allocationId,
        );
        if (newFeeUpdates.length) {
          await tx.paymentAllocation.createMany({
            data: newFeeUpdates.map((feeUpdate) => ({
              paymentBatchId: batch.id,
              tuitionFeeId: feeUpdate.fee.id,
              amount: feeUpdate.amount,
            })),
          });
        }
        await savePaymentBatchNoticeSnapshot(tx, batch.id, snapshot);
        await tx.tuitionAuditLog.create({
          data: {
            entityType: "PAYMENT_BATCH",
            entityId: batch.id,
            action: "UPDATE",
            reason: `Bổ sung hoặc cập nhật khoản học phí khi phát hành theo lớp kỳ ${data.month}`,
            dataBefore: {
              status: PaymentBatchStatus.PENDING,
              totalAmount: batch.totalAmount.toString(),
              bankAccountId: batch.bankAccountId,
              allocationCount: batch.allocations.length,
            },
            dataAfter: {
              status: PaymentBatchStatus.PENDING,
              totalAmount: nextTotal.toString(),
              bankAccountId: data.bankAccountId,
              addedTuitionFeeIds: newFeeUpdates.map((feeUpdate) => feeUpdate.fee.id),
              increasedTuitionFeeIds: feeUpdates
                .filter((feeUpdate) => feeUpdate.allocationId)
                .map((feeUpdate) => feeUpdate.fee.id),
              allocationCount: batchFeeIds.length,
            },
            performedBy: actorId,
            ...auditFields(auditContext),
          },
        });
        updatedBatchCount += 1;
        updatedBatchIds.add(batch.id);
        resultBatches.set(batch.id, {
          id: batch.id,
          batchNo: batch.batchNo,
          totalAmount: nextTotal,
        });
      }

      for (const batch of pendingBatches) {
        if (
          updatedBatchIds.has(batch.id) ||
          !resultBatches.has(batch.id) ||
          batch.paymentMethod !== "BANK_TRANSFER" ||
          batch.bankAccountId === data.bankAccountId
        ) {
          continue;
        }
        if (batch.statementRowLinks.length) {
          throw new ConflictError(
            `Đợt ${batch.batchNo} đang được ghép với sao kê; hãy dùng đúng tài khoản nhận tiền hoặc hoàn tất đối soát trước khi cập nhật`,
          );
        }
        const snapshot: DocumentSnapshot = {
          version: 1,
          student: {
            code: batch.student.code,
            fullName: batch.student.fullName,
          },
          fees: batch.allocations.map((allocation) => {
            const fee = feeById.get(allocation.tuitionFeeId);
            if (!fee) {
              throw new ConflictError(
                "Không tải được đầy đủ khoản phí của đợt đang chờ",
              );
            }
            return toFeeSnapshot(fee, allocation.amount);
          }),
          bankAccount: bankAccountSnapshot,
        };
        const updated = await tx.paymentBatch.updateMany({
          where: {
            id: batch.id,
            status: PaymentBatchStatus.PENDING,
            paymentMethod: "BANK_TRANSFER",
          },
          data: { bankAccountId: data.bankAccountId, updatedBy: actorId },
        });
        if (updated.count !== 1) {
          throw new ConflictError(
            "Đợt thu vừa được xử lý; hãy tải lại danh sách và thử lại",
          );
        }
        await savePaymentBatchNoticeSnapshot(tx, batch.id, snapshot);
        await tx.tuitionAuditLog.create({
          data: {
            entityType: "PAYMENT_BATCH",
            entityId: batch.id,
            action: "UPDATE",
            reason: `Cập nhật tài khoản nhận tiền khi phát hành theo lớp kỳ ${data.month}`,
            dataBefore: {
              status: PaymentBatchStatus.PENDING,
              bankAccountId: batch.bankAccountId,
              totalAmount: batch.totalAmount.toString(),
            },
            dataAfter: {
              status: PaymentBatchStatus.PENDING,
              bankAccountId: data.bankAccountId,
              totalAmount: batch.totalAmount.toString(),
            },
            performedBy: actorId,
            ...auditFields(auditContext),
          },
        });
        updatedBatchCount += 1;
      }

      const result = {
        batches: [...resultBatches.values()],
        replacedBatchCount: 0,
        updatedBatchCount,
      };
      const storedResponse = {
        batches: result.batches.map((batch) => ({
          ...batch,
          totalAmount: Number(batch.totalAmount.toFixed(2)),
        })),
        replacedBatchCount: result.replacedBatchCount,
        updatedBatchCount: result.updatedBatchCount,
      };
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO class_notice_requests (
          idempotency_key, request_hash, class_id, month, bank_account_id, response
        ) VALUES (
          ${data.idempotencyKey}, ${requestHash}, ${data.classId}::uuid,
          ${data.month}, ${data.bankAccountId}::uuid,
          ${JSON.stringify(storedResponse)}::jsonb
        )
      `);
      return result;
}

export async function createClassNoticeBatches(
  data: ClassNoticeBatchCreate,
  actorId: string,
  auditContext?: AuditContext,
) {
  return prisma.$transaction(
    async (tx) => {
      const classStudents = await tx.classStudent.findMany({
        where: {
          classId: data.classId,
          status: { in: ["ACTIVE", "COMPLETED", "LEFT"] },
        },
        select: { studentId: true },
      });
      const studentIds = [...new Set(classStudents.map(({ studentId }) => studentId))];
      if (!studentIds.length) {
        throw new ConflictError("Lớp không có học sinh để phát hành thông báo");
      }
      const requestedMonths = data.months?.length
        ? [...new Set(data.months)].sort()
        : undefined;
      const feePeriods = await tx.tuitionFee.findMany({
        where: {
          studentId: { in: studentIds },
          billingType: "MONTHLY",
          status: {
            in: [
              TuitionFeeStatus.UNPAID,
              PARTIAL_FEE_STATUS,
              TuitionFeeStatus.OVERDUE,
            ],
          },
          ...(data.month
            ? {
                billingYear: Number(data.month.slice(0, 4)),
                billingMonth: Number(data.month.slice(5, 7)),
              }
            : requestedMonths
              ? {
                  OR: requestedMonths.map((period) => ({
                    billingYear: Number(period.slice(0, 4)),
                    billingMonth: Number(period.slice(5, 7)),
                  })),
                }
              : {}),
        },
        select: { billingYear: true, billingMonth: true },
        distinct: ["billingYear", "billingMonth"],
        orderBy: [{ billingYear: "asc" }, { billingMonth: "asc" }],
      });
      const periods = data.month
        ? [data.month]
        : requestedMonths
          ? feePeriods.map(({ billingYear, billingMonth }) =>
              `${billingYear}-${String(billingMonth).padStart(2, "0")}`,
            )
          : feePeriods.map(({ billingYear, billingMonth }) =>
              `${billingYear}-${String(billingMonth).padStart(2, "0")}`,
            );
      if (!periods.length) {
        throw new ConflictError("Lớp không có khoản học phí tháng còn nợ");
      }

      const batches = new Map<
        string,
        { id: string; batchNo: string; totalAmount: number }
      >();
      let replacedBatchCount = 0;
      let updatedBatchCount = 0;
      const idempotencyPrefix = `class-all-${createHash("sha256")
        .update(data.idempotencyKey)
        .digest("hex")}`;

      for (const period of periods) {
        const result = await createClassNoticeBatchesForPeriod(
          tx,
          {
            ...data,
            studentIds,
            month: period,
            idempotencyKey: data.month
              ? data.idempotencyKey
              : `${idempotencyPrefix}-${period}`,
          },
          actorId,
          auditContext,
        );
        for (const batch of result.batches) {
          batches.set(batch.id, {
            ...batch,
            totalAmount: Number(batch.totalAmount),
          });
        }
        replacedBatchCount += result.replacedBatchCount;
        updatedBatchCount += result.updatedBatchCount;
      }

      return {
        batches: [...batches.values()],
        replacedBatchCount,
        updatedBatchCount,
      };
    },
    { timeout: 120_000 },
  );
}

async function cancelPendingBatchInTransaction(
  tx: Prisma.TransactionClient,
  batchId: string,
  actorId: string,
  reason: string,
  auditContext?: AuditContext,
) {
  await tx.$executeRaw(
    Prisma.sql`SELECT id FROM payment_batches WHERE id = ${batchId}::uuid FOR UPDATE`,
  );
  const batch = await tx.paymentBatch.findUnique({
    where: { id: batchId },
    include: { allocations: true },
  });
  if (!batch) throw new NotFoundError("Không tìm thấy đợt thanh toán");
  if (batch.status !== PaymentBatchStatus.PENDING) {
    throw new ConflictError(
      "Chỉ có thể thay đổi đợt thanh toán đang chờ đối soát",
    );
  }

  const cancelled = await tx.paymentBatch.update({
    where: { id: batchId },
    data: { status: PaymentBatchStatus.CANCELLED, updatedBy: actorId },
    include: { allocations: true, student: true },
  });
  await tx.tuitionAuditLog.create({
    data: {
      entityType: "PAYMENT_BATCH",
      entityId: batchId,
      action: "CANCEL",
      reason,
      dataBefore: batch as unknown as Prisma.InputJsonValue,
      dataAfter: cancelled as unknown as Prisma.InputJsonValue,
      performedBy: actorId,
      ...auditFields(auditContext),
    },
  });
  return { batch, cancelled };
}

export async function restructurePendingBatches(
  data: PendingBatchRestructure,
  actorId: string,
  auditContext?: AuditContext,
) {
  return prisma.$transaction(async (tx) => {
    const batchIds =
      data.operation === "SPLIT"
        ? [data.sourceBatchId]
        : [...new Set(data.batchIds)];
    const batchRefs = await tx.paymentBatch.findMany({
      where: { id: { in: batchIds } },
      select: { studentId: true },
    });
    if (batchRefs.length !== batchIds.length) {
      throw new NotFoundError("Không tìm thấy đầy đủ các đợt thanh toán");
    }
    // Lock student then batches (sorted) before reading allocations, same order as other batch flows.
    await lockStudentRows(
      tx,
      batchRefs.map((batch) => batch.studentId),
    );
    await lockPaymentBatchRows(tx, batchIds);
    const sourceBatches = await tx.paymentBatch.findMany({
      where: { id: { in: batchIds } },
      include: {
        allocations: true,
        statementRowLinks: { select: { isConfirmed: true } },
      },
    });
    if (sourceBatches.length !== batchIds.length) {
      throw new NotFoundError("Không tìm thấy đầy đủ các đợt thanh toán");
    }
    if (
      sourceBatches.some((batch) => batch.status !== PaymentBatchStatus.PENDING)
    ) {
      throw new ConflictError("Chỉ có thể tách hoặc gộp đợt đang chờ đối soát");
    }
    if (
      sourceBatches.some((batch) => batch.paymentMethod !== "BANK_TRANSFER")
    ) {
      throw new ConflictError("Chỉ có thể tách hoặc gộp đợt chuyển khoản");
    }
    if (new Set(sourceBatches.map((batch) => batch.studentId)).size !== 1) {
      throw new ConflictError(
        "Chỉ được tách hoặc gộp các đợt của cùng một học sinh",
      );
    }
    if (new Set(sourceBatches.map((batch) => batch.bankAccountId)).size !== 1) {
      throw new ConflictError("Các đợt phải dùng cùng một tài khoản nhận tiền");
    }
    const linkedBatch = sourceBatches.find(
      (batch) => batch.statementRowLinks.length,
    );
    if (linkedBatch) {
      throw new ConflictError(
        `Đợt ${linkedBatch.batchNo} đang được ghép với sao kê; hãy hoàn tất đối soát trước khi tách hoặc gộp`,
      );
    }

    const allocations = sourceBatches.flatMap((batch) => batch.allocations);
    if (data.operation === "SPLIT" && allocations.length < 2) {
      throw new ConflictError(
        "Đợt thanh toán chỉ có một khoản, không cần tách",
      );
    }

    const groups =
      data.operation === "SPLIT"
        ? allocations.map((allocation) => [allocation])
        : [allocations];
    for (const batch of sourceBatches) {
      await cancelPendingBatchInTransaction(
        tx,
        batch.id,
        actorId,
        data.reason,
        auditContext,
      );
    }

    const newBatches = [];
    for (const [index, group] of groups.entries()) {
      const created = await createPaymentBatch(
        {
          tuitionFeeIds: group.map((allocation) => allocation.tuitionFeeId),
          amounts: Object.fromEntries(
            group.map((allocation) => [
              allocation.tuitionFeeId,
              allocation.amount.toString(),
            ]),
          ),
          paymentMethod: "BANK_TRANSFER",
          bankAccountId: sourceBatches[0]?.bankAccountId ?? undefined,
          idempotencyKey: `${data.idempotencyKey}-${index + 1}`.slice(0, 150),
        },
        actorId,
        tx,
        auditContext,
      );
      newBatches.push(created);
    }

    for (const oldBatch of sourceBatches) {
      await tx.tuitionAuditLog.create({
        data: {
          entityType: "PAYMENT_BATCH",
          entityId: oldBatch.id,
          action: data.operation,
          reason: data.reason,
          dataBefore: {
            batchNo: oldBatch.batchNo,
            allocationCount: oldBatch.allocations.length,
          },
          dataAfter: {
            batchIds: newBatches.map((batch) => batch.id),
            batchNos: newBatches.map((batch) => batch.batchNo),
          },
          performedBy: actorId,
          ...auditFields(auditContext),
        },
      });
    }

    return {
      batches: newBatches.map((batch) => ({
        id: batch.id,
        batchNo: batch.batchNo,
        totalAmount: batch.totalAmount,
      })),
    };
  }, { timeout: 60_000 });
}

export async function listPaymentBatches(params: {
  transactionCode?: string;
  studentCode?: string;
  studentId?: string;
  search?: string;
  classId?: string;
  studentClassId?: string;
  billingYear?: number;
  billingMonth?: number;
  billingPeriods?: Array<{ billingYear: number; billingMonth: number }>;
  status?: PaymentBatchStatus;
  page: number;
  pageSize: number;
}) {
  const page = Number.isFinite(params.page)
    ? Math.max(Math.floor(params.page), 1)
    : 1;
  const pageSize = Number.isFinite(params.pageSize)
    ? Math.min(Math.max(Math.floor(params.pageSize), 1), 100)
    : 20;
  const transactionSearchValues = params.transactionCode
    ? (() => {
        const values = [params.transactionCode];
        const batchMatch = params.transactionCode.match(
          /PB(?:[\s_-]*PB)?[\s_-]*(\d{8})[\s_-]*(\d{6})/i,
        );
        if (batchMatch) {
          values.push(`PB-${batchMatch[1]}-${batchMatch[2]}`);
          values.push(`PB${batchMatch[1]}${batchMatch[2]}`);
        }
        return values.filter(
          (value, index, allValues) => allValues.indexOf(value) === index,
        );
      })()
    : [];
  const search = params.search?.trim();
  const filters: Prisma.PaymentBatchWhereInput[] = [];
  if (transactionSearchValues.length) {
    filters.push({
      OR: transactionSearchValues.flatMap((value) => [
        { batchNo: { contains: value, mode: "insensitive" as const } },
        {
          bankTransactionNo: { contains: value, mode: "insensitive" as const },
        },
        {
          transactionReference: {
            contains: value,
            mode: "insensitive" as const,
          },
        },
      ]),
    });
  }
  if (search) {
    filters.push({
      OR: [
        { batchNo: { contains: search, mode: "insensitive" } },
        { student: { code: { contains: search, mode: "insensitive" } } },
        { student: { fullName: { contains: search, mode: "insensitive" } } },
        {
          allocations: {
            some: {
              tuitionFee: { feeNo: { contains: search, mode: "insensitive" } },
            },
          },
        },
        {
          allocations: {
            some: {
              tuitionFee: {
                class: { code: { contains: search, mode: "insensitive" } },
              },
            },
          },
        },
        {
          allocations: {
            some: {
              tuitionFee: {
                class: { name: { contains: search, mode: "insensitive" } },
              },
            },
          },
        },
      ],
    });
  }
  const where: Prisma.PaymentBatchWhereInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.studentCode || params.studentId || params.studentClassId
      ? {
          student: {
            ...(params.studentCode
              ? {
                  code: {
                    contains: params.studentCode,
                    mode: "insensitive" as const,
                  },
                }
              : {}),
            ...(params.studentId ? { id: params.studentId } : {}),
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
    ...(params.classId || params.billingYear || params.billingMonth || params.billingPeriods?.length
      ? {
          allocations: {
            some: {
              tuitionFee: {
                ...(params.classId ? { classId: params.classId } : {}),
                ...(params.billingPeriods?.length
                  ? {
                      OR: params.billingPeriods.map((period) => ({
                        billingYear: period.billingYear,
                        billingMonth: period.billingMonth,
                      })),
                    }
                  : {
                      ...(params.billingYear
                        ? { billingYear: params.billingYear }
                        : {}),
                      ...(params.billingMonth
                        ? { billingMonth: params.billingMonth }
                        : {}),
                    }),
              },
            },
          },
        }
      : {}),
    ...(filters.length ? { AND: filters } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.paymentBatch.findMany({
      where,
      include: {
        student: true,
        receipt: true,
        allocations: { include: { tuitionFee: { include: { class: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.paymentBatch.count({ where }),
  ]);
  return {
    items: items.map((item) => ({
      ...item,
      receipt: item.status === PaymentBatchStatus.SUCCESS ? item.receipt : null,
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
  };
}

export async function getPaymentBatchDetail(batchId: string) {
  const batch = await prisma.paymentBatch.findUnique({
    where: { id: batchId },
    include: {
      student: true,
      bankAccount: true,
      receipt: true,
      allocations: {
        include: {
          tuitionFee: {
            include: {
              class: true,
              items: {
                include: {
                  classSubject: { include: { subject: true } },
                },
                orderBy: { displayOrder: "asc" },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      payments: {
        include: { receipt: true },
        orderBy: { paymentDate: "asc" },
      },
    },
  });
  if (!batch) throw new NotFoundError("Không tìm thấy đợt thanh toán");

  const printedAtRow = batch.receipt
    ? (
        await prisma.$queryRaw<Array<{ printedAt: Date | null }>>(
          Prisma.sql`SELECT printed_at AS "printedAt"
          FROM payment_batch_receipts
          WHERE id = ${batch.receipt.id}::uuid`,
        )
      )[0]
    : null;

  const auditLogs = await prisma.tuitionAuditLog.findMany({
    where: {
      entityType: "PAYMENT_BATCH",
      entityId: batchId,
      action: "SUCCESS",
    },
    orderBy: { performedAt: "desc" },
    select: { performedBy: true },
  });

  const userIds = [
    batch.createdBy,
    batch.updatedBy,
    batch.confirmedBy,
    ...batch.payments.flatMap((payment) => [
      payment.receivedBy,
      payment.confirmedBy,
    ]),
    ...auditLogs.map((log) => log.performedBy),
  ].filter((userId): userId is string => Boolean(userId));
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, fullName: true, email: true },
  });
  const usersById = new Map(users.map((user) => [user.id, user]));

  const allocations = batch.allocations.map((allocation) => ({
    ...allocation,
    tuitionFee: {
      ...allocation.tuitionFee,
      status: getEffectiveTuitionFeeStatus(
        allocation.tuitionFee.status,
        allocation.tuitionFee.dueDate,
      ),
    },
  }));

  return {
    ...batch,
    allocations,
    receipt:
      batch.status === PaymentBatchStatus.SUCCESS && batch.receipt
        ? { ...batch.receipt, printedAt: printedAtRow?.printedAt ?? null }
        : null,
    createdByUser: usersById.get(batch.createdBy) || null,
    updatedByUser: usersById.get(batch.updatedBy) || null,
    confirmedByUser: batch.confirmedBy
      ? usersById.get(batch.confirmedBy) || null
      : null,
    receivedByUser:
      usersById.get(
        batch.payments.find((payment) => payment.receivedBy)?.receivedBy ||
          (batch.paymentMethod === "CASH"
            ? auditLogs[0]?.performedBy
            : undefined) ||
          "",
      ) || null,
  };
}

export async function cancelPaymentBatch(
  batchId: string,
  actorId: string,
  reason: string,
  auditContext?: AuditContext,
) {
  return prisma.$transaction(async (tx) => {
    return (
      await cancelPendingBatchInTransaction(
        tx,
        batchId,
        actorId,
        reason,
        auditContext,
      )
    ).cancelled;
  });
}

export async function convertPaymentBatchToCash(
  batchId: string,
  actorId: string,
  paymentDate: string,
  note: string | undefined,
  auditContext?: AuditContext,
) {
  const cashPaymentDate = parsePaymentDate(paymentDate);
  if (!cashPaymentDate)
    throw new ConflictError("Ngày nhận tiền mặt là bắt buộc");
  const cashPaymentNote = note?.trim() || "Thanh toán tiền mặt";
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM payment_batches WHERE id = ${batchId}::uuid FOR UPDATE`,
    );
    const batch = await tx.paymentBatch.findUnique({
      where: { id: batchId },
      include: { allocations: true },
    });
    if (!batch) throw new NotFoundError("Không tìm thấy đợt thanh toán");
    if (batch.status !== PaymentBatchStatus.PENDING)
      throw new ConflictError(
        "Chỉ có thể chuyển sang tiền mặt với đợt đang chờ xử lý",
      );
    if (batch.paymentMethod !== "BANK_TRANSFER")
      throw new ConflictError(
        "Chỉ có thể chuyển đợt thanh toán chuyển khoản sang tiền mặt",
      );

    await tx.paymentBatch.update({
      where: { id: batchId },
      data: {
        paymentMethod: "CASH",
        bankAccountId: null,
        bankTransactionNo: null,
        transactionReference: null,
        updatedBy: actorId,
      },
    });
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "PAYMENT_BATCH",
        entityId: batchId,
        action: "UPDATE",
        dataBefore: { paymentMethod: batch.paymentMethod },
        dataAfter: {
          paymentMethod: "CASH",
          paymentContent: cashPaymentNote,
          reason: "Chuyển sang thanh toán tiền mặt",
        },
        performedBy: actorId,
        ...auditFields(auditContext),
      },
    });
    return completePaymentBatch(
      tx,
      batchId,
      actorId,
      {
        paymentDate: cashPaymentDate,
        paymentContent: cashPaymentNote,
      },
      auditContext,
    );
  });
}

export async function getPaymentBatchQr(
  batchId: string,
  actorId: string,
  auditContext?: AuditContext,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM payment_batches WHERE id = ${batchId}::uuid FOR UPDATE`,
    );
    const batch = await tx.paymentBatch.findUnique({
      where: { id: batchId },
      include: {
        student: { select: { fullName: true } },
        allocations: {
          select: { tuitionFee: { select: { class: { select: { name: true } } } } },
        },
      },
    });
    if (!batch) throw new NotFoundError("Không tìm thấy đợt thanh toán");
    if (batch.status !== PaymentBatchStatus.PENDING)
      throw new ConflictError("Đợt thanh toán không còn hiệu lực");
    if (batch.paymentMethod !== "BANK_TRANSFER")
      throw new ConflictError("Chỉ payment batch chuyển khoản mới có mã QR");
    if (!batch.bankAccountId)
      throw new ConflictError("Đợt thanh toán chưa gắn tài khoản ngân hàng");
    const accountRecord = await tx.bankAccount.findFirst({
      where: { id: batch.bankAccountId, isActive: true },
    });
    if (!accountRecord)
      throw new ConflictError("Chưa cấu hình tài khoản ngân hàng nhận học phí");
    // Same account source as the notice PDF: the snapshot taken when the batch was issued.
    const snapshot = parseDocumentSnapshot(batch.noticeSnapshot);
    const snapshotAccount = snapshot?.bankAccount;
    const account = {
      id: accountRecord.id,
      bankCode: snapshotAccount?.bankCode ?? accountRecord.bankCode,
      bankName: snapshotAccount?.bankName ?? accountRecord.bankName,
      accountNo: snapshotAccount?.accountNo ?? accountRecord.accountNo,
      accountName: snapshotAccount?.accountName ?? accountRecord.accountName,
    };
    // Same content as the notice PDF, taken from the batch snapshot when available.
    const transferContent = buildTransferContent({
      batchNo: batch.batchNo,
      studentName: snapshot?.student.fullName ?? batch.student.fullName,
      classNames: snapshot
        ? snapshot.fees.map((fee) => fee.className)
        : batch.allocations.map((allocation) => allocation.tuitionFee.class?.name),
    });
    const qrDataUrl = await buildVietQrDataUrl({
      bankCode: account.bankCode,
      accountNo: account.accountNo,
      amount: Number(batch.totalAmount),
      addInfo: transferContent,
    });
    if (!qrDataUrl)
      throw new ConflictError(unsupportedVietQrBankMessage(account.bankCode));
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "PAYMENT_BATCH",
        entityId: batch.id,
        action: "QR_GENERATED",
        dataAfter: {
          batchNo: batch.batchNo,
          amount: batch.totalAmount.toString(),
          bankAccountId: account.id,
        },
        performedBy: actorId,
        ...auditFields(auditContext),
      },
    });
    return {
      batchNo: batch.batchNo,
      amount: batch.totalAmount,
      account,
      qrDataUrl,
      transferContent,
    };
  });
}
