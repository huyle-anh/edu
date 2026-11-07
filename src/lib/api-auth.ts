import { getSessionFromCookie } from "@/lib/session";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { UserStatus } from "@prisma/client";
import type { SessionUser } from "@/types/auth";

export async function requireApiUser(options: { allowTeacher?: boolean } = {}): Promise<
  SessionUser | Response
> {
  const session = await getSessionFromCookie();

  if (!session?.user) {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { status: true, deletedAt: true, teacherId: true, teacher: { select: { status: true } } },
  });
  if (!user || user.status !== UserStatus.ACTIVE || user.deletedAt || (user.teacher?.status !== undefined && user.teacher.status !== "ACTIVE")) {
    return apiError("UNAUTHORIZED", "Tài khoản không còn hoạt động", 401);
  }

  if (user.teacherId && !options.allowTeacher) {
    return apiError("UNAUTHORIZED", "Tài khoản giáo viên không có quyền truy cập chức năng này", 403);
  }
  return { ...session.user, teacherId: user.teacherId };
}
