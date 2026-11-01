import { PDFDocument, rgb, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { PaymentBatchStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { auditFields, type AuditContext } from "@/lib/audit";
import { getPdfFontBytes } from "@/lib/pdf-font";
import { compareVietnameseNames } from "@/lib/vietnamese-name";
import {
  buildVietQrPng,
  getVietQrBankBin,
} from "@/modules/finance/tuition/services/vietqr.service";
import { buildTransferContent } from "../utils/transfer-content";
import {
  getPaymentBatchNoticeSnapshot,
  parseDocumentSnapshot,
  savePaymentBatchNoticeSnapshot,
  toFeeSnapshot,
  type DocumentSnapshot,
} from "./payment-document-snapshot";

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const formatVietnamDateTime = (value: Date) => {
  const parts = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}:${get("second")}`;
};

function groupNoticeFees(fees: DocumentSnapshot["fees"]) {
  const grouped = new Map<
    string,
    Map<string, { className: string; payableAmount: number }>
  >();
  for (const fee of fees) {
    const period = `${fee.billingYear}-${String(fee.billingMonth).padStart(2, "0")}`;
    const className = fee.className || "Chưa có lớp";
    const periodClasses = grouped.get(period) ?? new Map();
    const classKey = fee.classId ?? fee.tuitionFeeId;
    const current = periodClasses.get(classKey);
    if (current) current.payableAmount += Number(fee.payableAmount);
    else {
      periodClasses.set(classKey, {
        className,
        payableAmount: Number(fee.payableAmount),
      });
    }
    grouped.set(period, periodClasses);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([period, classes]) => ({
      period,
      classes: [...classes.values()].sort((left, right) =>
        left.className.localeCompare(right.className, "vi"),
      ),
    }));
}

export async function generatePaymentBatchNoticePdf(
  batchId: string,
  exportedByName: string,
  exportedById: string,
  auditContext?: AuditContext,
) {
  const data = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM payment_batches WHERE id = ${batchId}::uuid FOR UPDATE`,
    );
    return loadPaymentBatchNoticeData(tx, batchId);
  });

  const pdf = await renderPaymentBatchNoticePdf(data, exportedByName);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM payment_batches WHERE id = ${batchId}::uuid FOR UPDATE`,
    );
    const current = await tx.paymentBatch.findUnique({
      where: { id: batchId },
      select: { status: true },
    });
    if (!current) throw new NotFoundError("Không tìm thấy đợt thanh toán");
    if (current.status !== PaymentBatchStatus.PENDING) {
      throw new ConflictError(
        "Chỉ có thể xuất thông báo cho đợt thanh toán đang chờ đối soát",
      );
    }
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "PAYMENT_BATCH",
        entityId: batchId,
        action: "NOTICE_PRINTED",
        dataAfter: {
          batchNo: data.batch.batchNo,
          snapshotUsed: Boolean(data.snapshot),
          bankAccountSnapshotUsed: Boolean(data.snapshot?.bankAccount),
        },
        performedBy: exportedById,
        ...auditFields(auditContext),
      },
    });
  });

  return { pdf, batchNo: data.batch.batchNo };
}

export async function generatePaymentBatchNoticesPdf(
  batchIds: string[],
  exportedByName: string,
  exportedById: string,
  auditContext?: AuditContext,
) {
  const uniqueIds = [...new Set(batchIds)];
  if (uniqueIds.length !== batchIds.length) {
    throw new ConflictError("Danh sách đợt thu bị trùng");
  }

  const notices = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw(Prisma.sql`
      SELECT id FROM payment_batches
      WHERE id IN (${Prisma.join(uniqueIds.map((id) => Prisma.sql`${id}::uuid`))})
      ORDER BY id
      FOR UPDATE
    `);
      const batches = await tx.paymentBatch.findMany({
        where: { id: { in: uniqueIds } },
        include: {
          student: true,
          bankAccount: true,
          allocations: {
            include: {
              tuitionFee: {
                include: {
                  class: true,
                  items: {
                    include: { classSubject: { include: { subject: true } } },
                    orderBy: { displayOrder: "asc" },
                  },
                },
              },
            },
          },
        },
      });
      if (batches.length !== uniqueIds.length) {
        throw new NotFoundError("Không tìm thấy đầy đủ các đợt thu đã chọn");
      }
      if (
        batches.some(
          (batch) =>
            batch.status !== PaymentBatchStatus.PENDING ||
            batch.paymentMethod !== "BANK_TRANSFER" ||
            !batch.bankAccountId ||
            !batch.bankAccount,
        )
      ) {
        throw new ConflictError(
          "Chỉ có thể gộp PDF của các đợt chuyển khoản đang chờ",
        );
      }
      const batchesById = new Map(batches.map((batch) => [batch.id, batch]));
      const prepared = uniqueIds.map((id) => {
        const batch = batchesById.get(id)!;
        const accountRecord = batch.bankAccount!;
        const parsedSnapshot = parseDocumentSnapshot(batch.noticeSnapshot);
        const student = parsedSnapshot?.student ?? batch.student;
        const snapshot: DocumentSnapshot = parsedSnapshot ?? {
          version: 1,
          student: { code: student.code, fullName: student.fullName },
          fees: batch.allocations.map((allocation) =>
            toFeeSnapshot(allocation.tuitionFee, allocation.amount),
          ),
          bankAccount: {
            bankCode: accountRecord.bankCode,
            bankName: accountRecord.bankName,
            accountNo: accountRecord.accountNo,
            accountName: accountRecord.accountName,
          },
        };
        return {
          data: {
            batch,
            accountRecord,
            account: snapshot.bankAccount ?? accountRecord,
            student,
            fees: snapshot.fees,
            snapshot,
          },
          snapshotWasMissing: !parsedSnapshot,
        };
      });
      const snapshotsToSave = prepared.filter(
        (item) => item.snapshotWasMissing,
      );
      if (snapshotsToSave.length) {
        await tx.$executeRaw(Prisma.sql`
        UPDATE payment_batches AS batch
        SET notice_snapshot = payload.snapshot
        FROM (VALUES ${Prisma.join(
          snapshotsToSave.map(
            ({ data }) =>
              Prisma.sql`(${data.batch.id}::uuid, ${JSON.stringify(data.snapshot)}::jsonb)`,
          ),
        )}) AS payload(id, snapshot)
        WHERE batch.id = payload.id
      `);
      }
      prepared.sort(
        (left, right) =>
          compareVietnameseNames(
            left.data.student.fullName,
            right.data.student.fullName,
          ) ||
          left.data.batch.batchNo.localeCompare(
            right.data.batch.batchNo,
            "vi",
          ),
      );
      return prepared.map((item) => item.data);
    },
    { timeout: 60_000 },
  );

  const combinedPdf = await PDFDocument.create();
  const noticeMetadata: Array<{
    batchId: string;
    batchNo: string;
    snapshotUsed: boolean;
    bankAccountSnapshotUsed: boolean;
  }> = [];
  for (const noticeData of notices) {
    const notice = await renderPaymentBatchNoticePdf(
      noticeData,
      exportedByName,
    );
    const sourcePdf = await PDFDocument.load(notice);
    const pages = await combinedPdf.copyPages(
      sourcePdf,
      sourcePdf.getPageIndices(),
    );
    for (const page of pages) combinedPdf.addPage(page);
    noticeMetadata.push({
      batchId: noticeData.batch.id,
      batchNo: noticeData.batch.batchNo,
      snapshotUsed: Boolean(noticeData.snapshot),
      bankAccountSnapshotUsed: Boolean(noticeData.snapshot.bankAccount),
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
      SELECT id FROM payment_batches
      WHERE id IN (${Prisma.join(uniqueIds.map((id) => Prisma.sql`${id}::uuid`))})
      ORDER BY id
      FOR UPDATE
    `);
    const currentBatches = await tx.paymentBatch.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, status: true },
    });
    if (currentBatches.length !== uniqueIds.length) {
      throw new NotFoundError("Không tìm thấy đầy đủ các đợt thu đã chọn");
    }
    if (
      currentBatches.some(
        (batch) => batch.status !== PaymentBatchStatus.PENDING,
      )
    ) {
      throw new ConflictError("Chỉ có thể xuất PDF của các đợt đang chờ");
    }
    await tx.tuitionAuditLog.createMany({
      data: noticeMetadata.map((notice) => ({
        entityType: "PAYMENT_BATCH",
        entityId: notice.batchId,
        action: "NOTICE_PRINTED",
        dataAfter: {
          batchNo: notice.batchNo,
          snapshotUsed: notice.snapshotUsed,
          bankAccountSnapshotUsed: notice.bankAccountSnapshotUsed,
        },
        performedBy: exportedById,
        ...auditFields(auditContext),
      })),
    });
  });

  return Buffer.from(await combinedPdf.save());
}

