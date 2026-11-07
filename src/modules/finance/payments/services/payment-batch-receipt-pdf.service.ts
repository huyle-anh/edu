import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { auditFields, type AuditContext } from "@/lib/audit";
import { getPdfFontBytes } from "@/lib/pdf-font";
import { vietnameseAmountInWords } from "@/lib/vietnamese-amount";
import {
  getPaymentBatchReceiptSnapshot,
  parseBatchReceiptSnapshot,
  savePaymentBatchReceiptSnapshot,
  toFeeSnapshot,
} from "./payment-document-snapshot";

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

export async function generatePaymentBatchReceiptPdf(
  receiptId: string,
  actorId: string,
  auditContext?: AuditContext,
  markPrinted = false,
) {
  const receiptRef = await prisma.paymentBatchReceipt.findUnique({
    where: { id: receiptId },
    select: { paymentBatchId: true },
  });
  if (!receiptRef) throw new NotFoundError("Không tìm thấy biên lai tổng");

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM tuition_payments WHERE payment_batch_id = ${receiptRef.paymentBatchId}::uuid ORDER BY id FOR UPDATE`,
    );
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM payment_batches WHERE id = ${receiptRef.paymentBatchId}::uuid FOR UPDATE`,
    );
    return generatePaymentBatchReceiptPdfWithClient(tx, receiptId, actorId, auditContext, markPrinted);
  });
}

