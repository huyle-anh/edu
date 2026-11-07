import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { auditFields, type AuditContext } from "@/lib/audit";
import type { BankAccountCreate, BankAccountUpdate } from "../schemas/bank-account.schema";

export function listBankAccounts(includeInactive = false) {
  return prisma.bankAccount.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: [{ isActive: "desc" }, { bankName: "asc" }, { accountNo: "asc" }],
  });
}

export function createBankAccount(
  data: BankAccountCreate,
  actorId: string,
  auditContext?: AuditContext,
) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.bankAccount.create({
      data: {
        ...data,
        branchName: data.branchName || null,
        createdBy: actorId,
        updatedBy: actorId,
      },
    });
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "BANK_ACCOUNT",
        entityId: created.id,
        action: "CREATED",
        dataAfter: created,
        performedBy: actorId,
        ...auditFields(auditContext),
      },
    });
    return created;
  });
}

export async function updateBankAccount(
  id: string,
  data: BankAccountUpdate,
  actorId: string,
  auditContext?: AuditContext,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT id FROM bank_accounts WHERE id = ${id}::uuid FOR UPDATE
    `;
    const existing = await tx.bankAccount.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundError("Không tìm thấy tài khoản ngân hàng");

    const pendingBatch = await tx.paymentBatch.findFirst({
      where: { bankAccountId: id, status: "PENDING" },
      select: { batchNo: true },
    });
    const successfulBatch = await tx.paymentBatch.findFirst({
      where: { bankAccountId: id, status: "SUCCESS" },
      select: { batchNo: true },
    });
    if (pendingBatch && data.isActive === false) {
      throw new ConflictError(
        `Không thể ngưng tài khoản đang gắn với đợt thanh toán ${pendingBatch.batchNo}`,
      );
    }
    const accountDetailsChanged = [
        "bankCode",
        "bankName",
        "accountNo",
        "accountName",
        "branchName",
        "currencyCode",
      ].some((field) => data[field as keyof BankAccountUpdate] !== undefined);
    if (pendingBatch && accountDetailsChanged) {
      throw new ConflictError(
        `Không thể thay đổi thông tin tài khoản đang gắn với đợt thanh toán ${pendingBatch.batchNo}`,
      );
    }
    if (successfulBatch && accountDetailsChanged) {
      throw new ConflictError(
        `Không thể thay đổi thông tin tài khoản đã được sử dụng trong đợt thanh toán ${successfulBatch.batchNo}`,
      );
    }

    const updated = await tx.bankAccount.update({
      where: { id },
      data: {
        ...data,
        ...(data.branchName !== undefined
          ? { branchName: data.branchName || null }
          : {}),
        updatedBy: actorId,
      },
    });
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "BANK_ACCOUNT",
        entityId: id,
        action: "UPDATED",
        dataBefore: existing,
        dataAfter: updated,
        performedBy: actorId,
        ...auditFields(auditContext),
      },
    });
    return updated;
  });
}
