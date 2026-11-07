import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { getVietnamCalendarDateStart, getVietnamDate, getVietnamDayEndExclusive, parseVietnamDateStart } from "@/lib/vietnam-time";
import type { AttendanceCreate, AttendanceQuery, AttendanceUpdate } from "@/modules/attendance/schemas/attendance.schema";

type EnrollmentClient = Pick<Prisma.TransactionClient, "classStudent">;
type ClassSubjectClient = Pick<Prisma.TransactionClient, "classSubject">;

function getSessionDateBounds(sessionAt: Date) {
  const dateText = getVietnamDate(sessionAt);
  const date = new Date(`${dateText}T00:00:00.000Z`);
  const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const vietnamDayStart = parseVietnamDateStart(dateText);
  const vietnamDayEndExclusive = getVietnamDayEndExclusive(dateText);
  if (!vietnamDayStart || !vietnamDayEndExclusive) throw new ConflictError("Thời điểm điểm danh không hợp lệ");
  return { date, monthStart, vietnamDayStart, vietnamDayEndExclusive };
}

async function getEligibleEnrollments(
  client: EnrollmentClient,
  classSubject: { classId: string; id: string },
  sessionAt: Date,
) {
  const { date, monthStart, vietnamDayStart, vietnamDayEndExclusive } = getSessionDateBounds(sessionAt);
  return client.classStudent.findMany({
    where: {
      classId: classSubject.classId,
      enrolledAt: { lte: date },
      currentPeriodStart: { lte: date },
      AND: [
        { OR: [{ deletedAt: null }, { deletedAt: { gte: vietnamDayStart } }] },
        { OR: [
          { status: "ACTIVE" },
          { status: "COMPLETED" },
          { status: "LEFT", OR: [{ leftAt: { gte: date } }, { deletedAt: { gte: vietnamDayStart } }] },
        ] },
        {
          student: {
            OR: [
              { status: "ACTIVE", OR: [{ deletedAt: null }, { deletedAt: { gte: vietnamDayStart } }] },
              { status: "INACTIVE", deletedAt: { gte: vietnamDayStart } },
            ],
          },
        },
        { pauses: { none: {
          status: "ACTIVE",
          startMonth: { lte: monthStart },
          endMonth: { gte: monthStart },
        } } },
        { subjects: { some: {
          classSubjectId: classSubject.id,
          status: { in: ["ACTIVE", "DROPPED", "COMPLETED"] },
          enrolledAt: { lt: vietnamDayEndExclusive },
          OR: [{ droppedAt: null }, { droppedAt: { gte: vietnamDayStart } }],
        } } },
      ],
    },
    select: { id: true, student: { select: { id: true, code: true, fullName: true } } },
    orderBy: { student: { fullName: "asc" } },
  });
}

async function getAuthorizedClassSubject(
  client: ClassSubjectClient,
  classId: string,
  teacherId: string | null,
) {
  const assignment = await client.classSubject.findFirst({
    where: {
      classId,
      ...(teacherId ? { teacherId } : {}),
    },
    include: {
      class: { select: { id: true, code: true, name: true, status: true, startDate: true, endDate: true, deletedAt: true } },
      subject: { select: { name: true } },
      teacher: { select: { id: true, fullName: true } },
    },
  });
  if (!assignment) throw new NotFoundError("Không tìm thấy lớp hoặc bạn không được phân công");
  return assignment;
}

function validateCanCreate(assignment: Awaited<ReturnType<typeof getAuthorizedClassSubject>>, sessionAt: Date) {
  if (assignment.deletedAt || !assignment.teacherId || !assignment.teacher || assignment.status !== "ACTIVE" || assignment.class.status !== "ACTIVE") {
    throw new ConflictError("Chỉ có thể tạo phiên điểm danh cho lớp đang hoạt động");
  }
  const sessionDate = getVietnamCalendarDateStart(sessionAt);
  if (assignment.class.startDate && sessionDate < assignment.class.startDate) {
    throw new ConflictError("Ngày điểm danh nằm trước thời gian hoạt động của lớp");
  }
  if (assignment.class.endDate && sessionDate > assignment.class.endDate) {
    throw new ConflictError("Ngày điểm danh nằm sau thời gian hoạt động của lớp");
  }
}

function normalizeRecords(records: AttendanceCreate["records"]) {
  if (new Set(records.map((record) => record.enrollmentId)).size !== records.length) {
    throw new ConflictError("Danh sách điểm danh có học viên bị trùng");
  }
  return records.map((record) => ({
    enrollmentId: record.enrollmentId,
    status: record.status,
    note: record.status === "ABSENT" ? record.note?.trim() || null : null,
  }));
}

function validateRoster(submittedIds: string[], expectedIds: Set<string>) {
  const submitted = new Set(submittedIds);
  if (submitted.size !== submittedIds.length || submitted.size !== expectedIds.size || [...expectedIds].some((id) => !submitted.has(id))) {
    throw new ConflictError("Danh sách học viên đã thay đổi; vui lòng tải lại trước khi lưu");
  }
}

