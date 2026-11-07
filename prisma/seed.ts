import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function timeToMinute(time: string): number {
  const [hour = "0", minute = "0"] = time.split(":");
  return Number(hour) * 60 + Number(minute);
}

async function cleanup() {
  await prisma.tuitionAuditLog.deleteMany();
  await prisma.tuitionReceipt.deleteMany();
  await prisma.tuitionPayment.deleteMany();
  await prisma.tuitionFeeItem.deleteMany();
  await prisma.tuitionFee.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.$executeRaw`DELETE FROM enrollment_subjects`;
  await prisma.$executeRaw`DELETE FROM class_subjects`;
  await prisma.$executeRaw`DELETE FROM subjects`;
  await prisma.classSchedule.deleteMany();
  await prisma.classStudent.deleteMany();
  await prisma.class.deleteMany();
  await prisma.student.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.user.deleteMany();
}

async function seedAuth() {
  const defaultPasswordHash = await bcrypt.hash("password", 10);

  const adminUser = await prisma.user.create({
    data: {
      email: "admin@edu.local",
      fullName: "Quản trị viên",
      passwordHash: defaultPasswordHash,
      status: "ACTIVE",
    },
  });

  const staffUser = await prisma.user.create({
    data: {
      email: "staff@edu.local",
      fullName: "Nhân viên trung tâm",
      passwordHash: defaultPasswordHash,
      status: "ACTIVE",
    },
  });

  return { adminUser, staffUser };
}

async function seedMasters() {
  const teachers = await Promise.all([
    prisma.teacher.create({
      data: {
        code: "GV001",
        fullName: "Nguyễn Văn An",
        phone: "0901000001",
        bankAccount: "0123456789",
        specialty: "Toán học",
        status: "ACTIVE",
      },
    }),
    prisma.teacher.create({
      data: {
        code: "GV002",
        fullName: "Trần Thị Bình",
        phone: "0901000002",
        bankAccount: "9876543210",
        specialty: "Tiếng Anh",
        status: "ACTIVE",
      },
    }),
    prisma.teacher.create({
      data: {
        code: "GV003",
        fullName: "Lê Minh Cường",
        phone: "0901000003",
        specialty: "Vật lý",
        status: "INACTIVE",
      },
    }),
  ]);

  const students = await Promise.all([
    prisma.student.create({
      data: {
        code: "HV001",
        fullName: "Phạm Gia Hân",
        phone: "0912000001",
        birthday: date("2012-03-15"),
        parentName: "Phạm Văn Hải",
        address: "Quận 1, TP.HCM",
        status: "ACTIVE",
      },
    }),
    prisma.student.create({
      data: {
        code: "HV002",
        fullName: "Nguyễn Minh Khang",
        phone: "0912000002",
        birthday: date("2011-07-20"),
        parentName: "Nguyễn Thị Hoa",
        address: "Quận 3, TP.HCM",
        status: "ACTIVE",
      },
    }),
    prisma.student.create({
      data: {
        code: "HV003",
        fullName: "Trần Bảo Ngọc",
        phone: "0912000003",
        birthday: date("2013-11-08"),
        parentName: "Trần Văn Nam",
        address: "Bình Thạnh, TP.HCM",
        status: "ACTIVE",
      },
    }),
    prisma.student.create({
      data: {
        code: "HV004",
        fullName: "Lê Hoàng Long",
        phone: "0912000004",
        birthday: date("2010-01-12"),
        parentName: "Lê Thị Mai",
        address: "Tân Bình, TP.HCM",
        status: "INACTIVE",
      },
    }),
  ]);

  return { teachers, students };
}

