import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { auditFields, type AuditContext } from "@/lib/audit";
import { Prisma, type Class } from "@prisma/client";
import type {
  ClassCreate,
  ClassFilter,
  ClassUpdate,
} from "@/modules/class/schemas/class.schema";
import type {
  ClassSubjectCreate,
  ClassSubjectUpdate,
  SubjectCreate,
  SubjectUpdate,
} from "@/modules/class/schemas/class-subject.schema";
import type {
  ClassStudentWithRelations,
  ClassStudentWithStudent,
  ClassWithRelations,
} from "@/types/prisma";
import { getEffectiveTuitionFeeStatus } from "@/modules/finance/tuition/utils/tuition-status";
import { getVietnamCalendarDateStart } from "@/lib/vietnam-time";

function toNullableDate(value?: string): Date | undefined {
  return value ? new Date(value) : undefined;
}

function buildClassCreateInput(
  data: ClassCreate,
): Prisma.ClassUncheckedCreateInput {
  return {
    code: data.code,
    name: data.name,
    startDate: toNullableDate(data.startDate),
    endDate: toNullableDate(data.endDate),
    status: data.status,
  };
}

function buildClassUpdateInput(
  data: ClassUpdate,
): Prisma.ClassUncheckedUpdateInput {
  return {
    ...(data.code !== undefined && { code: data.code }),
    ...(data.name !== undefined && { name: data.name }),
    ...(data.startDate !== undefined && {
      startDate: data.startDate ? new Date(data.startDate) : null,
    }),
    ...(data.endDate !== undefined && {
      endDate: data.endDate ? new Date(data.endDate) : null,
    }),
    ...(data.status !== undefined && { status: data.status }),
    ...((data.status === "DRAFT" || data.status === "ACTIVE") && {
      deletedAt: null,
    }),
    ...(data.status === "CANCELLED" && { deletedAt: new Date() }),
  };
}

export type ClassSubjectView = {
  id: string;
  teacherId: string | null;
  tuitionFee: Prisma.Decimal;
  totalSessions: number;
  maxStudents: number | null;
  status: "ACTIVE" | "INACTIVE" | "COMPLETED";
  subject: { id: string; name: string; status: "ACTIVE" | "INACTIVE" };
  teacher: { id: string; code: string; fullName: string } | null;
};

async function queryClassSubjects(
  client: Prisma.TransactionClient | typeof prisma,
  classId: string,
  options?: { includeCompleted?: boolean },
): Promise<ClassSubjectView[]> {
  const statusFilter = options?.includeCompleted
    ? Prisma.sql`cs.status IN ('ACTIVE'::class_subject_status, 'COMPLETED'::class_subject_status)`
    : Prisma.sql`cs.status = 'ACTIVE'::class_subject_status`;
  return client.$queryRaw<ClassSubjectView[]>`
    SELECT cs.id, cs.teacher_id AS "teacherId", cs.tuition_fee AS "tuitionFee", cs.total_sessions AS "totalSessions",
           cs.status AS "status",
           cs.max_students AS "maxStudents",
           json_build_object('id', s.id, 'name', s.name, 'status', s.status) AS subject,
           CASE WHEN t.id IS NULL THEN NULL ELSE json_build_object(
             'id', t.id, 'code', t.code, 'fullName', t.full_name
           ) END AS teacher
    FROM class_subjects cs
    JOIN subjects s ON s.id = cs.subject_id
    LEFT JOIN teachers t ON t.id = cs.teacher_id
    WHERE cs.class_id = ${classId}::uuid AND ${statusFilter}
    ORDER BY cs.created_at ASC
  `;
}

async function assertClassCanManageSubjects(
  classId: string,
  client: Prisma.TransactionClient,
) {
  await client.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`class:${classId}`}))`,
  );
  const classData = await client.class.findUnique({
    where: { id: classId },
    select: { id: true, status: true },
  });
  if (!classData) throw new NotFoundError("Không tìm thấy lớp học");
  if (classData.status === "COMPLETED" || classData.status === "CANCELLED") {
    throw new ConflictError(
      "Không thể thay đổi môn học trong lớp đã kết thúc hoặc đã hủy",
    );
  }
  return classData;
}

async function assertClassAllowsEnrollmentChanges(
  tx: Prisma.TransactionClient,
  classId: string,
) {
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`class:${classId}`}))`,
  );
  const classData = await tx.class.findUnique({
    where: { id: classId },
    select: { status: true },
  });
  if (!classData) throw new NotFoundError("Không tìm thấy lớp học");
  if (classData.status !== "ACTIVE") {
    throw new ConflictError("Chỉ có thể thay đổi đăng ký khi lớp đang hoạt động");
  }
}

