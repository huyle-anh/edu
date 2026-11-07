import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { Prisma, type ClassSchedule } from "@prisma/client";
import type {
  ClassScheduleCreate,
  ClassScheduleUpdate,
  ScheduleFilter,
} from "@/modules/schedule/schemas/schedule.schema";

type ClassScheduleWithRelations = Prisma.ClassScheduleGetPayload<{
  include: {
    class: true;
    teacher: true;
    classSubject: { include: { subject: true } };
  };
}>;

type ScheduleConflict = ClassScheduleWithRelations;

export class ScheduleConflictError extends Error {
  conflicts: ScheduleConflict[];

  constructor(conflicts: ScheduleConflict[]) {
    super("Phát hiện lịch học bị trùng");
    this.name = "ScheduleConflictError";
    this.conflicts = conflicts;
  }
}

async function assertScheduleRelations(
  data: {
    classId: string;
    classSubjectId: string;
    teacherId: string;
  },
  client: typeof prisma | Prisma.TransactionClient = prisma,
): Promise<void> {
  const [classData, teacher, classSubject] = await Promise.all([
    client.class.findUnique({
      where: { id: data.classId },
      select: { id: true, status: true },
    }),
    client.teacher.findUnique({
      where: { id: data.teacherId },
      select: { id: true, status: true },
    }),
    client.classSubject.findFirst({
      where: {
        id: data.classSubjectId,
        classId: data.classId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        teacherId: true,
        subject: { select: { status: true } },
      },
    }),
  ]);

  if (!classData) {
    throw new NotFoundError("Không tìm thấy lớp học");
  }

  if (classData.status === "CANCELLED" || classData.status === "COMPLETED") {
    throw new ConflictError(
      "Không thể tạo lịch cho lớp đã kết thúc hoặc đã hủy",
    );
  }

  if (!teacher) {
    throw new NotFoundError("Không tìm thấy giáo viên");
  }
  if (teacher.status !== "ACTIVE") {
    throw new ConflictError("Giáo viên đã ngừng hoạt động");
  }
  if (!classSubject) {
    throw new ConflictError("Môn học không thuộc lớp hoặc đã ngừng mở");
  }
  if (classSubject.subject.status !== "ACTIVE") {
    throw new ConflictError("Môn học đã ngừng hoạt động");
  }
  if (!classSubject.teacherId) {
    throw new ConflictError("Môn học chưa được phân công giáo viên");
  }
  if (classSubject.teacherId !== data.teacherId) {
    throw new ConflictError("Giáo viên không đúng với môn học");
  }
}

async function lockScheduleResources(
  client: Prisma.TransactionClient,
  data: { classId: string; teacherId: string; dayOfWeek: number },
) {
  await client.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`schedule:class:${data.classId}:${data.dayOfWeek}`}))`,
  );
  await client.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`schedule:teacher:${data.teacherId}:${data.dayOfWeek}`}))`,
  );
}

async function lockClassSubject(
  client: Prisma.TransactionClient,
  classSubjectId: string,
) {
  await client.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`class-subject:${classSubjectId}`}))`,
  );
}

function hasTimeConflict(
  startMinute1: number,
  endMinute1: number,
  startMinute2: number,
  endMinute2: number,
): boolean {
  return startMinute1 < endMinute2 && startMinute2 < endMinute1;
}

function toClassScheduleCreateInput(
  data: ClassScheduleCreate,
): Prisma.ClassScheduleUncheckedCreateInput {
  return {
    classId: data.classId,
    classSubjectId: data.classSubjectId,
    teacherId: data.teacherId,
    dayOfWeek: data.dayOfWeek,
    startMinute: data.startMinute,
    endMinute: data.endMinute,
  };
}

function toClassScheduleUpdateInput(
  data: ClassScheduleUpdate,
): Prisma.ClassScheduleUncheckedUpdateInput {
  return {
    ...(data.classId !== undefined && { classId: data.classId }),
    ...(data.classSubjectId !== undefined && { classSubjectId: data.classSubjectId }),
    ...(data.teacherId !== undefined && { teacherId: data.teacherId }),
    ...(data.dayOfWeek !== undefined && { dayOfWeek: data.dayOfWeek }),
    ...(data.startMinute !== undefined && { startMinute: data.startMinute }),
    ...(data.endMinute !== undefined && { endMinute: data.endMinute }),
  };
}

export async function getScheduleConflicts(
  data: {
    classId?: string | null;
    teacherId?: string | null;
    dayOfWeek: number;
    startMinute: number;
    endMinute: number;
  },
  excludeId?: string,
  client: typeof prisma | Prisma.TransactionClient = prisma,
): Promise<ScheduleConflict[]> {
  const conflictTargets: Prisma.ClassScheduleWhereInput[] = [
    ...(data.teacherId ? [{ teacherId: data.teacherId }] : []),
    ...(data.classId ? [{ classId: data.classId }] : []),
  ];

  if (conflictTargets.length === 0) return [];

  const schedules = await client.classSchedule.findMany({
    where: {
      dayOfWeek: data.dayOfWeek,
      deletedAt: null,
      class: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
      ...(excludeId && {
        id: {
          not: excludeId,
        },
      }),
      OR: conflictTargets,
    },
    include: {
      class: true,
      teacher: true,
      classSubject: { include: { subject: true } },
    },
  });

  return schedules.filter((schedule) =>
    hasTimeConflict(
      data.startMinute,
      data.endMinute,
      schedule.startMinute,
      schedule.endMinute,
    ),
  );
}

export async function createClassSchedule(data: ClassScheduleCreate): Promise<{
  schedule: ClassScheduleWithRelations;
  conflicts: ScheduleConflict[];
}> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`class:${data.classId}`}))`,
    );
    await lockScheduleResources(tx, data);
    await lockClassSubject(tx, data.classSubjectId);
    await assertScheduleRelations(data, tx);
    const conflicts = await getScheduleConflicts(data, undefined, tx);

    if (conflicts.length > 0) {
      throw new ScheduleConflictError(conflicts);
    }

    const schedule = await tx.classSchedule.create({
      data: toClassScheduleCreateInput(data),
      include: {
        class: true,
        teacher: true,
        classSubject: { include: { subject: true } },
      },
    });

    return {
      schedule,
      conflicts,
    };
  });
}

