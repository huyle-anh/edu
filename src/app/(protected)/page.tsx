import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";

export default async function HomePage(): Promise<never> {
  const user = await requireAuth();
  redirect(user.teacherId ? "/teacher/attendance" : "/admin");
}
