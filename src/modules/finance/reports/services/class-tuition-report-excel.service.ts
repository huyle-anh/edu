import ExcelJS from "exceljs";
import type { ClassTuitionReport } from "@/modules/finance/reports/services/class-tuition-report.service";

const border = {
  top: { style: "thin" as const, color: { argb: "FFD7E0E8" } },
  left: { style: "thin" as const, color: { argb: "FFD7E0E8" } },
  bottom: { style: "thin" as const, color: { argb: "FFD7E0E8" } },
  right: { style: "thin" as const, color: { argb: "FFD7E0E8" } },
};

const moneyFormat = '#,##0 "₫";[Red]-#,##0 "₫";-';
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const colors = {
  navy: "FF17324D",
  accent: "FF168C8C",
  blue: "FFE8F0F6",
  lightBlue: "FFF5F8FA",
  green: "FFE4F3EA",
  yellow: "FFFFF4DB",
  orange: "FFFFE9E3",
  gray: "FFF1F4F7",
  white: "FFFFFFFF",
};

function styleRange(
  worksheet: ExcelJS.Worksheet,
  range: string,
  style: Partial<ExcelJS.Style>,
) {
  worksheet.getCell(range).style = style;
}

function toVietnamExcelDate(value: Date) {
  return new Date(value.getTime() + VIETNAM_OFFSET_MS);
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatEnrollmentStatus(status: string) {
  return status === "LEFT" ? "Đã rời lớp" : status === "ACTIVE" ? "Đang học" : status === "COMPLETED" ? "Đã hoàn thành" : status === "SUSPENDED" ? "Tạm ngưng" : status;
}

function formatTuitionStatus(status: string) {
  const labels: Record<string, string> = {
    UNPAID: "Chưa thu",
    PARTIAL: "Thu một phần",
    PAID: "Đã thu đủ",
    OVERDUE: "Quá hạn",
    EXEMPTED: "Được miễn",
    CANCELLED: "Đã hủy",
    NO_FEE: "Chưa tạo học phí",
  };
  return status.split(", ").map((item) => labels[item] ?? item).join(", ");
}

export async function buildClassTuitionReportExcel(
  report: ClassTuitionReport,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EduCenter";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Báo cáo học phí");
  worksheet.columns = [
    { key: "stt", width: 8 },
    { key: "studentCode", width: 18 },
    { key: "studentName", width: 32 },
    { key: "enrollmentStatus", width: 18 },
    { key: "tuitionStatus", width: 20 },
    { key: "assessedAmount", width: 20 },
    { key: "paidInPeriodAmount", width: 23 },
    { key: "paidCumulativeAmount", width: 24 },
    { key: "outstandingAmount", width: 20 },
    { key: "note", width: 18 },
  ];
  worksheet.properties.defaultRowHeight = 18;
  worksheet.views = [{ state: "frozen", ySplit: 7 }];
  worksheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: worksheet.pageSetup.paperSize,
    margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
  };
  worksheet.mergeCells("A1:J1");
  worksheet.mergeCells("A2:J2");
  worksheet.mergeCells("A3:B3");
  worksheet.mergeCells("C3:J3");
  worksheet.mergeCells("A4:J4");
  worksheet.mergeCells("A5:J5");
  worksheet.mergeCells("A6:A7");
  worksheet.mergeCells("B6:B7");
  worksheet.mergeCells("C6:C7");
  worksheet.mergeCells("D6:D7");
  worksheet.mergeCells("E6:E7");
  worksheet.mergeCells("F6:F7");
  worksheet.mergeCells("G6:G7");
  worksheet.mergeCells("H6:H7");
  worksheet.mergeCells("I6:I7");
  worksheet.mergeCells("J6:J7");

  worksheet.getCell("A1").value = "TRUNG TÂM ĐÀO TẠO";
  worksheet.getCell("A2").value = "BÁO CÁO THU HỌC PHÍ THEO LỚP / MÔN";
  worksheet.getCell("A3").value = `T${Number(report.month.slice(5))}/${report.month.slice(0, 4)}`;
  worksheet.getCell("C3").value = `LỚP: ${report.classCode} - ${report.className}`;
  worksheet.getCell("A4").value = `Môn: ${report.subjectName}  |  GV: ${report.teacherCode} - ${report.teacherName}`;
  worksheet.getCell("A5").value = `KỲ HỌC PHÍ: ${report.month}  |  THỜI GIAN THU: ${formatDate(report.fromDate)} đến ${formatDate(report.toDate)}  |  DƯ NỢ TÍNH ĐẾN: ${formatDate(report.asOfDate)}`;
  worksheet.getCell("A6").value = "STT";
  worksheet.getCell("B6").value = "MÃ HỌC VIÊN";
  worksheet.getCell("C6").value = "HỌ VÀ TÊN HỌC VIÊN";
  worksheet.getCell("D6").value = "TRẠNG THÁI HỌC VIÊN";
  worksheet.getCell("E6").value = "TRẠNG THÁI HỌC PHÍ";
  worksheet.getCell("F6").value = "PHẢI THU KỲ";
  worksheet.getCell("G6").value = "THU TRONG KHOẢNG CHỌN";
  worksheet.getCell("H6").value = "ĐÃ THU LŨY KẾ";
  worksheet.getCell("I6").value = "CHƯA THU";
  worksheet.getCell("J6").value = "GHI CHÚ";

  ["A1", "A2", "A3", "C3", "A4"].forEach((cell) => {
    styleRange(worksheet, cell, {
      font: {
        name: "Arial",
        size: cell === "A2" ? 14 : 11,
        bold: true,
        color: { argb: colors.navy },
      },
      alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    });
  });
  worksheet.getCell("A1").font = { name: "Arial", size: 10, bold: true, color: { argb: colors.accent } };
  worksheet.getCell("A2").font = { name: "Arial", size: 16, bold: true, color: { argb: colors.white } };
  worksheet.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.navy } };
  worksheet.getRow(1).height = 22;
  worksheet.getRow(2).height = 26;
  worksheet.getRow(3).height = 24;
  worksheet.getRow(4).height = 30;
  worksheet.getRow(5).height = 24;
  styleRange(worksheet, "A5", {
    font: { name: "Arial", size: 10, color: { argb: colors.navy } },
    alignment: { horizontal: "left", vertical: "middle", wrapText: true },
  });
  ["A6", "B6", "C6", "D6", "E6", "F6", "G6", "H6", "I6", "J6"].forEach((cell) => {
    styleRange(worksheet, cell, {
      font: { name: "Arial", size: 10, bold: true, color: { argb: colors.white } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: colors.navy } },
      border,
      alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    });
  });
  worksheet.getRow(6).height = 28;
  worksheet.getRow(7).height = 28;

  const firstDataRow = 8;
  report.rows.forEach((row, index) => {
    const excelRow = worksheet.getRow(firstDataRow + index);
    excelRow.values = [
      index + 1,
      row.studentCode,
      [row.givenName, row.familyName].filter(Boolean).join(" "),
      formatEnrollmentStatus(row.enrollmentStatus),
      formatTuitionStatus(row.tuitionStatus),
      row.assessedAmount,
      row.paidInPeriodAmount,
      row.paidCumulativeAmount,
      row.outstandingAmount,
      "",
    ];
    excelRow.height = 24;
    excelRow.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.font = { name: "Arial", size: 10, color: { argb: colors.navy } };
      cell.border = border;
      cell.alignment = {
        horizontal: columnNumber >= 6 && columnNumber <= 9 ? "right" : columnNumber === 1 ? "center" : "left",
        vertical: "middle",
        wrapText: true,
      };
      if (columnNumber >= 6 && columnNumber <= 9) cell.numFmt = moneyFormat;
    });
    if (index % 2 === 1) {
      excelRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.lightBlue } };
      });
    }
  });

  const lastDataRow = Math.max(firstDataRow, firstDataRow + report.rows.length - 1);
  const totalRow = lastDataRow + 1;
  const remainingRow = totalRow + 1;
  const closedDateRow = totalRow + 2;

  worksheet.mergeCells(`A${totalRow}:E${totalRow}`);
  worksheet.mergeCells(`A${remainingRow}:F${remainingRow}`);
  worksheet.mergeCells(`A${closedDateRow}:I${closedDateRow}`);
  [totalRow, remainingRow, closedDateRow].forEach((rowNumber) => {
    const row = worksheet.getRow(rowNumber);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: "Arial", size: 11, bold: true };
      cell.border = border;
      cell.alignment = { vertical: "middle", wrapText: true };
    });
    row.height = 24;
  });

  worksheet.getCell(`A${totalRow}`).value = "TỔNG";
  const totalAssessed = report.rows.reduce((total, row) => total + row.assessedAmount, 0);
  const totalPeriodPaid = report.rows.reduce((total, row) => total + row.paidInPeriodAmount, 0);
  const totalCumulativePaid = report.rows.reduce((total, row) => total + row.paidCumulativeAmount, 0);
  const totalOutstanding = report.rows.reduce((total, row) => total + row.outstandingAmount, 0);
  for (const column of ["F", "G", "H", "I"] as const) {
    const total = ({ F: totalAssessed, G: totalPeriodPaid, H: totalCumulativePaid, I: totalOutstanding } as const)[column];
    worksheet.getCell(`${column}${totalRow}`).value = {
      formula: `SUM(${column}${firstDataRow}:${column}${lastDataRow})`,
      result: total,
    };
  }
  worksheet.getCell(`A${remainingRow}`).value = "DOANH THU SAU TRÍCH % TRÊN TIỀN THU TRONG KHOẢNG";
  worksheet.getCell(`G${remainingRow}`).value = {
    formula: `G${totalRow}*(100-${report.commissionPercent})/100`,
    result: totalPeriodPaid * (100 - report.commissionPercent) / 100,
  };
  worksheet.getCell(`A${closedDateRow}`).value = "NGÀY XUẤT BÁO CÁO";
  worksheet.getCell(`J${closedDateRow}`).value = toVietnamExcelDate(new Date());
  worksheet.getCell(`J${closedDateRow}`).numFmt = "dd/mm/yyyy";

  [totalRow].forEach((rowNumber) => {
    ["F", "G", "H", "I"].forEach((column) => {
      worksheet.getCell(`${column}${rowNumber}`).numFmt = moneyFormat;
      worksheet.getCell(`${column}${rowNumber}`).alignment = { horizontal: "right", vertical: "middle" };
    });
  });
  worksheet.getCell(`G${remainingRow}`).numFmt = moneyFormat;
  worksheet.getCell(`G${remainingRow}`).alignment = { horizontal: "right", vertical: "middle" };
  worksheet.getCell(`J${closedDateRow}`).alignment = { horizontal: "right", vertical: "middle" };
  worksheet.getCell(`A${remainingRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.blue } };
  worksheet.getCell(`G${remainingRow}`).font = { name: "Arial", size: 10, bold: true, color: { argb: colors.navy } };
  [totalRow, remainingRow, closedDateRow].forEach((rowNumber, index) => {
    worksheet.getCell(`A${rowNumber}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: [colors.green, colors.blue, colors.gray][index] },
    };
    const fillColumns = index === 0 ? ["F", "G", "H", "I"] : index === 1 ? ["G"] : ["J"];
    fillColumns.forEach((column) => {
      worksheet.getCell(`${column}${rowNumber}`).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: [colors.green, colors.blue, colors.gray][index] },
      };
    });
  });
  worksheet.autoFilter = { from: "A6", to: `J${lastDataRow}` };
  worksheet.pageSetup.printArea = `A1:J${closedDateRow}`;

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