async function assertClassAllowsStudentRegistration(
  tx: Prisma.TransactionClient,
  classId: string,
) {
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`class:${classId}`}))`,
  );
  const classData = await tx.class.findUnique({
    where: { id: classId },
    select: { status: true },
  });
  if (!classData) throw new NotFoundError("Không tìm thấy lớp học");
  if (classData.status !== "ACTIVE" && classData.status !== "DRAFT") {
    throw new ConflictError("Chỉ có thể đăng ký học viên khi lớp đang chuẩn bị hoặc hoạt động");
  }
}

export async function createClass(data: ClassCreate): Promise<Class> {
  if (data.status !== "DRAFT") {
    throw new ConflictError("Lớp học mới phải bắt đầu ở trạng thái nháp");
  }
  try {
    return await prisma.class.create({
      data: buildClassCreateInput({ ...data, status: "DRAFT" }),
    });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictError("Mã lớp đã tồn tại");
    }

    throw error;
  }
}

export async function getClassById(
  id: string,
): Promise<
  (ClassWithRelations & { classSubjects: ClassSubjectView[] }) | null
> {
  const classData = await prisma.class.findUnique({
    where: { id },
    include: {
      students: { include: { student: true } },
      schedules: { where: { deletedAt: null } },
    },
  });
  if (!classData) return null;
  return {
    ...classData,
    classSubjects: await queryClassSubjects(prisma, id, {
      includeCompleted: true,
    }),
  };
}

export async function getClasses(filter: ClassFilter) {
  const { search, status, statuses, page, pageSize } = filter;
  const skip = (page - 1) * pageSize;

  const where: Prisma.ClassWhereInput = {
    ...(search && {
      OR: [
        { code: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...(status && { status }),
    ...(!status && statuses?.length && { status: { in: statuses } }),
    ...(!status && { deletedAt: null }),
  };

  const [classes, total] = await Promise.all([
    prisma.class.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        classSubjects: {
          where: { status: "ACTIVE" },
          select: { teacher: { select: { fullName: true } } },
        },
        _count: {
          select: {
            students: true,
            schedules: { where: { deletedAt: null } },
            classSubjects: true,
            tuitionFees: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.class.count({ where }),
  ]);

  return {
    items: classes.map(({ classSubjects, ...classData }) => ({
      ...classData,
      teacherNames: [
        ...new Set(
          classSubjects.map((item) => item.teacher?.fullName).filter(Boolean),
        ),
      ],
    })),
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

export async function updateClass(
  id: string,
  data: ClassUpdate,
  actorId: string,
  auditContext?: AuditContext,
): Promise<Class> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`class:${id}`}))`,
    );
    const current = await tx.class.findUnique({
      where: { id },
      select: {
        code: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
        deletedAt: true,
      },
    });

    if (!current) throw new NotFoundError("Không tìm thấy lớp học");

    const startDate =
      data.startDate === undefined
        ? current.startDate
        : new Date(data.startDate);
    const endDate =
      data.endDate === undefined ? current.endDate : new Date(data.endDate);
    if (startDate && endDate && endDate < startDate) {
      throw new ConflictError(
        "Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu",
      );
    }

    if (data.startDate !== undefined || data.endDate !== undefined) {
      const conflicts = await tx.$queryRaw<Array<{ source: string }>>`
        SELECT 'học phí' AS source
        FROM tuition_fees tf
        WHERE tf.class_id = ${id}::uuid
          AND tf.billing_type = 'MONTHLY'::tuition_fee_billing_type
          AND (
            (${startDate}::date IS NOT NULL AND make_date(tf.billing_year::integer, tf.billing_month::integer, 1) < date_trunc('month', ${startDate}::date)::date)
            OR (${endDate}::date IS NOT NULL AND make_date(tf.billing_year::integer, tf.billing_month::integer, 1) > date_trunc('month', ${endDate}::date)::date)
          )
        UNION ALL
        SELECT 'tạm nghỉ' AS source
        FROM enrollment_pauses ep
        JOIN class_students cs ON cs.id = ep.enrollment_id
        WHERE cs.class_id = ${id}::uuid
          AND ep.status = 'ACTIVE'::enrollment_pause_status
          AND (
            (${startDate}::date IS NOT NULL AND ep.start_month < date_trunc('month', ${startDate}::date)::date)
            OR (${endDate}::date IS NOT NULL AND ep.end_month > date_trunc('month', ${endDate}::date)::date)
          )
        LIMIT 1
      `;
      if (conflicts.length > 0) {
        throw new ConflictError(
          `Không thể đổi thời gian lớp vì ${conflicts[0]?.source ?? "dữ liệu"} đã phát sinh ngoài khoảng mới`,
        );
      }
    }

    if (data.status !== undefined && data.status !== current.status) {
      const allowedTransitions: Record<Class["status"], Class["status"][]> = {
        DRAFT: ["ACTIVE", "CANCELLED"],
        ACTIVE: ["COMPLETED", "CANCELLED"],
        COMPLETED: [],
        CANCELLED: ["ACTIVE"],
      };
      if (!allowedTransitions[current.status].includes(data.status)) {
        throw new ConflictError("Trạng thái lớp học không hợp lệ");
      }
    }

    if (data.status === "COMPLETED" && current.status !== "COMPLETED") {
      await tx.$executeRaw`
        UPDATE class_subjects
        SET status = 'COMPLETED'::class_subject_status,
            updated_at = CURRENT_TIMESTAMP
        WHERE class_id = ${id}::uuid
          AND status = 'ACTIVE'::class_subject_status
      `;
      const activeEnrollments = await tx.classStudent.findMany({
        where: { classId: id, status: "ACTIVE" },
        select: { id: true, studentId: true },
      });
      const enrollmentIds = activeEnrollments.map(
        (enrollment) => enrollment.id,
      );

      if (enrollmentIds.length > 0) {
        await tx.enrollmentSubject.updateMany({
          where: { enrollmentId: { in: enrollmentIds }, status: "ACTIVE" },
          data: { status: "COMPLETED" },
        });
        await tx.classStudent.updateMany({
          where: { classId: id, status: "ACTIVE" },
          data: { status: "COMPLETED" },
        });
        await tx.tuitionAuditLog.createMany({
          data: activeEnrollments.map((enrollment) => ({
            entityType: "ENROLLMENT",
            entityId: enrollment.id,
            action: "COMPLETED",
            dataBefore: {
              classId: id,
              studentId: enrollment.studentId,
              status: "ACTIVE",
            },
            dataAfter: {
              classId: id,
              studentId: enrollment.studentId,
              status: "COMPLETED",
            },
            performedBy: actorId,
            ...auditFields(auditContext),
          })),
        });
      }
    }

    const updatedClass = await tx.class.update({
      where: { id },
      data: buildClassUpdateInput(data),
    });

    if (
      data.status === "CANCELLED" &&
      current.status !== "CANCELLED"
    ) {
      // Lock candidate fees first so a concurrent batch issuance either finishes before
      // the pending-batch check below or waits until the class cancellation commits.
      await tx.$queryRaw(Prisma.sql`
        SELECT id FROM tuition_fees
        WHERE class_id = ${id}::uuid
          AND status IN ('UNPAID'::tuition_fee_status, 'OVERDUE'::tuition_fee_status)
        ORDER BY id
        FOR UPDATE
      `);
      const feesToCancel = await tx.tuitionFee.findMany({
        where: {
          classId: id,
          status: { in: ["UNPAID", "OVERDUE"] },
          payments: { none: {} },
          paymentAllocations: {
            none: { paymentBatch: { status: "PENDING" } },
          },
        },
        select: {
          id: true,
          status: true,
          version: true,
          cancellationReason: true,
        },
      });

      for (const fee of feesToCancel) {
        const updatedFee = await tx.tuitionFee.update({
          where: { id: fee.id },
          data: {
            status: "CANCELLED",
            cancellationReason: "Lớp học đã bị hủy",
            version: { increment: 1 },
            updatedBy: actorId,
          },
          select: { id: true, status: true, version: true, cancellationReason: true },
        });
        await tx.tuitionAuditLog.create({
          data: {
            entityType: "TUITION_FEE",
            entityId: fee.id,
            action: "CANCEL",
            reason: "Lớp học đã bị hủy",
            dataBefore: fee as unknown as Prisma.InputJsonValue,
            dataAfter: updatedFee as unknown as Prisma.InputJsonValue,
            performedBy: actorId,
            ...auditFields(auditContext),
          },
        });
      }
    }

    if (current.status === "CANCELLED" && data.status === "ACTIVE") {
      await tx.tuitionAuditLog.create({
        data: {
          entityType: "CLASS",
          entityId: id,
          action: "CLASS_RESTORED",
          dataBefore: {
            code: current.code,
            name: current.name,
            status: current.status,
            deletedAt: current.deletedAt?.toISOString() ?? null,
          },
          dataAfter: {
            code: updatedClass.code,
            name: updatedClass.name,
            status: updatedClass.status,
            deletedAt: updatedClass.deletedAt?.toISOString() ?? null,
          },
          reason: "Khôi phục lớp đã hủy",
          performedBy: actorId,
          ...auditFields(auditContext),
        },
      });
    }

    return updatedClass;
  });
}

