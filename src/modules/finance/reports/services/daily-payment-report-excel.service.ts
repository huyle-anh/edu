import ExcelJS from "exceljs";
import type { DailyPaymentReport } from "@/modules/finance/reports/services/daily-payment-report.service";

const border = {
  top: { style: "thin" as const, color: { argb: "FFD7E0E8" } },
  left: { style: "thin" as const, color: { argb: "FFD7E0E8" } },
  bottom: { style: "thin" as const, color: { argb: "FFD7E0E8" } },
  right: { style: "thin" as const, color: { argb: "FFD7E0E8" } },
};
const moneyFormat = '#,##0 "₫"';
const zeroAsDashMoneyFormat = '#,##0 "₫";[Red]-#,##0 "₫";-';
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const colors = {
  navy: "FF17324D",
  blue: "FFE8F0F6",
  lightBlue: "FFF5F8FA",
  green: "FFE4F3EA",
  yellow: "FFFFF4DB",
  orange: "FFFFE9E3",
  gray: "FFF1F4F7",
  white: "FFFFFFFF",
  red: "FFC00000",
};

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function toVietnamExcelDate(value: Date) {
  // ExcelJS serializes Date values without a timezone. Shift the instant so
  // the displayed Excel clock represents Vietnam local time.
  return new Date(value.getTime() + VIETNAM_OFFSET_MS);
}

function styleCell(cell: ExcelJS.Cell, alignment: Partial<ExcelJS.Alignment> = {}) {
  cell.font = { name: "Arial", size: 11 };
  cell.border = border;
  cell.alignment = { vertical: "middle", wrapText: true, ...alignment };
}

function setFill(cell: ExcelJS.Cell, argb: string) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function setBold(cell: ExcelJS.Cell, color?: string) {
  cell.font = { name: "Arial", size: 11, bold: true, color: color ? { argb: color } : undefined };
}

