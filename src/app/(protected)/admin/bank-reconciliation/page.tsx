import { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { BankReconciliationPanel } from "@/modules/finance/bank/components/BankReconciliationPanel";
import { BankReconciliationSessionHistory } from "@/modules/finance/bank/components/BankReconciliationSessionHistory";

export const metadata: Metadata = { title: "Đối soát ngân hàng" };

export default async function BankReconciliationPage() {
  await requireAuth();
  return <div style={{ display: "grid", gap: 24, width: "100%", minWidth: 0 }}><BankReconciliationPanel /><BankReconciliationSessionHistory /></div>;
}