async function generatePaymentBatchReceiptPdfWithClient(
  client: Prisma.TransactionClient,
  receiptId: string,
  actorId: string,
  auditContext?: AuditContext,
  markPrinted = false,
) {
  const receipt = await client.paymentBatchReceipt.findUnique({
    where: { id: receiptId },
    include: {
      paymentBatch: {
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
      },
    },
  });
  if (!receipt) throw new NotFoundError("Không tìm thấy biên lai tổng");
  if (receipt.paymentBatch.status !== "SUCCESS") {
    throw new ConflictError("Biên lai tổng đã bị hủy và không thể xuất PDF");
  }
  const parsedSnapshot = parseBatchReceiptSnapshot(
    await getPaymentBatchReceiptSnapshot(receipt.id, client),
  );
  if (parsedSnapshot?.status === "CANCELLED") {
    throw new ConflictError("Biên lai tổng đã được hủy và không thể xuất PDF");
  }
  const student = parsedSnapshot?.student ?? receipt.paymentBatch.student;
  const receiverName = displayReceiverName(parsedSnapshot?.receiverName ?? receipt.receiverName, student);
  const snapshot = parsedSnapshot ?? {
    version: 1 as const,
    receiptNo: receipt.receiptNo,
    issuedAt: receipt.issuedAt.toISOString(),
    student: { code: student.code, fullName: student.fullName },
    receiverName,
    fees: receipt.paymentBatch.allocations.map((allocation) =>
      toFeeSnapshot(allocation.tuitionFee, allocation.amount),
    ),
    amount: receipt.paymentBatch.totalAmount.toString(),
    paymentMethod: receipt.paymentBatch.paymentMethod,
  };
  if (!parsedSnapshot) {
    await savePaymentBatchReceiptSnapshot(client, receipt.id, snapshot);
  }
  const fees = snapshot.fees;

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await getPdfFontBytes(), { subset: true });
  let page = pdf.addPage(A5_PAGE_SIZE);
  const color = rgb(0.12, 0.16, 0.24);
  const draw = (text: string, x: number, y: number, size = 11) =>
    page.drawText(text, {
      x: x * A5_SCALE,
      y: y * A5_SCALE,
      size: size * A5_SCALE,
      font,
      color,
    });

  draw("BIÊN LAI THANH TOÁN HỌC PHÍ", 155, 770, 17);
  draw(`Số biên lai: ${receipt.receiptNo}`, 55, 730);
  draw(`Mã thanh toán: ${receipt.paymentBatch.batchNo}`, 55, 708);
  draw(
    `Ngày thu: ${formatVietnamDateTime(receipt.paymentBatch.paymentDate)}`,
    55,
    686,
  );
  draw("THÔNG TIN HỌC SINH", 55, 640, 13);
  draw(`Mã học sinh: ${student.code}`, 75, 615);
  draw(`Họ tên: ${student.fullName}`, 75, 593);
  draw(`Người nộp: ${receiverName}`, 75, 571);
  draw("CÁC KHOẢN ĐÃ THANH TOÁN", 55, 545, 13);

  let y = 515;
  for (const allocation of fees) {
    if (y < 260) {
      page = pdf.addPage(A5_PAGE_SIZE);
      draw("BIÊN LAI THANH TOÁN HỌC PHÍ", 155, 790, 15);
      draw("CÁC KHOẢN ĐÃ THANH TOÁN (tiếp theo)", 55, 755, 13);
      y = 725;
    }
    draw(
      `${allocation.feeNo} — ${allocation.className || "Chưa có lớp"}`,
      75,
      y,
    );
    const payableAmount = allocation.payableAmount ?? allocation.finalAmount;
    const isPartialReceipt = Number(payableAmount) < Number(allocation.finalAmount);
    draw(`${money(Number(payableAmount))} VND`, 390, y);
    let itemY = y - 17;
    for (const item of allocation.items) {
      if (itemY < 220) {
        page = pdf.addPage(A5_PAGE_SIZE);
        draw("BIÊN LAI THANH TOÁN HỌC PHÍ", 155, 790, 15);
        draw("CÁC KHOẢN ĐÃ THANH TOÁN (tiếp theo)", 55, 755, 13);
        itemY = 725;
      }
      const subjectName = item.subjectName || item.itemName;
      draw(`- ${subjectName}`, 90, itemY, 9);
      if (!isPartialReceipt) draw(`${money(Number(item.amount))} VND`, 390, itemY, 9);
      itemY -= 17;
    }
    if (!isPartialReceipt && Number(allocation.discountAmount) > 0) {
      draw("- Giảm giá", 90, itemY, 9);
      draw(`-${money(Number(allocation.discountAmount))} VND`, 390, itemY, 9);
      itemY -= 17;
    }
    if (!isPartialReceipt && Number(allocation.additionalAmount) > 0) {
      draw("- Phụ thu", 90, itemY, 9);
      draw(`${money(Number(allocation.additionalAmount))} VND`, 390, itemY, 9);
      itemY -= 17;
    }
    y = itemY - 10;
  }
  page.drawLine({
    start: { x: 55 * A5_SCALE, y: (y - 5) * A5_SCALE },
    end: { x: 540 * A5_SCALE, y: (y - 5) * A5_SCALE },
    thickness: A5_SCALE,
    color: rgb(0.8, 0.8, 0.8),
  });
  draw("TỔNG CỘNG", 75, y - 35, 13);
  draw(`${money(Number(receipt.amount))} VND`, 390, y - 35, 13);
  draw(`Bằng chữ: ${vietnameseAmountInWords(receipt.amount.toString())}`, 75, y - 55, 9);
  draw(`Phương thức: ${receipt.paymentBatch.paymentMethod}`, 75, y - 75);
  if (receipt.paymentBatch.bankTransactionNo)
    draw(
      `Mã giao dịch NH: ${receipt.paymentBatch.bankTransactionNo}`,
      75,
      y - 97,
    );
  else if (receipt.paymentBatch.transactionReference)
    draw(
      `Mã tham chiếu: ${receipt.paymentBatch.transactionReference}`,
      75,
      y - 97,
    );
  draw(
    "Biên lai tổng hợp được phát hành từ hệ thống quản lý học phí.",
    75,
    90,
    9,
  );
  const pdfBuffer = Buffer.from(await pdf.save());
  const printedAt = markPrinted ? new Date() : null;
  if (printedAt) {
    await client.$executeRaw(
      Prisma.sql`UPDATE payment_batch_receipts SET printed_at = ${printedAt} WHERE id = ${receipt.id}::uuid`,
    );
  }
  await client.tuitionAuditLog.create({
    data: {
      entityType: "PAYMENT_BATCH",
      entityId: receipt.paymentBatchId,
      action: markPrinted ? "RECEIPT_PDF_PRINTED" : "RECEIPT_PDF_EXPORTED",
      dataAfter: {
        receiptNo: receipt.receiptNo,
        ...(printedAt ? { printedAt: printedAt.toISOString() } : {}),
        snapshotUsed: Boolean(snapshot),
      },
      performedBy: actorId,
      ...auditFields(auditContext),
    },
  });
  return {
    pdf: pdfBuffer,
    batchNo: receipt.paymentBatch.batchNo,
  };
}
