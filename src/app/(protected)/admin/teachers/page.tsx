import { requireAuth } from "@/lib/auth";
import { TeacherList } from "@/modules/teacher/components/TeacherList";
import type { ReactElement } from "react";

export default async function TeachersPage(): Promise<ReactElement> {
  await requireAuth();
  return <TeacherList />;
}
