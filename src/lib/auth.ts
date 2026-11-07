import { redirect } from "next/navigation";
import type { SessionUser } from "@/types/auth";
import { getSessionFromCookie } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { UserStatus } from "@prisma/client";

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSessionFromCookie();
  if (!session?.user) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { status: true, deletedAt: true, teacherId: true, teacher: { select: { status: true } } },
  });
  if (!user || user.status !== UserStatus.ACTIVE || user.deletedAt || (user.teacher?.status !== undefined && user.teacher.status !== "ACTIVE")) return null;
  return { ...session.user, teacherId: user.teacherId };
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