export async function getAttendanceClasses(filter: AttendanceQuery, teacherId: string | null) {
  const where: Prisma.ClassSubjectWhereInput = {
    ...(teacherId ? { teacherId } : {}),
    OR: [
      {
        deletedAt: null,
        status: { in: ["ACTIVE", "COMPLETED"] },
        class: { deletedAt: null, status: { in: ["ACTIVE", "COMPLETED"] } },
      },
      { attendanceSessions: { some: {} } },
    ],
  };
  const skip = (filter.page - 1) * filter.pageSize;
  const [assignments, total] = await prisma.$transaction([
    prisma.classSubject.findMany({
      where,
      skip,
      take: filter.pageSize,
      include: {
        class: { select: { id: true, code: true, name: true, status: true, startDate: true, endDate: true } },
        subject: { select: { name: true } },
        teacher: { select: { fullName: true } },
      },
      orderBy: [{ class: { name: "asc" } }, { subject: { name: "asc" } }],
    }),
    prisma.classSubject.count({ where }),
  ]);
  const today = getVietnamCalendarDateStart();
  const items = assignments.map((assignment) => ({
    classId: assignment.classId,
    classCode: assignment.class.code,
    className: assignment.class.name,
    classStatus: assignment.class.status,
    subjectName: assignment.subject.name,
    teacherName: assignment.teacher?.fullName ?? "",
    canCreate: Boolean(assignment.teacherId && assignment.teacher) && assignment.status === "ACTIVE" && assignment.class.status === "ACTIVE" &&
      (!assignment.class.startDate || today >= assignment.class.startDate) &&
      (!assignment.class.endDate || today <= assignment.class.endDate),
  }));
  return {
    items,
    pagination: { page: filter.page, pageSize: filter.pageSize, total, totalPages: Math.ceil(total / filter.pageSize) },
  };
}

export async function getAttendanceSessions(classId: string, filter: AttendanceQuery, teacherId: string | null) {
  const assignment = await getAuthorizedClassSubject(prisma, classId, teacherId);
  const from = filter.fromDate ? parseVietnamDateStart(filter.fromDate) : null;
  const to = filter.toDate ? getVietnamDayEndExclusive(filter.toDate) : null;
  const where = {
    classSubjectId: assignment.id,
    ...(from && to ? { sessionAt: { gte: from, lt: to } } : {}),
  };
  const skip = (filter.page - 1) * filter.pageSize;
  const [sessions, total] = await prisma.$transaction([
    prisma.attendanceSession.findMany({
      where,
      skip,
      take: filter.pageSize,
      orderBy: { sessionAt: "desc" },
      select: { id: true, sessionAt: true, updatedAt: true, _count: { select: { records: true } } },
    }),
    prisma.attendanceSession.count({ where }),
  ]);
  return {
    class: {
      id: assignment.class.id,
      code: assignment.class.code,
      name: assignment.class.name,
      status: assignment.class.status,
      subjectName: assignment.subject.name,
      teacherName: assignment.teacher?.fullName ?? "",
    },
    items: sessions.map(({ _count, ...session }) => ({ ...session, studentCount: _count.records })),
    pagination: { page: filter.page, pageSize: filter.pageSize, total, totalPages: Math.ceil(total / filter.pageSize) },
  };
}

export async function getNewAttendanceRoster(classId: string, teacherId: string | null) {
  const assignment = await getAuthorizedClassSubject(prisma, classId, teacherId);
  const sessionAt = new Date();
  validateCanCreate(assignment, sessionAt);
  const eligible = await getEligibleEnrollments(prisma, assignment, sessionAt);
  return {
    class: {
      id: assignment.class.id,
      code: assignment.class.code,
      name: assignment.class.name,
      subjectName: assignment.subject.name,
      teacherName: assignment.teacher?.fullName ?? "",
    },
    records: eligible.map((enrollment) => ({ enrollmentId: enrollment.id, student: enrollment.student, status: "PRESENT" as const, note: "" })),
  };
}

