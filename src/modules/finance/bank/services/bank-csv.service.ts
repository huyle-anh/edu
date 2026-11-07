import crypto from "node:crypto";
import ExcelJS from "exceljs";
import { Prisma, PaymentBatchStatus, TuitionPaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/errors";
import { auditFields, type AuditContext } from "@/lib/audit";
import { completePaymentBatch } from "@/modules/finance/payments/services/payment-batch.service";

export type ParsedBankRow = {
  rowNo: number;
  transactionDate: Date;
  description: string;
  reconciliationContent: string;
  amount: Prisma.Decimal;
  balance: Prisma.Decimal | null;
  transactionNo: string | null;
  transactionNoIsExplicit?: boolean;
  raw: string;
};

type ParsedBankRowError = {
  rowNo: number;
  message: string;
};

type ParsedBankRows = {
  rows: ParsedBankRow[];
  errors: ParsedBankRowError[];
  totalRows: number;
  statement: BankStatementMetadata;
};

export type BankStatementMetadata = {
  bankFormat: "BIDV" | "TECHCOMBANK";
  fromDate: string | null;
  toDate: string | null;
  accountNo: string | null;
  accountName: string | null;
  currencyCode: string | null;
  openingBalance: Prisma.Decimal | null;
  closingBalance: Prisma.Decimal | null;
};

type ReconciliationStatus = "AUTO_MATCHED" | "UNMATCHED" | "IGNORED" | "DUPLICATED";

type ReconciliationTokenPayload = {
  version: 1;
  expiresAt: number;
  importSessionId?: string;
  bankAccountId: string;
  transactionHash: string;
  rowNo: number;
  transactionDate: string;
  bankTransactionNo: string | null;
  description: string;
  reconciliationContent?: string;
  creditAmount: string;
  debitAmount: string;
  balanceAmount: string | null;
  paymentBatchId: string | null;
  paymentBatchIds?: string[];
  reconciliationStatus?: ReconciliationStatus;
};

type BankStatementTokenPayload = {
  version: 1;
  expiresAt: number;
  importSessionId: string;
  bankAccountId: string;
  fileName: string;
  transactionRows: Array<{ rowNo: number; transactionHash: string }>;
  statement: {
    bankFormat: BankStatementMetadata["bankFormat"];
    fromDate: string | null;
    toDate: string | null;
    accountNo: string | null;
    accountName: string | null;
    currencyCode: string | null;
    openingBalance: string | null;
    closingBalance: string | null;
  };
  invalidRowErrors: ParsedBankRowError[];
};

export type PaymentBatchMatch = {
  id: string;
  batchNo: string;
  totalAmount: Prisma.Decimal;
  student: { id: string; code: string; fullName: string };
  allocations: Array<{
    tuitionFeeId: string;
    amount: Prisma.Decimal;
    tuitionFee: { feeNo: string; class: { name: string } };
  }>;
};

type PaymentBatchGroupMatch = {
  batchIds: string[];
  totalAmount: Prisma.Decimal;
  batches: PaymentBatchMatch[];
};

export type BankImportItem = {
  confirmationToken: string;
  rowNo: number;
  transactionDate: Date;
  bankTransactionNo: string | null;
  description: string;
  creditAmount: Prisma.Decimal;
  debitAmount: Prisma.Decimal;
  balanceAmount: Prisma.Decimal | null;
  reconciliationStatus: ReconciliationStatus;
  paymentBatch: PaymentBatchMatch | null;
  paymentBatchCandidates: Array<PaymentBatchMatch & { confirmationToken: string }>;
  paymentBatchGroupCandidates: Array<PaymentBatchGroupMatch & { confirmationToken: string }>;
  reconciliationContent: string;
};

export type BankImportResult = {
  sessionId: string;
  fileName: string;
  statementToken: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicatedRows: number;
  matchedRows: number;
  unmatchedRows: number;
  ignoredRows: number;
  invalidRowErrors: ParsedBankRowError[];
  items: BankImportItem[];
};

function parseMoney(value: string): Prisma.Decimal {
  const normalized = value.replace(/VND/gi, "").replace(/\s/g, "").trim();
  if (!normalized) return new Prisma.Decimal(0);

  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  let numberValue = normalized;
  if (lastComma >= 0 && lastDot >= 0) {
    numberValue = lastComma > lastDot
      ? normalized.replace(/\./g, "").replace(",", ".")
      : normalized.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const fractionLength = normalized.length - lastComma - 1;
    numberValue = fractionLength <= 2 ? normalized.replace(",", ".") : normalized.replace(/,/g, "");
  } else if ((normalized.match(/\./g) || []).length > 1) {
    numberValue = normalized.replace(/\./g, "");
  } else if (lastDot >= 0) {
    const fractionLength = normalized.length - lastDot - 1;
    numberValue = fractionLength <= 2 ? normalized : normalized.replace(/\./g, "");
  }

  try {
    return new Prisma.Decimal(numberValue);
  } catch {
    throw new Error(`Số tiền không hợp lệ: ${value}`);
  }
}

function findStatementValue(worksheet: ExcelJS.Worksheet, labels: string[]) {
  let result: string | null = null;
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    if (result) return;
    for (let column = 1; column < row.cellCount; column += 1) {
      const label = normalize(row.getCell(column).text);
      if (labels.includes(label)) {
        const value = row.getCell(column + 1).text.trim();
        if (value) {
          result = value;
          return;
        }
      }
    }
  });
  return result;
}

function parseOptionalMoney(value: string | null) {
  if (!value) return null;
  try {
    return parseMoney(value);
  } catch {
    return null;
  }
}

function extractStatementMetadata(
  worksheet: ExcelJS.Worksheet,
  bankFormat: BankStatementMetadata["bankFormat"],
): BankStatementMetadata {
  return {
    bankFormat,
    fromDate: findStatementValue(worksheet, ["tu ngay", "from date", "ngay bat dau"]),
    toDate: findStatementValue(worksheet, ["toi ngay", "den ngay", "to date", "ngay ket thuc"]),
    accountNo: findStatementValue(worksheet, ["so tai khoan", "account number"]),
    accountName: findStatementValue(worksheet, ["ten tai khoan", "account name"]),
    currencyCode: findStatementValue(worksheet, ["loai tien", "currency"]),
    openingBalance: parseOptionalMoney(
      findStatementValue(worksheet, ["so du dau ky", "so du dau", "opening balance"]),
    ),
    closingBalance: parseOptionalMoney(
      findStatementValue(worksheet, ["so du cuoi ky", "so du cuoi", "closing balance"]),
    ),
  };
}

function createVietnamDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
): Date {
  // ExcelJS exposes an Excel date as a JS Date whose UTC components represent
  // the wall-clock values displayed in the workbook. Convert that Vietnamese
  // local time to the UTC instant used by the API/database.
  const result = new Date(Date.UTC(year, month - 1, day, hour - 7, minute, second, millisecond));
  const vietnamDate = new Date(result.getTime() + 7 * 60 * 60 * 1000);
  if (
    vietnamDate.getUTCFullYear() !== year ||
    vietnamDate.getUTCMonth() !== month - 1 ||
    vietnamDate.getUTCDate() !== day ||
    vietnamDate.getUTCHours() !== hour ||
    vietnamDate.getUTCMinutes() !== minute ||
    vietnamDate.getUTCSeconds() !== second ||
    vietnamDate.getUTCMilliseconds() !== millisecond
  ) {
    throw new Error("Ngày giao dịch không hợp lệ");
  }
  return result;
}

function parseDate(value: string): Date {
  const text = value.trim();
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) throw new Error(`Ngày giao dịch không hợp lệ: ${value}`);
  const day = Number(match[1]);
  const month = Number(match[2]);
  const yearValue = Number(match[3]);
  const year = yearValue < 100 ? 2000 + yearValue : yearValue;
  const hour = Number(match[4] || 0);
  const minute = Number(match[5] || 0);
  const second = Number(match[6] || 0);
  try {
    return createVietnamDate(year, month, day, hour, minute, second);
  } catch {
    throw new Error(`Ngày giao dịch không hợp lệ: ${value}`);
  }
}

type BidvTableColumns = {
  date: number;
  description: number;
  amount: number;
  balance: number;
  transactionNo: number;
};

type TechcombankTableColumns = {
  date: number;
  description: number;
  reconciliationContent: number;
  detail: number;
  debit: number;
  credit: number;
  balance: number;
};

function findBidvTableHeader(worksheet: ExcelJS.Worksheet) {
  let header: { rowNumber: number; columns: BidvTableColumns } | null = null;
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (header) return;
    const cells = Array.from({ length: Math.max(row.cellCount, 5) }, (_, index) =>
      normalize(row.getCell(index + 1).text),
    );
    const findColumn = (name: string) => cells.findIndex((cell) => cell === name) + 1;
    const columns = {
      date: findColumn("ngay giao dich"),
      description: findColumn("noi dung giao dich"),
      amount: findColumn("so tien"),
      balance: findColumn("so du"),
      transactionNo: findColumn("ma giao dich"),
    };
    if (Object.values(columns).every((column) => column > 0)) {
      header = { rowNumber, columns };
    }
  });
  return header;
}

function parseExcelDate(value: unknown, text: string): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return createVietnamDate(
      value.getUTCFullYear(),
      value.getUTCMonth() + 1,
      value.getUTCDate(),
      value.getUTCHours(),
      value.getUTCMinutes(),
      value.getUTCSeconds(),
      value.getUTCMilliseconds(),
    );
  }
  return parseDate(text);
}

function parseBidvTable(worksheet: ExcelJS.Worksheet, header: { rowNumber: number; columns: BidvTableColumns }) {
  const rows: ParsedBankRow[] = [];
  const errors: ParsedBankRowError[] = [];
  let totalRows = 0;
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= header.rowNumber) return;
    const dateCell = row.getCell(header.columns.date);
    const dateText = dateCell.text.trim();
    if (!dateText) return;
    const amountText = row.getCell(header.columns.amount).text.trim();
    if (!amountText) return;
    totalRows += 1;
    try {
      rows.push({
        rowNo: rowNumber,
        transactionDate: parseExcelDate(dateCell.value, dateText),
        description: row.getCell(header.columns.description).text.trim(),
        reconciliationContent: "",
        amount: parseMoney(amountText),
        balance: parseMoney(row.getCell(header.columns.balance).text),
        transactionNo: row.getCell(header.columns.transactionNo).text.trim() || null,
        transactionNoIsExplicit: true,
        raw: Array.from({ length: row.cellCount }, (_, index) => row.getCell(index + 1).text).join("|"),
      });
    } catch (error) {
      errors.push({
        rowNo: rowNumber,
        message: error instanceof Error ? error.message : "Dòng sao kê không hợp lệ",
      });
    }
  });
  if (!totalRows) throw new BadRequestError("File Excel BIDV không có dữ liệu giao dịch");
  return { rows, errors, totalRows };
}

function findTechcombankTableHeader(worksheet: ExcelJS.Worksheet) {
  let header: { rowNumber: number; columns: TechcombankTableColumns } | null = null;
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (header) return;
    const cells = Array.from({ length: Math.max(row.cellCount, 7) }, (_, index) =>
      normalize(row.getCell(index + 1).text),
    );
    const findColumn = (name: string) => cells.findIndex((cell) => cell === name) + 1;
    const columns = {
      date: findColumn("ngay"),
      description: findColumn("dien giai"),
      reconciliationContent: findColumn("noi dung doi soat"),
      detail: findColumn("chi tiet"),
      debit: findColumn("no"),
      credit: findColumn("co"),
      balance: findColumn("so du"),
    };
    if ([columns.date, columns.description, columns.detail, columns.debit, columns.credit, columns.balance]
      .every((column) => column > 0)) {
      header = { rowNumber, columns };
    }
  });
  return header;
}

