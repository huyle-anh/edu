import { Prisma } from "@prisma/client";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type {
  BankReconciliationDateReportInput,
  BankReconciliationReportDocument,
  BankReconciliationReportItem,
} from "@/modules/finance/bank/schemas/bank-reconciliation-report.schema";

function vietnamDateStart(value: string, label: string) {
  const date = new Date(`${value}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) throw new ConflictError(`${label} không hợp lệ`);
  return date;
}

function invalidRowErrors(value: Prisma.JsonValue | null): Array<{ rowNo: number; message: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return [];
    const rowNo = "rowNo" in item && typeof item.rowNo === "number" ? item.rowNo : null;
    const message = "message" in item && typeof item.message === "string" ? item.message : null;
    return rowNo !== null && message !== null ? [{ rowNo, message }] : [];
  });
}

function toStatus(value: string): BankReconciliationReportItem["reconciliationStatus"] {
  if (["AUTO_MATCHED", "UNMATCHED", "IGNORED", "DUPLICATED", "CONFIRMED"].includes(value)) {
    return value as BankReconciliationReportItem["reconciliationStatus"];
  }
  throw new ConflictError("Trạng thái dòng sao kê không hợp lệ");
}

type HistoricalRow = {
  id: string;
  transactionHash: string;
  rowNo: number;
  transactionDate: Date;
  bankTransactionNo: string | null;
  description: string;
  reconciliationContent: string;
  creditAmount: Prisma.Decimal;
  debitAmount: Prisma.Decimal;
  balanceAmount: Prisma.Decimal | null;
  status: string;
  paymentBatchCandidateCount: number;
  paymentBatchGroupCandidateCount: number;
  fileName: string;
  bankFormat: string;
  invalidRowErrors: Prisma.JsonValue | null;
  sessionCreatedAt: Date;
};

type HistoricalRowBatch = {
  rowId: string;
  paymentBatchId: string;
};

export async function buildHistoricalBankReconciliationReport(
  input: BankReconciliationDateReportInput,
): Promise<BankReconciliationReportDocument> {
  const from = vietnamDateStart(input.fromDate, "Từ ngày");
  const toExclusive = new Date(vietnamDateStart(input.toDate, "Đến ngày").getTime() + 24 * 60 * 60 * 1000);
  const account = await prisma.bankAccount.findUnique({
    where: { id: input.bankAccountId },
    select: { id: true, bankName: true, accountNo: true, accountName: true },
  });
  if (!account) throw new NotFoundError("Không tìm thấy tài khoản ngân hàng");

  const importedRows = await prisma.$queryRaw<HistoricalRow[]>(Prisma.sql`
    SELECT
      row."id",
      row."transaction_hash" AS "transactionHash",
      row."row_no" AS "rowNo",
      row."transaction_date" AS "transactionDate",
      row."bank_transaction_no" AS "bankTransactionNo",
      row."description",
      row."reconciliation_content" AS "reconciliationContent",
      row."credit_amount" AS "creditAmount",
      row."debit_amount" AS "debitAmount",
      row."balance_amount" AS "balanceAmount",
      row."status"::text AS "status",
      row."payment_batch_candidate_count" AS "paymentBatchCandidateCount",
      row."payment_batch_group_candidate_count" AS "paymentBatchGroupCandidateCount",
      session."file_name" AS "fileName",
      session."bank_format" AS "bankFormat",
      session."invalid_row_errors" AS "invalidRowErrors",
      session."created_at" AS "sessionCreatedAt"
    FROM "bank_statement_import_rows" row
    JOIN "bank_statement_import_sessions" session ON session."id" = row."session_id"
    WHERE session."bank_account_id" = ${account.id}::uuid
      AND row."transaction_date" >= ${from}
      AND row."transaction_date" < ${toExclusive}
    ORDER BY row."transaction_date" ASC, row."id" ASC
  `);
  const latestRowsByTransaction = new Map<string, HistoricalRow>();
  for (const row of importedRows) {
    // Re-imported copies are useful for the session audit, but should not add a
    // second transaction to the consolidated date-range report.
    if (row.status === "DUPLICATED") continue;
    const current = latestRowsByTransaction.get(row.transactionHash);
    const isConfirmed = row.status === "CONFIRMED";
    const currentIsConfirmed = current?.status === "CONFIRMED";
    if (
      !current ||
      (isConfirmed && !currentIsConfirmed) ||
      (isConfirmed === currentIsConfirmed && row.sessionCreatedAt > current.sessionCreatedAt)
    ) {
      latestRowsByTransaction.set(row.transactionHash, row);
    }
  }
  const rows = [...latestRowsByTransaction.values()].sort(
    (left, right) => left.transactionDate.getTime() - right.transactionDate.getTime() || left.rowNo - right.rowNo,
  );
  const rowBatches = rows.length
    ? await prisma.$queryRaw<HistoricalRowBatch[]>(Prisma.sql`
        SELECT "row_id" AS "rowId", "payment_batch_id" AS "paymentBatchId"
        FROM "bank_statement_import_row_batches"
        WHERE "row_id" IN (${Prisma.join(rows.map((row) => Prisma.sql`${row.id}::uuid`))})
      `)
    : [];
  const batchIds = [...new Set(rowBatches.map((link) => link.paymentBatchId))];
  const batches = batchIds.length
    ? await prisma.paymentBatch.findMany({
        where: { id: { in: batchIds } },
        select: {
          id: true,
          batchNo: true,
          totalAmount: true,
          student: { select: { code: true, fullName: true } },
          allocations: {
            select: {
              amount: true,
              tuitionFee: { select: { feeNo: true, class: { select: { name: true } } } },
            },
          },
          receipt: { select: { receiptNo: true } },
        },
      })
    : [];
  const batchesById = new Map(batches.map((batch) => [batch.id, batch]));
  const batchIdsByRowId = new Map<string, string[]>();
  rowBatches.forEach((link) => {
    const ids = batchIdsByRowId.get(link.rowId) || [];
    ids.push(link.paymentBatchId);
    batchIdsByRowId.set(link.rowId, ids);
  });

  const items = rows.map<BankReconciliationReportItem>((row) => ({
    rowNo: row.rowNo,
    transactionDate: row.transactionDate.toISOString(),
    bankTransactionNo: row.bankTransactionNo,
    description: row.description,
    reconciliationContent: row.reconciliationContent,
    creditAmount: row.creditAmount.toNumber(),
    debitAmount: row.debitAmount.toNumber(),
    balanceAmount: row.balanceAmount?.toNumber() ?? null,
    reconciliationStatus: toStatus(row.status),
    paymentBatches: (batchIdsByRowId.get(row.id) || []).flatMap((batchId) => {
      const paymentBatch = batchesById.get(batchId);
      if (!paymentBatch) return [];
      return [{
        batchNo: paymentBatch.batchNo,
        totalAmount: paymentBatch.totalAmount.toNumber(),
        student: paymentBatch.student,
        allocations: paymentBatch.allocations.map((allocation) => ({
          amount: allocation.amount.toNumber(),
          tuitionFee: allocation.tuitionFee,
        })),
      }];
    }),
    receiptNos: (batchIdsByRowId.get(row.id) || [])
      .map((batchId) => batchesById.get(batchId)?.receipt?.receiptNo)
      .filter((receiptNo): receiptNo is string => Boolean(receiptNo)),
    paymentBatchCandidateCount: row.paymentBatchCandidateCount,
    paymentBatchGroupCandidateCount: row.paymentBatchGroupCandidateCount,
  }));

  const selectedItems = items.filter((item) =>
    input.scope === "MATCHED"
      ? ["AUTO_MATCHED", "CONFIRMED"].includes(item.reconciliationStatus)
      : input.scope === "UNMATCHED"
        ? item.reconciliationStatus === "UNMATCHED"
        : true,
  );
  const formats = [...new Set(rows.map((row) => row.bankFormat))];
  const bankFormat = formats.length === 1 && (formats[0] === "BIDV" || formats[0] === "TECHCOMBANK")
    ? formats[0]
    : "MIXED";
  const financialItems = selectedItems.filter(
    (item) => item.reconciliationStatus !== "DUPLICATED",
  );
  const totalCredit = financialItems.reduce((sum, item) => sum.add(item.creditAmount), new Prisma.Decimal(0));
  const totalDebit = financialItems.reduce((sum, item) => sum.add(item.debitAmount), new Prisma.Decimal(0));
  const invalidRows = rows.flatMap((row) => invalidRowErrors(row.invalidRowErrors));
  const fileNames = [...new Set(rows.map((row) => row.fileName))];

  return {
    fileName: fileNames.length ? fileNames.join(", ") : "Không có phiên sao kê",
    bankName: account.bankName,
    accountNo: account.accountNo,
    accountName: account.accountName,
    statement: {
      bankFormat,
      fromDate: input.fromDate,
      toDate: input.toDate,
      accountNo: account.accountNo,
      accountName: account.accountName,
      currencyCode: "VND",
      openingBalance: null,
      closingBalance: null,
    },
    invalidRowErrors: invalidRows,
    scope: input.scope,
    items: selectedItems,
    balanceItems: items,
    balanceCheck: {
      openingBalance: null,
      closingBalance: null,
      totalCredit: totalCredit.toString(),
      totalDebit: totalDebit.toString(),
      variance: null,
    },
  };
}
