import { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { TuitionList } from "@/modules/finance/tuition/components/TuitionList";

export const metadata: Metadata = { title: "Quản lý các khoản học phí" };

export default async function TuitionFeesPage() { await requireAuth(); return <TuitionList />; }