export async function deleteClass(id: string): Promise<Class> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`class:${id}`}))`,
    );

    const classData = await tx.class.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            students: true,
            classSubjects: true,
            schedules: { where: { deletedAt: null } },
            tuitionFees: true,
          },
        },
      },
    });

    if (!classData) {
      throw new NotFoundError("Không tìm thấy lớp học");
    }

    if (classData._count.tuitionFees > 0) {
      throw new ConflictError("Không thể xóa lớp học đã phát sinh học phí");
    }

    if (
      classData._count.students > 0 ||
      classData._count.classSubjects > 0 ||
      classData._count.schedules > 0
    ) {
      throw new ConflictError(
        "Không thể xóa lớp đã có học viên, môn học hoặc lịch học; hãy chuyển trạng thái lớp thay vì xóa",
      );
    }

    return tx.class.update({
      where: { id },
      data: { status: "CANCELLED", deletedAt: new Date() },
    });
  });
}

export async function assignStudentToClass(
  classId: string,
  studentId: string,
  classSubjectIds: string[],
  actorId?: string,
  auditContext?: AuditContext,
): Promise<ClassStudentWithRelations> {
  return prisma.$transaction(async (tx) => {
    await assertClassAllowsStudentRegistration(tx, classId);
    if (classSubjectIds.length === 0) {
      throw new ConflictError("Hãy chọn ít nhất một môn học");
    }

    for (const classSubjectId of [...new Set(classSubjectIds)].sort()) {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`class-subject:${classSubjectId}`}))`,
      );
    }

    const classSubjects = (await queryClassSubjects(tx, classId)).filter(
      (item) =>
        item.subject.status === "ACTIVE" && classSubjectIds.includes(item.id),
    );
    if (classSubjects.length !== new Set(classSubjectIds).size) {
      throw new ConflictError("Môn học không thuộc lớp hoặc đã ngừng mở");
    }

    let existing = await tx.classStudent.findUnique({
      where: { classId_studentId: { classId, studentId } },
      include: { student: true, class: true },
    });

    if (existing) {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`enrollment:${existing.id}`}))`,
      );
      existing = await tx.classStudent.findUnique({
        where: { id: existing.id },
        include: { student: true, class: true },
      });
    }

    if (existing && !["ACTIVE", "LEFT"].includes(existing.status)) {
      throw new ConflictError(
        "Chỉ có thể đăng ký thêm môn cho enrollment đang học hoặc đã rời lớp",
      );
    }

    const classData = await tx.class.findUnique({ where: { id: classId } });
    if (!classData) throw new NotFoundError("Không tìm thấy lớp học");
    if (classData.status !== "ACTIVE" && classData.status !== "DRAFT") {
      throw new ConflictError("Không thể đăng ký học viên vào lớp đã kết thúc hoặc đã hủy");
    }
    const student = await tx.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundError("Không tìm thấy học viên");
    if (student.status !== "ACTIVE") {
      throw new ConflictError("Không thể đăng ký học viên đã ngừng hoạt động");
    }

    const existingSubjectRows = existing
      ? await tx.$queryRaw<
          Array<{ id: string; classSubjectId: string; status: string }>
        >`
          SELECT id, class_subject_id AS "classSubjectId", status::text AS status
          FROM enrollment_subjects
          WHERE enrollment_id = ${existing.id}::uuid
        `
      : [];
    const existingSubjectIds = new Set(
      existingSubjectRows
        .filter((row) => row.status === "ACTIVE")
        .map((row) => row.classSubjectId),
    );
    const newClassSubjects = classSubjects.filter(
      (classSubject) => !existingSubjectIds.has(classSubject.id),
    );
    if (newClassSubjects.length === 0) {
      throw new ConflictError("Học viên đã đăng ký các môn học được chọn");
    }

    const reactivationStart = getVietnamCalendarDateStart();
    const reactivationMonthStart = new Date(
      Date.UTC(
        reactivationStart.getUTCFullYear(),
        reactivationStart.getUTCMonth(),
        1,
      ),
    );
    const clearedPauses =
      existing?.status === "LEFT"
        ? await tx.$queryRaw<
            Array<{
              id: string;
              enrollmentId: string;
              startMonth: Date;
              endMonth: Date;
              reason: string | null;
            }>
          >`
          SELECT id,
                 enrollment_id AS "enrollmentId",
                 start_month AS "startMonth",
                 end_month AS "endMonth",
                 reason
          FROM enrollment_pauses
          WHERE enrollment_id = ${existing.id}::uuid
            AND status = 'ACTIVE'::enrollment_pause_status
            AND end_month >= ${reactivationMonthStart}::date
        `
        : [];
    const clearedPauseIds = clearedPauses.map((pause) => pause.id);
    if (clearedPauseIds.length > 0) {
      await tx.$executeRaw`
        UPDATE enrollment_pauses
        SET status = 'CANCELLED'::enrollment_pause_status,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY(${clearedPauseIds}::uuid[])
          AND status = 'ACTIVE'::enrollment_pause_status
      `;
      await tx.tuitionAuditLog.createMany({
        data: clearedPauses.map((pause) => ({
          entityType: "ENROLLMENT_PAUSE",
          entityId: pause.id,
          action: "CANCELLED",
          dataBefore: {
            ...pause,
            status: "ACTIVE",
          } as unknown as Prisma.InputJsonValue,
          dataAfter: {
            id: pause.id,
            enrollmentId: pause.enrollmentId,
            status: "CANCELLED",
          },
          reason: "Hủy khoảng tạm nghỉ khi học viên tái đăng ký",
          performedBy: actorId || studentId,
          ...auditFields(auditContext),
        })),
      });
    }

    const enrollment = existing
      ? await tx.classStudent.update({
          where: { id: existing.id },
          data: {
            status: "ACTIVE",
            leftAt: null,
            deletedAt: null,
            ...(existing.status === "LEFT" && {
              currentPeriodStart: reactivationStart,
            }),
          },
          include: { student: true, class: true },
        })
      : await tx.classStudent.create({
          data: { classId, studentId },
          include: { student: true, class: true },
        });
    for (const classSubject of newClassSubjects) {
      if (classSubject.maxStudents !== null) {
        await tx.$executeRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`class-subject:${classSubject.id}`}))`,
        );
        const countRows = await tx.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count FROM enrollment_subjects
          WHERE class_subject_id = ${classSubject.id}::uuid AND status = 'ACTIVE'::enrollment_subject_status
        `;
        const count = Number(countRows[0]?.count ?? 0);
        if (count >= classSubject.maxStudents) {
          throw new ConflictError(
            `Môn ${classSubject.subject.name} đã đủ số lượng`,
          );
        }
      }
      const previousSubject = existingSubjectRows.find(
        (row) => row.classSubjectId === classSubject.id,
      );
      if (previousSubject) {
        await tx.enrollmentSubject.update({
          where: { id: previousSubject.id },
          data: { status: "ACTIVE", droppedAt: null, enrolledAt: new Date() },
        });
      } else {
        await tx.$executeRaw`
          INSERT INTO enrollment_subjects (enrollment_id, class_subject_id, enrolled_at)
          VALUES (${enrollment.id}::uuid, ${classSubject.id}::uuid, CURRENT_TIMESTAMP)
        `;
      }
    }

    const performedBy = actorId || studentId;
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "ENROLLMENT",
        entityId: enrollment.id,
        action: "SUBJECTS_REGISTERED",
        dataBefore: { classSubjectIds: [...existingSubjectIds] },
        dataAfter: {
          classId,
          studentId,
          classSubjectIds: newClassSubjects.map((item) => item.id),
          clearedPauseIds,
        },
        performedBy,
        ...auditFields(auditContext),
      },
    });
    return enrollment;
  });
}

export async function removeSubjectFromEnrollment(
  classId: string,
  studentId: string,
  classSubjectId: string,
  actorId: string,
  options?: { force?: boolean; reason?: string },
  auditContext?: AuditContext,
) {
  return prisma.$transaction(async (tx) => {
    await assertClassAllowsEnrollmentChanges(tx, classId);
    const enrollment = await tx.classStudent.findUnique({
      where: { classId_studentId: { classId, studentId } },
      include: { student: true },
    });
    if (!enrollment || enrollment.status !== "ACTIVE") {
      throw new NotFoundError("Không tìm thấy học viên đang học trong lớp");
    }
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`enrollment:${enrollment.id}`}))`,
    );
    const lockedEnrollment = await tx.classStudent.findUnique({
      where: { id: enrollment.id },
      select: { status: true },
    });
    if (!lockedEnrollment || lockedEnrollment.status !== "ACTIVE") {
      throw new NotFoundError("Không tìm thấy học viên đang học trong lớp");
    }
    const subject = await tx.enrollmentSubject.findUnique({
      where: {
        enrollmentId_classSubjectId: {
          enrollmentId: enrollment.id,
          classSubjectId,
        },
      },
      include: { classSubject: { include: { subject: true } } },
    });
    if (!subject || subject.status !== "ACTIVE") {
      throw new NotFoundError("Không tìm thấy môn học đang đăng ký");
    }
    const activeSubjectCount = await tx.enrollmentSubject.count({
      where: { enrollmentId: enrollment.id, status: "ACTIVE" },
    });
    if (activeSubjectCount <= 1) {
      throw new ConflictError(
        "Không thể bỏ môn cuối cùng; hãy dùng thao tác Rời lớp",
      );
    }
    const feeItem = await tx.tuitionFeeItem.findFirst({
      where: {
        classSubjectId,
        tuitionFee: {
          enrollmentId: enrollment.id,
          billingType: "MONTHLY",
        },
      },
      select: { id: true },
    });
    if (feeItem && options?.force !== true) {
      throw new ConflictError(
        "Không thể bỏ môn đã phát sinh học phí; hãy dùng force cancel kèm lý do",
      );
    }
    if (feeItem && !options?.reason?.trim()) {
      throw new ConflictError(
        "Bắt buộc nhập lý do khi force cancel môn đã phát sinh học phí",
      );
    }
    await tx.enrollmentSubject.update({
      where: { id: subject.id },
      data: { status: "DROPPED", droppedAt: new Date() },
    });
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "ENROLLMENT",
        entityId: enrollment.id,
        action: "SUBJECT_DROPPED",
        dataAfter: {
          classId,
          studentId,
          classSubjectId,
          subjectName: subject.classSubject.subject.name,
          feeAlreadyCreated: Boolean(feeItem),
          forced: options?.force === true,
        },
        reason: options?.reason?.trim(),
        performedBy: actorId,
        ...auditFields(auditContext),
      },
    });
    return { dropped: true, feeAlreadyCreated: Boolean(feeItem) };
  });
}

function parseBillingMonth(value: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) throw new ConflictError("Kỳ tạm nghỉ phải có định dạng YYYY-MM");
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
}

