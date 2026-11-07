import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { ConflictError } from "@/lib/errors";
import { assignStudentToClass } from "@/modules/class/services/class.service";

type ParsedClassStudentRow = {
  rowNo: number;
  code: string;
};

export type ClassStudentImportResult = {
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  errors: Array<{ rowNo: number; message: string }>;
};

const CODE_HEADERS = new Set([
  "ma hoc vien",
  "ma hoc sinh",
  "student code",
  "code",
]);

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getCellText(cell: ExcelJS.Cell): string {
  return cell.text.trim();
}

async function readStudentCodes(buffer: Buffer): Promise<{
  rows: ParsedClassStudentRow[];
  errors: ClassStudentImportResult["errors"];
}> {
  const workbook = new ExcelJS.Workbook();
  const excelBuffer = buffer as unknown as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(excelBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new ConflictError("File Excel không có sheet dữ liệu");

  const maxHeaderRow = Math.min(worksheet.rowCount, 30);
  let headerRowNumber = 0;
  let codeColumnNumber = 0;

  for (let rowNumber = 1; rowNumber <= maxHeaderRow && !codeColumnNumber; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    for (let columnNumber = 1; columnNumber <= row.cellCount; columnNumber += 1) {
      if (CODE_HEADERS.has(normalizeHeader(getCellText(row.getCell(columnNumber))))) {
        headerRowNumber = rowNumber;
        codeColumnNumber = columnNumber;
        break;
      }
    }
  }

  if (!codeColumnNumber) {
    throw new ConflictError("File Excel phải có cột Mã học viên");
  }

  const rows: ParsedClassStudentRow[] = [];
  const errors: ClassStudentImportResult["errors"] = [];
  const seenCodes = new Set<string>();

  for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const code = getCellText(row.getCell(codeColumnNumber));
    const firstCell = getCellText(row.getCell(1));
    const hasData = Array.from({ length: row.cellCount }, (_, index) =>
      getCellText(row.getCell(index + 1)),
    ).some(Boolean);

    if (!hasData) continue;
    if (normalizeHeader(firstCell).startsWith("ghi chu")) break;

    if (!code) {
      errors.push({ rowNo: rowNumber, message: "Thiếu mã học viên" });
      continue;
    }

    const normalizedCode = code.toLocaleLowerCase();
    if (seenCodes.has(normalizedCode)) {
      errors.push({ rowNo: rowNumber, message: "Mã học viên bị lặp: " + code });
      continue;
    }

    seenCodes.add(normalizedCode);
    rows.push({ rowNo: rowNumber, code });
  }

  if (rows.length === 0 && errors.length === 0) {
    throw new ConflictError("File Excel không có dữ liệu học viên");
  }

  return { rows, errors };
}

export async function importStudentsToClass(
  classId: string,
  buffer: Buffer,
  classSubjectIds: string[],
  actorId: string,
): Promise<ClassStudentImportResult> {
  if (buffer.length > 10 * 1024 * 1024) {
    throw new ConflictError("File Excel không được vượt quá 10 MB");
  }

  const { rows, errors } = await readStudentCodes(buffer);
  const totalRows = rows.length + errors.length;
  const students = await prisma.student.findMany({
    where: { code: { in: rows.map((row) => row.code) } },
    select: { id: true, code: true },
  });
  const studentByCode = new Map(
    students.map((student) => [student.code.toLocaleLowerCase(), student]),
  );
  let importedRows = 0;

  for (const row of rows) {
    const student = studentByCode.get(row.code.toLocaleLowerCase());
    if (!student) {
      errors.push({
        rowNo: row.rowNo,
        message: "Không tìm thấy học viên có mã " + row.code,
      });
      continue;
    }

    try {
      await assignStudentToClass(classId, student.id, classSubjectIds, actorId);
      importedRows += 1;
    } catch (error: unknown) {
      errors.push({
        rowNo: row.rowNo,
        message: error instanceof Error
          ? error.message
          : "Không thể đăng ký mã " + row.code,
      });
    }
  }

  return {
    totalRows,
    importedRows,
    skippedRows: totalRows - importedRows,
    errors,
  };
}