export async function getAttendanceSession(sessionId: string, teacherId: string | null) {
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    include: {
      classSubject: {
        include: {
          class: { select: { id: true, code: true, name: true } },
          subject: { select: { name: true } },
          teacher: { select: { id: true, fullName: true } },
        },
      },
      records: { include: { enrollment: { select: { id: true, student: { select: { id: true, code: true, fullName: true } } } } } },
      audits: { orderBy: { performedAt: "desc" }, take: 20, include: { actor: { select: { fullName: true } } } },
    },
  });
  if (!session || (teacherId && session.classSubject.teacherId !== teacherId)) {
    throw new NotFoundError("Không tìm thấy phiên điểm danh hoặc bạn không được phân công");
  }
  const eligible = await getEligibleEnrollments(prisma, session.classSubject, session.sessionAt);
  const enrollmentsById = new Map(eligible.map((enrollment) => [enrollment.id, enrollment]));
  for (const saved of session.records) {
    if (!enrollmentsById.has(saved.enrollmentId)) enrollmentsById.set(saved.enrollmentId, { id: saved.enrollmentId, student: saved.enrollment.student });
  }
  const savedByEnrollment = new Map(session.records.map((record) => [record.enrollmentId, record]));
  return {
    id: session.id,
    sessionAt: session.sessionAt,
    updatedAt: session.updatedAt,
    class: {
      id: session.classSubject.class.id,
      code: session.classSubject.class.code,
      name: session.classSubject.class.name,
      subjectName: session.classSubject.subject.name,
      teacherName: session.classSubject.teacher?.fullName ?? "",
    },
    records: [...enrollmentsById.values()]
      .sort((left, right) => left.student.fullName.localeCompare(right.student.fullName, "vi"))
      .map((enrollment) => {
        const saved = savedByEnrollment.get(enrollment.id);
        return { enrollmentId: enrollment.id, student: enrollment.student, status: saved?.status ?? "ABSENT", note: saved?.note ?? "" };
      }),
    audits: session.audits,
  };
}

export async function createAttendance(input: AttendanceCreate, actorId: string, teacherId: string | null) {
  const records = normalizeRecords(input.records);
  return prisma.$transaction(async (tx) => {
    const initialAssignment = await getAuthorizedClassSubject(tx, input.classId, teacherId);
    await tx.$executeRaw`SELECT id FROM class_subjects WHERE id = ${initialAssignment.id}::uuid FOR UPDATE`;
    const assignment = await getAuthorizedClassSubject(tx, input.classId, teacherId);
    const sessionAt = new Date();
    validateCanCreate(assignment, sessionAt);
    const eligible = await getEligibleEnrollments(tx, assignment, sessionAt);
    validateRoster(records.map((record) => record.enrollmentId), new Set(eligible.map((enrollment) => enrollment.id)));

    const session = await tx.attendanceSession.create({
      data: {
        classSubjectId: assignment.id,
        sessionAt,
        createdBy: actorId,
        updatedBy: actorId,
        records: { create: records },
      },
    });
    await tx.attendanceAuditLog.create({
      data: {
        attendanceSessionId: session.id,
        performedBy: actorId,
        action: "ATTENDANCE_CREATED",
        dataBefore: Prisma.JsonNull,
        dataAfter: records as unknown as Prisma.InputJsonValue,
      },
    });
    return { id: session.id, sessionAt: session.sessionAt, updatedAt: session.updatedAt };
  });
}

export async function updateAttendance(input: AttendanceUpdate, actorId: string, teacherId: string | null) {
  const records = normalizeRecords(input.records);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM attendance_sessions WHERE id = ${input.sessionId}::uuid FOR UPDATE`;
    const initialSession = await tx.attendanceSession.findUnique({ where: { id: input.sessionId }, select: { classSubjectId: true } });
    if (!initialSession) throw new NotFoundError("Không tìm thấy phiên điểm danh hoặc bạn không được phân công");
    await tx.$executeRaw`SELECT id FROM class_subjects WHERE id = ${initialSession.classSubjectId}::uuid FOR UPDATE`;
    const session = await tx.attendanceSession.findUnique({
      where: { id: input.sessionId },
      include: {
        classSubject: { include: { teacher: { select: { id: true } } } },
        records: true,
      },
    });
    if (!session || (teacherId && session.classSubject.teacherId !== teacherId)) {
      throw new NotFoundError("Không tìm thấy phiên điểm danh hoặc bạn không được phân công");
    }

    const eligible = await getEligibleEnrollments(tx, session.classSubject, session.sessionAt);
    const expectedIds = new Set(eligible.map((enrollment) => enrollment.id));
    for (const existing of session.records) expectedIds.add(existing.enrollmentId);
    validateRoster(records.map((record) => record.enrollmentId), expectedIds);

    for (const record of records) {
      await tx.attendanceRecord.upsert({
        where: { attendanceSessionId_enrollmentId: { attendanceSessionId: session.id, enrollmentId: record.enrollmentId } },
        create: { attendanceSessionId: session.id, ...record },
        update: { status: record.status, note: record.note },
      });
    }
    const updated = await tx.attendanceSession.update({ where: { id: session.id }, data: { updatedBy: actorId } });
    await tx.attendanceAuditLog.create({
      data: {
        attendanceSessionId: session.id,
        performedBy: actorId,
        action: "ATTENDANCE_UPDATED",
        dataBefore: session.records.map((record) => ({ enrollmentId: record.enrollmentId, status: record.status, note: record.note })) as unknown as Prisma.InputJsonValue,
        dataAfter: records as unknown as Prisma.InputJsonValue,
      },
    });
    return { id: updated.id, sessionAt: updated.sessionAt, updatedAt: updated.updatedAt };
  });
}
