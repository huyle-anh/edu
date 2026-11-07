import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requireAuth } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAuth();
  if (user.teacherId) redirect("/teacher/attendance");
  return children;
}
