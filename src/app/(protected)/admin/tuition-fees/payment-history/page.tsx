import { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { PaymentBatchHistory } from "@/modules/finance/payments/components/PaymentBatchHistory";

export const metadata: Metadata = { title: "Giao dịch thu học phí" };
export default async function PaymentBatchHistoryPage() { await requireAuth(); return <PaymentBatchHistory />; }
