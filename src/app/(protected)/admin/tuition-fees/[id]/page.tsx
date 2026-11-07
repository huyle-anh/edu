import { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { TuitionDetail } from "@/modules/finance/tuition/components/TuitionDetail";

export const metadata: Metadata = { title: "Chi tiết học phí" };
export default async function TuitionDetailPage({ params }: { params: Promise<{ id: string }> }) { await requireAuth(); return <TuitionDetail id={(await params).id} />; }