export async function buildDailyPaymentReportExcel(report: DailyPaymentReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EduCenter";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Báo cáo ngày");
  sheet.columns = [
    { width: 8 },
    { width: 24 },
    { width: 22 },
    { width: 16 },
    { width: 12 },
    { width: 18 },
    { width: 42 },
    { width: 18 },
  ];
  sheet.mergeCells("A1:H1");
  sheet.mergeCells("A2:H2");
  sheet.mergeCells("A3:H3");
  sheet.getCell("A1").value = "TRUNG TÂM ĐÀO TẠO";
  sheet.getCell("A2").value = "BÁO CÁO THU HỌC PHÍ HẰNG NGÀY";
  sheet.getCell("A3").value = `CẢ NGÀY · ${formatDate(report.date)}`;
  sheet.getRow(1).height = 24;
  sheet.getRow(2).height = 24;
  sheet.getRow(3).height = 22;
  ["A1", "A2", "A3"].forEach((address) => {
    styleCell(sheet.getCell(address), { horizontal: "center" });
    sheet.getCell(address).font = {
      name: "Arial",
      size: address === "A2" ? 16 : 10,
      bold: true,
      color: { argb: address === "A2" ? colors.white : colors.navy },
    };
  });
  setFill(sheet.getCell("A2"), colors.navy);
  sheet.getCell("A3").font = { name: "Arial", size: 11, color: { argb: colors.navy } };

  const headers = ["STT", "GIÁO VIÊN", "LỚP", "HỌC PHÍ", "SỐ LƯỢT", "THÀNH TIỀN", "TÊN HỌC SINH ĐÓNG TIỀN", "KỲ HỌC"];
  headers.forEach((value, index) => {
    const cell = sheet.getRow(4).getCell(index + 1);
    cell.value = value;
    styleCell(cell, { horizontal: "center" });
    setBold(cell, colors.white);
    setFill(cell, colors.navy);
  });
  sheet.getRow(4).height = 28;

  const firstDataRow = 5;
  report.rows.forEach((row, index) => {
    const excelRow = sheet.getRow(firstDataRow + index);
    excelRow.values = [index + 1, row.teacherName, row.className, row.tuitionFee, row.count, row.total, row.studentNames, row.billingPeriods];
    excelRow.height = 24;
    excelRow.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      styleCell(cell, { horizontal: columnNumber === 1 ? "center" : [4, 5, 6].includes(columnNumber) ? "right" : "left" });
      if ([4, 6].includes(columnNumber)) cell.numFmt = moneyFormat;
    });
    if ((index + firstDataRow) % 2 === 0) {
      excelRow.eachCell({ includeEmpty: true }, (cell) => setFill(cell, colors.lightBlue));
    }
  });

  const lastDataRow = Math.max(firstDataRow, firstDataRow + report.rows.length - 1);
  const totalRow = lastDataRow + 2;
  sheet.mergeCells(`A${totalRow}:H${totalRow}`);
  sheet.getCell(`A${totalRow}`).value = "TỔNG QUAN THU TRONG NGÀY";
  styleCell(sheet.getCell(`A${totalRow}`), { horizontal: "left" });
  sheet.getCell(`A${totalRow}`).font = { name: "Arial", size: 11, bold: true, color: { argb: colors.white } };
  setFill(sheet.getCell(`A${totalRow}`), colors.navy);
  sheet.getRow(totalRow).height = 24;
  const summaryFirstRow = totalRow + 1;
  const summary = [
    ["TỔNG THU", report.totalCollected, "Payment SUCCESS"],
    ["TIỀN MẶT", report.cashCollected, "Đã thu bằng tiền mặt"],
    ["CHUYỂN KHOẢN", report.bankTransferCollected, "Đã thu bằng chuyển khoản"],
    ["SỐ GIAO DỊCH", report.paymentCount, "Số payment thành công trong ngày"],
  ];
  summary.forEach(([label, value, note], index) => {
    const row = sheet.getRow(summaryFirstRow + index);
    row.getCell(1).value = label;
    row.getCell(6).value = value;
    row.getCell(7).value = note;
    sheet.mergeCells(`A${summaryFirstRow + index}:E${summaryFirstRow + index}`);
    sheet.mergeCells(`G${summaryFirstRow + index}:H${summaryFirstRow + index}`);
    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      styleCell(cell, { horizontal: columnNumber === 6 ? "right" : "left" });
      if (columnNumber === 6 && index < 3) cell.numFmt = moneyFormat;
      if (columnNumber === 1) setBold(cell, colors.navy);
    });
    setFill(row.getCell(1), index === 0 ? colors.green : index === 1 ? colors.yellow : index === 2 ? colors.blue : colors.gray);
    setFill(row.getCell(6), index === 0 ? colors.green : index === 1 ? colors.yellow : index === 2 ? colors.blue : colors.gray);
  });
  const noteRow = summaryFirstRow + summary.length + 1;
  sheet.mergeCells(`A${noteRow}:H${noteRow}`);
  sheet.getCell(`A${noteRow}`).value = "Ghi chú: Chỉ tính payment học phí SUCCESS theo ngày Việt Nam. Nhập số tờ và tiền nộp thực tế tại các ô màu vàng để Excel tự đối soát.";
  styleCell(sheet.getCell(`A${noteRow}`), { horizontal: "left" });
  setFill(sheet.getCell(`A${noteRow}`), colors.gray);
  sheet.getRow(noteRow).height = 32;

  const reconciliationTitleRow = noteRow + 2;
  const signerLabelRow = reconciliationTitleRow + 1;
  const signerInputRow = signerLabelRow + 1;
  const headerRow = signerInputRow + 2;
  const denominations = [500_000, 200_000, 100_000, 50_000, 20_000, 10_000, 5_000, 2_000, 1_000];

  sheet.mergeCells(`A${reconciliationTitleRow}:H${reconciliationTitleRow}`);
  const reconciliationTitle = sheet.getCell(`A${reconciliationTitleRow}`);
  reconciliationTitle.value = "ĐỐI SOÁT TIỀN MẶT THEO MỆNH GIÁ";
  styleCell(reconciliationTitle, { horizontal: "center" });
  setBold(reconciliationTitle, colors.white);
  reconciliationTitle.font = { name: "Arial", size: 12, bold: true, color: { argb: colors.white } };
  setFill(reconciliationTitle, colors.navy);
  sheet.getRow(reconciliationTitleRow).height = 24;

  sheet.mergeCells(`A${signerLabelRow}:D${signerLabelRow}`);
  sheet.mergeCells(`E${signerLabelRow}:H${signerLabelRow}`);
  sheet.getCell(`A${signerLabelRow}`).value = "Người lập bảng";
  sheet.getCell(`E${signerLabelRow}`).value = "Người kiểm duyệt";
  ["A", "E"].forEach((column) => {
    styleCell(sheet.getCell(`${column}${signerLabelRow}`), { horizontal: "center" });
    sheet.getCell(`${column}${signerLabelRow}`).font = { name: "Arial", size: 11, bold: true, italic: true, color: { argb: colors.navy } };
    setFill(sheet.getCell(`${column}${signerLabelRow}`), colors.blue);
  });
  sheet.mergeCells(`A${signerInputRow}:D${signerInputRow + 1}`);
  sheet.mergeCells(`E${signerInputRow}:H${signerInputRow + 1}`);
  ["A", "E"].forEach((column) => {
    const cell = sheet.getCell(`${column}${signerInputRow}`);
    styleCell(cell, { horizontal: "center" });
    setFill(cell, colors.yellow);
  });
  sheet.getRow(signerInputRow).height = 22;
  sheet.getRow(signerInputRow + 1).height = 22;

  ["MỆNH GIÁ", "SỐ TỜ", "THÀNH TIỀN"].forEach((value, index) => {
    const cell = sheet.getRow(headerRow).getCell(index + 2);
    cell.value = value;
    styleCell(cell, { horizontal: "center" });
    setBold(cell, colors.navy);
    setFill(cell, colors.green);
  });
  sheet.getRow(headerRow).height = 24;

  const denominationFirstRow = headerRow + 1;
  denominations.forEach((denomination, index) => {
    const rowNumber = denominationFirstRow + index;
    const row = sheet.getRow(rowNumber);
    row.getCell(2).value = denomination;
    row.getCell(3).value = null;
    row.getCell(4).value = { formula: `=IF(C${rowNumber}=\"\",0,B${rowNumber}*C${rowNumber})`, result: 0 };
    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      styleCell(cell, { horizontal: columnNumber === 2 ? "right" : "right" });
      if ([2, 4].includes(columnNumber)) cell.numFmt = zeroAsDashMoneyFormat;
    });
    setFill(row.getCell(3), colors.yellow);
    if (index % 2 === 1) {
      setFill(row.getCell(2), colors.lightBlue);
      setFill(row.getCell(4), colors.lightBlue);
    }
    row.getCell(3).dataValidation = {
      type: "whole",
      operator: "greaterThanOrEqual",
      formulae: ["0"],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Số tờ không hợp lệ",
      error: "Vui lòng nhập số nguyên không âm.",
    };
  });

  const denominationLastRow = denominationFirstRow + denominations.length - 1;
  const denominationTotalRow = denominationLastRow + 1;
  const depositRow = denominationTotalRow + 1;
  const statusRow = denominationTotalRow + 2;
  const reconciliationRows = [
    { row: denominationTotalRow, label: "TỔNG CỘNG", formula: `=SUM(D${denominationFirstRow}:D${denominationLastRow})`, fill: colors.green },
    { row: depositRow, label: "TIỀN NỘP HÔM NAY (NHẬP)", input: true, fill: colors.orange },
    { row: statusRow, label: "ĐỐI SOÁT", formula: `=IF(D${depositRow}=\"\",\"\",IF(D${denominationTotalRow}=D${depositRow},\"ĐỦ\",IF(D${denominationTotalRow}>D${depositRow},\"THỪA\",\"THIẾU\")))`, fill: colors.yellow },
  ];
  reconciliationRows.forEach(({ row: rowNumber, label, formula, input, fill }) => {
    sheet.mergeCells(`B${rowNumber}:C${rowNumber}`);
    const labelCell = sheet.getCell(`B${rowNumber}`);
    labelCell.value = label;
    styleCell(labelCell, { horizontal: "left" });
    setBold(labelCell, colors.navy);
    setFill(labelCell, fill);
    const valueCell = sheet.getCell(`D${rowNumber}`);
    if (formula) valueCell.value = { formula, result: rowNumber === statusRow ? "" : 0 };
    styleCell(valueCell, { horizontal: "right" });
    valueCell.numFmt = rowNumber === statusRow ? "@" : zeroAsDashMoneyFormat;
    setFill(valueCell, input ? colors.yellow : fill);
    if (rowNumber === statusRow) {
      valueCell.alignment = { horizontal: "center", vertical: "middle" };
      valueCell.font = { name: "Arial", size: 11, bold: true, color: { argb: colors.red } };
    }
    if (input) {
      valueCell.dataValidation = {
        type: "decimal",
        operator: "greaterThanOrEqual",
        formulae: ["0"],
        allowBlank: true,
        showErrorMessage: true,
        errorTitle: "Số tiền không hợp lệ",
        error: "Vui lòng nhập số tiền không âm.",
      };
    }
    sheet.getRow(rowNumber).height = 23;
  });

  sheet.mergeCells(`F${denominationTotalRow}:H${denominationTotalRow}`);
  sheet.mergeCells(`F${depositRow}:H${depositRow}`);
  sheet.mergeCells(`F${statusRow}:H${statusRow}`);
  sheet.getCell(`F${denominationTotalRow}`).value = "Tổng các mệnh giá đã nhập";
  sheet.getCell(`F${depositRow}`).value = "Nhập số tiền thực tế đã nộp";
  sheet.getCell(`F${statusRow}`).value = "Đủ khi tổng mệnh giá bằng tiền nộp";
  [denominationTotalRow, depositRow, statusRow].forEach((rowNumber) => {
    styleCell(sheet.getCell(`F${rowNumber}`), { horizontal: "left" });
    sheet.getCell(`F${rowNumber}`).font = { name: "Arial", size: 10, italic: true, color: { argb: colors.navy } };
    setFill(sheet.getCell(`F${rowNumber}`), colors.gray);
  });

  workbook.calcProperties.fullCalcOnLoad = true;
  sheet.views = [{ state: "frozen", ySplit: 4 }];
  sheet.autoFilter = { from: "A4", to: `G${lastDataRow}` };
  sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printArea: `A1:H${statusRow}` };

  const detail = workbook.addWorksheet("Chi tiết giao dịch");
  detail.columns = [
    { key: "index", width: 8 }, { key: "paymentNo", width: 24 }, { key: "paymentDate", width: 18 },
    { key: "studentCode", width: 16 }, { key: "studentName", width: 28 }, { key: "className", width: 18 },
    { key: "feeNo", width: 24 }, { key: "paymentMethod", width: 18 }, { key: "bankName", width: 24 },
    { key: "bankAccountNo", width: 20 }, { key: "bankTransactionNo", width: 24 }, { key: "transactionReference", width: 24 },
    { key: "paymentContent", width: 32 }, { key: "amount", width: 18 },
  ];
  detail.mergeCells("A1:N1");
  detail.mergeCells("A2:N2");
  detail.getCell("A1").value = "CHI TIẾT CÁC KHOẢN THU";
  detail.getCell("A2").value = `Ngày thu ${formatDate(report.date)} · ${report.paymentCount} giao dịch · Tổng ${report.totalCollected.toLocaleString("vi-VN")} ₫`;
  styleCell(detail.getCell("A1"), { horizontal: "center" });
  detail.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: colors.white } };
  setFill(detail.getCell("A1"), colors.navy);
  styleCell(detail.getCell("A2"), { horizontal: "center" });
  detail.getCell("A2").font = { name: "Arial", size: 10, italic: true, color: { argb: colors.navy } };
  detail.getRow(1).height = 32;
  detail.getRow(2).height = 23;
  detail.getRow(4).values = ["STT", "Mã thanh toán", "Ngày thu", "Mã học viên", "Học viên", "Lớp", "Mã học phí", "Phương thức", "Ngân hàng", "Tài khoản nhận", "Mã giao dịch NH", "Mã tham chiếu", "Nội dung thu", "Số tiền"];
  detail.getRow(4).eachCell((cell) => {
    styleCell(cell, { horizontal: "center" });
    setBold(cell, colors.white);
    setFill(cell, colors.navy);
  });
  detail.getRow(4).height = 30;
  report.details.forEach((item, index) => {
    const row = detail.addRow({
      index: index + 1,
      paymentNo: item.paymentNo,
      paymentDate: toVietnamExcelDate(item.paymentDate),
      studentCode: item.studentCode,
      studentName: item.studentName,
      className: item.className,
      feeNo: item.feeNo,
      paymentMethod: item.paymentMethod,
      bankName: item.bankName ?? "",
      bankAccountNo: item.bankAccountNo ?? "",
      bankTransactionNo: item.bankTransactionNo ?? "",
      transactionReference: item.transactionReference ?? "",
      paymentContent: item.paymentContent ?? "",
      amount: item.amount,
    });
    row.getCell("paymentDate").numFmt = "dd/mm/yyyy hh:mm";
    row.getCell("amount").numFmt = moneyFormat;
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => styleCell(cell, { horizontal: [1, 14].includes(columnNumber) ? "right" : "left" }));
    if ((index + 1) % 2 === 0) {
      row.eachCell({ includeEmpty: true }, (cell) => setFill(cell, colors.lightBlue));
    }
  });
  detail.views = [{ state: "frozen", ySplit: 4 }];
  detail.autoFilter = { from: "A4", to: `N${Math.max(4, report.details.length + 4)}` };
  detail.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printArea: `A1:N${Math.max(4, report.details.length + 4)}` };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
