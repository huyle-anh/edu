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
import { getStoredTuitionFeeStatus } from "@/modules/finance/tuition/utils/tuition-status";
import { markPaymentBatchReceiptCancelled } from "@/modules/finance/payments/services/payment-document-snapshot";

async function findReceiptForCancellation(
  tx: Prisma.TransactionClient,
  receiptId: string,
) {
  return tx.tuitionReceipt.findUnique({
    where: { id: receiptId },
    include: {
      payment: {
        include: {
          paymentBatch: true,
          tuitionFee: true,
          refunds: {
            where: {
              status: {
                notIn: [TuitionRefundStatus.REJECTED, TuitionRefundStatus.CANCELLED],
              },
            },
            select: { id: true },
          },
        },
      },
    },
  });
}

export async function cancelTuitionReceipt(
  receiptId: string,
  actorId: string,
  reason: string,
  auditContext?: AuditContext,
) {
  return prisma.$transaction(async (tx) => {
    let receipt = await findReceiptForCancellation(tx, receiptId);
    if (!receipt) throw new NotFoundError("Không tìm thấy biên lai");

    if (receipt.payment.paymentBatchId) {
      // Refund creation locks payment before batch. Lock every payment in a
      // stable order before the batch to avoid races and lock-order deadlocks.
      const batchPayments = await tx.tuitionPayment.findMany({
        where: { paymentBatchId: receipt.payment.paymentBatchId },
        select: { id: true },
        orderBy: { id: "asc" },
      });
      for (const payment of batchPayments) {
        await tx.$executeRaw(
          Prisma.sql`SELECT id FROM tuition_payments WHERE id = ${payment.id}::uuid FOR UPDATE`,
        );
      }
      await tx.$executeRaw(
        Prisma.sql`SELECT id FROM payment_batches WHERE id = ${receipt.payment.paymentBatchId}::uuid FOR UPDATE`,
      );
    } else {
      // Refund creation locks payment before checking active refunds. Use the
      // same lock order here and re-read all state after waiting for the lock.
      await tx.$executeRaw(
        Prisma.sql`SELECT id FROM tuition_payments WHERE id = ${receipt.payment.id}::uuid FOR UPDATE`,
      );
    }
    receipt = await findReceiptForCancellation(tx, receiptId);
    if (!receipt) throw new NotFoundError("Không tìm thấy biên lai");

    if (receipt.status === ReceiptStatus.CANCELLED)
      throw new ConflictError("Biên lai đã được hủy");
    if (receipt.payment.paymentStatus !== TuitionPaymentStatus.SUCCESS)
      throw new ConflictError("Chỉ có thể hủy biên lai của thanh toán thành công");
    if (receipt.payment.refunds.length > 0)
      throw new ConflictError(
        "Không thể hủy biên lai khi thanh toán đang có yêu cầu hoàn tiền",
      );

    const batchId = receipt.payment.paymentBatchId;
    if (batchId) {
      const batch = await tx.paymentBatch.findUnique({ where: { id: batchId } });
      if (!batch) throw new NotFoundError("Không tìm thấy đợt thanh toán");
      if (batch.status !== PaymentBatchStatus.SUCCESS)
        throw new ConflictError("Đợt thanh toán không còn ở trạng thái thành công");

      const payments = await tx.tuitionPayment.findMany({
        where: { paymentBatchId: batch.id },
        include: {
          receipt: true,
          tuitionFee: true,
          refunds: {
            where: {
              status: {
                notIn: [TuitionRefundStatus.REJECTED, TuitionRefundStatus.CANCELLED],
              },
            },
            select: { id: true },
          },
        },
      });
      if (
        payments.length === 0 ||
        payments.some((payment) => payment.paymentStatus !== TuitionPaymentStatus.SUCCESS)
      )
        throw new ConflictError("Đợt thanh toán không còn nhất quán để hoàn tác");
      if (payments.some((payment) => payment.refunds.length > 0)) {
        throw new ConflictError(
          "Không thể hủy biên lai khi batch đang có yêu cầu hoàn tiền",
        );
      }

      for (const payment of payments) {
        const cancelledPayment = await tx.tuitionPayment.update({
          where: { id: payment.id },
          data: {
            paymentStatus: TuitionPaymentStatus.CANCELLED,
            cancellationReason: reason,
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
        const paidAfterCancellation = remainingPayments.reduce(
          (total, item) => total.add(item.amount),
          new Prisma.Decimal(0),
        );
        const reopenedFee = await tx.tuitionFee.update({
          where: { id: payment.tuitionFeeId },
          data: {
            status: getStoredTuitionFeeStatus(payment.tuitionFee.finalAmount, paidAfterCancellation),
            version: { increment: 1 },
            updatedBy: actorId,
          },
        });
        const auditRows: Prisma.TuitionAuditLogCreateManyInput[] = [
          {
            entityType: "TUITION_PAYMENT",
            entityId: payment.id,
            action: "CANCEL",
            reason,
            dataBefore: payment as unknown as Prisma.InputJsonValue,
            dataAfter: cancelledPayment as unknown as Prisma.InputJsonValue,
            performedBy: actorId,
          },
          {
            entityType: "TUITION_FEE",
            entityId: payment.tuitionFeeId,
            action: "PAYMENT_REVERSED",
            reason,
            dataBefore: payment.tuitionFee as unknown as Prisma.InputJsonValue,
            dataAfter: reopenedFee as unknown as Prisma.InputJsonValue,
            performedBy: actorId,
          },
        ];
        if (payment.receipt) {
          const cancelledReceipt = await tx.tuitionReceipt.update({
            where: { id: payment.receipt.id },
            data: {
              status: ReceiptStatus.CANCELLED,
              cancellationReason: reason,
              cancelledBy: actorId,
              cancelledAt: new Date(),
            },
          });
          auditRows.push({
            entityType: "TUITION_RECEIPT",
            entityId: payment.receipt.id,
            action: "CANCEL",
            reason,
            dataBefore: payment.receipt as unknown as Prisma.InputJsonValue,
            dataAfter: cancelledReceipt as unknown as Prisma.InputJsonValue,
            performedBy: actorId,
          });
        }
        await tx.tuitionAuditLog.createMany({
          data: auditRows.map((row) => ({ ...row, ...auditFields(auditContext) })),
        });
      }

      const cancelledBatch = await tx.paymentBatch.update({
        where: { id: batch.id },
        data: { status: PaymentBatchStatus.CANCELLED, updatedBy: actorId },
      });
      const batchReceipt = await tx.paymentBatchReceipt.findUnique({
        where: { paymentBatchId: batch.id },
        select: { id: true, snapshot: true },
      });
      if (batchReceipt) {
        await markPaymentBatchReceiptCancelled(tx, batchReceipt.id, reason, actorId);
        await tx.tuitionAuditLog.create({
          data: {
            entityType: "PAYMENT_BATCH_RECEIPT",
            entityId: batchReceipt.id,
            action: "CANCEL",
            reason,
            dataBefore: batchReceipt as unknown as Prisma.InputJsonValue,
            dataAfter: {
              status: "CANCELLED",
              cancellationReason: reason,
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
          entityId: batch.id,
          action: "CANCEL",
          reason,
          dataBefore: batch as unknown as Prisma.InputJsonValue,
          dataAfter: cancelledBatch as unknown as Prisma.InputJsonValue,
          performedBy: actorId,
          ...auditFields(auditContext),
        },
      });
      return tx.tuitionReceipt.findUnique({ where: { id: receiptId } });
    }

    const cancelledPayment = await tx.tuitionPayment.update({
      where: { id: receipt.payment.id },
      data: {
        paymentStatus: TuitionPaymentStatus.CANCELLED,
        cancellationReason: reason,
        updatedBy: actorId,
        version: { increment: 1 },
      },
    });
    const remainingPayments = await tx.tuitionPayment.findMany({
      where: {
        tuitionFeeId: receipt.payment.tuitionFeeId,
        paymentStatus: TuitionPaymentStatus.SUCCESS,
      },
      select: { amount: true },
    });
    const paidAfterCancellation = remainingPayments.reduce(
      (total, item) => total.add(item.amount),
      new Prisma.Decimal(0),
    );
    const reopenedFee = await tx.tuitionFee.update({
      where: { id: receipt.payment.tuitionFeeId },
      data: {
        status: getStoredTuitionFeeStatus(receipt.payment.tuitionFee.finalAmount, paidAfterCancellation),
        version: { increment: 1 },
        updatedBy: actorId,
      },
    });
    const cancelledReceipt = await tx.tuitionReceipt.update({
      where: { id: receiptId },
      data: {
        status: ReceiptStatus.CANCELLED,
        cancellationReason: reason,
        cancelledBy: actorId,
        cancelledAt: new Date(),
      },
    });
    await tx.tuitionAuditLog.createMany({
      data: [
        {
          entityType: "TUITION_PAYMENT",
          entityId: receipt.payment.id,
          action: "CANCEL",
          reason,
          dataBefore: receipt.payment as unknown as Prisma.InputJsonValue,
          dataAfter: cancelledPayment as unknown as Prisma.InputJsonValue,
          performedBy: actorId,
        },
        {
          entityType: "TUITION_FEE",
          entityId: receipt.payment.tuitionFeeId,
          action: "PAYMENT_REVERSED",
          reason,
          dataBefore: receipt.payment.tuitionFee as unknown as Prisma.InputJsonValue,
          dataAfter: reopenedFee as unknown as Prisma.InputJsonValue,
          performedBy: actorId,
        },
        {
          entityType: "TUITION_RECEIPT",
          entityId: receiptId,
          action: "CANCEL",
          reason,
          dataBefore: receipt as unknown as Prisma.InputJsonValue,
          dataAfter: cancelledReceipt as unknown as Prisma.InputJsonValue,
          performedBy: actorId,
        },
      ].map((row) => ({ ...row, ...auditFields(auditContext) })),
    });
    return cancelledReceipt;
  });
}
