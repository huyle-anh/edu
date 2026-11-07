import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ClassTuitionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  redirect(`/admin/classes/${id}/students`);
}
