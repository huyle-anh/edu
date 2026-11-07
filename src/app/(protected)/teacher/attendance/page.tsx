import { AttendancePage } from "@/modules/attendance/components/AttendancePage";
import { requireAuth } from "@/lib/auth";

export default async function TeacherAttendanceRoute() {
  await requireAuth();
  return <AttendancePage />;
}
