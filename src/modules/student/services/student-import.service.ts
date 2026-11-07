import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BadRequestError, ConflictError } from "@/lib/errors";
import { generateStudentCode } from "@/modules/student/services/student.service";
import { studentCreateSchema } from "@/modules/student/schemas/student.schema";

type CsvDelimiter = "," | ";" | "\t";

type ParsedStudentRow = {
  rowNo: number;
  fullName: string;
  phone: string | null;
  address: string | null;
};

export type StudentImportResult = {
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  errors: Array<{ rowNo: number; message: string }>;
};

function decodeCsv(buffer: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(buffer).replace(/^\uFEFF/, "");
  }
}

function countDelimiter(line: string, delimiter: CsvDelimiter): number {
  let count = 0;
  let quoted = false;

  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) count += 1;
  }

  return count;
}

function detectDelimiter(line: string): CsvDelimiter {
  const delimiters: CsvDelimiter[] = [",", ";", "\t"];
  return delimiters.reduce((selected, delimiter) =>
    countDelimiter(line, delimiter) > countDelimiter(line, selected)
      ? delimiter
      : selected,
  ",");
}

function parseCsvLine(line: string, delimiter: CsvDelimiter): string[] {
  const columns: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      columns.push(value.trim());
      value = "";
    } else {
      value += char;
    }
  }

  columns.push(value.trim());
  return columns;
}

function normalizePhone(value: string): string | null {
  const phone = value.replace(/[.\s()-]/g, "");
  return phone || null;
}

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const FULL_NAME_HEADERS = new Set([
  "ho ten",
  "ho va ten",
  "ten hoc vien",
  "student name",
  "full name",
  "name",
]);
const LAST_NAME_HEADERS = new Set(["ho", "ho dem", "last name"]);
const FIRST_NAME_HEADERS = new Set(["ten", "first name"]);
const PHONE_HEADERS = new Set([
  "so dien thoai",
  "sdt",
  "phone",
  "mobile",
  "telephone",
]);
const ADDRESS_HEADERS = new Set([
  "dia chi",
  "address",
  "dang ky",
  "ma dang ky",
  "lop",
  "class",
]);

function getHeaderMapping(columns: string[]) {
  const headers = columns.map(normalizeHeader);
  const fullNameIndex = headers.findIndex((header) => FULL_NAME_HEADERS.has(header));
  const lastNameIndex = headers.findIndex((header) => LAST_NAME_HEADERS.has(header));
  const firstNameIndex = headers.findIndex((header) => FIRST_NAME_HEADERS.has(header));
  const phoneIndex = headers.findIndex((header) => PHONE_HEADERS.has(header));
  const addressIndex = headers.findIndex((header) => ADDRESS_HEADERS.has(header));
  const hasHeader = headers.some(
    (header) =>
      FULL_NAME_HEADERS.has(header) ||
      LAST_NAME_HEADERS.has(header) ||
      FIRST_NAME_HEADERS.has(header) ||
      PHONE_HEADERS.has(header) ||
      ADDRESS_HEADERS.has(header) ||
      header === "stt" ||
      header === "ma" ||
      header === "ma hoc vien",
  );

  if (!hasHeader) return null;
  if (fullNameIndex < 0 && (lastNameIndex < 0 || firstNameIndex < 0)) {
    throw new ConflictError(
      "CSV phải có cột Họ tên hoặc đủ hai cột Họ và Tên",
    );
  }

  return {
    fullNameIndex: fullNameIndex >= 0 ? fullNameIndex : null,
    lastNameIndex: lastNameIndex >= 0 ? lastNameIndex : null,
    firstNameIndex: firstNameIndex >= 0 ? firstNameIndex : null,
    phoneIndex: phoneIndex >= 0 ? phoneIndex : null,
    addressIndex: addressIndex >= 0 ? addressIndex : null,
  };
}

