import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { TuitionPaymentStatus } from "@prisma/client";
import { Prisma, type Teacher } from "@prisma/client";
import type {
  TeacherCreate,
  TeacherFilter,
  TeacherUpdate,
} from "@/modules/teacher/schemas/teacher.schema";

function buildTeacherCreateInput(
  data: TeacherCreate,
): Prisma.TeacherCreateInput {
  return {
    fullName: data.fullName,
    code: "",
    phone: data.phone || null,
    bankAccount: data.bankAccount || null,
    specialty: data.specialty || null,
    commissionPercent: data.commissionPercent,
    status: data.status,
    deletedAt: data.status === "INACTIVE" ? new Date() : null,
  };
}

async function generateTeacherCode() {
  const prefix = `GV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
    if (!(await prisma.teacher.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  throw new ConflictError("Không thể tạo mã giáo viên tự động, vui lòng thử lại");
}

function buildTeacherUpdateInput(
  data: TeacherUpdate,
): Prisma.TeacherUpdateInput {
  return {
    ...(data.fullName !== undefined && { fullName: data.fullName }),
    ...(data.code !== undefined && { code: data.code }),
    ...(data.phone !== undefined && { phone: data.phone || null }),
    ...(data.bankAccount !== undefined && {
      bankAccount: data.bankAccount || null,
    }),
    ...(data.specialty !== undefined && {
      specialty: data.specialty || null,
    }),
    ...(data.commissionPercent !== undefined && {
      commissionPercent: data.commissionPercent,
    }),
    ...(data.status !== undefined && { status: data.status }),
    ...(data.status === "INACTIVE" && { deletedAt: new Date() }),
    ...(data.status === "ACTIVE" && { deletedAt: null }),
  };
}

export async function createTeacher(data: TeacherCreate): Promise<Teacher> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = await generateTeacherCode();
    try {
      return await prisma.teacher.create({
        data: { ...buildTeacherCreateInput(data), code },
      });
    } catch (error: unknown) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      ) {
        throw error;
      }
    }
  }
  throw new ConflictError("Không thể tạo mã giáo viên tự động, vui lòng thử lại");
}

export async function getTeacherById(
  id: string,
): Promise<Teacher | null> {
  return prisma.teacher.findUnique({ where: { id } });
}

export async function getTeachers(filter: TeacherFilter) {
  const { search, status, page, pageSize } = filter;
  const statusFilter = status === "ALL" ? undefined : status;
  const skip = (page - 1) * pageSize;

  const where: Prisma.TeacherWhereInput = {
    ...(search && {
      OR: [
        { code: { contains: search, mode: "insensitive" } },
        { fullName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { specialty: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...(statusFilter && { status: statusFilter }),
    ...(!status && { deletedAt: null }),
  };

  const [teachers, total] = await Promise.all([
    prisma.teacher.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.teacher.count({ where }),
  ]);

  return {
    teachers,
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

export async function updateTeacher(
  id: string,
  data: TeacherUpdate,
): Promise<Teacher> {
  return prisma.$transaction(async (tx) => {
    // Serialize identity/commission changes with payment completion, which
    // takes the same teacher row lock before creating a successful payment.
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM teachers WHERE id = ${id}::uuid FOR UPDATE`,
    );
    const currentTeacher = await tx.teacher.findUnique({ where: { id } });

    if (!currentTeacher) {
      throw new NotFoundError("Không tìm thấy giáo viên");
    }

    const reportIdentityChanged =
      (data.fullName !== undefined && data.fullName !== currentTeacher.fullName) ||
      (data.code !== undefined && data.code !== currentTeacher.code) ||
      (data.commissionPercent !== undefined &&
        data.commissionPercent !== Number(currentTeacher.commissionPercent));
    if (reportIdentityChanged) {
      const hasPaidHistory = await tx.tuitionFeeItem.findFirst({
        where: {
          classSubject: { teacherId: id },
          tuitionFee: {
            payments: { some: { paymentStatus: TuitionPaymentStatus.SUCCESS } },
          },
        },
        select: { id: true },
      });
      if (hasPaidHistory) {
        throw new ConflictError(
          "Không thể thay đổi thông tin giáo viên đã có doanh thu trong báo cáo",
        );
      }
    }

    return tx.teacher.update({
      where: { id },
      data: buildTeacherUpdateInput(data),
    });
  });
}

export async function deleteTeacher(id: string): Promise<Teacher> {
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!teacher) {
    throw new NotFoundError("Không tìm thấy giáo viên");
  }

  return prisma.teacher.update({
    where: { id },
    data: { status: "INACTIVE", deletedAt: new Date() },
  });
}