export async function getClassScheduleById(
  id: string,
): Promise<ClassScheduleWithRelations | null> {
  return prisma.classSchedule.findFirst({
    where: {
      id,
      deletedAt: null,
      class: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
    },
    include: {
      class: true,
      teacher: true,
      classSubject: { include: { subject: true } },
    },
  });
}

export async function getSchedules(filter: ScheduleFilter) {
  const page = Math.max(filter.page ?? 1, 1);
  const pageSize = Math.max(filter.pageSize ?? 10, 1);
  const skip = (page - 1) * pageSize;

  const where: Prisma.ClassScheduleWhereInput = {
    deletedAt: null,
    class: filter.classId
      ? { id: filter.classId }
      : { status: { notIn: ["COMPLETED", "CANCELLED"] } },
    ...(filter.classId && { classId: filter.classId }),
    ...(filter.classSubjectId && { classSubjectId: filter.classSubjectId }),
    ...(filter.dayOfWeek !== undefined && { dayOfWeek: filter.dayOfWeek }),
  };

  const [schedules, total] = await Promise.all([
    prisma.classSchedule.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        class: true,
        teacher: true,
        classSubject: { include: { subject: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }, { id: "asc" }],
    }),
    prisma.classSchedule.count({ where }),
  ]);

  return {
    items: schedules,
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

export async function updateClassSchedule(
  id: string,
  data: ClassScheduleUpdate,
): Promise<{
  schedule: ClassScheduleWithRelations;
  conflicts: ScheduleConflict[];
}> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM class_schedules WHERE id = ${id}::uuid FOR UPDATE`,
    );
    const current = await tx.classSchedule.findFirst({
      where: { id, deletedAt: null },
    });

    if (!current) {
      throw new NotFoundError("Không tìm thấy lịch học");
    }

    const classSubjectId = data.classSubjectId ?? current.classSubjectId;
    if (!classSubjectId) {
      throw new ConflictError("Lịch học phải được gắn với môn học");
    }
    const merged = {
      classId: data.classId ?? current.classId,
      classSubjectId,
      teacherId: data.teacherId ?? current.teacherId,
      dayOfWeek: data.dayOfWeek ?? current.dayOfWeek,
      startMinute: data.startMinute ?? current.startMinute,
      endMinute: data.endMinute ?? current.endMinute,
    };

    if (merged.startMinute >= merged.endMinute) {
      throw new ConflictError("Giờ kết thúc phải sau giờ bắt đầu");
    }

    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`class:${merged.classId}`}))`,
    );
    await lockScheduleResources(tx, merged);
    await lockClassSubject(tx, merged.classSubjectId);
    await assertScheduleRelations(merged, tx);
    const conflicts = await getScheduleConflicts(merged, id, tx);

    if (conflicts.length > 0) {
      throw new ScheduleConflictError(conflicts);
    }

    const schedule = await tx.classSchedule.update({
      where: { id },
      data: toClassScheduleUpdateInput(data),
      include: {
        class: true,
        teacher: true,
        classSubject: { include: { subject: true } },
      },
    });

    return {
      schedule,
      conflicts,
    };
  });
}

export async function deleteClassSchedule(id: string): Promise<ClassSchedule> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM class_schedules WHERE id = ${id}::uuid FOR UPDATE`,
    );
    const schedule = await tx.classSchedule.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        classId: true,
        classSubjectId: true,
        teacherId: true,
        dayOfWeek: true,
      },
    });
    if (!schedule) {
      throw new NotFoundError("Không tìm thấy lịch học");
    }

    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`class:${schedule.classId}`}))`,
    );
    await lockScheduleResources(tx, schedule);
    await lockClassSubject(tx, schedule.classSubjectId);
    const classData = await tx.class.findUnique({
      where: { id: schedule.classId },
      select: { status: true },
    });
    if (!classData) {
      throw new NotFoundError("Không tìm thấy lớp học");
    }
    if (classData.status === "COMPLETED" || classData.status === "CANCELLED") {
      throw new ConflictError("Không thể thay đổi lịch của lớp đã kết thúc hoặc đã hủy");
    }

    return tx.classSchedule.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  });
}