export async function pauseStudentEnrollment(
  classId: string,
  studentId: string,
  data: { startMonth: string; endMonth: string; reason?: string },
  actorId: string,
  auditContext?: AuditContext,
) {
  const startMonth = parseBillingMonth(data.startMonth);
  const endMonth = parseBillingMonth(data.endMonth);
  if (startMonth > endMonth) {
    throw new ConflictError(
      "Tháng bắt đầu phải trước hoặc bằng tháng kết thúc",
    );
  }
  return prisma.$transaction(async (tx) => {
    await assertClassAllowsEnrollmentChanges(tx, classId);
    const enrollmentRef = await tx.classStudent.findUnique({
      where: { classId_studentId: { classId, studentId } },
      select: { id: true },
    });
    if (!enrollmentRef) {
      throw new NotFoundError("Không tìm thấy học viên đang học trong lớp");
    }
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`enrollment:${enrollmentRef.id}`}))`,
    );
    const enrollment = await tx.classStudent.findUnique({
      where: { id: enrollmentRef.id },
      include: { class: true },
    });
    if (!enrollment || enrollment.status !== "ACTIVE") {
      throw new NotFoundError("Không tìm thấy học viên đang học trong lớp");
    }
    const classStartMonth = enrollment.class.startDate
      ? new Date(
          Date.UTC(
            enrollment.class.startDate.getUTCFullYear(),
            enrollment.class.startDate.getUTCMonth(),
            1,
          ),
        )
      : null;
    const classEndMonth = enrollment.class.endDate
      ? new Date(
          Date.UTC(
            enrollment.class.endDate.getUTCFullYear(),
            enrollment.class.endDate.getUTCMonth(),
            1,
          ),
        )
      : null;
    if (
      (classStartMonth && startMonth < classStartMonth) ||
      (classEndMonth && endMonth > classEndMonth)
    ) {
      throw new ConflictError(
        "Khoảng tạm nghỉ nằm ngoài thời gian của lớp học",
      );
    }
    const existingFees = await tx.$queryRaw<
      Array<{ id: string; status: string }>
    >`
      SELECT id, status::text AS status
      FROM tuition_fees
      WHERE enrollment_id = ${enrollment.id}::uuid
        AND billing_type = 'MONTHLY'::tuition_fee_billing_type
        AND make_date(billing_year::integer, billing_month::integer, 1)
          BETWEEN make_date(${startMonth.getUTCFullYear()}::integer, ${startMonth.getUTCMonth() + 1}::integer, 1)
          AND make_date(${endMonth.getUTCFullYear()}::integer, ${endMonth.getUTCMonth() + 1}::integer, 1)
      LIMIT 1
    `;
    if (existingFees.length > 0) {
      throw new ConflictError(
        "Không thể tạm nghỉ vì khoảng thời gian đã phát sinh học phí",
      );
    }
    const overlap = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM enrollment_pauses
      WHERE enrollment_id = ${enrollment.id}::uuid
        AND status = 'ACTIVE'::enrollment_pause_status
        AND start_month <= ${endMonth}::date
        AND end_month >= ${startMonth}::date
      LIMIT 1
    `;
    if (overlap.length > 0) throw new ConflictError("Khoảng tạm nghỉ bị trùng");
    const pause = await tx.enrollmentPause.create({
      data: {
        enrollmentId: enrollment.id,
        startMonth,
        endMonth,
        reason: data.reason?.trim() || null,
        createdBy: actorId,
      },
    });
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "ENROLLMENT_PAUSE",
        entityId: pause.id,
        action: "CREATED",
        dataAfter: pause as unknown as Prisma.InputJsonValue,
        reason: pause.reason,
        performedBy: actorId,
        ...auditFields(auditContext),
      },
    });
    return pause;
  });
}

export async function updateEnrollmentPause(
  classId: string,
  studentId: string,
  pauseId: string,
  data: { startMonth: string; endMonth: string; reason?: string },
  actorId: string,
  auditContext?: AuditContext,
) {
  const startMonth = parseBillingMonth(data.startMonth);
  const endMonth = parseBillingMonth(data.endMonth);
  if (startMonth > endMonth) {
    throw new ConflictError(
      "Tháng bắt đầu phải trước hoặc bằng tháng kết thúc",
    );
  }

  return prisma.$transaction(async (tx) => {
    await assertClassAllowsEnrollmentChanges(tx, classId);
    let pause = await tx.enrollmentPause.findFirst({
      where: {
        id: pauseId,
        enrollment: { classId, studentId, status: "ACTIVE" },
        status: "ACTIVE",
      },
    });
    if (!pause) throw new NotFoundError("Không tìm thấy thời gian tạm nghỉ");

    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`enrollment:${pause.enrollmentId}`}))`,
    );
    pause = await tx.enrollmentPause.findFirst({
      where: {
        id: pauseId,
        enrollment: { classId, studentId, status: "ACTIVE" },
        status: "ACTIVE",
      },
    });
    if (!pause)
      throw new NotFoundError(
        "Không tìm thấy thời gian tạm nghỉ đang hoạt động",
      );
    const enrollment = await tx.classStudent.findUnique({
      where: { id: pause.enrollmentId },
      include: { class: true },
    });
    if (!enrollment || enrollment.status !== "ACTIVE") {
      throw new NotFoundError("Không tìm thấy học viên đang học trong lớp");
    }
    const classStartMonth = enrollment.class.startDate
      ? new Date(
          Date.UTC(
            enrollment.class.startDate.getUTCFullYear(),
            enrollment.class.startDate.getUTCMonth(),
            1,
          ),
        )
      : null;
    const classEndMonth = enrollment.class.endDate
      ? new Date(
          Date.UTC(
            enrollment.class.endDate.getUTCFullYear(),
            enrollment.class.endDate.getUTCMonth(),
            1,
          ),
        )
      : null;
    if (
      (classStartMonth && startMonth < classStartMonth) ||
      (classEndMonth && endMonth > classEndMonth)
    ) {
      throw new ConflictError(
        "Khoảng tạm nghỉ nằm ngoài thời gian của lớp học",
      );
    }
    const existingFee = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM tuition_fees
      WHERE enrollment_id = ${pause.enrollmentId}::uuid
        AND billing_type = 'MONTHLY'::tuition_fee_billing_type
        AND make_date(billing_year::integer, billing_month::integer, 1)
          BETWEEN make_date(${startMonth.getUTCFullYear()}::integer, ${startMonth.getUTCMonth() + 1}::integer, 1)
          AND make_date(${endMonth.getUTCFullYear()}::integer, ${endMonth.getUTCMonth() + 1}::integer, 1)
      LIMIT 1
    `;
    if (existingFee.length > 0) {
      throw new ConflictError(
        "Không thể sửa tạm nghỉ vì khoảng thời gian đã phát sinh học phí",
      );
    }
    const overlap = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM enrollment_pauses
      WHERE enrollment_id = ${pause.enrollmentId}::uuid
        AND status = 'ACTIVE'::enrollment_pause_status
        AND id <> ${pause.id}::uuid
        AND start_month <= ${endMonth}::date
        AND end_month >= ${startMonth}::date
      LIMIT 1
    `;
    if (overlap.length > 0) throw new ConflictError("Khoảng tạm nghỉ bị trùng");

    const updated = await tx.enrollmentPause.update({
      where: { id: pause.id },
      data: {
        startMonth,
        endMonth,
        reason: data.reason?.trim() || null,
      },
    });
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "ENROLLMENT_PAUSE",
        entityId: pause.id,
        action: "UPDATED",
        dataBefore: pause as unknown as Prisma.InputJsonValue,
        dataAfter: updated as unknown as Prisma.InputJsonValue,
        reason: updated.reason,
        performedBy: actorId,
        ...auditFields(auditContext),
      },
    });
    return updated;
  });
}

export async function deleteEnrollmentPause(
  classId: string,
  studentId: string,
  pauseId: string,
  actorId: string,
  auditContext?: AuditContext,
) {
  return prisma.$transaction(async (tx) => {
    await assertClassAllowsEnrollmentChanges(tx, classId);
    const pause = await tx.enrollmentPause.findFirst({
      where: {
        id: pauseId,
        enrollment: { classId, studentId, status: "ACTIVE" },
      },
    });
    if (!pause) throw new NotFoundError("Không tìm thấy thời gian tạm nghỉ");

    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`enrollment:${pause.enrollmentId}`}))`,
    );
    const cancelled = await tx.$queryRaw<Array<{ id: string; status: string }>>`
      UPDATE enrollment_pauses
      SET status = 'CANCELLED'::enrollment_pause_status,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${pause.id}::uuid
        AND status = 'ACTIVE'::enrollment_pause_status
      RETURNING id, status::text AS status
    `;
    if (cancelled.length === 0) {
      throw new NotFoundError(
        "Không tìm thấy thời gian tạm nghỉ đang hoạt động",
      );
    }
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "ENROLLMENT_PAUSE",
        entityId: pause.id,
        action: "CANCELLED",
        dataBefore: pause as unknown as Prisma.InputJsonValue,
        dataAfter: cancelled[0] as unknown as Prisma.InputJsonValue,
        reason: "Hủy thời gian tạm nghỉ",
        performedBy: actorId,
        ...auditFields(auditContext),
      },
    });
    return { deleted: true };
  });
}

