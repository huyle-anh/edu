import { Prisma, type Prisma as PrismaTypes } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type DocumentSnapshot = {
  version: 1;
  student: { code: string; fullName: string };
  fees: ReturnType<typeof toFeeSnapshot>[];
  bankAccount?: {
    bankCode: string;
    bankName: string;
    accountNo: string;
    accountName: string;
  };
};

export type ReceiptSnapshot = {
  version: 1;
  receiptNo: string;
  issuedAt: string;
  student: { code: string; fullName: string };
  receiverName?: string;
  tuitionFee: ReturnType<typeof toFeeSnapshot>;
  amount: string;
  paymentMethod: string;
};

export type BatchReceiptSnapshot = {
  version: 1;
  receiptNo: string;
  issuedAt: string;
  student: { code: string; fullName: string };
  receiverName?: string;
  fees: ReturnType<typeof toFeeSnapshot>[];
  amount: string;
  paymentMethod: string;
  status?: "ACTIVE" | "CANCELLED";
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
};

type SnapshotFeeInput = {
  id: string;
  feeNo: string;
  billingYear: number;
  billingMonth: number;
  originalAmount: PrismaTypes.Decimal;
  discountAmount: PrismaTypes.Decimal;
  additionalAmount: PrismaTypes.Decimal;
  finalAmount: PrismaTypes.Decimal;
  class?: { id: string; name: string } | null;
  items: Array<{
    itemName: string;
    quantity: PrismaTypes.Decimal;
    unitPrice: PrismaTypes.Decimal;
    amount: PrismaTypes.Decimal;
    displayOrder: number;
    classSubject?: { subject: { name: string } } | null;
  }>;
};

export function toFeeSnapshot(fee: SnapshotFeeInput, payableAmount?: PrismaTypes.Decimal) {
  return {
    tuitionFeeId: fee.id,
    feeNo: fee.feeNo,
    billingYear: fee.billingYear,
    billingMonth: fee.billingMonth,
    classId: fee.class?.id ?? null,
    className: fee.class?.name ?? null,
    originalAmount: fee.originalAmount.toString(),
    discountAmount: fee.discountAmount.toString(),
    additionalAmount: fee.additionalAmount.toString(),
    finalAmount: fee.finalAmount.toString(),
    payableAmount: (payableAmount ?? fee.finalAmount).toString(),
    items: fee.items.map((item) => ({
      itemName: item.itemName,
      subjectName: item.classSubject?.subject.name ?? null,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      amount: item.amount.toString(),
      displayOrder: item.displayOrder,
    })),
  };
}

export function parseDocumentSnapshot(value: unknown): DocumentSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const snapshot = value as {
    version?: unknown;
    student?: unknown;
    fees?: unknown;
    bankAccount?: unknown;
  };
  if (
    snapshot.version !== 1 ||
    !snapshot.student ||
    typeof snapshot.student !== "object" ||
    !Array.isArray(snapshot.fees)
  ) return null;
  const student = snapshot.student as { code?: unknown; fullName?: unknown };
  if (typeof student.code !== "string" || typeof student.fullName !== "string") return null;
  if (snapshot.bankAccount !== undefined) {
    const account = snapshot.bankAccount as {
      bankCode?: unknown;
      bankName?: unknown;
      accountNo?: unknown;
      accountName?: unknown;
    };
    if (
      typeof account.bankCode !== "string" ||
      typeof account.bankName !== "string" ||
      typeof account.accountNo !== "string" ||
      typeof account.accountName !== "string"
    ) return null;
  }
  return snapshot as DocumentSnapshot;
}

export function parseReceiptSnapshot(value: unknown): ReceiptSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const snapshot = value as ReceiptSnapshot;
  if (
    snapshot.version !== 1 ||
    typeof snapshot.receiptNo !== "string" ||
    typeof snapshot.issuedAt !== "string" ||
    !snapshot.student ||
    typeof snapshot.student.code !== "string" ||
    typeof snapshot.student.fullName !== "string" ||
    !snapshot.tuitionFee ||
    !Array.isArray(snapshot.tuitionFee.items)
  ) return null;
  return snapshot;
}

export function parseBatchReceiptSnapshot(value: unknown): BatchReceiptSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const snapshot = value as BatchReceiptSnapshot;
  if (
    snapshot.version !== 1 ||
    typeof snapshot.receiptNo !== "string" ||
    typeof snapshot.issuedAt !== "string" ||
    !snapshot.student ||
    typeof snapshot.student.code !== "string" ||
    typeof snapshot.student.fullName !== "string" ||
    !Array.isArray(snapshot.fees)
  ) return null;
  if (
    snapshot.status !== undefined &&
    snapshot.status !== "ACTIVE" &&
    snapshot.status !== "CANCELLED"
  ) return null;
  return snapshot;
}

type DbClient = typeof prisma | PrismaTypes.TransactionClient;

export async function getTuitionReceiptSnapshot(receiptId: string, client: DbClient = prisma) {
  const rows = await client.$queryRaw<Array<{ snapshot: unknown }>>(
    Prisma.sql`SELECT snapshot FROM tuition_receipts WHERE id = ${receiptId}::uuid`,
  );
  return rows[0]?.snapshot ?? null;
}

export async function getPaymentBatchReceiptSnapshot(receiptId: string, client: DbClient = prisma) {
  const rows = await client.$queryRaw<Array<{ snapshot: unknown }>>(
    Prisma.sql`SELECT snapshot FROM payment_batch_receipts WHERE id = ${receiptId}::uuid`,
  );
  return rows[0]?.snapshot ?? null;
}

export async function getPaymentBatchNoticeSnapshot(batchId: string, client: DbClient = prisma) {
  const rows = await client.$queryRaw<Array<{ notice_snapshot: unknown }>>(
    Prisma.sql`SELECT notice_snapshot FROM payment_batches WHERE id = ${batchId}::uuid`,
  );
  return rows[0]?.notice_snapshot ?? null;
}

export async function saveTuitionReceiptSnapshot(client: DbClient, receiptId: string, snapshot: unknown) {
  await client.$executeRaw(
    Prisma.sql`UPDATE tuition_receipts SET snapshot = ${JSON.stringify(snapshot)}::jsonb WHERE id = ${receiptId}::uuid`,
  );
}

export async function savePaymentBatchReceiptSnapshot(client: DbClient, receiptId: string, snapshot: unknown) {
  await client.$executeRaw(
    Prisma.sql`UPDATE payment_batch_receipts SET snapshot = ${JSON.stringify(snapshot)}::jsonb WHERE id = ${receiptId}::uuid`,
  );
}

export async function markPaymentBatchReceiptCancelled(
  client: DbClient,
  receiptId: string,
  reason: string,
  actorId: string,
  cancelledAt = new Date(),
) {
  await client.$executeRaw(
    Prisma.sql`UPDATE payment_batch_receipts
      SET snapshot = COALESCE(snapshot, '{}'::jsonb) || jsonb_build_object(
        'status', 'CANCELLED',
        'cancellationReason', ${reason},
        'cancelledBy', ${actorId},
        'cancelledAt', ${cancelledAt.toISOString()}
      )
      WHERE id = ${receiptId}::uuid`,
  );
}

export async function savePaymentBatchNoticeSnapshot(client: DbClient, batchId: string, snapshot: unknown) {
  await client.$executeRaw(
    Prisma.sql`UPDATE payment_batches SET notice_snapshot = ${JSON.stringify(snapshot)}::jsonb WHERE id = ${batchId}::uuid`,
  );
}
