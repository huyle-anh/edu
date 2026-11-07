import { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { ReceiptList } from "@/modules/finance/receipts/ReceiptList";

export const metadata: Metadata = {
  title: "Biên lai học phí",
};

export default async function ReceiptsPage() {
  await requireAuth();
  return <ReceiptList />;
}
