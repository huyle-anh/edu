import bcrypt from "bcrypt";
import { Prisma, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type { UserCreate, UserFilter, UserUpdate } from "../schemas/user.schema";

function withoutPassword<T extends { passwordHash: string }>(user: T) {
  const { passwordHash, ...safeUser } = user;
  void passwordHash;
  return safeUser;
}

export async function getUsers(filter: UserFilter) {
  const { search, status, page, pageSize } = filter;
  const where: Prisma.UserWhereInput = {
    ...(search && {
      OR: [
        { email: { contains: search, mode: "insensitive" } },
        { fullName: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...(status && { status }),
  };
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { teacher: { select: { id: true, code: true, fullName: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);
  return {
    items: users.map(withoutPassword),
    total,
    page,
    pageSize,
    pages: Math.ceil(total / pageSize),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function createUser(data: UserCreate) {
  if (data.teacherId) {
    const teacher = await prisma.teacher.findUnique({ where: { id: data.teacherId }, select: { id: true, status: true, user: { select: { id: true } } } });
    if (!teacher || teacher.status !== "ACTIVE") throw new NotFoundError("Không tìm thấy giáo viên đang hoạt động");
    if (teacher.user) throw new ConflictError("Giáo viên đã được liên kết với tài khoản khác");
  }
  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      fullName: data.fullName,
      passwordHash,
      status: data.status,
      teacherId: data.teacherId ?? null,
    },
    include: { teacher: { select: { id: true, code: true, fullName: true } } },
  });
  return withoutPassword(user);
}

export async function updateUser(id: string, data: UserUpdate, actorId: string) {
  if (id === actorId && data.status && data.status !== "ACTIVE") {
    throw new ConflictError("Không thể khóa tài khoản đang đăng nhập");
  }
  const current = await prisma.user.findUnique({ where: { id } });
  if (!current) throw new NotFoundError("Không tìm thấy người dùng");
  if (data.teacherId !== undefined && data.teacherId !== current.teacherId) {
    if (data.teacherId) {
      const teacher = await prisma.teacher.findUnique({ where: { id: data.teacherId }, select: { id: true, status: true, user: { select: { id: true } } } });
      if (!teacher || teacher.status !== "ACTIVE") throw new NotFoundError("Không tìm thấy giáo viên đang hoạt động");
      if (teacher.user && teacher.user.id !== id) throw new ConflictError("Giáo viên đã được liên kết với tài khoản khác");
    }
  }
  const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : undefined;
  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      include: { teacher: { select: { id: true, code: true, fullName: true } } },
      data: {
        email: data.email?.toLowerCase(),
        fullName: data.fullName,
        passwordHash,
        status: data.status,
        ...(data.teacherId !== undefined && { teacherId: data.teacherId }),
        deletedAt:
          data.status === "ACTIVE"
            ? null
            : data.status === "INACTIVE"
              ? new Date()
              : undefined,
      },
    });
    return withoutPassword(updated);
  });
}

export async function deactivateUser(id: string, actorId: string) {
  if (id === actorId) throw new ConflictError("Không thể khóa tài khoản đang đăng nhập");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError("Không tìm thấy người dùng");
  const updated = await prisma.user.update({
    where: { id },
    data: { status: UserStatus.INACTIVE, deletedAt: new Date() },
  });
  return withoutPassword(updated);
}
