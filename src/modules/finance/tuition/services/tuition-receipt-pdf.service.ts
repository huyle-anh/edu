import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { auditFields, type AuditContext } from "@/lib/audit";
import { vietnameseAmountInWords } from "@/lib/vietnamese-amount";
import { getPdfFontBytes } from "@/lib/pdf-font";
import {
  getTuitionReceiptSnapshot,
  parseReceiptSnapshot,
  saveTuitionReceiptSnapshot,
  toFeeSnapshot,
} from "@/modules/finance/payments/services/payment-document-snapshot";

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const A5_PAGE_SIZE: [number, number] = [419.53, 595.28];
const A5_SCALE = A5_PAGE_SIZE[0] / 595;

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
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}:${get("second")}`;
};

const displayReceiverName = (receiverName: string | null | undefined, student: { fullName: string }) => {
  const name = receiverName?.trim();
  return name && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(name)
    ? name
    : student.fullName;
};

export async function generateTuitionReceiptPdf(
  receiptId: string,
  actorId: string,
  auditContext?: AuditContext,
  markPrinted = false,
) {
  const receiptRef = await prisma.tuitionReceipt.findUnique({
    where: { id: receiptId },
    select: { paymentId: true },
  });
  if (!receiptRef) throw new NotFoundError("Không tìm thấy biên lai");

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM tuition_payments WHERE id = ${receiptRef.paymentId}::uuid FOR UPDATE`,
    );
    return generateTuitionReceiptPdfWithClient(tx, receiptId, actorId, auditContext, markPrinted);
  });
}