export async function getSubjects(search?: string, includeInactive = false) {
  return prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      status: "ACTIVE" | "INACTIVE";
    }>
  >`
    SELECT id, name, status FROM subjects
    WHERE ${includeInactive ? Prisma.sql`TRUE` : Prisma.sql`status = 'ACTIVE'::subject_status`}
      ${search ? Prisma.sql`AND name ILIKE ${`%${search}%`}` : Prisma.empty}
    ORDER BY name ASC
  `;
}

async function generateSubjectCode() {
  const prefix = `MH-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
    if (
      !(await prisma.subject.findUnique({
        where: { code },
        select: { id: true },
      }))
    ) {
      return code;
    }
  }
  throw new ConflictError("Không thể tạo mã môn học tự động, vui lòng thử lại");
}

export async function createSubject(data: SubjectCreate) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = await generateSubjectCode();
    try {
      return await prisma.subject.create({
        data: { code, name: data.name, status: "ACTIVE" },
        select: { id: true, name: true, status: true },
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
  throw new ConflictError("Không thể tạo mã môn học tự động, vui lòng thử lại");
}

export async function updateSubject(id: string, data: SubjectUpdate) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM subjects WHERE id = ${id}::uuid FOR UPDATE`,
    );
    const rows = await tx.$queryRaw<
      Array<{ id: string; name: string; status: string }>
    >`
      UPDATE subjects
      SET name = ${data.name}, status = ${data.status}::subject_status,
          updated_at = CURRENT_TIMESTAMP, deleted_at = CASE WHEN ${data.status} = 'INACTIVE' THEN COALESCE(deleted_at, CURRENT_TIMESTAMP) ELSE NULL END
      WHERE id = ${id}::uuid
      RETURNING id, name, status
    `;
    if (!rows[0]) throw new NotFoundError("Không tìm thấy môn học");
    return rows[0];
  });
}

export async function getClassSubjects(classId: string) {
  return queryClassSubjects(prisma, classId);
}

export async function addClassSubject(
  classId: string,
  data: ClassSubjectCreate,
  actorId: string,
  auditContext?: AuditContext,
) {
  return prisma.$transaction(async (tx) => {
    await assertClassCanManageSubjects(classId, tx);
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM subjects WHERE id = ${data.subjectId}::uuid FOR UPDATE`,
    );
    const subject = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM subjects WHERE id = ${data.subjectId}::uuid AND status = 'ACTIVE'::subject_status
    `;
    if (!subject[0]) throw new NotFoundError("Không tìm thấy môn học");
    if (data.teacherId) {
      const teacher = await tx.teacher.findUnique({
        where: { id: data.teacherId },
        select: { id: true, status: true },
      });
      if (!teacher || teacher.status !== "ACTIVE")
        throw new ConflictError(
          "Giáo viên không hợp lệ hoặc đã ngừng hoạt động",
        );
    }
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      INSERT INTO class_subjects (id, class_id, subject_id, teacher_id, tuition_fee, total_sessions, max_students, status, created_at, updated_at)
      VALUES (gen_random_uuid(), ${classId}::uuid, ${data.subjectId}::uuid, ${data.teacherId ?? null}::uuid,
        ${data.tuitionFee}, ${data.totalSessions}, ${data.maxStudents ?? null}, 'ACTIVE'::class_subject_status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `;
    const created = (await queryClassSubjects(tx, classId)).find(
      (item) => item.id === rows[0]?.id,
    );
    if (!created) throw new NotFoundError("Không tìm thấy môn học vừa tạo");
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "CLASS_SUBJECT",
        entityId: created.id,
        action: "CREATED",
        dataAfter: created as unknown as Prisma.InputJsonValue,
        performedBy: actorId,
        ...auditFields(auditContext),
      },
    });
    return created;
  });
}

export async function updateClassSubject(
  classId: string,
  classSubjectId: string,
  data: ClassSubjectUpdate,
  actorId: string,
  auditContext?: AuditContext,
) {
  return prisma.$transaction(async (tx) => {
    await assertClassCanManageSubjects(classId, tx);
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`class-subject:${classSubjectId}`}))`,
    );
    const existing = (await queryClassSubjects(tx, classId)).find(
      (item) => item.id === classSubjectId,
    );
    if (!existing) throw new NotFoundError("Không tìm thấy môn học trong lớp");

    if (data.teacherId) {
      const teacher = await tx.teacher.findUnique({
        where: { id: data.teacherId },
        select: { id: true, status: true },
      });
      if (!teacher || teacher.status !== "ACTIVE")
        throw new ConflictError(
          "Giáo viên không hợp lệ hoặc đã ngừng hoạt động",
        );
    }
    if (data.teacherId !== undefined && data.teacherId !== existing.teacherId) {
      const activeSchedule = await tx.classSchedule.findFirst({
        where: { classSubjectId, deletedAt: null },
        select: { id: true },
      });
      if (activeSchedule) {
        throw new ConflictError(
          "Không thể đổi giáo viên khi môn học đang có lịch; hãy xóa lịch học trước",
        );
      }
      const existingFeeItem = await tx.tuitionFeeItem.findFirst({
        where: { classSubjectId },
        select: { id: true },
      });
      if (existingFeeItem) {
        throw new ConflictError(
          "Không thể đổi giáo viên sau khi môn học đã phát sinh học phí",
        );
      }
    }
    if (data.maxStudents !== undefined && data.maxStudents !== null) {
      const activeEnrollmentCount = await tx.enrollmentSubject.count({
        where: { classSubjectId, status: "ACTIVE" },
      });
      if (data.maxStudents < activeEnrollmentCount) {
        throw new ConflictError(
          `Giới hạn học viên không được nhỏ hơn số đang đăng ký (${activeEnrollmentCount})`,
        );
      }
    }

    await tx.$executeRaw`
      UPDATE class_subjects
      SET teacher_id = CASE
            WHEN ${data.teacherId === undefined} THEN teacher_id
            ELSE ${data.teacherId ?? null}::uuid
          END,
          tuition_fee = ${data.tuitionFee},
          total_sessions = ${data.totalSessions},
          max_students = CASE
            WHEN ${data.maxStudents === undefined} THEN max_students
            ELSE ${data.maxStudents ?? null}
          END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${classSubjectId}::uuid AND class_id = ${classId}::uuid
    `;
    const updated = (await queryClassSubjects(tx, classId)).find(
      (item) => item.id === classSubjectId,
    );
    if (!updated)
      throw new NotFoundError("Không tìm thấy môn học vừa cập nhật");
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "CLASS_SUBJECT",
        entityId: classSubjectId,
        action: "UPDATED",
        dataBefore: existing as unknown as Prisma.InputJsonValue,
        dataAfter: updated as unknown as Prisma.InputJsonValue,
        performedBy: actorId,
        ...auditFields(auditContext),
      },
    });
    return updated;
  });
}

