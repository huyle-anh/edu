import { z } from "zod";

const reportAllocationSchema = z.object({
  amount: z.coerce.number().nonnegative(),
  tuitionFee: z.object({
    feeNo: z.string(),
    class: z.object({ name: z.string() }),
  }),
});

const reportBatchSchema = z.object({
  batchNo: z.string(),
  totalAmount: z.coerce.number().nonnegative(),
  student: z.object({ code: z.string(), fullName: z.string() }),
  allocations: z.array(reportAllocationSchema),
});

export const reportItemDataSchema = z.object({
  rowNo: z.number().int().positive(),
  transactionDate: z.string().min(1),
  bankTransactionNo: z.string().nullable(),
  description: z.string(),
  reconciliationContent: z.string(),
  creditAmount: z.coerce.number().nonnegative(),
  debitAmount: z.coerce.number().nonnegative(),
  balanceAmount: z.coerce.number().nullable(),
  reconciliationStatus: z.enum([
    "AUTO_MATCHED",
    "UNMATCHED",
    "IGNORED",
    "DUPLICATED",
    "CONFIRMED",
  ]),
  paymentBatches: z.array(reportBatchSchema),
  receiptNos: z.array(z.string()),
  paymentBatchCandidateCount: z.number().int().nonnegative(),
  paymentBatchGroupCandidateCount: z.number().int().nonnegative(),
});

const reportItemRequestSchema = z.object({
  confirmationToken: z.string().min(1),
  mappingConfirmationToken: z.string().min(1).nullable(),
});

export const bankReconciliationReportSchema = z.object({
  bankAccountId: z.string().uuid(),
  statementToken: z.string().min(1),
  scope: z.enum(["ALL", "MATCHED", "UNMATCHED"]).default("ALL"),
  items: z.array(reportItemRequestSchema).max(10000),
});

const reportDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày báo cáo không hợp lệ");

export const bankReconciliationDateReportSchema = z.object({
  bankAccountId: z.string().uuid(),
  fromDate: reportDateSchema,
  toDate: reportDateSchema,
  scope: z.enum(["ALL", "MATCHED", "UNMATCHED"]).default("ALL"),
}).superRefine((value, context) => {
  if (value.fromDate > value.toDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["toDate"],
      message: "Đến ngày phải lớn hơn hoặc bằng Từ ngày",
    });
  }
});

export type BankReconciliationReportInput = z.infer<
  typeof bankReconciliationReportSchema
>;

export type BankReconciliationDateReportInput = z.infer<
  typeof bankReconciliationDateReportSchema
>;

export type BankReconciliationReportItem = z.infer<typeof reportItemDataSchema>;

export type BankReconciliationReportDocument = {
  fileName: string;
  bankName: string;
  accountNo: string;
  accountName: string;
  statement: {
    bankFormat: "BIDV" | "TECHCOMBANK" | "MIXED";
    fromDate: string | null;
    toDate: string | null;
    accountNo: string | null;
    accountName: string | null;
    currencyCode: string | null;
    openingBalance: number | null;
    closingBalance: number | null;
  };
  invalidRowErrors: Array<{ rowNo: number; message: string }>;
  scope: "ALL" | "MATCHED" | "UNMATCHED";
  items: BankReconciliationReportItem[];
  balanceItems: BankReconciliationReportItem[];
  balanceCheck: {
    openingBalance: string | null;
    closingBalance: string | null;
    totalCredit: string;
    totalDebit: string;
    variance: string | null;
  };
};
