import { AttendanceCalendarPage } from "@/modules/attendance/components/AttendanceCalendarPage";
import { requireAuth } from "@/lib/auth";

export default async function TeacherAttendanceCalendarRoute() {
  await requireAuth();
  return <AttendanceCalendarPage />;
}