export async function removeClassSubject(
  classId: string,
  classSubjectId: string,
  actorId: string,
  auditContext?: AuditContext,
) {
  await prisma.$transaction(async (tx) => {
    await assertClassCanManageSubjects(classId, tx);
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`class-subject:${classSubjectId}`}))`,
    );
    const existing = (await queryClassSubjects(tx, classId)).find(
      (item) => item.id === classSubjectId,
    );
    if (!existing) throw new NotFoundError("Không tìm thấy môn học trong lớp");

    const [enrollments, tuitionItems, schedules] = await Promise.all([
      tx.$queryRaw<
        Array<{ count: bigint }>
      >`SELECT COUNT(*)::bigint AS count FROM enrollment_subjects WHERE class_subject_id = ${classSubjectId}::uuid`,
      tx.$queryRaw<
        Array<{ count: bigint }>
      >`SELECT COUNT(*)::bigint AS count FROM tuition_fee_items WHERE class_subject_id = ${classSubjectId}::uuid`,
      tx.$queryRaw<
        Array<{ count: bigint }>
      >`SELECT COUNT(*)::bigint AS count FROM class_schedules WHERE class_subject_id = ${classSubjectId}::uuid AND deleted_at IS NULL`,
    ]);
    if (
      Number(enrollments[0]?.count ?? 0) > 0 ||
      Number(tuitionItems[0]?.count ?? 0) > 0 ||
      Number(schedules[0]?.count ?? 0) > 0
    ) {
      throw new ConflictError(
        "Không thể xóa môn đã có học viên, lịch học hoặc đã phát sinh học phí",
      );
    }

    await tx.$executeRaw`
      UPDATE class_subjects SET status = 'INACTIVE'::class_subject_status, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${classSubjectId}::uuid AND class_id = ${classId}::uuid
    `;
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "CLASS_SUBJECT",
        entityId: classSubjectId,
        action: "INACTIVATED",
        dataBefore: existing as unknown as Prisma.InputJsonValue,
        dataAfter: { status: "INACTIVE" },
        performedBy: actorId,
        ...auditFields(auditContext),
      },
    });
  });
}

export async function removeStudentFromClass(
  classId: string,
  studentId: string,
  options?: { force?: boolean; reason?: string },
  actorId?: string,
  auditContext?: AuditContext,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await assertClassAllowsEnrollmentChanges(tx, classId);
    const enrollment = await tx.classStudent.findUnique({
      where: { classId_studentId: { classId, studentId } },
      select: { id: true },
    });
    if (!enrollment) {
      throw new NotFoundError("Không tìm thấy học viên đang đăng ký trong lớp");
    }
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`enrollment:${enrollment.id}`}))`,
    );
    const lockedEnrollment = await tx.classStudent.findUnique({
      where: { id: enrollment.id },
      include: { tuitionFees: { select: { id: true, status: true } } },
    });
    if (!lockedEnrollment || lockedEnrollment.status !== "ACTIVE") {
      throw new NotFoundError("Không tìm thấy học viên đang đăng ký trong lớp");
    }

    if (lockedEnrollment.tuitionFees.length > 0 && options?.force !== true) {
      throw new ConflictError("Không thể xóa học viên đã phát sinh học phí");
    }

    if (lockedEnrollment.tuitionFees.length > 0 && !options?.reason?.trim()) {
      throw new ConflictError(
        "Bắt buộc nhập lý do khi force rời lớp đã phát sinh học phí",
      );
    }

    await tx.enrollmentSubject.updateMany({
      where: { enrollmentId: enrollment.id, status: "ACTIVE" },
      data: { status: "DROPPED", droppedAt: new Date() },
    });
    await tx.classStudent.update({
      where: { id: enrollment.id },
      data: { status: "LEFT", leftAt: new Date(), deletedAt: new Date() },
    });
    if (actorId) {
      await tx.tuitionAuditLog.create({
        data: {
          entityType: "ENROLLMENT",
          entityId: enrollment.id,
          action: "LEFT",
          reason: options?.reason?.trim() || "Học viên rời lớp",
          dataBefore: {
            status: lockedEnrollment.status,
            tuitionFeeIds: lockedEnrollment.tuitionFees.map((fee) => fee.id),
          },
          dataAfter: {
            status: "LEFT",
            classId,
            studentId,
            forced: options?.force === true,
          },
          performedBy: actorId,
          ...auditFields(auditContext),
        },
      });
    }
  });
}

export async function getClassStudents(classId: string): Promise<
  Array<
    ClassStudentWithStudent & {
      subjects: Array<{ classSubjectId: string }>;
      tuitionFees: Array<{
        id: string;
        status: string;
        billingYear: number;
        billingMonth: number;
        billingType: string;
        items: Array<{ classSubjectId: string | null }>;
      }>;
      pauses: Array<{
        id: string;
        status: string;
        startMonth: Date;
        endMonth: Date;
        reason: string | null;
      }>;
    }
  >
> {
  return prisma.classStudent
    .findMany({
      where: { classId, status: { in: ["ACTIVE", "COMPLETED", "LEFT"] } },
      include: {
        student: true,
        subjects: {
          where: { status: { in: ["ACTIVE", "COMPLETED"] } },
          select: { classSubjectId: true },
        },
        tuitionFees: {
          select: {
            id: true,
            status: true,
            finalAmount: true,
            dueDate: true,
            billingYear: true,
            billingMonth: true,
            billingType: true,
            items: { select: { classSubjectId: true } },
            payments: {
              where: { paymentStatus: "SUCCESS" },
              select: { amount: true },
            },
          },
        },
        pauses: {
          select: {
            id: true,
            startMonth: true,
            endMonth: true,
            reason: true,
          },
        },
      },
    })
    .then(async (students) => {
      const pauseIds = students.flatMap((student) =>
        student.pauses.map((pause) => pause.id),
      );
      const pauseStatuses =
        pauseIds.length > 0
          ? await prisma.$queryRaw<Array<{ id: string; status: string }>>`
          SELECT id, status::text AS status FROM enrollment_pauses
          WHERE id = ANY(${pauseIds}::uuid[])
        `
          : [];
      const statusById = new Map(
        pauseStatuses.map((pause) => [pause.id, pause.status]),
      );
      return students.map((student) => ({
        ...student,
        pauses: student.pauses.map((pause) => ({
          ...pause,
          status: statusById.get(pause.id) ?? "ACTIVE",
        })),
        tuitionFees: student.tuitionFees.map((fee) => {
          const { dueDate, ...feeData } = fee;
          const paidAmount = fee.payments.reduce(
            (total, payment) => total.add(payment.amount),
            new Prisma.Decimal(0),
          );
          const remainingAmount = fee.finalAmount.sub(paidAmount);
          return {
            ...feeData,
            paidAmount,
            remainingAmount: remainingAmount.greaterThan(0)
              ? remainingAmount
              : new Prisma.Decimal(0),
            status: getEffectiveTuitionFeeStatus(fee.status, dueDate),
          };
        }),
      }));
    });
}

function parseStudentListMonth(value: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) throw new ConflictError("Kỳ học phí phải có định dạng YYYY-MM");
  const year = Number(match[1]);
  const month = Number(match[2]);
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 0)),
    year,
    month,
  };
}