function parseTechcombankTable(
  worksheet: ExcelJS.Worksheet,
  header: { rowNumber: number; columns: TechcombankTableColumns },
) {
  const rows: ParsedBankRow[] = [];
  const errors: ParsedBankRowError[] = [];
  let totalRows = 0;
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= header.rowNumber) return;
    const dateCell = row.getCell(header.columns.date);
    const dateText = dateCell.text.trim();
    if (!dateText) return;

    const debitText = row.getCell(header.columns.debit).text.trim();
    const creditText = row.getCell(header.columns.credit).text.trim();
    if (!debitText && !creditText) return;
    totalRows += 1;
    try {
      const debit = debitText ? parseMoney(debitText) : new Prisma.Decimal(0);
      const credit = creditText ? parseMoney(creditText) : new Prisma.Decimal(0);
      if (debit.greaterThan(0) && credit.greaterThan(0)) {
        throw new Error(`Dòng ${rowNumber} trong file Techcombank có cả ghi nợ và ghi có`);
      }
      const detail = row.getCell(header.columns.detail).text.trim();
      const reconciliationContent = header.columns.reconciliationContent
        ? row.getCell(header.columns.reconciliationContent).text.trim()
        : "";
      const description = [row.getCell(header.columns.description).text.trim(), detail]
        .filter(Boolean)
        .join(" | ");
      rows.push({
        rowNo: rowNumber,
        transactionDate: parseExcelDate(dateCell.value, dateText),
        description,
        reconciliationContent,
        amount: credit.greaterThan(0) ? credit : debit.mul(-1),
        balance: parseMoney(row.getCell(header.columns.balance).text),
        // Techcombank's CHI TIET is narrative content, not a transaction ID.
        transactionNo: detail || null,
        transactionNoIsExplicit: false,
        raw: Array.from({ length: row.cellCount }, (_, index) => row.getCell(index + 1).text).join("|"),
      });
    } catch (error) {
      errors.push({
        rowNo: rowNumber,
        message: error instanceof Error ? error.message : "Dòng sao kê không hợp lệ",
      });
    }
  });
  if (!totalRows) throw new BadRequestError("File Excel Techcombank không có dữ liệu giao dịch");
  return { rows, errors, totalRows };
}

export async function parseBidvExcel(buffer: Buffer): Promise<ParsedBankRows> {
  const workbook = new ExcelJS.Workbook();
  const excelBuffer = buffer as unknown as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(excelBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new BadRequestError("File Excel BIDV không có worksheet");

  const tableHeader = findBidvTableHeader(worksheet);
  if (!tableHeader) throw new BadRequestError("File Excel BIDV không đúng format bảng hiện tại");
  return { ...parseBidvTable(worksheet, tableHeader), statement: extractStatementMetadata(worksheet, "BIDV") };
}

export async function parseTechcombankExcel(buffer: Buffer): Promise<ParsedBankRows> {
  const workbook = new ExcelJS.Workbook();
  const excelBuffer = buffer as unknown as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(excelBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new BadRequestError("File Excel Techcombank không có worksheet");
  const tableHeader = findTechcombankTableHeader(worksheet);
  if (!tableHeader) throw new BadRequestError("Không tìm thấy bảng giao dịch trong file Excel Techcombank");
  return { ...parseTechcombankTable(worksheet, tableHeader), statement: extractStatementMetadata(worksheet, "TECHCOMBANK") };
}

async function parseBankStatement(buffer: Buffer, bankCode: string) {
  switch (bankCode.trim().toUpperCase()) {
    case "BIDV":
      return parseBidvExcel(buffer);
    case "TCB":
    case "TECHCOMBANK":
      return parseTechcombankExcel(buffer);
    default:
      throw new ConflictError(`Chưa hỗ trợ định dạng sao kê của ngân hàng ${bankCode}`);
  }
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
}

function normalizeBankAccountNumber(value: string) {
  return value.replace(/[\s-]/g, "");
}

function normalizeBatchReference(value: string) {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

function getBankTransactionNo(row: ParsedBankRow) {
  return row.transactionNoIsExplicit === false ? null : row.transactionNo?.trim() || null;
}

function hashTransactionIdentity(identity: string) {
  return crypto.createHash("sha256").update(identity).digest("hex");
}

function getTransactionHashes(bankAccountId: string, row: ParsedBankRow) {
  const transactionNo = getBankTransactionNo(row);
  const identity = transactionNo
    ? `${bankAccountId}:transaction-no:${transactionNo}`
    : `${bankAccountId}:row:${row.transactionDate.toISOString()}:${row.amount.toString()}:${normalize(row.description)}:${normalize(row.reconciliationContent)}:${row.balance?.toString() ?? ""}`;
  const transactionHash = hashTransactionIdentity(identity);
  const legacyTransactionHashes = row.transactionNoIsExplicit === false
    ? [
        // Preserve duplicate protection for TCB rows imported before CHI TIET
        // was correctly treated as narrative rather than as a transaction number.
        ...(row.transactionNo?.trim()
          ? [hashTransactionIdentity(`${bankAccountId}:transaction-no:${row.transactionNo.trim()}`)]
          : []),
        // Preserve rows imported with the previous raw-row identity while new
        // imports use a format-stable identity.
        ...(!transactionNo
          ? [hashTransactionIdentity(`${bankAccountId}:row:${row.raw}`)]
          : []),
      ]
    : [];
  return { transactionHash, legacyTransactionHashes };
}

function getTokenSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set and at least 32 characters");
  return secret;
}

function createConfirmationToken(payload: ReconciliationTokenPayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", getTokenSecret()).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function createStatementToken(payload: BankStatementTokenPayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", getTokenSecret()).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

export function verifyBankStatementToken(token: string): BankStatementTokenPayload {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) throw new ConflictError("Token phiên sao kê không hợp lệ");
  const expected = crypto.createHmac("sha256", getTokenSecret()).update(encodedPayload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) throw new ConflictError("Token phiên sao kê không hợp lệ");

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    throw new ConflictError("Token phiên sao kê không hợp lệ");
  }
  if (
    !isRecord(decoded) ||
    decoded.version !== 1 ||
    typeof decoded.expiresAt !== "number" ||
    decoded.expiresAt < Date.now() ||
    typeof decoded.importSessionId !== "string" ||
    typeof decoded.bankAccountId !== "string" ||
    typeof decoded.fileName !== "string" ||
    !Array.isArray(decoded.transactionRows) ||
    decoded.transactionRows.some(
      (row) => !isRecord(row) || typeof row.rowNo !== "number" || typeof row.transactionHash !== "string",
    ) ||
    !isRecord(decoded.statement) ||
    !["BIDV", "TECHCOMBANK"].includes(decoded.statement.bankFormat as string) ||
    (decoded.statement.fromDate !== null && typeof decoded.statement.fromDate !== "string") ||
    (decoded.statement.toDate !== null && typeof decoded.statement.toDate !== "string") ||
    (decoded.statement.accountNo !== null && typeof decoded.statement.accountNo !== "string") ||
    (decoded.statement.accountName !== null && typeof decoded.statement.accountName !== "string") ||
    (decoded.statement.currencyCode !== null && typeof decoded.statement.currencyCode !== "string") ||
    (decoded.statement.openingBalance !== null && typeof decoded.statement.openingBalance !== "string") ||
    (decoded.statement.closingBalance !== null && typeof decoded.statement.closingBalance !== "string") ||
    !Array.isArray(decoded.invalidRowErrors) ||
    decoded.invalidRowErrors.some(
      (error) => !isRecord(error) || typeof error.rowNo !== "number" || typeof error.message !== "string",
    )
  ) throw new ConflictError("Token phiên sao kê không hợp lệ");
  return decoded as BankStatementTokenPayload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function verifyConfirmationToken(token: string): ReconciliationTokenPayload {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) throw new ConflictError("Token đối soát không hợp lệ");
  const expected = crypto.createHmac("sha256", getTokenSecret()).update(encodedPayload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) throw new ConflictError("Token đối soát không hợp lệ");

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    throw new ConflictError("Token đối soát không hợp lệ");
  }
  if (
    !isRecord(decoded) ||
    decoded.version !== 1 ||
    typeof decoded.expiresAt !== "number" ||
    decoded.expiresAt < Date.now() ||
    typeof decoded.bankAccountId !== "string" ||
    typeof decoded.transactionHash !== "string" ||
    typeof decoded.rowNo !== "number" ||
    typeof decoded.transactionDate !== "string" ||
    (decoded.bankTransactionNo !== null && typeof decoded.bankTransactionNo !== "string") ||
    typeof decoded.description !== "string" ||
    (decoded.reconciliationContent !== undefined && typeof decoded.reconciliationContent !== "string") ||
    typeof decoded.creditAmount !== "string" ||
    typeof decoded.debitAmount !== "string" ||
    (decoded.balanceAmount !== null && typeof decoded.balanceAmount !== "string") ||
    (decoded.paymentBatchId !== null && typeof decoded.paymentBatchId !== "string") ||
    (decoded.paymentBatchIds !== undefined &&
      (!Array.isArray(decoded.paymentBatchIds) ||
        decoded.paymentBatchIds.length < 2 ||
        decoded.paymentBatchIds.some((batchId) => typeof batchId !== "string")))
    ||
    (decoded.reconciliationStatus !== undefined &&
      !["AUTO_MATCHED", "UNMATCHED", "IGNORED", "DUPLICATED"].includes(decoded.reconciliationStatus as string))
  ) throw new ConflictError("Token đối soát không hợp lệ");
  return decoded as ReconciliationTokenPayload;
}

