import { requireAuth } from "@/lib/auth";
import { SubjectManagement } from "@/modules/class/components/SubjectManagement";

export default async function SubjectsPage() {
  await requireAuth();
  return <SubjectManagement />;
}
