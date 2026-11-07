import ExcelJS from "exceljs";
import type { Student } from "@prisma/client";

const border = {
  top: { style: "thin" as const, color: { argb: "FFD9E2EC" } },
  left: { style: "thin" as const, color: { argb: "FFD9E2EC" } },
  bottom: { style: "thin" as const, color: { argb: "FFD9E2EC" } },
  right: { style: "thin" as const, color: { argb: "FFD9E2EC" } },
};

const colors = {
  navy: "FF1F4E78",
  blue: "FFD9EAF7",
  lightBlue: "FFF5FAFD",
  gray: "FFF2F2F2",
  green: "FFE2F0D9",
  red: "FFFCE4D6",
};

function formatDate(value: Date | null) {
  if (!value) return "";

  const day = String(value.getUTCDate()).padStart(2, "0");
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${value.getUTCFullYear()}`;
}

function styleCell(
  cell: ExcelJS.Cell,
  alignment: Partial<ExcelJS.Alignment> = {},
) {
  cell.font = { name: "Arial", size: 11 };
  cell.border = border;
  cell.alignment = { vertical: "middle", wrapText: true, ...alignment };
}

function setFill(cell: ExcelJS.Cell, argb: string) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
}

export async function buildStudentListExcel(
  students: Student[],
  filterDescription?: string,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EduCenter";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Danh sách học viên");
  worksheet.columns = [
    { width: 20 },
    { width: 28 },
    { width: 14 },
    { width: 28 },
    { width: 18 },
    { width: 36 },
    { width: 20 },
  ];
  worksheet.views = [{ state: "frozen", ySplit: 4 }];

  worksheet.mergeCells("A1:G1");
  worksheet.getCell("A1").value = "DANH SÁCH HỌC VIÊN";
  worksheet.getRow(1).height = 28;
  styleCell(worksheet.getCell("A1"), { horizontal: "center" });
  worksheet.getCell("A1").font = {
    name: "Arial",
    size: 14,
    bold: true,
    color: { argb: colors.navy },
  };

  worksheet.mergeCells("A2:G2");
  worksheet.getCell("A2").value = filterDescription
    ? `Bộ lọc: ${filterDescription}`
    : "Bộ lọc: Tất cả học viên";
  worksheet.getRow(2).height = 22;
  styleCell(worksheet.getCell("A2"), { horizontal: "left" });
  worksheet.getCell("A2").font = {
    name: "Arial",
    size: 10,
    italic: true,
    color: { argb: "FF5B7083" },
  };

  worksheet.mergeCells("A3:G3");
  worksheet.getCell("A3").value = `Tổng số: ${students.length} học viên`;
  worksheet.getRow(3).height = 22;
  styleCell(worksheet.getCell("A3"), { horizontal: "left" });
  worksheet.getCell("A3").font = {
    name: "Arial",
    size: 10,
    color: { argb: "FF5B7083" },
  };

  const headers = [
    "MÃ HỌC VIÊN",
    "HỌ TÊN",
    "NGÀY SINH",
    "PHỤ HUYNH",
    "SỐ ĐIỆN THOẠI",
    "ĐỊA CHỈ",
    "TRẠNG THÁI",
  ];
  headers.forEach((header, index) => {
    const cell = worksheet.getRow(4).getCell(index + 1);
    cell.value = header;
    styleCell(cell, { horizontal: "center" });
    cell.font = {
      name: "Arial",
      size: 11,
      bold: true,
      color: { argb: colors.navy },
    };
    setFill(cell, colors.blue);
  });
  worksheet.getRow(4).height = 28;

  students.forEach((student, index) => {
    const row = worksheet.getRow(index + 5);
    row.values = [
      student.code,
      student.fullName,
      formatDate(student.birthday),
      student.parentName ?? "",
      student.phone ?? "",
      student.address ?? "",
      student.status === "ACTIVE" ? "Đang hoạt động" : "Ngừng hoạt động",
    ];
    row.height = 24;
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      styleCell(cell, {
        horizontal: [1, 3, 5, 7].includes(columnNumber) ? "center" : "left",
      });
    });

    setFill(row.getCell(7), student.status === "ACTIVE" ? colors.green : colors.red);
    if (index % 2 === 1) {
      row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        if (columnNumber !== 7) setFill(cell, colors.lightBlue);
      });
    }
  });

  worksheet.autoFilter = {
    from: "A4",
    to: `G${Math.max(4, students.length + 4)}`,
  };

  const noteRow = Math.max(5, students.length + 6);
  worksheet.mergeCells(`A${noteRow}:G${noteRow}`);
  worksheet.getCell(`A${noteRow}`).value =
    "Ghi chú: File được xuất theo bộ lọc hiện tại trên màn hình quản lý học viên.";
  styleCell(worksheet.getCell(`A${noteRow}`), { horizontal: "left" });
  setFill(worksheet.getCell(`A${noteRow}`), colors.gray);
  worksheet.getRow(noteRow).height = 24;

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