function parseStudentCsv(buffer: Buffer): { rows: ParsedStudentRow[]; errors: StudentImportResult["errors"] } {
  const lines = decodeCsv(buffer).split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) throw new BadRequestError("File CSV không có dữ liệu");

  const delimiter = detectDelimiter(lines[0]!);
  const rows: ParsedStudentRow[] = [];
  const errors: StudentImportResult["errors"] = [];

  const firstColumns = parseCsvLine(lines[0]!, delimiter);
  const headerMapping = getHeaderMapping(firstColumns);
  const firstDataIndex = headerMapping ? 1 : 0;

  lines.slice(firstDataIndex).forEach((line, offset) => {
    const index = offset + firstDataIndex;
    const rowNo = index + 1;
    const columns = parseCsvLine(line, delimiter);
    let fullName: string;
    let phone: string | null;
    let address: string | null;

    if (headerMapping) {
      const nameParts = headerMapping.fullNameIndex !== null
        ? [columns[headerMapping.fullNameIndex] ?? ""]
        : [
            columns[headerMapping.lastNameIndex!] ?? "",
            columns[headerMapping.firstNameIndex!] ?? "",
          ];
      fullName = nameParts.join(" ").replace(/\s+/g, " ").trim();
      phone = normalizePhone(
        headerMapping.phoneIndex === null
          ? ""
          : columns[headerMapping.phoneIndex] ?? "",
      );
      address = headerMapping.addressIndex === null
        ? null
        : (columns[headerMapping.addressIndex] ?? "").trim() || null;
    } else if (
      columns.length >= 5 &&
      (columns[1] ?? "").trim() &&
      !(columns[2] ?? "").trim() &&
      !(columns[3] ?? "").trim()
    ) {
      // Registration-list format: đăng ký/lớp; họ tên; empty; empty; số điện thoại.
      address = (columns[0] ?? "").trim() || null;
      fullName = (columns[1] ?? "").trim();
      phone = normalizePhone(columns[4] ?? "");
    } else if (columns.length >= 4) {
      // Backward-compatible format: STT, Họ, Tên, Số điện thoại.
      fullName = `${columns[1] ?? ""} ${columns[2] ?? ""}`
        .replace(/\s+/g, " ")
        .trim();
      phone = normalizePhone(columns[3] ?? "");
      address = null;
    } else {
      // Headerless compact format: Họ tên, Số điện thoại.
      fullName = (columns[0] ?? "").trim();
      phone = normalizePhone(columns[1] ?? "");
      address = null;
    }

    if (!fullName) {
      errors.push({ rowNo, message: "Thiếu họ tên" });
      return;
    }

    rows.push({ rowNo, fullName, phone, address });
  });

  if (rows.length === 0 && errors.length === 0) {
    throw new BadRequestError("File CSV không có dữ liệu học viên");
  }

  return { rows, errors };
}

function studentKey(fullName: string, phone: string | null): string {
  return `${fullName.trim().toLocaleLowerCase()}|${phone ?? ""}`;
}

export async function importStudentsCsv(
  buffer: Buffer,
): Promise<StudentImportResult> {
  if (buffer.length > 5 * 1024 * 1024) {
    throw new ConflictError("File CSV không được vượt quá 5 MB");
  }

  const { rows, errors } = parseStudentCsv(buffer);
  const totalRows = rows.length + errors.length;
  const importedRows = await prisma.$transaction(async (tx) => {
    const existingStudents = await tx.student.findMany({
      select: { fullName: true, phone: true },
    });
    const knownStudents = new Set(
      existingStudents.map((student) => studentKey(student.fullName, student.phone)),
    );
    const importedKeys = new Set<string>();
    let imported = 0;

    for (const row of rows) {
      const validated = studentCreateSchema.safeParse({
        fullName: row.fullName,
        phone: row.phone ?? undefined,
        address: row.address ?? undefined,
        status: "ACTIVE",
      });
      if (!validated.success) {
        const message = validated.error.issues[0]?.message ?? "Dữ liệu học viên không hợp lệ";
        errors.push({ rowNo: row.rowNo, message });
        continue;
      }

      const key = studentKey(validated.data.fullName, validated.data.phone ?? null);
      if (knownStudents.has(key) || importedKeys.has(key)) continue;

      const code = await generateStudentCode(tx);
      try {
        await tx.student.create({
          data: {
            code,
            fullName: validated.data.fullName,
            phone: validated.data.phone || null,
            address: validated.data.address || null,
            status: "ACTIVE",
          },
        });
      } catch (error: unknown) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new ConflictError("Mã học viên tự động bị trùng, vui lòng import lại");
        }
        throw error;
      }

      knownStudents.add(key);
      importedKeys.add(key);
      imported += 1;
    }

    return imported;
  });

  return {
    totalRows,
    importedRows,
    skippedRows: totalRows - importedRows,
    errors,
  };
}
