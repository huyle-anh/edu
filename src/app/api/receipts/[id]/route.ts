import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const routeParamsSchema = z.object({ id: z.string().uuid() });

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const { id } = routeParamsSchema.parse(await params);
    const receipt = await prisma.tuitionReceipt.findUnique({
      where: { id },
      select: {
        receiptNo: true,
        issuedAt: true,
        receiverName: true,
        amount: true,
        status: true,
        payment: {
          select: {
            id: true,
            paymentNo: true,
            paymentDate: true,
            paymentStatus: true,
            paymentMethod: true,
            transactionReference: true,
            refunds: {
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                refundNo: true,
                amount: true,
                refundMethod: true,
                status: true,
                reason: true,
                bankTransactionNo: true,
              },
            },
            tuitionFee: {
              select: {
                feeNo: true,
                finalAmount: true,
                discountAmount: true,
                additionalAmount: true,
                student: { select: { id: true, code: true, fullName: true } },
                class: { select: { name: true } },
                items: {
                  select: {
                    itemName: true,
                    amount: true,
                    classSubject: {
                      select: { subject: { select: { name: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    return receipt ? apiSuccess(receipt) : apiError("NOT_FOUND", "Không tìm thấy biên lai", 404);
  } catch (error) {
    return handleApiError(error, "Không thể tải biên lai");
  }
}