export async function getClassStudentsPage(
  classId: string,
  options: {
    page: number;
    pageSize: number;
    search?: string;
    status?: "ACTIVE" | "PAUSED" | "COMPLETED" | "LEFT";
    subjectId?: string;
    month: string;
    sortBy?: "code" | "fullName" | "item" | "finalAmount" | "paidAmount" | "remainingAmount" | "feeStatus";
    sortDirection?: "asc" | "desc";
    tuitionStatus?: "NONE" | "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE" | "EXEMPTED" | "CANCELLED";
  },
) {
  const period = parseStudentListMonth(options.month);
  const periodEndExclusive = new Date(Date.UTC(period.year, period.month, 1));
  const subjectForPeriodWhere: Prisma.EnrollmentSubjectWhereInput = {
    OR: [
      { status: { in: ["ACTIVE", "COMPLETED"] } },
      { droppedAt: { gte: period.start, lt: periodEndExclusive } },
    ],
  };
  const pauseWhere: Prisma.EnrollmentPauseWhereInput = {
    status: "ACTIVE",
    startMonth: { lte: period.end },
    endMonth: { gte: period.start },
  };
  const activeInPeriod: Prisma.ClassStudentWhereInput = {
    status: "ACTIVE",
  };
  const statusWhere: Prisma.ClassStudentWhereInput =
    options.status === "COMPLETED"
      ? { status: "COMPLETED" }
      : options.status === "LEFT"
        ? { status: "LEFT" }
        : options.status === "PAUSED"
          ? { ...activeInPeriod, pauses: { some: pauseWhere } }
          : options.status === "ACTIVE"
            ? { ...activeInPeriod, pauses: { none: pauseWhere } }
          : { status: { in: ["ACTIVE", "COMPLETED", "LEFT"] } };
  const feePeriodWhere: Prisma.TuitionFeeWhereInput = {
    billingType: "MONTHLY",
    billingYear: period.year,
    billingMonth: period.month,
  };
  const asOfDate = getVietnamCalendarDateStart(new Date());
  const feeStatusWhere: Prisma.TuitionFeeWhereInput | undefined = options.tuitionStatus && options.tuitionStatus !== "NONE"
    ? {
        ...feePeriodWhere,
        ...(options.tuitionStatus === "OVERDUE"
          ? {
              OR: [
                { status: "OVERDUE" },
                { status: { in: ["UNPAID", "PARTIAL"] }, dueDate: { lt: asOfDate } },
              ],
            }
          : {
              status: options.tuitionStatus,
              ...(options.tuitionStatus === "UNPAID" || options.tuitionStatus === "PARTIAL"
                ? { OR: [{ dueDate: null }, { dueDate: { gte: asOfDate } }] }
                : {}),
            }),
      }
    : undefined;
  const where: Prisma.ClassStudentWhereInput = {
    classId,
    ...statusWhere,
    ...(options.search?.trim() && {
      student: {
        OR: [
          { code: { contains: options.search.trim(), mode: "insensitive" } },
          {
            fullName: { contains: options.search.trim(), mode: "insensitive" },
          },
          { phone: { contains: options.search.trim(), mode: "insensitive" } },
        ],
      },
    }),
    ...(options.subjectId && {
      subjects: {
        some: {
          ...subjectForPeriodWhere,
          classSubjectId: options.subjectId,
        },
      },
    }),
    ...(options.tuitionStatus === "NONE" && { tuitionFees: { none: feePeriodWhere } }),
    ...(feeStatusWhere && { tuitionFees: { some: feeStatusWhere } }),
  };

  const activeWhere: Prisma.ClassStudentWhereInput = {
    classId,
    status: "ACTIVE",
    pauses: { none: pauseWhere },
  };
  const feeSort = ["item", "finalAmount", "paidAmount", "remainingAmount", "feeStatus"].includes(options.sortBy ?? "");
  const sortedPageIds = feeSort
    ? await prisma.$queryRaw<Array<{ id: string }>>`
        WITH fee_sort AS (
          SELECT tf.enrollment_id,
            COUNT(*)::int AS fee_count,
            COALESCE(SUM(tf.final_amount), 0)::double precision AS final_amount,
            COALESCE(SUM(paid.amount), 0)::double precision AS paid_amount,
            MAX(CASE
              WHEN (tf.status::text IN ('UNPAID', 'PARTIAL') AND tf.due_date < ${asOfDate}::date) OR tf.status::text = 'OVERDUE' THEN 3
              WHEN tf.status::text = 'UNPAID' THEN 1
              WHEN tf.status::text = 'PARTIAL' THEN 2
              WHEN tf.status::text = 'PAID' THEN 4
              WHEN tf.status::text = 'EXEMPTED' THEN 5
              WHEN tf.status::text = 'CANCELLED' THEN 6
              ELSE 0 END) AS fee_status_order
          FROM tuition_fees tf
          LEFT JOIN LATERAL (
            SELECT SUM(tp.amount) AS amount
            FROM tuition_payments tp
            WHERE tp.tuition_fee_id = tf.id AND tp.payment_status = 'SUCCESS'::tuition_payment_status
          ) paid ON true
          WHERE tf.class_id = ${classId}::uuid
            AND tf.billing_type = 'MONTHLY'::tuition_fee_billing_type
            AND tf.billing_year = ${period.year} AND tf.billing_month = ${period.month}
          GROUP BY tf.enrollment_id
        ), fee_item_sort AS (
          SELECT tf.enrollment_id, string_agg(DISTINCT tfi.item_name, ', ' ORDER BY tfi.item_name) AS item_name
          FROM tuition_fees tf
          JOIN tuition_fee_items tfi ON tfi.tuition_fee_id = tf.id
          WHERE tf.class_id = ${classId}::uuid
            AND tf.billing_type = 'MONTHLY'::tuition_fee_billing_type
            AND tf.billing_year = ${period.year} AND tf.billing_month = ${period.month}
          GROUP BY tf.enrollment_id
        )
        SELECT cs.id
        FROM class_students cs
        JOIN students s ON s.id = cs.student_id
        LEFT JOIN fee_sort ON fee_sort.enrollment_id = cs.id
        LEFT JOIN fee_item_sort ON fee_item_sort.enrollment_id = cs.id
        WHERE cs.class_id = ${classId}::uuid
          AND cs.status::text IN ('ACTIVE', 'COMPLETED', 'LEFT')
          AND (${options.status ?? null}::text IS NULL
            OR (${options.status ?? null}::text = 'ACTIVE' AND cs.status::text = 'ACTIVE' AND NOT EXISTS (
              SELECT 1 FROM enrollment_pauses ep WHERE ep.enrollment_id = cs.id AND ep.status::text = 'ACTIVE'
                AND ep.start_month <= ${period.end}::date AND ep.end_month >= ${period.start}::date))
            OR (${options.status ?? null}::text = 'PAUSED' AND cs.status::text = 'ACTIVE' AND EXISTS (
              SELECT 1 FROM enrollment_pauses ep WHERE ep.enrollment_id = cs.id AND ep.status::text = 'ACTIVE'
                AND ep.start_month <= ${period.end}::date AND ep.end_month >= ${period.start}::date))
            OR (${options.status ?? null}::text = 'COMPLETED' AND cs.status::text = 'COMPLETED')
            OR (${options.status ?? null}::text = 'LEFT' AND cs.status::text = 'LEFT'))
          AND (${options.search?.trim() || null}::text IS NULL OR
            s.code ILIKE '%' || ${options.search?.trim() || ""} || '%' OR
            s.full_name ILIKE '%' || ${options.search?.trim() || ""} || '%' OR
            s.phone ILIKE '%' || ${options.search?.trim() || ""} || '%')
          AND (${options.subjectId ?? null}::uuid IS NULL OR EXISTS (
            SELECT 1 FROM enrollment_subjects es WHERE es.enrollment_id = cs.id
              AND es.class_subject_id = ${options.subjectId ?? "00000000-0000-0000-0000-000000000000"}::uuid
              AND (es.status::text IN ('ACTIVE', 'COMPLETED') OR (es.dropped_at >= ${period.start}::date AND es.dropped_at < ${periodEndExclusive}::date))))
          AND (${options.tuitionStatus ?? null}::text IS NULL
            OR (${options.tuitionStatus ?? null}::text = 'NONE' AND COALESCE(fee_sort.fee_count, 0) = 0)
            OR (${options.tuitionStatus ?? null}::text <> 'NONE' AND EXISTS (
              SELECT 1 FROM tuition_fees tf WHERE tf.enrollment_id = cs.id AND tf.class_id = ${classId}::uuid
                AND tf.billing_type = 'MONTHLY'::tuition_fee_billing_type
                AND tf.billing_year = ${period.year} AND tf.billing_month = ${period.month}
                AND CASE WHEN tf.status::text IN ('UNPAID', 'PARTIAL') AND tf.due_date < ${asOfDate}::date THEN 'OVERDUE'
                  ELSE tf.status::text END = ${options.tuitionStatus ?? ""})))
        ORDER BY
          CASE WHEN ${options.sortBy ?? "fullName"} IN ('item', 'code', 'fullName') AND ${options.sortDirection ?? "asc"} = 'asc'
            THEN CASE WHEN ${options.sortBy ?? "fullName"} = 'item' THEN fee_item_sort.item_name WHEN ${options.sortBy ?? "fullName"} = 'code' THEN s.code ELSE s.full_name END END ASC NULLS LAST,
          CASE WHEN ${options.sortBy ?? "fullName"} IN ('item', 'code', 'fullName') AND ${options.sortDirection ?? "asc"} = 'desc'
            THEN CASE WHEN ${options.sortBy ?? "fullName"} = 'item' THEN fee_item_sort.item_name WHEN ${options.sortBy ?? "fullName"} = 'code' THEN s.code ELSE s.full_name END END DESC NULLS LAST,
          CASE WHEN ${options.sortBy ?? "fullName"} = 'finalAmount' AND ${options.sortDirection ?? "asc"} = 'asc' THEN fee_sort.final_amount END ASC NULLS LAST,
          CASE WHEN ${options.sortBy ?? "fullName"} = 'finalAmount' AND ${options.sortDirection ?? "asc"} = 'desc' THEN fee_sort.final_amount END DESC NULLS LAST,
          CASE WHEN ${options.sortBy ?? "fullName"} = 'paidAmount' AND ${options.sortDirection ?? "asc"} = 'asc' THEN fee_sort.paid_amount END ASC NULLS LAST,
          CASE WHEN ${options.sortBy ?? "fullName"} = 'paidAmount' AND ${options.sortDirection ?? "asc"} = 'desc' THEN fee_sort.paid_amount END DESC NULLS LAST,
          CASE WHEN ${options.sortBy ?? "fullName"} = 'remainingAmount' AND ${options.sortDirection ?? "asc"} = 'asc' THEN GREATEST(fee_sort.final_amount - fee_sort.paid_amount, 0) END ASC NULLS LAST,
          CASE WHEN ${options.sortBy ?? "fullName"} = 'remainingAmount' AND ${options.sortDirection ?? "asc"} = 'desc' THEN GREATEST(fee_sort.final_amount - fee_sort.paid_amount, 0) END DESC NULLS LAST,
          CASE WHEN ${options.sortBy ?? "fullName"} = 'feeStatus' AND ${options.sortDirection ?? "asc"} = 'asc' THEN fee_sort.fee_status_order END ASC NULLS LAST,
          CASE WHEN ${options.sortBy ?? "fullName"} = 'feeStatus' AND ${options.sortDirection ?? "asc"} = 'desc' THEN fee_sort.fee_status_order END DESC NULLS LAST,
          s.full_name ASC, s.code ASC
        LIMIT ${options.pageSize} OFFSET ${(options.page - 1) * options.pageSize}
      `
    : null;
  const [students, total, active, paused, completed, left, activeWithFee] =
    await Promise.all([
      prisma.classStudent.findMany({
        where: sortedPageIds ? { ...where, id: { in: sortedPageIds.map(({ id }) => id) } } : where,
        ...(!sortedPageIds && { skip: (options.page - 1) * options.pageSize, take: options.pageSize }),
        orderBy: [
          {
            student: {
            [options.sortBy === "code" ? "code" : "fullName"]: options.sortDirection ?? "asc",
            },
          },
          { student: { code: "asc" } },
        ],
        include: {
          student: true,
          subjects: {
            where: subjectForPeriodWhere,
            select: { classSubjectId: true },
          },
          tuitionFees: {
            where: feePeriodWhere,
            select: {
              id: true,
              feeNo: true,
              status: true,
              finalAmount: true,
              dueDate: true,
              billingYear: true,
              billingMonth: true,
              billingType: true,
              note: true,
              items: { select: { classSubjectId: true, itemName: true, amount: true } },
              payments: {
                where: { paymentStatus: "SUCCESS" },
                orderBy: { paymentDate: "desc" },
                select: {
                  amount: true,
                  paymentDate: true,
                  paymentMethod: true,
                  bankTransactionNo: true,
                  transactionReference: true,
                  paymentContent: true,
                  paymentBatch: {
                    select: {
                      bankTransactionNo: true,
                      transactionReference: true,
                      paymentContent: true,
                      statementRowLinks: {
                        select: {
                          isConfirmed: true,
                          row: {
                            select: {
                              bankTransactionNo: true,
                              description: true,
                              reconciliationContent: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              paymentAllocations: {
                where: { paymentBatch: { status: "PENDING" } },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: {
                  paymentBatch: {
                    select: {
                      id: true,
                      batchNo: true,
                      status: true,
                      paymentContent: true,
                      bankTransactionNo: true,
                      transactionReference: true,
                      statementRowLinks: {
                        select: {
                          isConfirmed: true,
                          row: {
                            select: {
                              bankTransactionNo: true,
                              description: true,
                              reconciliationContent: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          pauses: {
            select: {
              id: true,
              startMonth: true,
              endMonth: true,
              reason: true,
            },
          },
        },
      }),
      prisma.classStudent.count({ where }),
      prisma.classStudent.count({ where: activeWhere }),
      prisma.classStudent.count({
        where: {
          classId,
          status: "ACTIVE",
          pauses: { some: pauseWhere },
        },
      }),
      prisma.classStudent.count({ where: { classId, status: "COMPLETED" } }),
      prisma.classStudent.count({ where: { classId, status: "LEFT" } }),
      prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM class_students cs
      WHERE cs.class_id = ${classId}::uuid
        AND cs.status = 'ACTIVE'::enrollment_status
        AND NOT EXISTS (
          SELECT 1
          FROM enrollment_pauses ep
          WHERE ep.enrollment_id = cs.id
            AND ep.status = 'ACTIVE'::enrollment_pause_status
            AND ep.start_month <= ${period.end}::date
            AND ep.end_month >= ${period.start}::date
        )
        AND EXISTS (
          SELECT 1
          FROM tuition_fees tf
          WHERE tf.enrollment_id = cs.id
            AND tf.class_id = ${classId}::uuid
            AND tf.billing_type = 'MONTHLY'::tuition_fee_billing_type
            AND tf.billing_year = ${period.year}
            AND tf.billing_month = ${period.month}
            AND NOT EXISTS (
              SELECT 1
              FROM enrollment_subjects es
              JOIN class_subjects csu ON csu.id = es.class_subject_id
              JOIN subjects s ON s.id = csu.subject_id
              WHERE es.enrollment_id = cs.id
                AND es.status = 'ACTIVE'::enrollment_subject_status
                AND csu.status = 'ACTIVE'::class_subject_status
                AND s.status = 'ACTIVE'::subject_status
                AND NOT EXISTS (
                  SELECT 1
                  FROM tuition_fee_items tfi
                  WHERE tfi.tuition_fee_id = tf.id
                    AND tfi.class_subject_id = es.class_subject_id
                )
            )
        )
    `.then((rows) => Number(rows[0]?.count ?? 0)),
    ]);

  const pauseIds = students.flatMap((student) =>
    student.pauses.map((pause) => pause.id),
  );
  const pauseStatuses =
    pauseIds.length > 0
      ? await prisma.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT id, status::text AS status FROM enrollment_pauses
        WHERE id = ANY(${pauseIds}::uuid[])
      `
      : [];
  const statusById = new Map(
    pauseStatuses.map((pause) => [pause.id, pause.status]),
  );
  const [tuitionSummary] = await prisma.$queryRaw<Array<{
    count: number;
    amount: number;
    paid: number;
    remaining: number;
  }>>`
    SELECT
      COUNT(*)::int AS count,
      COALESCE(SUM(CASE WHEN tf.status::text NOT IN ('EXEMPTED', 'CANCELLED') THEN tf.final_amount ELSE 0 END), 0)::double precision AS amount,
      COALESCE(SUM(CASE WHEN tf.status::text NOT IN ('EXEMPTED', 'CANCELLED') THEN paid.amount ELSE 0 END), 0)::double precision AS paid,
      COALESCE(SUM(CASE WHEN tf.status::text NOT IN ('EXEMPTED', 'CANCELLED') THEN GREATEST(tf.final_amount - COALESCE(paid.amount, 0), 0) ELSE 0 END), 0)::double precision AS remaining
    FROM tuition_fees tf
    LEFT JOIN LATERAL (
      SELECT SUM(tp.amount) AS amount
      FROM tuition_payments tp
      WHERE tp.tuition_fee_id = tf.id AND tp.payment_status = 'SUCCESS'::tuition_payment_status
    ) paid ON true
    WHERE tf.class_id = ${classId}::uuid
      AND tf.billing_type = 'MONTHLY'::tuition_fee_billing_type
      AND tf.billing_year = ${period.year}
      AND tf.billing_month = ${period.month}
  `;
  const orderedStudents = sortedPageIds
    ? sortedPageIds.map(({ id }) => students.find((student) => student.id === id)).filter((student) => student !== undefined)
    : students;
  const items = orderedStudents.map((student) => ({
    ...student,
    pauses: student.pauses.map((pause) => ({
      ...pause,
      status: statusById.get(pause.id) ?? "ACTIVE",
    })),
    tuitionFees: student.tuitionFees.map((fee) => {
      const { dueDate, ...feeData } = fee;
      const paidAmount = fee.payments.reduce(
        (total, payment) => total.add(payment.amount),
        new Prisma.Decimal(0),
      );
      const remainingAmount = fee.finalAmount.sub(paidAmount);
      return {
        ...feeData,
        paidAmount,
        remainingAmount: remainingAmount.greaterThan(0)
          ? remainingAmount
          : new Prisma.Decimal(0),
        status: getEffectiveTuitionFeeStatus(fee.status, dueDate),
      };
    }),
  }));

  return {
    items,
    total,
    page: options.page,
    pageSize: options.pageSize,
    pages: Math.ceil(total / options.pageSize),
    pagination: {
      page: options.page,
      pageSize: options.pageSize,
      total,
      totalPages: Math.ceil(total / options.pageSize),
    },
    summary: {
      active,
      paused,
      completed,
      left,
      total: active + paused + completed + left,
      uncreated: Math.max(0, active - activeWithFee),
      tuitionFees: tuitionSummary ?? { count: 0, amount: 0, paid: 0, remaining: 0 },
    },
  };
}
