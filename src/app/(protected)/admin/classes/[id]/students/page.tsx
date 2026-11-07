import { requireAuth } from "@/lib/auth";
import { ClassStudentManagement } from "@/modules/class/components/ClassStudentManagement";

export default async function ClassStudentsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  return <ClassStudentManagement id={(await params).id} />;
}
