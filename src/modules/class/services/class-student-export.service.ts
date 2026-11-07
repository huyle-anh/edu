import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import { buildStudentListExcel } from "@/modules/student/services/student-excel.service";

export async function buildClassStudentListExcel(classId: string): Promise<{
  file: Buffer;
  classCode: string;
}> {
  const classData = await prisma.class.findUnique({
    where: { id: classId },
    select: { code: true, name: true },
  });
  if (!classData) throw new NotFoundError("Không tìm thấy lớp học");

  const enrollments = await prisma.classStudent.findMany({
    where: { classId, status: { in: ["ACTIVE", "COMPLETED"] } },
    orderBy: { student: { fullName: "asc" } },
    select: { student: true },
  });
  const file = await buildStudentListExcel(
    enrollments.map((enrollment) => enrollment.student),
    `Lớp: ${classData.code} - ${classData.name} | Chỉ gồm học viên đang học hoặc đã hoàn thành. Cột MÃ HỌC VIÊN dùng để import lại.`,
  );

  return { file, classCode: classData.code };
}