export function verifyBankReconciliationToken(token: string) {
  return verifyConfirmationToken(token);
}

function createTokenPayload(
  importSessionId: string,
  bankAccountId: string,
  transactionHash: string,
  row: ParsedBankRow,
  paymentBatchId: string | null,
  paymentBatchIds?: string[],
  reconciliationStatus?: ReconciliationStatus,
): ReconciliationTokenPayload {
  return {
    version: 1,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    importSessionId,
    bankAccountId,
    transactionHash,
    rowNo: row.rowNo,
    transactionDate: row.transactionDate.toISOString(),
    bankTransactionNo: getBankTransactionNo(row),
    description: row.description,
    reconciliationContent: row.reconciliationContent,
    creditAmount: row.amount.toString(),
    debitAmount: row.amount.isNegative() ? row.amount.abs().toString() : "0",
    balanceAmount: row.balance?.toString() ?? null,
    paymentBatchId,
    ...(paymentBatchIds?.length ? { paymentBatchIds } : {}),
    ...(reconciliationStatus ? { reconciliationStatus } : {}),
  };
}

export function findExactBatchGroups(
  batches: PaymentBatchMatch[],
  targetAmount: Prisma.Decimal,
  reservedBatchIds: Set<string>,
  maxGroups = 20,
  maxBatchCount = 8,
): PaymentBatchMatch[][] {
  const candidatesByStudent = new Map<string, PaymentBatchMatch[]>();
  for (const batch of batches) {
    if (reservedBatchIds.has(batch.id) || !batch.totalAmount.lessThan(targetAmount)) continue;
    const studentBatches = candidatesByStudent.get(batch.student.id) ?? [];
    studentBatches.push(batch);
    candidatesByStudent.set(batch.student.id, studentBatches);
  }
  const groups: PaymentBatchMatch[][] = [];
  let visited = 0;

  function visit(
    candidates: PaymentBatchMatch[],
    start: number,
    total: Prisma.Decimal,
    selected: PaymentBatchMatch[],
  ) {
    if (groups.length >= maxGroups || selected.length >= maxBatchCount || visited >= 100_000) return;
    for (let index = start; index < candidates.length; index += 1) {
      visited += 1;
      const candidate = candidates[index]!;
      const nextTotal = total.add(candidate.totalAmount);
      if (nextTotal.greaterThan(targetAmount)) continue;
      const nextSelected = [...selected, candidate];
      if (nextTotal.equals(targetAmount)) {
        if (nextSelected.length >= 2) groups.push(nextSelected);
        continue;
      }
      visit(candidates, index + 1, nextTotal, nextSelected);
      if (groups.length >= maxGroups) return;
    }
  }

  for (const studentBatches of candidatesByStudent.values()) {
    studentBatches.sort((left, right) => left.totalAmount.comparedTo(right.totalAmount));
    visit(studentBatches, 0, new Prisma.Decimal(0), []);
    if (groups.length >= maxGroups || visited >= 100_000) break;
  }
  return groups;
}

function toPaymentBatchMatch(batch: PaymentBatchMatch): PaymentBatchMatch {
  return {
    id: batch.id,
    batchNo: batch.batchNo,
    totalAmount: batch.totalAmount,
    student: batch.student,
    allocations: batch.allocations.map((allocation) => ({
      tuitionFeeId: allocation.tuitionFeeId,
      amount: allocation.amount,
      tuitionFee: {
        feeNo: allocation.tuitionFee.feeNo,
        class: allocation.tuitionFee.class,
      },
    })),
  };
}

