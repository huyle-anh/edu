import { requireAuth } from "@/lib/auth";
import { StudentList } from "@/modules/student/components/StudentList";
import type { ReactElement } from "react";

export default async function StudentsPage(): Promise<ReactElement> {
  await requireAuth();
  return <StudentList />;
}