async function loadPaymentBatchNoticeData(
  client: Prisma.TransactionClient,
  batchId: string,
) {
  const batch = await client.paymentBatch.findUnique({
    where: { id: batchId },
    include: {
      student: true,
      allocations: {
        include: {
          tuitionFee: {
            include: {
              class: true,
              items: {
                include: { classSubject: { include: { subject: true } } },
                orderBy: { displayOrder: "asc" },
              },
            },
          },
        },
      },
    },
  });
  if (!batch) throw new NotFoundError("Không tìm thấy đợt thanh toán");
  if (batch.status !== PaymentBatchStatus.PENDING) {
    throw new ConflictError(
      "Chỉ có thể xuất thông báo cho đợt thanh toán đang chờ đối soát",
    );
  }

  if (batch.paymentMethod !== "BANK_TRANSFER" || !batch.bankAccountId) {
    throw new ConflictError(
      "Chỉ có thể xuất thông báo chuyển khoản cho đợt thanh toán đã gắn tài khoản ngân hàng",
    );
  }

  const accountRecord = await client.bankAccount.findUnique({
    where: { id: batch.bankAccountId },
  });
  if (!accountRecord) {
    throw new ConflictError(
      "Tài khoản ngân hàng của đợt thanh toán không còn tồn tại",
    );
  }
  const parsedSnapshot = parseDocumentSnapshot(
    await getPaymentBatchNoticeSnapshot(batch.id, client),
  );
  const student = parsedSnapshot?.student ?? batch.student;
  const snapshot = parsedSnapshot ?? {
    version: 1 as const,
    student: { code: student.code, fullName: student.fullName },
    fees: batch.allocations.map((allocation) =>
      toFeeSnapshot(allocation.tuitionFee, allocation.amount),
    ),
    bankAccount: {
      bankCode: accountRecord.bankCode,
      bankName: accountRecord.bankName,
      accountNo: accountRecord.accountNo,
      accountName: accountRecord.accountName,
    },
  };
  if (!parsedSnapshot) {
    await savePaymentBatchNoticeSnapshot(client, batch.id, snapshot);
  }
  const account = snapshot.bankAccount ?? accountRecord;
  const fees = snapshot.fees;

  return { batch, accountRecord, account, student, fees, snapshot };
}

