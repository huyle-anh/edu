import { requireAuth } from "@/lib/auth";
import { UserManagement } from "@/modules/user/components/UserManagement";

export default async function UsersPage() {
  await requireAuth();
  return <UserManagement />;
}
