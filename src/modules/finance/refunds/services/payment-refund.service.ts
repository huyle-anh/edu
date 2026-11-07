import {
  PaymentBatchStatus,
  Prisma,
  ReceiptStatus,
  TuitionPaymentStatus,
  TuitionRefundStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { auditFields, type AuditContext } from "@/lib/audit";
import type {
  PaymentRefundComplete,
  PaymentRefundCreate,
} from "../schemas/payment-refund.schema";
import { getStoredTuitionFeeStatus } from "@/modules/finance/tuition/utils/tuition-status";
import { markPaymentBatchReceiptCancelled } from "@/modules/finance/payments/services/payment-document-snapshot";

async function generateRefundNo(tx: Prisma.TransactionClient) {
  const prefix = `RF-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const refundNo = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
    const exists = await tx.paymentRefund.findUnique({
      where: { refundNo },
      select: { id: true },
    });
    if (!exists) return refundNo;
  }
  throw new ConflictError("Không thể tạo mã hoàn tiền, vui lòng thử lại");
}

async function lockPayment(tx: Prisma.TransactionClient, paymentId: string) {
  await tx.$executeRaw(
    Prisma.sql`SELECT id FROM tuition_payments WHERE id = ${paymentId}::uuid FOR UPDATE`,
  );
  return tx.tuitionPayment.findUnique({
    where: { id: paymentId },
    include: {
      tuitionFee: true,
      paymentBatch: true,
    },
  });
}

async function getPaymentGroup(
  tx: Prisma.TransactionClient,
  paymentId: string,
) {
  const payment = await lockPayment(tx, paymentId);
  if (!payment) throw new NotFoundError("Không tìm thấy payment");
  if (payment.paymentStatus !== TuitionPaymentStatus.SUCCESS) {
    throw new ConflictError("Chỉ có thể hoàn tiền payment SUCCESS");
  }

  if (!payment.paymentBatchId) return [payment];

  await tx.$executeRaw(
    Prisma.sql`SELECT id FROM payment_batches WHERE id = ${payment.paymentBatchId}::uuid FOR UPDATE`,
  );
  const batch = await tx.paymentBatch.findUnique({
    where: { id: payment.paymentBatchId },
  });
  if (!batch || batch.status !== PaymentBatchStatus.SUCCESS) {
    throw new ConflictError("Payment batch không còn ở trạng thái thành công");
  }

  const payments = await tx.tuitionPayment.findMany({
    where: {
      paymentBatchId: payment.paymentBatchId,
      paymentStatus: TuitionPaymentStatus.SUCCESS,
    },
    include: { tuitionFee: true, paymentBatch: true },
    orderBy: { createdAt: "asc" },
  });
  if (!payments.length) throw new ConflictError("Payment batch không có payment SUCCESS");
  return payments;
}

async function assertNoActiveRefunds(
  tx: Prisma.TransactionClient,
  paymentIds: string[],
) {
  const existing = await tx.paymentRefund.findMany({
    where: {
      paymentId: { in: paymentIds },
      status: {
        notIn: [TuitionRefundStatus.REJECTED, TuitionRefundStatus.CANCELLED],
      },
    },
    select: { refundNo: true },
  });
  if (existing.length) {
    throw new ConflictError(`Payment đã có yêu cầu hoàn tiền ${existing[0]?.refundNo}`);
  }
}

export async function createPaymentRefund(
  data: PaymentRefundCreate,
  actorId: string,
  transaction?: Prisma.TransactionClient,
  auditContext?: AuditContext,
) {
  const execute = async (tx: Prisma.TransactionClient) => {
    const payments = await getPaymentGroup(tx, data.paymentId);
    const paymentIds = payments.map((payment) => payment.id);
    await assertNoActiveRefunds(tx, paymentIds);

    const refunds = [];
    for (const payment of payments) {
      const refund = await tx.paymentRefund.create({
        data: {
          refundNo: await generateRefundNo(tx),
          paymentId: payment.id,
          amount: payment.amount,
          refundMethod: data.refundMethod,
          reason: data.reason,
          status: TuitionRefundStatus.PENDING,
          createdBy: actorId,
        },
      });
      await tx.tuitionAuditLog.create({
        data: {
          entityType: "PAYMENT_REFUND",
          entityId: refund.id,
          action: "CREATED",
          dataAfter: {
            refundNo: refund.refundNo,
            paymentId: payment.id,
            amount: refund.amount.toString(),
            status: refund.status,
          },
          reason: data.reason,
          performedBy: actorId,
          ...auditFields(auditContext),
        },
      });
      refunds.push(refund);
    }
    return refunds;
  };
  return transaction ? execute(transaction) : prisma.$transaction(execute);
}

async function findRefundWithPayment(
  tx: Prisma.TransactionClient,
  refundId: string,
) {
  const refund = await tx.paymentRefund.findUnique({
    where: { id: refundId },
    include: { payment: { include: { tuitionFee: true, paymentBatch: true } } },
  });
  if (!refund) throw new NotFoundError("Không tìm thấy yêu cầu hoàn tiền");
  return refund;
}

async function lockRefund(tx: Prisma.TransactionClient, refundId: string) {
  await tx.$executeRaw(
    Prisma.sql`SELECT id FROM payment_refunds WHERE id = ${refundId}::uuid FOR UPDATE`,
  );
}

async function getRefundGroup(
  tx: Prisma.TransactionClient,
  refundId: string,
) {
  const initialRefund = await findRefundWithPayment(tx, refundId);
  const paymentBatchId = initialRefund.payment.paymentBatchId;

  if (!paymentBatchId) {
    // Receipt cancellation uses payment -> refund lock order. Keep the same
    // order here so approval cannot race a receipt cancellation.
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM tuition_payments WHERE id = ${initialRefund.paymentId}::uuid FOR UPDATE`,
    );
    await lockRefund(tx, refundId);
    const refund = await findRefundWithPayment(tx, refundId);
    return [refund];
  }

  const paymentRows = await tx.tuitionPayment.findMany({
    where: { paymentBatchId },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  if (!paymentRows.length) {
    throw new ConflictError("Payment batch không có payment");
  }
  for (const payment of paymentRows) {
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM tuition_payments WHERE id = ${payment.id}::uuid FOR UPDATE`,
    );
  }
  await tx.$executeRaw(
    Prisma.sql`SELECT id FROM payment_batches WHERE id = ${paymentBatchId}::uuid FOR UPDATE`,
  );
  await lockRefund(tx, refundId);
  const refund = await findRefundWithPayment(tx, refundId);
  if (!refund.payment.paymentBatchId) return [refund];
  if (
    refund.status === TuitionRefundStatus.REJECTED ||
    refund.status === TuitionRefundStatus.CANCELLED
  ) {
    return [refund];
  }
  const batch = await tx.paymentBatch.findUnique({
    where: { id: paymentBatchId },
    select: { status: true },
  });
  if (!batch || batch.status !== PaymentBatchStatus.SUCCESS) {
    throw new ConflictError("Payment batch không còn ở trạng thái thành công");
  }

  const payments = await tx.tuitionPayment.findMany({
    where: { paymentBatchId },
    select: { id: true, paymentStatus: true },
  });
  if (payments.some((payment) => payment.paymentStatus !== TuitionPaymentStatus.SUCCESS)) {
    throw new ConflictError("Payment batch không còn nhất quán để hoàn tiền");
  }

  const refunds = await tx.paymentRefund.findMany({
    where: {
      payment: { paymentBatchId },
      status: {
        notIn: [TuitionRefundStatus.REJECTED, TuitionRefundStatus.CANCELLED],
      },
    },
    include: { payment: { include: { tuitionFee: true, paymentBatch: true } } },
    orderBy: { createdAt: "asc" },
  });
  const refundPaymentIds = new Set(refunds.map((item) => item.paymentId));
  if (
    refunds.length !== payments.length ||
    payments.some((payment) => !refundPaymentIds.has(payment.id))
  ) {
    throw new ConflictError(
      "Yêu cầu hoàn tiền của payment batch chưa bao phủ toàn bộ payment",
    );
  }
  return refunds;
}

export async function approvePaymentRefund(
  refundId: string,
  actorId: string,
  auditContext?: AuditContext,
) {
  return prisma.$transaction(async (tx) => {
    const refunds = await getRefundGroup(tx, refundId);
    if (!refunds.length) throw new NotFoundError("Không tìm thấy yêu cầu hoàn tiền");
    if (refunds.some((refund) => refund.status !== TuitionRefundStatus.PENDING)) {
      throw new ConflictError("Yêu cầu hoàn tiền không còn ở trạng thái chờ duyệt");
    }
    const approved = [];
    for (const refund of refunds) {
      const item = await tx.paymentRefund.update({
        where: { id: refund.id },
        data: { status: TuitionRefundStatus.APPROVED, approvedBy: actorId },
      });
      await tx.tuitionAuditLog.create({
        data: {
          entityType: "PAYMENT_REFUND",
          entityId: item.id,
          action: "APPROVED",
          dataBefore: { status: refund.status },
          dataAfter: { status: item.status, approvedBy: actorId },
          performedBy: actorId,
          ...auditFields(auditContext),
        },
      });
      approved.push(item);
    }
    return approved;
  });
}

export async function completePaymentRefund(
  refundId: string,
  actorId: string,
  data: PaymentRefundComplete,
  auditContext?: AuditContext,
) {
  return prisma.$transaction(async (tx) => {
    const refunds = await getRefundGroup(tx, refundId);
    if (!refunds.length) throw new NotFoundError("Không tìm thấy yêu cầu hoàn tiền");
    if (refunds.some((refund) => refund.status !== TuitionRefundStatus.APPROVED)) {
      throw new ConflictError("Chỉ có thể hoàn tất yêu cầu đã được duyệt");
    }

    const bankTransactionNo = data.bankTransactionNo?.trim() || null;
    if (refunds[0]?.refundMethod === "CASH" && bankTransactionNo) {
      throw new ConflictError("Hoàn tiền mặt không được có mã giao dịch ngân hàng");
    }
    if (refunds[0]?.refundMethod === "BANK_TRANSFER" && !bankTransactionNo) {
      throw new ConflictError("Hoàn chuyển khoản phải có mã giao dịch ngân hàng");
    }

    const completedAt = new Date();
    const refundDate = data.refundDate ? new Date(data.refundDate) : completedAt;
    for (const refund of refunds) {
      const payment = await lockPayment(tx, refund.paymentId);
      if (!payment || payment.paymentStatus !== TuitionPaymentStatus.SUCCESS) {
        throw new ConflictError("Payment không còn đủ điều kiện hoàn tiền");
      }
      if (!refund.amount.equals(payment.amount)) {
        throw new ConflictError("Số tiền hoàn không khớp toàn bộ payment");
      }

      const cancelledReceipt = await tx.tuitionReceipt.findUnique({
        where: { paymentId: payment.id },
      });
      let updatedReceipt: typeof cancelledReceipt = cancelledReceipt;
      if (cancelledReceipt && cancelledReceipt.status !== ReceiptStatus.CANCELLED) {
        updatedReceipt = await tx.tuitionReceipt.update({
          where: { id: cancelledReceipt.id },
          data: {
            status: ReceiptStatus.CANCELLED,
            cancellationReason: `Hoàn tiền ${refund.refundNo}: ${refund.reason}`,
            cancelledBy: actorId,
            cancelledAt: completedAt,
          },
        });
      }

      const updatedPayment = await tx.tuitionPayment.update({
        where: { id: payment.id },
        data: {
          paymentStatus: TuitionPaymentStatus.REFUNDED,
          cancellationReason: `Hoàn tiền ${refund.refundNo}: ${refund.reason}`,
          updatedBy: actorId,
          version: { increment: 1 },
        },
      });
      const remainingPayments = await tx.tuitionPayment.findMany({
        where: {
          tuitionFeeId: payment.tuitionFeeId,
          paymentStatus: TuitionPaymentStatus.SUCCESS,
        },
        select: { amount: true },
      });
      const paidAfterRefund = remainingPayments.reduce(
        (total, item) => total.add(item.amount),
        new Prisma.Decimal(0),
      );
      const reopenedFee = await tx.tuitionFee.update({
        where: { id: payment.tuitionFeeId },
        data: {
          status: getStoredTuitionFeeStatus(payment.tuitionFee.finalAmount, paidAfterRefund),
          version: { increment: 1 },
          updatedBy: actorId,
        },
      });
      const completedRefund = await tx.paymentRefund.update({
        where: { id: refund.id },
        data: {
          status: TuitionRefundStatus.COMPLETED,
          refundDate,
          bankTransactionNo,
          completedAt,
        },
      });
      const auditRows: Prisma.TuitionAuditLogCreateManyInput[] = [];
      if (updatedReceipt && cancelledReceipt && updatedReceipt.status !== cancelledReceipt.status) {
        auditRows.push({
          entityType: "TUITION_RECEIPT",
          entityId: updatedReceipt.id,
          action: "CANCEL",
          dataBefore: cancelledReceipt as unknown as Prisma.InputJsonValue,
          dataAfter: updatedReceipt as unknown as Prisma.InputJsonValue,
          reason: refund.reason,
          performedBy: actorId,
          ...auditFields(auditContext),
        });
      }
      auditRows.push(
        {
          entityType: "PAYMENT_REFUND",
          entityId: refund.id,
          action: "COMPLETED",
          dataBefore: refund as unknown as Prisma.InputJsonValue,
          dataAfter: completedRefund as unknown as Prisma.InputJsonValue,
          reason: refund.reason,
          performedBy: actorId,
          ...auditFields(auditContext),
        },
        {
          entityType: "TUITION_PAYMENT",
          entityId: payment.id,
          action: "REFUNDED",
          dataBefore: payment as unknown as Prisma.InputJsonValue,
          dataAfter: updatedPayment as unknown as Prisma.InputJsonValue,
          reason: refund.reason,
          performedBy: actorId,
          ...auditFields(auditContext),
        },
        {
          entityType: "TUITION_FEE",
          entityId: payment.tuitionFeeId,
          action: "REFUND_REVERSED",
          dataBefore: payment.tuitionFee as unknown as Prisma.InputJsonValue,
          dataAfter: reopenedFee as unknown as Prisma.InputJsonValue,
          reason: refund.reason,
          performedBy: actorId,
          ...auditFields(auditContext),
        },
      );
      await tx.tuitionAuditLog.createMany({
        data: auditRows,
      });
    }

    const batchId = refunds[0]?.payment.paymentBatchId;
    if (batchId) {
      const batch = await tx.paymentBatch.findUnique({ where: { id: batchId } });
      const cancelledBatch = await tx.paymentBatch.update({
        where: { id: batchId },
        data: { status: PaymentBatchStatus.CANCELLED, updatedBy: actorId },
      });
      const batchReceipt = await tx.paymentBatchReceipt.findUnique({
        where: { paymentBatchId: batchId },
        select: { id: true, snapshot: true },
      });
      if (batchReceipt) {
        await markPaymentBatchReceiptCancelled(
          tx,
          batchReceipt.id,
          "Hoàn tiền toàn bộ batch",
          actorId,
          completedAt,
        );
        await tx.tuitionAuditLog.create({
          data: {
            entityType: "PAYMENT_BATCH_RECEIPT",
            entityId: batchReceipt.id,
            action: "CANCEL",
            reason: "Hoàn tiền toàn bộ batch",
            dataBefore: batchReceipt as unknown as Prisma.InputJsonValue,
            dataAfter: {
              status: "CANCELLED",
              cancellationReason: "Hoàn tiền toàn bộ batch",
              cancelledBy: actorId,
            },
            performedBy: actorId,
            ...auditFields(auditContext),
          },
        });
      }
      await tx.tuitionAuditLog.create({
        data: {
          entityType: "PAYMENT_BATCH",
          entityId: batchId,
          action: "REFUND_REVERSED",
          dataBefore: batch as unknown as Prisma.InputJsonValue,
          dataAfter: cancelledBatch as unknown as Prisma.InputJsonValue,
          reason: "Hoàn tiền toàn bộ batch",
          performedBy: actorId,
          ...auditFields(auditContext),
        },
      });
    }
    return tx.paymentRefund.findUnique({
      where: { id: refundId },
      include: { payment: true },
    });
  });
}

export async function getPaymentRefundsForPayment(paymentId: string) {
  return prisma.paymentRefund.findMany({
    where: { paymentId },
    orderBy: { createdAt: "desc" },
  });
}