async function renderPaymentBatchNoticePdf(
  data: Awaited<ReturnType<typeof loadPaymentBatchNoticeData>>,
  exportedByName: string,
) {
  const { batch, accountRecord, account, student, fees } = data;

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await getPdfFontBytes(), { subset: true });
  const exportedAt = formatVietnamDateTime(new Date());
  let page = pdf.addPage([595, 420]);
  const ink = rgb(0.12, 0.18, 0.27);
  const navy = rgb(0.1, 0.19, 0.3);
  const muted = rgb(0.39, 0.45, 0.52);
  const red = rgb(0.76, 0.12, 0.19);
  const cream = rgb(0.99, 0.98, 0.94);
  const gold = rgb(0.78, 0.58, 0.29);
  const paleBlue = rgb(0.96, 0.97, 0.98);
  const paleRed = rgb(1, 0.95, 0.94);
  const border = rgb(0.84, 0.75, 0.58);
  const white = rgb(1, 1, 1);
  const draw = (
    text: string,
    x: number,
    y: number,
    size = 11,
    textColor = ink,
  ) => page.drawText(text, { x, y, size, font, color: textColor });
  const drawFit = (
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    size: number,
    textColor = ink,
    minSize = 8,
  ) => {
    let fittedSize = size;
    while (
      fittedSize > minSize &&
      font.widthOfTextAtSize(text, fittedSize) > maxWidth
    ) {
      fittedSize = Math.max(minSize, fittedSize - 0.5);
    }
    let fittedText = text;
    if (font.widthOfTextAtSize(fittedText, fittedSize) > maxWidth) {
      const ellipsis = "…";
      const characters = Array.from(text);
      while (
        characters.length > 0 &&
        font.widthOfTextAtSize(`${characters.join("")}${ellipsis}`, fittedSize) >
          maxWidth
      ) {
        characters.pop();
      }
      fittedText =
        font.widthOfTextAtSize(ellipsis, fittedSize) <= maxWidth
          ? `${characters.join("")}${ellipsis}`
          : "";
    }
    draw(fittedText, x, y, fittedSize, textColor);
  };
  const drawRightFit = (
    text: string,
    rightX: number,
    y: number,
    maxWidth: number,
    size: number,
    textColor = ink,
    minSize = 8,
  ) => {
    let fittedSize = size;
    while (
      fittedSize > minSize &&
      font.widthOfTextAtSize(text, fittedSize) > maxWidth
    ) {
      fittedSize = Math.max(minSize, fittedSize - 0.5);
    }
    let textWidth = font.widthOfTextAtSize(text, fittedSize);
    if (textWidth > maxWidth && textWidth > 0) {
      fittedSize *= maxWidth / textWidth;
      textWidth = font.widthOfTextAtSize(text, fittedSize);
    }
    draw(
      text,
      rightX - textWidth,
      y,
      fittedSize,
      textColor,
    );
  };
  const drawCentered = (
    text: string,
    centerX: number,
    y: number,
    size: number,
    color = ink,
  ) => {
    draw(
      text,
      centerX - font.widthOfTextAtSize(text, size) / 2,
      y,
      size,
      color,
    );
  };
  const drawHeader = () => {
    page.drawRectangle({ x: 0, y: 0, width: 595, height: 420, color: cream });
    drawCentered("THÔNG BÁO THANH TOÁN HỌC PHÍ", 297.5, 398, 14, navy);
    page.drawLine({
      start: { x: 28, y: 383 },
      end: { x: 567, y: 383 },
      thickness: 1,
      color: gold,
    });
  };
  const drawCard = (
    x: number,
    y: number,
    width: number,
    height: number,
    title?: string,
  ) => {
    page.drawRectangle({
      x,
      y,
      width,
      height,
      color: white,
      borderColor: gold,
      borderWidth: 0.9,
    });
    if (title) {
      page.drawRectangle({
        x,
        y: y + height - 23,
        width,
        height: 23,
        color: navy,
      });
      drawCentered(title, x + width / 2, y + height - 16, 8.5, white);
    }
  };

  const leftX = 28;
  const leftWidth = 260;
  const rightX = 307;
  const rightWidth = 260;
  const cardBottom = 32;
  const cardTop = 366;
  const totalBoxBottom = cardBottom + 10;
  const totalBoxHeight = 32;
  const drawFirstPageCards = () => {
    drawCard(
      leftX,
      cardBottom,
      leftWidth,
      cardTop - cardBottom,
      "THÔNG TIN HỌC VIÊN & HỌC PHÍ",
    );
    drawCard(rightX, cardBottom, rightWidth, cardTop - cardBottom);
    drawFit(student.fullName, 45, 319, 228, 16, red, 11);
    draw("CÁC KHOẢN THANH TOÁN", 45, 296, 8.5, navy);
    page.drawLine({
      start: { x: 45, y: 289 },
      end: { x: 274, y: 289 },
      thickness: 0.7,
      color: border,
    });
  };

  let onContinuationPage = false;
  const continuationPages = new Set<PDFPage>();
  const drawContinuationPage = () => {
    page = pdf.addPage([595, 420]);
    continuationPages.add(page);
    drawHeader();
    drawCard(
      28,
      cardBottom,
      539,
      cardTop - cardBottom,
      "CÁC KHOẢN THANH TOÁN (TIẾP THEO)",
    );
    drawFit(
      `Học viên: ${student.fullName}  ·  Mã đợt: ${batch.batchNo}`,
      45,
      319,
      505,
      7.5,
      muted,
      6.5,
    );
    page.drawLine({
      start: { x: 45, y: 304 },
      end: { x: 550, y: 304 },
      thickness: 0.7,
      color: border,
    });
    onContinuationPage = true;
    y = 289;
  };
  drawHeader();
  drawFirstPageCards();

  let y = 274;
  let feeRowX = 45;
  let feeRowRight = 274;
  let feeRowWidth = 229;
  const minimumFeeY = totalBoxBottom + totalBoxHeight + 12;
  const ensureFeeSpace = (needed: number) => {
    const currentPage = page;
    if (y - needed < minimumFeeY) drawContinuationPage();
    if (onContinuationPage) {
      feeRowX = 45;
      feeRowRight = 550;
      feeRowWidth = feeRowRight - feeRowX;
    }
    return page !== currentPage;
  };
  const drawPeriodHeading = (period: string) => {
    page.drawRectangle({
      x: feeRowX - 3,
      y: y - 6,
      width: feeRowWidth + 6,
      height: 19,
      color: navy,
    });
    drawFit(`KỲ ${period}`, feeRowX + 5, y, feeRowWidth - 10, 8, white, 7);
    y -= 23;
  };
  for (const group of groupNoticeFees(fees)) {
    ensureFeeSpace(46);
    drawPeriodHeading(group.period);
    for (const classLine of group.classes) {
      if (ensureFeeSpace(23)) drawPeriodHeading(group.period);
      page.drawRectangle({
        x: feeRowX - 3,
        y: y - 6,
        width: feeRowWidth + 6,
        height: 17,
        color: paleBlue,
      });
      drawFit(classLine.className, feeRowX + 11, y, feeRowWidth - 100, 8, navy, 6.5);
      drawRightFit(
        `${money(classLine.payableAmount)} VND`,
        feeRowRight,
        y,
        85,
        8,
        navy,
        6.5,
      );
      y -= 23;
    }
  }
  const totalTextY = totalBoxBottom + 11;
  page.drawRectangle({
    x: 42,
    y: totalBoxBottom,
    width: 232,
    height: totalBoxHeight,
    color: paleRed,
    borderColor: border,
    borderWidth: 0.6,
  });
  page.drawRectangle({
    x: 42,
    y: totalBoxBottom,
    width: 3,
    height: totalBoxHeight,
    color: red,
  });
  const totalLabel = "TỔNG CẦN THANH TOÁN";
  const totalLabelSize = 7;
  const totalLabelWidth = font.widthOfTextAtSize(totalLabel, totalLabelSize);
  draw(totalLabel, 52, totalTextY, totalLabelSize, muted);
  drawRightFit(
    `${money(Number(batch.totalAmount))} VND`,
    263,
    totalTextY,
    263 - (52 + totalLabelWidth + 8),
    12.5,
    red,
    8,
  );
  if (!accountRecord.isActive) {
    draw("Tài khoản đã ngừng hoạt động.", 45, 34, 6, red);
  }

  const qrPng = await buildNoticeQrPng(data);
  const pages = pdf.getPages();
  // VietQR-style slip, same layout as the QR card on the payment screen.
  const qrAccent = rgb(0.11, 0.25, 0.56);
  const qrCenterX = rightX + rightWidth / 2;
  const qrSize = 196;
  const qrY = 146;
  if (accountRecord.isActive) {
    page = pdf.getPage(0);
    const infoWidth = rightWidth - 36;
    const fitSize = (text: string, size: number, minSize: number) => {
      let fitted = size;
      while (fitted > minSize && font.widthOfTextAtSize(text, fitted) > infoWidth)
        fitted -= 0.25;
      return fitted;
    };
    const napasText = "napas 247";
    const bankText = account.bankCode.toUpperCase();
    const rowSize = 9.5;
    const rowGap = 8;
    const napasWidth = font.widthOfTextAtSize(napasText, rowSize);
    const bankWidth = font.widthOfTextAtSize(bankText, rowSize);
    const rowStart = qrCenterX - (napasWidth + rowGap * 2 + bankWidth) / 2;
    draw(napasText, rowStart, 121, rowSize, qrAccent);
    page.drawLine({
      start: { x: rowStart + napasWidth + rowGap, y: 118.5 },
      end: { x: rowStart + napasWidth + rowGap, y: 129 },
      thickness: 0.8,
      color: qrAccent,
    });
    draw(bankText, rowStart + napasWidth + rowGap * 2, 121, rowSize, qrAccent);
    const accountName = account.accountName.toUpperCase();
    drawCentered(accountName, qrCenterX, 103, fitSize(accountName, 10.5, 6.5), ink);
    drawCentered(account.accountNo, qrCenterX, 89, 9, muted);
    const amountLabel = "Số tiền: ";
    const amountText = `${money(Number(batch.totalAmount))} VND`;
    const amountSize = 9.5;
    const amountLabelWidth = font.widthOfTextAtSize(amountLabel, amountSize);
    const amountStart =
      qrCenterX -
      (amountLabelWidth + font.widthOfTextAtSize(amountText, amountSize)) / 2;
    draw(amountLabel, amountStart, 73, amountSize, ink);
    draw(amountText, amountStart + amountLabelWidth, 73, amountSize, red);
    // Transfer content must be typed exactly for manual transfers, so it gets ink color.
    const contentText = `Nội dung: ${noticeTransferContent(data)}`;
    drawCentered(contentText, qrCenterX, 58, fitSize(contentText, 9, 6.5), navy);
    const reminderText = "Vui lòng chuyển đúng số tiền và nội dung.";
    drawCentered(reminderText, qrCenterX, 46, 7, muted);
  }
  if (qrPng) {
    const qr = await pdf.embedPng(qrPng);
    pages.forEach((qrPage) => {
      if (continuationPages.has(qrPage)) {
        const compactQrSize = 33;
        qrPage.drawImage(qr, {
          x: 512,
          y: 380,
          width: compactQrSize,
          height: compactQrSize,
        });
        return;
      }
      qrPage.drawRectangle({
        x: qrCenterX - qrSize / 2 - 6,
        y: qrY - 6,
        width: qrSize + 12,
        height: qrSize + 12,
        borderColor: qrAccent,
        borderWidth: 1.5,
      });
      qrPage.drawImage(qr, {
        x: qrCenterX - qrSize / 2,
        y: qrY,
        width: qrSize,
        height: qrSize,
      });
    });
  } else if (accountRecord.isActive) {
    pages.forEach((qrPage) => {
      if (continuationPages.has(qrPage)) {
        const placeholder = "QR chưa khả dụng";
        const placeholderSize = 5.5;
        const placeholderWidth = font.widthOfTextAtSize(
          placeholder,
          placeholderSize,
        );
        qrPage.drawText(placeholder, {
          x: 529 - placeholderWidth / 2,
          y: 395,
          size: placeholderSize,
          font,
          color: muted,
        });
        return;
      }
      qrPage.drawText(
        getVietQrBankBin(account.bankCode)
          ? "Mã QR hiện chưa khả dụng."
          : `Mã ngân hàng ${account.bankCode} chưa hỗ trợ QR.`,
        {
          x: rightX + 18,
          y: 187,
          size: 8,
          font,
          color: muted,
          maxWidth: rightWidth - 36,
        },
      );
    });
  }

  pages.forEach((footerPage, index) => {
    footerPage.drawLine({
      start: { x: 28, y: 25 },
      end: { x: 567, y: 25 },
      thickness: 0.7,
      color: gold,
    });
    const dateText = `Ngày xuất: ${exportedAt}`;
    const employeeText = `Nhân viên: ${exportedByName}`;
    footerPage.drawText(dateText, {
      x: 28,
      y: 14,
      size: 5.8,
      font,
      color: muted,
    });
    const employeeSize = Math.min(
      5.8,
      (270 / Math.max(font.widthOfTextAtSize(employeeText, 5.8), 1)) * 5.8,
    );
    footerPage.drawText(employeeText, {
      x: 245,
      y: 14,
      size: employeeSize,
      font,
      color: muted,
    });
    const pageText = `Trang ${index + 1}/${pages.length}`;
    footerPage.drawText(pageText, {
      x: 520,
      y: 14,
      size: 5.8,
      font,
      color: muted,
    });
  });

  const pdfBuffer = Buffer.from(await pdf.save());
  return pdfBuffer;
}

async function buildNoticeQrPng(
  data: Awaited<ReturnType<typeof loadPaymentBatchNoticeData>>,
) {
  const { batch, accountRecord, account } = data;
  if (!accountRecord.isActive) return null;
  const addInfo = noticeTransferContent(data);
  try {
    return await buildVietQrPng({
      bankCode: account.bankCode,
      accountNo: account.accountNo,
      amount: Number(batch.totalAmount),
      addInfo,
    });
  } catch {
    return null;
  }
}

function noticeTransferContent(
  data: Awaited<ReturnType<typeof loadPaymentBatchNoticeData>>,
) {
  return buildTransferContent({
    batchNo: data.batch.batchNo,
    studentName: data.student.fullName,
    classNames: data.fees.map((fee) => fee.className),
  });
}
