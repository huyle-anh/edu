import type { ReactElement } from "react";
import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { ClassTuitionReportPage } from "@/modules/finance/reports/components/ClassTuitionReportPage";

export const metadata: Metadata = { title: "Báo cáo" };

export default async function ReportsPage(): Promise<ReactElement> {
  await requireAuth();
  return <ClassTuitionReportPage />;
}