export async function importBankStatement(args: {
  buffer: Buffer;
  fileName: string;
  bankAccountId: string;
  actorId: string;
  auditContext?: AuditContext;
}): Promise<BankImportResult> {
  const bank = await prisma.bankAccount.findUnique({
    where: { id: args.bankAccountId },
    select: { id: true, isActive: true, bankCode: true, accountNo: true },
  });
  if (!bank) throw new NotFoundError("Không tìm thấy tài khoản ngân hàng");
  if (!bank.isActive) throw new ConflictError("Tài khoản ngân hàng đã ngừng hoạt động");
  const parsed = await parseBankStatement(args.buffer, bank.bankCode);
  if (
    parsed.statement.accountNo &&
    normalizeBankAccountNumber(parsed.statement.accountNo) !== normalizeBankAccountNumber(bank.accountNo)
  ) {
    throw new ConflictError("Số tài khoản trong file sao kê không khớp tài khoản đã chọn");
  }
  const { rows, errors: invalidRowErrors } = parsed;
  const importSessionId = crypto.randomUUID();

  const rowHashes = rows.map((row) => getTransactionHashes(args.bankAccountId, row));
  const transactionHashes = rowHashes.flatMap(({ transactionHash, legacyTransactionHashes }) => [
    transactionHash,
    ...legacyTransactionHashes,
  ]);
  const transactionNumbers = rows
    .map((row) => getBankTransactionNo(row))
    .filter((value): value is string => Boolean(value));
  const existingPayments = await prisma.tuitionPayment.findMany({
    where: {
      paymentStatus: {
        in: [
          TuitionPaymentStatus.SUCCESS,
          TuitionPaymentStatus.CANCELLED,
          TuitionPaymentStatus.REFUNDED,
        ],
      },
      bankAccountId: args.bankAccountId,
      OR: [
        { transactionReference: { in: transactionHashes } },
        ...(transactionNumbers.length ? [{ bankTransactionNo: { in: transactionNumbers } }] : []),
      ],
    },
    select: { transactionReference: true, bankTransactionNo: true },
  });
  const existingReferences = new Set(
    existingPayments.flatMap((payment) => [payment.transactionReference, payment.bankTransactionNo]),
  );

  const pendingBatches = await prisma.paymentBatch.findMany({
    where: {
      status: PaymentBatchStatus.PENDING,
      paymentMethod: "BANK_TRANSFER",
      bankAccountId: args.bankAccountId,
    },
    orderBy: { createdAt: "asc" },
    include: {
      student: true,
      allocations: {
        include: {
          tuitionFee: { include: { class: { select: { name: true } } } },
        },
      },
    },
  });

  const importedHashes = new Set<string>();
  const autoMatchCandidatesByRow = new Map<number, PaymentBatchMatch>();
  const autoMatchCandidateCounts = new Map<string, number>();

  for (const [index, row] of rows.entries()) {
    if (!row.amount.greaterThan(0)) continue;
    const description = normalizeBatchReference(
      [row.description, row.reconciliationContent].filter(Boolean).join(" "),
    );
    const candidates = pendingBatches.filter(
      (candidate) =>
        candidate.totalAmount.equals(row.amount) &&
        description.includes(normalizeBatchReference(candidate.batchNo)),
    );
    if (candidates.length === 1) {
      const candidate = candidates[0]!;
      autoMatchCandidatesByRow.set(index, candidate);
      autoMatchCandidateCounts.set(
        candidate.id,
        (autoMatchCandidateCounts.get(candidate.id) || 0) + 1,
      );
    }
  }
  const reservedAutoMatchedBatchIds = new Set(
    [...autoMatchCandidateCounts.entries()]
      .filter(([, count]) => count === 1)
      .map(([batchId]) => batchId),
  );

  const items: BankImportItem[] = [];
  let duplicatedRows = 0;
  let matchedRows = 0;
  let unmatchedRows = 0;
  let ignoredRows = 0;

  for (const [index, row] of rows.entries()) {
    const { transactionHash } = rowHashes[index]!;
    const transactionNumber = getBankTransactionNo(row);
    const isCredit = row.amount.greaterThan(0);
    const isDuplicate =
      importedHashes.has(transactionHash) ||
      rowHashes[index]!.legacyTransactionHashes.some((hash) => importedHashes.has(hash)) ||
      existingReferences.has(transactionHash) ||
      rowHashes[index]!.legacyTransactionHashes.some((hash) => existingReferences.has(hash)) ||
      (transactionNumber !== null && existingReferences.has(transactionNumber));
    const initialStatus: ReconciliationStatus = isDuplicate
      ? "DUPLICATED"
      : isCredit
        ? "UNMATCHED"
        : "IGNORED";
    const baseItem = {
      confirmationToken: createConfirmationToken(
        createTokenPayload(importSessionId, args.bankAccountId, transactionHash, row, null, undefined, initialStatus),
      ),
      rowNo: row.rowNo,
      transactionDate: row.transactionDate,
      bankTransactionNo: transactionNumber,
      description: row.description,
      reconciliationContent: row.reconciliationContent,
      creditAmount: isCredit ? row.amount : new Prisma.Decimal(0),
      debitAmount: isCredit ? new Prisma.Decimal(0) : row.amount.abs(),
      balanceAmount: row.balance,
      reconciliationStatus: (isCredit ? "UNMATCHED" : "IGNORED") as ReconciliationStatus,
      paymentBatch: null as BankImportItem["paymentBatch"],
      paymentBatchCandidates: [] as BankImportItem["paymentBatchCandidates"],
      paymentBatchGroupCandidates: [] as BankImportItem["paymentBatchGroupCandidates"],
    };
    if (isDuplicate) {
      duplicatedRows += 1;
      items.push({ ...baseItem, reconciliationStatus: "DUPLICATED" });
      continue;
    }
    importedHashes.add(transactionHash);

    if (!isCredit) {
      ignoredRows += 1;
      items.push(baseItem);
      continue;
    }

    const autoMatchCandidate = autoMatchCandidatesByRow.get(index);
    const batch =
      autoMatchCandidate &&
      autoMatchCandidateCounts.get(autoMatchCandidate.id) === 1 &&
      autoMatchCandidate;
    if (batch) {
      matchedRows += 1;
      const paymentBatch = toPaymentBatchMatch(batch);
      items.push({
        ...baseItem,
        confirmationToken: createConfirmationToken(
          createTokenPayload(importSessionId, args.bankAccountId, transactionHash, row, batch.id, undefined, "AUTO_MATCHED"),
        ),
        reconciliationStatus: "AUTO_MATCHED",
        paymentBatch,
      });
      continue;
    }
    unmatchedRows += 1;

    const paymentBatchCandidates = pendingBatches
      .filter(
        (candidate) =>
          candidate.totalAmount.equals(row.amount) &&
          !reservedAutoMatchedBatchIds.has(candidate.id),
      )
      .map((candidate) => ({
        ...toPaymentBatchMatch(candidate),
        confirmationToken: createConfirmationToken(
          createTokenPayload(importSessionId, args.bankAccountId, transactionHash, row, candidate.id, undefined, "UNMATCHED"),
        ),
      }));
    const paymentBatchGroups = findExactBatchGroups(
      pendingBatches.map(toPaymentBatchMatch),
      row.amount,
      reservedAutoMatchedBatchIds,
    ).map((batches) => {
      const batchIds = batches.map((batch) => batch.id);
      return {
        batchIds,
        totalAmount: row.amount,
        batches,
        confirmationToken: createConfirmationToken(
          createTokenPayload(importSessionId, args.bankAccountId, transactionHash, row, null, batchIds, "UNMATCHED"),
        ),
      };
    });

    items.push({
      ...baseItem,
      paymentBatchCandidates,
      paymentBatchGroupCandidates: paymentBatchGroups,
    });
  }

  const result = {
    sessionId: importSessionId,
    fileName: args.fileName,
    statementToken: createStatementToken({
      version: 1,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      importSessionId,
      bankAccountId: args.bankAccountId,
      fileName: args.fileName,
      transactionRows: rows.map((row, index) => ({
        rowNo: row.rowNo,
        transactionHash: rowHashes[index]!.transactionHash,
      })),
      statement: {
        ...parsed.statement,
        openingBalance: parsed.statement.openingBalance?.toString() ?? null,
        closingBalance: parsed.statement.closingBalance?.toString() ?? null,
      },
      invalidRowErrors,
    }),
    statement: {
      ...parsed.statement,
      openingBalance: parsed.statement.openingBalance?.toString() ?? null,
      closingBalance: parsed.statement.closingBalance?.toString() ?? null,
    },
    totalRows: parsed.totalRows,
    validRows: rows.length,
    invalidRows: invalidRowErrors.length,
    duplicatedRows,
    matchedRows,
    unmatchedRows,
    ignoredRows,
    invalidRowErrors,
    items,
  };
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "bank_statement_import_sessions" (
        "id", "bank_account_id", "file_name", "bank_format", "statement_from_date", "statement_to_date",
        "account_no", "account_name", "currency_code", "opening_balance", "closing_balance",
        "total_rows", "valid_rows", "invalid_rows", "duplicated_rows", "matched_rows", "unmatched_rows",
        "ignored_rows", "invalid_row_errors", "performed_by"
      ) VALUES (
        ${importSessionId}::uuid, ${args.bankAccountId}::uuid, ${args.fileName}, ${parsed.statement.bankFormat},
        ${parsed.statement.fromDate}, ${parsed.statement.toDate}, ${parsed.statement.accountNo},
        ${parsed.statement.accountName}, ${parsed.statement.currencyCode}, ${parsed.statement.openingBalance},
        ${parsed.statement.closingBalance}, ${result.totalRows}, ${result.validRows}, ${result.invalidRows},
        ${result.duplicatedRows}, ${result.matchedRows}, ${result.unmatchedRows}, ${result.ignoredRows},
        ${JSON.stringify(result.invalidRowErrors)}::jsonb, ${args.actorId}::uuid
      )
    `);
    for (const [index, row] of rows.entries()) {
      const item = items[index]!;
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "bank_statement_import_rows" (
          "session_id", "row_no", "transaction_hash", "transaction_date", "bank_transaction_no",
          "description", "reconciliation_content", "credit_amount", "debit_amount", "balance_amount",
          "status", "payment_batch_candidate_count", "payment_batch_group_candidate_count", "raw_data"
        ) VALUES (
          ${importSessionId}::uuid, ${row.rowNo}, ${rowHashes[index]!.transactionHash}, ${row.transactionDate},
          ${item.bankTransactionNo}, ${item.description}, ${item.reconciliationContent}, ${item.creditAmount},
          ${item.debitAmount}, ${item.balanceAmount}, ${item.reconciliationStatus}::bank_statement_row_status,
          ${item.paymentBatchCandidates.length}, ${item.paymentBatchGroupCandidates.length}, ${row.raw}
        )
      `);
    }
    const persistedRows = await tx.$queryRaw<Array<{ id: string; rowNo: number }>>(Prisma.sql`
      SELECT "id", "row_no" AS "rowNo"
      FROM "bank_statement_import_rows"
      WHERE "session_id" = ${importSessionId}::uuid
    `);
    const rowIdByRowNo = new Map(persistedRows.map((row) => [row.rowNo, row.id]));
    const suggestedMatches = items.flatMap((item) => {
      if (item.reconciliationStatus !== "AUTO_MATCHED" || !item.paymentBatch) return [];
      const rowId = rowIdByRowNo.get(item.rowNo);
      return rowId ? [{ rowId, paymentBatchId: item.paymentBatch.id, isConfirmed: false }] : [];
    });
    if (suggestedMatches.length) {
      for (const suggestedMatch of suggestedMatches) {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "bank_statement_import_row_batches" ("row_id", "payment_batch_id", "is_confirmed")
          VALUES (${suggestedMatch.rowId}::uuid, ${suggestedMatch.paymentBatchId}::uuid, false)
        `);
      }
    }
    await tx.tuitionAuditLog.createMany({
      data: items.map((item, index) => ({
        entityType: "BANK_ACCOUNT",
        entityId: args.bankAccountId,
        action: `STATEMENT_ROW_${item.reconciliationStatus}`,
        dataAfter: {
          sessionId: importSessionId,
          fileName: args.fileName,
          rowNo: item.rowNo,
          transactionHash: rowHashes[index]?.transactionHash ?? null,
          bankTransactionNo: item.bankTransactionNo,
          creditAmount: item.creditAmount.toString(),
          debitAmount: item.debitAmount.toString(),
          paymentBatchId: item.paymentBatch?.id ?? null,
        },
        performedBy: args.actorId,
        ...auditFields(args.auditContext),
      })),
    });
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "BANK_ACCOUNT",
        entityId: args.bankAccountId,
        action: "STATEMENT_IMPORTED",
        reason: args.fileName,
        dataAfter: {
          sessionId: importSessionId,
          fileName: args.fileName,
          totalRows: result.totalRows,
          matchedRows: result.matchedRows,
          unmatchedRows: result.unmatchedRows,
          duplicatedRows: result.duplicatedRows,
          ignoredRows: result.ignoredRows,
          invalidRows: result.invalidRows,
        },
        performedBy: args.actorId,
        ...auditFields(args.auditContext),
      },
    });
  });
  return result;
}

async function recordConfirmedStatementRow(
  tx: Prisma.TransactionClient,
  payload: ReconciliationTokenPayload,
  batchIds: string[],
) {
  if (!payload.importSessionId) return;
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "bank_statement_import_rows"
    WHERE "session_id" = ${payload.importSessionId}::uuid
      AND "row_no" = ${payload.rowNo}
      AND "transaction_hash" = ${payload.transactionHash}
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) throw new ConflictError("Không tìm thấy dòng sao kê cần lưu kết quả đối soát");
  await tx.$executeRaw(Prisma.sql`
    DELETE FROM "bank_statement_import_row_batches" WHERE "row_id" = ${row.id}::uuid
  `);
  if (batchIds.length) {
    for (const paymentBatchId of batchIds) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "bank_statement_import_row_batches" ("row_id", "payment_batch_id", "is_confirmed")
        VALUES (${row.id}::uuid, ${paymentBatchId}::uuid, true)
      `);
    }
  }
  await tx.$executeRaw(Prisma.sql`
    UPDATE "bank_statement_import_rows"
    SET "status" = 'CONFIRMED'::bank_statement_row_status
    WHERE "id" = ${row.id}::uuid
  `);
  await tx.$executeRaw(Prisma.sql`
    UPDATE "bank_statement_import_sessions" session
    SET
      "matched_rows" = counts."matchedRows",
      "unmatched_rows" = counts."unmatchedRows",
      "duplicated_rows" = counts."duplicatedRows",
      "ignored_rows" = counts."ignoredRows"
    FROM (
      SELECT
        count(*) FILTER (WHERE "status" IN ('AUTO_MATCHED', 'CONFIRMED'))::int AS "matchedRows",
        count(*) FILTER (WHERE "status" = 'UNMATCHED')::int AS "unmatchedRows",
        count(*) FILTER (WHERE "status" = 'DUPLICATED')::int AS "duplicatedRows",
        count(*) FILTER (WHERE "status" = 'IGNORED')::int AS "ignoredRows"
      FROM "bank_statement_import_rows"
      WHERE "session_id" = ${payload.importSessionId}::uuid
    ) counts
    WHERE session."id" = ${payload.importSessionId}::uuid
  `);
}