async function seedClasses(
  teachers: Awaited<ReturnType<typeof seedMasters>>["teachers"],
  students: Awaited<ReturnType<typeof seedMasters>>["students"],
) {
  const mathClass = await prisma.class.create({
    data: {
      code: "CLSMATH001",
      name: "Toán tư duy cơ bản",
      startDate: date("2026-06-01"),
      endDate: date("2026-08-31"),
      status: "ACTIVE",
      note: "Lớp tối thứ 2 và thứ 4",
    },
  });

  const englishClass = await prisma.class.create({
    data: {
      code: "CLSENG001",
      name: "Tiếng Anh giao tiếp thiếu nhi",
      startDate: date("2026-06-05"),
      endDate: date("2026-09-30"),
      status: "ACTIVE",
      note: "Lớp cuối tuần",
    },
  });

  const physicsClass = await prisma.class.create({
    data: {
      code: "CLSPHY001",
      name: "Vật lý nâng cao",
      startDate: date("2026-07-01"),
      endDate: date("2026-09-15"),
      status: "DRAFT",
    },
  });

  await prisma.classStudent.createMany({
    data: [
      {
        classId: mathClass.id,
        studentId: students[0].id,
        enrolledAt: date("2026-06-01"),
        status: "ACTIVE",
      },
      {
        classId: mathClass.id,
        studentId: students[1].id,
        enrolledAt: date("2026-06-01"),
        status: "ACTIVE",
      },
      {
        classId: mathClass.id,
        studentId: students[2].id,
        enrolledAt: date("2026-06-01"),
        status: "ACTIVE",
      },
      {
        classId: englishClass.id,
        studentId: students[1].id,
        enrolledAt: date("2026-06-05"),
        status: "ACTIVE",
      },
      {
        classId: englishClass.id,
        studentId: students[2].id,
        enrolledAt: date("2026-06-05"),
        status: "ACTIVE",
      },
      {
        classId: englishClass.id,
        studentId: students[3].id,
        enrolledAt: date("2026-06-05"),
        leftAt: date("2026-06-20"),
        status: "LEFT",
        note: "Nghỉ do thay đổi lịch học",
      },
    ],
  });

  await prisma.classSchedule.createMany({
    data: [
      {
        classId: mathClass.id,
        teacherId: teachers[0].id,
        dayOfWeek: 2,
        startMinute: timeToMinute("18:00"),
        endMinute: timeToMinute("19:30"),
      },
      {
        classId: mathClass.id,
        teacherId: teachers[0].id,
        dayOfWeek: 4,
        startMinute: timeToMinute("18:00"),
        endMinute: timeToMinute("19:30"),
      },
      {
        classId: englishClass.id,
        teacherId: teachers[1].id,
        dayOfWeek: 7,
        startMinute: timeToMinute("09:00"),
        endMinute: timeToMinute("10:30"),
      },
      {
        classId: englishClass.id,
        teacherId: teachers[1].id,
        dayOfWeek: 1,
        startMinute: timeToMinute("09:00"),
        endMinute: timeToMinute("10:30"),
      },
    ],
  });

  const subjects = await prisma.$queryRaw<Array<{ id: string; code: string }>>`
    INSERT INTO subjects (id, code, name, status, created_at, updated_at)
    VALUES
      (gen_random_uuid(), 'TOAN', 'Toán', 'ACTIVE'::subject_status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (gen_random_uuid(), 'VAN', 'Ngữ văn', 'ACTIVE'::subject_status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (gen_random_uuid(), 'ANH', 'Tiếng Anh', 'ACTIVE'::subject_status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (gen_random_uuid(), 'LY', 'Vật lý', 'ACTIVE'::subject_status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING id, code
  `;
  const subjectId = (code: string) =>
    subjects.find((subject) => subject.code === code)?.id;
  const mathSubjectId = subjectId("TOAN");
  const literatureSubjectId = subjectId("VAN");
  const englishSubjectId = subjectId("ANH");
  const physicsSubjectId = subjectId("LY");
  if (
    !mathSubjectId ||
    !literatureSubjectId ||
    !englishSubjectId ||
    !physicsSubjectId
  ) {
    throw new Error("Không thể tạo dữ liệu môn học mẫu");
  }

  await prisma.$executeRaw`
    INSERT INTO class_subjects (id, class_id, subject_id, teacher_id, tuition_fee, total_sessions, status, created_at, updated_at)
    VALUES
      (gen_random_uuid(), ${mathClass.id}::uuid, ${mathSubjectId}::uuid, ${teachers[0].id}::uuid, 500000, 12, 'ACTIVE'::class_subject_status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (gen_random_uuid(), ${mathClass.id}::uuid, ${literatureSubjectId}::uuid, ${teachers[1].id}::uuid, 450000, 12, 'ACTIVE'::class_subject_status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (gen_random_uuid(), ${englishClass.id}::uuid, ${englishSubjectId}::uuid, ${teachers[1].id}::uuid, 650000, 16, 'ACTIVE'::class_subject_status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (gen_random_uuid(), ${physicsClass.id}::uuid, ${physicsSubjectId}::uuid, ${teachers[2].id}::uuid, 700000, 10, 'ACTIVE'::class_subject_status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;
  const subjectForClass = await prisma.$queryRaw<
    Array<{ id: string; class_id: string; subject_id: string }>
  >`
    SELECT id, class_id, subject_id FROM class_subjects
    WHERE class_id IN (${mathClass.id}::uuid, ${englishClass.id}::uuid, ${physicsClass.id}::uuid)
  `;
  for (const classSubject of subjectForClass) {
    await prisma.$executeRaw`
      INSERT INTO enrollment_subjects (id, enrollment_id, class_subject_id, status, enrolled_at)
      SELECT gen_random_uuid(), cs.id, ${classSubject.id}::uuid, 'ACTIVE'::enrollment_subject_status, CURRENT_TIMESTAMP
      FROM class_students cs
      WHERE cs.class_id = ${classSubject.class_id}::uuid
    `;
  }

  return { mathClass, englishClass, physicsClass };
}

async function seedBankAccounts(adminUserId: string) {
  await prisma.bankAccount.createMany({
    data: [
      {
        bankCode: "TCB",
        bankName: "Ngân hàng TMCP Kỹ Thương Việt Nam",
        accountNo: "19070479681014",
        accountName: "NGUYEN DO HUAN",
        isActive: true,
        createdBy: adminUserId,
        updatedBy: adminUserId,
      },
      {
        bankCode: "BIDV",
        bankName: "Ngân hàng Thương mại Cổ phần Đầu tư và Phát triển Việt Nam",
        accountNo: "7802866666",
        accountName: "MA HONG LAN",
        isActive: true,
        createdBy: adminUserId,
        updatedBy: adminUserId,
      },
    ],
  });
}

async function main() {
  console.log("Start seeding...");

  await cleanup();

  const { adminUser } = await seedAuth();
  // const { teachers, students } = await seedMasters();
  // const classes = await seedClasses(teachers, students);
  await seedBankAccounts(adminUser.id);

  console.log("Seed completed.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
