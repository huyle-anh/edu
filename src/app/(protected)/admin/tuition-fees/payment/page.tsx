import { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { TuitionPaymentWorkspace } from "@/modules/finance/payments/components/TuitionPaymentWorkspace";

export const metadata: Metadata = { title: "Thu học phí" };

export default async function TuitionPaymentPage({ searchParams }: { searchParams: Promise<{ tuitionFeeId?: string }> }) {
  await requireAuth();
  return <TuitionPaymentWorkspace initialTuitionFeeId={(await searchParams).tuitionFeeId} />;
}