async function generateTuitionReceiptPdfWithClient(
  client: Prisma.TransactionClient,
  receiptId: string,
  actorId: string,
  auditContext?: AuditContext,
  markPrinted = false,
) {
  const receipt = await client.tuitionReceipt.findUnique({
    where: { id: receiptId },
    include: {
      payment: {
        include: {
          tuitionFee: {
            include: {
              student: true,
              class: true,
              items: {
                orderBy: { displayOrder: "asc" },
                include: { classSubject: { include: { subject: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!receipt) throw new NotFoundError("Không tìm thấy biên lai");
  if (receipt.status === "CANCELLED")
    throw new ConflictError("Biên lai đã được hủy và không thể xuất PDF");
  const parsedSnapshot = parseReceiptSnapshot(
    await getTuitionReceiptSnapshot(receipt.id, client),
  );
  const student = parsedSnapshot?.student ?? receipt.payment.tuitionFee.student;
  const receiverName = displayReceiverName(parsedSnapshot?.receiverName ?? receipt.receiverName, student);
  const snapshot = parsedSnapshot ?? {
    version: 1 as const,
    receiptNo: receipt.receiptNo,
    issuedAt: receipt.issuedAt.toISOString(),
    student: { code: student.code, fullName: student.fullName },
    receiverName,
    tuitionFee: toFeeSnapshot(receipt.payment.tuitionFee, receipt.amount),
    amount: receipt.amount.toString(),
    paymentMethod: receipt.payment.paymentMethod,
  };
  if (!parsedSnapshot) {
    await saveTuitionReceiptSnapshot(client, receipt.id, snapshot);
  }
  const fee = snapshot.tuitionFee;
  const receiptFinalAmount = "finalAmount" in fee
    ? Number(fee.finalAmount)
    : Number(receipt.amount);
  const receiptPayableAmount = "payableAmount" in fee
    ? Number(fee.payableAmount)
    : Number(receipt.amount);
  const isPartialReceipt = receiptPayableAmount < receiptFinalAmount;
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await getPdfFontBytes(), { subset: true });
  let page = pdf.addPage(A5_PAGE_SIZE);
  const color = rgb(0.12, 0.16, 0.24);
  const draw = (
    text: string,
    x: number,
    y: number,
    size = 11,
    bold = false,
  ) => {
    void bold;
    page.drawText(text, {
      x: x * A5_SCALE,
      y: y * A5_SCALE,
      size: size * A5_SCALE,
      font,
      color,
    });
  };
  draw("PHIẾU THU HỌC PHÍ", 190, 770, 18, true);
  draw(`Số phiếu: ${receipt.receiptNo}`, 55, 730);
  draw(
    `Ngày thu: ${formatVietnamDateTime(receipt.payment.paymentDate)}`,
    55,
    708,
  );
  draw(`Mã thanh toán: ${receipt.payment.paymentNo}`, 55, 686);
  draw("THÔNG TIN HỌC SINH", 55, 640, 13, true);
  draw(`Mã học sinh: ${student.code}`, 75, 615);
  draw(`Họ tên: ${student.fullName}`, 75, 593);
  draw(`Lớp: ${fee.className || "Chưa có lớp"}`, 75, 571);
  draw(`Người nộp: ${receiverName}`, 75, 549);
  draw("NỘI DUNG THU", 55, 515, 13, true);
  let y = 485;
  for (const item of fee.items) {
    if (y < 130) {
      page = pdf.addPage(A5_PAGE_SIZE);
      draw("PHIẾU THU HỌC PHÍ", 190, 790, 16, true);
      draw("NỘI DUNG THU (tiếp theo)", 55, 755, 13, true);
      y = 725;
    }
    const subjectName = item.subjectName;
    draw(
      `${subjectName ? `Học phí môn: ${subjectName}` : item.itemName} x ${item.quantity.toString()}`,
      75,
      y,
    );
    if (!isPartialReceipt) draw(`${money(Number(item.amount))} VND`, 400, y);
    y -= 24;
  }
  if (!isPartialReceipt && Number(fee.discountAmount) > 0) {
    draw("Giảm giá", 75, y);
    draw(`-${money(Number(fee.discountAmount))} VND`, 400, y);
    y -= 24;
  }
  if (!isPartialReceipt && Number(fee.additionalAmount) > 0) {
    draw("Phụ thu", 75, y);
    draw(`${money(Number(fee.additionalAmount))} VND`, 400, y);
    y -= 24;
  }
  page.drawLine({
    start: { x: 55 * A5_SCALE, y: (y - 5) * A5_SCALE },
    end: { x: 540 * A5_SCALE, y: (y - 5) * A5_SCALE },
    thickness: A5_SCALE,
    color: rgb(0.8, 0.8, 0.8),
  });
  draw(isPartialReceipt ? "SỐ TIỀN THU LẦN NÀY" : "TỔNG CỘNG", 75, y - 35, 13, true);
  draw(`${money(Number(receipt.amount))} VND`, 390, y - 35, 13, true);
  draw(`Bằng chữ: ${vietnameseAmountInWords(receipt.amount.toString())}`, 75, y - 55, 9);
  draw(`Phương thức: ${receipt.payment.paymentMethod}`, 75, y - 75);
  draw("Phiếu thu được phát hành từ hệ thống quản lý học phí.", 75, 90, 9);
  const pdfBuffer = Buffer.from(await pdf.save());
  const printedAt = markPrinted ? new Date() : null;
  if (printedAt) {
    await client.$executeRaw(
      Prisma.sql`UPDATE tuition_receipts SET printed_at = ${printedAt} WHERE id = ${receipt.id}::uuid`,
    );
  }
  await client.tuitionAuditLog.create({
    data: {
      entityType: "TUITION_RECEIPT",
      entityId: receipt.id,
      action: markPrinted ? "PDF_PRINTED" : "PDF_EXPORTED",
      dataAfter: {
        receiptNo: receipt.receiptNo,
        ...(printedAt ? { printedAt: printedAt.toISOString() } : {}),
        snapshotUsed: Boolean(snapshot),
      },
      performedBy: actorId,
      ...auditFields(auditContext),
    },
  });
  return pdfBuffer;
}