async function confirmPaymentBatch(
  payload: ReconciliationTokenPayload,
  batchId: string,
  actorId: string,
  transaction?: Prisma.TransactionClient,
  auditContext?: AuditContext,
) {
  if (payload.paymentBatchId !== batchId) throw new ConflictError("Đợt thanh toán không thuộc giao dịch ngân hàng này");
  const execute = async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`bank-reconciliation:${payload.transactionHash}`}))`);
    if (payload.bankTransactionNo) {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`bank-reconciliation-no:${payload.bankAccountId}:${payload.bankTransactionNo}`}))`,
      );
    }
    const existingBatch = await tx.paymentBatch.findFirst({
      where: {
        id: { not: batchId },
        bankAccountId: payload.bankAccountId,
        OR: [
          { transactionReference: payload.transactionHash },
          ...(payload.bankTransactionNo
            ? [{ bankTransactionNo: payload.bankTransactionNo }]
            : []),
        ],
      },
    });
    if (existingBatch) {
      throw new ConflictError(
        "Giao dịch ngân hàng đã được xác nhận",
        "STATEMENT_DUPLICATE",
      );
    }

    const batch = await tx.paymentBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundError("Không tìm thấy đợt thanh toán");
    if (batch.status !== PaymentBatchStatus.PENDING) {
      throw new ConflictError(
        "Đợt thanh toán không còn chờ xử lý",
        batch.status === PaymentBatchStatus.SUCCESS
          ? "PAYMENT_ALREADY_CONFIRMED"
          : undefined,
      );
    }
    if (batch.paymentMethod !== "BANK_TRANSFER")
      throw new ConflictError("Chỉ payment batch chuyển khoản mới được đối soát ngân hàng");
    if (batch.bankAccountId !== payload.bankAccountId)
      throw new ConflictError("Tài khoản ngân hàng không khớp với đợt thanh toán");
    if (!new Prisma.Decimal(payload.creditAmount).equals(batch.totalAmount)) {
      throw new ConflictError(
        "Số tiền ghi có không khớp với tổng đợt thanh toán",
        "PAYMENT_AMOUNT_MISMATCH",
      );
    }
    const completed = await completePaymentBatch(tx, batchId, actorId, {
      paymentDate: new Date(payload.transactionDate),
      bankAccountId: payload.bankAccountId,
      bankTransactionNo: payload.bankTransactionNo || undefined,
      transactionReference: payload.transactionHash,
      paymentContent: payload.description,
    }, auditContext);
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "PAYMENT_BATCH",
        entityId: batchId,
        action: "BANK_RECONCILIATION_CONFIRMED",
        dataAfter: {
          transactionHash: payload.transactionHash,
          bankAccountId: payload.bankAccountId,
          bankTransactionNo: payload.bankTransactionNo,
          rowNo: payload.rowNo,
          transactionDate: payload.transactionDate,
          creditAmount: payload.creditAmount,
        },
        performedBy: actorId,
        ...auditFields(auditContext),
      },
    });
    await recordConfirmedStatementRow(tx, payload, [batchId]);
    return completed;
  };
  return transaction ? execute(transaction) : prisma.$transaction(execute);
}

