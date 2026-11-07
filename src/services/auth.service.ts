import bcrypt from "bcrypt";
import { UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { LoginInput } from "@/schemas/auth.schema";

type AuthUserResult = {
  user: {
    id: string;
    email: string;
    fullName: string;
  };
  rememberMe: boolean;
};

export async function authenticateUser(input: LoginInput): Promise<AuthUserResult | null> {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    include: { teacher: { select: { status: true } } },
  });

  if (!user || user.status !== UserStatus.ACTIVE || (user.teacher?.status !== undefined && user.teacher.status !== "ACTIVE")) {
    return null;
  }

  const isValid = await bcrypt.compare(input.password, user.passwordHash);

  if (!isValid) {
    return null;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
    },
    rememberMe: input.rememberMe,
  };
}
