import { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { PaymentBatchDetail } from "@/modules/finance/payments/components/PaymentBatchDetail";

export const metadata: Metadata = { title: "Chi tiết đợt thanh toán" };

export default async function PaymentBatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();
  return <PaymentBatchDetail id={(await params).id} />;
}