export async function confirmBankReconciliation(args: {
  confirmationToken: string;
  batchId: string;
  actorId: string;
  auditContext?: AuditContext;
}) {
  const payload = verifyConfirmationToken(args.confirmationToken);
  if (new Prisma.Decimal(payload.debitAmount).greaterThan(0)) throw new ConflictError("Không thể đối soát giao dịch ghi nợ");
  return confirmPaymentBatch(
    payload,
    args.batchId,
    args.actorId,
    undefined,
    args.auditContext,
  );
}

export async function confirmBankReconciliationGroup(args: {
  confirmationToken: string;
  batchIds: string[];
  actorId: string;
  auditContext?: AuditContext;
}) {
  const payload = verifyConfirmationToken(args.confirmationToken);
  if (new Prisma.Decimal(payload.debitAmount).greaterThan(0)) {
    throw new ConflictError("Không thể đối soát giao dịch ghi nợ");
  }
  const batchIds = [...new Set(args.batchIds)].sort();
  const tokenBatchIds = [...new Set(payload.paymentBatchIds || [])].sort();
  if (
    batchIds.length < 2 ||
    tokenBatchIds.length !== batchIds.length ||
    tokenBatchIds.some((batchId, index) => batchId !== batchIds[index])
  ) {
    throw new ConflictError("Danh sách đợt thanh toán trong token không khớp");
  }

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`bank-reconciliation:${payload.transactionHash}`}))`,
    );
    if (payload.bankTransactionNo) {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`bank-reconciliation-no:${payload.bankAccountId}:${payload.bankTransactionNo}`}))`,
      );
    }

    const existingBatch = await tx.paymentBatch.findFirst({
      where: {
        id: { notIn: batchIds },
        bankAccountId: payload.bankAccountId,
        OR: [
          { transactionReference: payload.transactionHash },
          ...(payload.bankTransactionNo
            ? [{ bankTransactionNo: payload.bankTransactionNo }]
            : []),
        ],
      },
      select: { batchNo: true },
    });
    if (existingBatch) {
      throw new ConflictError(
        `Giao dịch ngân hàng đã được xác nhận cho đợt ${existingBatch.batchNo}`,
        "STATEMENT_DUPLICATE",
      );
    }

    const batches = await tx.paymentBatch.findMany({
      where: { id: { in: batchIds } },
      select: {
        id: true,
        studentId: true,
        status: true,
        paymentMethod: true,
        bankAccountId: true,
        totalAmount: true,
      },
    });
    if (batches.length !== batchIds.length) {
      throw new NotFoundError("Không tìm thấy đầy đủ các đợt thanh toán");
    }
    if (batches.some((batch) => batch.status !== PaymentBatchStatus.PENDING)) {
      throw new ConflictError("Một hoặc nhiều đợt thanh toán không còn chờ xử lý");
    }
    if (batches.some((batch) => batch.paymentMethod !== "BANK_TRANSFER")) {
      throw new ConflictError("Chỉ có thể gộp các đợt thanh toán chuyển khoản");
    }
    if (new Set(batches.map((batch) => batch.studentId)).size !== 1) {
      throw new ConflictError("Chỉ có thể gộp các đợt thanh toán của cùng một học sinh");
    }
    if (batches.some((batch) => batch.bankAccountId !== payload.bankAccountId)) {
      throw new ConflictError("Tài khoản ngân hàng không khớp với một hoặc nhiều đợt thanh toán");
    }
    const totalAmount = batches.reduce(
      (total, batch) => total.add(batch.totalAmount),
      new Prisma.Decimal(0),
    );
    if (!totalAmount.equals(new Prisma.Decimal(payload.creditAmount))) {
      throw new ConflictError(
        "Tổng các đợt thanh toán không khớp số tiền giao dịch ngân hàng",
        "PAYMENT_AMOUNT_MISMATCH",
      );
    }

    const completed = [];
    for (const batchId of batchIds) {
      const completedBatch = await completePaymentBatch(tx, batchId, args.actorId, {
        paymentDate: new Date(payload.transactionDate),
        bankAccountId: payload.bankAccountId,
        bankTransactionNo: payload.bankTransactionNo || undefined,
        transactionReference: payload.transactionHash,
        paymentContent: payload.description,
      }, args.auditContext);
      await tx.tuitionAuditLog.create({
        data: {
          entityType: "PAYMENT_BATCH",
          entityId: batchId,
          action: "BANK_RECONCILIATION_GROUP_CONFIRMED",
          dataAfter: {
            transactionHash: payload.transactionHash,
            bankAccountId: payload.bankAccountId,
            bankTransactionNo: payload.bankTransactionNo,
            rowNo: payload.rowNo,
            transactionDate: payload.transactionDate,
            creditAmount: payload.creditAmount,
            batchIds,
            groupTotalAmount: totalAmount.toString(),
          },
          performedBy: args.actorId,
          ...auditFields(args.auditContext),
        },
      });
      completed.push(completedBatch);
    }
    await recordConfirmedStatementRow(tx, payload, batchIds);
    return { confirmedCount: completed.length, batches: completed };
  });
}

export async function confirmBankReconciliations(args: {
  confirmations: Array<{ confirmationToken: string; batchId: string }>;
  actorId: string;
  auditContext?: AuditContext;
}) {
  const payloads = args.confirmations.map((confirmation) => {
    const payload = verifyConfirmationToken(confirmation.confirmationToken);
    if (new Prisma.Decimal(payload.debitAmount).greaterThan(0)) {
      throw new ConflictError("Không thể đối soát giao dịch ghi nợ");
    }
    return { ...confirmation, payload };
  });

  return prisma.$transaction(async (tx) => {
    const completed = [];
    for (const confirmation of payloads) {
      completed.push(
        await confirmPaymentBatch(
          confirmation.payload,
          confirmation.batchId,
          args.actorId,
          tx,
          args.auditContext,
        ),
      );
    }
    return { confirmedCount: completed.length, batches: completed };
  });
}
