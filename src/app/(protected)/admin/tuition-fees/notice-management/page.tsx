import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { PaymentBatchManagement } from "@/modules/finance/payments/components/PaymentBatchManagement";

export const metadata: Metadata = { title: "Quản lý thông báo và đợt thu" };

export default async function PaymentBatchManagementPage() {
  await requireAuth();
  return <PaymentBatchManagement />;
}
