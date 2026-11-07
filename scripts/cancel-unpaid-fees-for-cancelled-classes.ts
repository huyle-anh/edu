import {
  Prisma,
  PrismaClient,
  TuitionFeeStatus,
} from "@prisma/client";

const prisma = new PrismaClient();
const reason = "Hủy công nợ do lớp đã hủy (rà soát hồi tố)";

type FeeRow = {
  id: string;
  feeNo: string;
  status: TuitionFeeStatus;
  finalAmount: Prisma.Decimal;
  billingYear: number;
  billingMonth: number;
  student: { fullName: string; code: string };
  payments: Array<{ paymentStatus: string }>;
  paymentAllocations: Array<{
    paymentBatch: { batchNo: string; status: string };
  }>;
};

function parseArgs(args: string[]) {
  let apply = false;
  let actorId: string | undefined;
  const classIds: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--apply") {
      apply = true;
    } else if (arg === "--actor-id") {
      actorId = args[index + 1];
      index += 1;
    } else if (arg === "--class-id") {
      const id = args[index + 1];
      if (!id) throw new Error("Thiếu giá trị sau --class-id");
      classIds.push(id);
      index += 1;
    } else {
      throw new Error(`Tham số không hỗ trợ: ${arg}`);
    }
  }

  if (apply && classIds.length === 0) {
    throw new Error("Chế độ --apply bắt buộc chỉ định ít nhất một --class-id");
  }
  if (apply && !actorId) {
    throw new Error("Chế độ --apply bắt buộc chỉ định --actor-id của người thao tác");
  }

  return { apply, actorId, classIds: [...new Set(classIds)] };
}

function classifyFee(fee: FeeRow): string {
  if (fee.status !== "UNPAID" && fee.status !== "OVERDUE") return fee.status;
  if (fee.paymentAllocations.some(({ paymentBatch }) => paymentBatch.status === "PENDING")) {
    return "Đang ở đợt thu PENDING";
  }
  if (fee.payments.length > 0) return "Có lịch sử thanh toán";
  return "Đủ điều kiện hủy";
}

async function getCancelledClasses(classIds: string[]) {
  const classes = await prisma.class.findMany({
    where: {
      status: "CANCELLED",
      ...(classIds.length > 0 ? { id: { in: classIds } } : {}),
    },
    select: {
      id: true,
      code: true,
      name: true,
      tuitionFees: {
        where: { status: { notIn: ["CANCELLED", "EXEMPTED"] } },
        orderBy: [{ billingYear: "asc" }, { billingMonth: "asc" }, { feeNo: "asc" }],
        select: {
          id: true,
          feeNo: true,
          status: true,
          finalAmount: true,
          billingYear: true,
          billingMonth: true,
          student: { select: { fullName: true, code: true } },
          payments: { select: { paymentStatus: true } },
          paymentAllocations: {
            select: { paymentBatch: { select: { batchNo: true, status: true } } },
          },
        },
      },
    },
    orderBy: [{ code: "asc" }],
  });

  const foundIds = new Set(classes.map(({ id }) => id));
  const missingIds = classIds.filter((id) => !foundIds.has(id));
  if (missingIds.length > 0) {
    throw new Error(`Không tìm thấy lớp đã hủy với mã ID: ${missingIds.join(", ")}`);
  }
  return classes;
}

async function applyForClass(classId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`class:${classId}`}))`,
    );
    const classData = await tx.class.findUnique({
      where: { id: classId },
      select: { id: true, code: true, name: true, status: true },
    });
    if (!classData || classData.status !== "CANCELLED") {
      throw new Error(`Lớp ${classId} không còn ở trạng thái đã hủy; bỏ qua cập nhật.`);
    }

    await tx.$queryRaw(Prisma.sql`
      SELECT id FROM tuition_fees WHERE class_id = ${classId}::uuid ORDER BY id FOR UPDATE
    `);

    const fees = await tx.tuitionFee.findMany({
      where: {
        classId,
        status: { in: [TuitionFeeStatus.UNPAID, TuitionFeeStatus.OVERDUE] },
        payments: { none: {} },
        paymentAllocations: { none: { paymentBatch: { status: "PENDING" } } },
      },
      select: { id: true, feeNo: true, status: true, version: true },
    });

    for (const fee of fees) {
      const updated = await tx.tuitionFee.update({
        where: { id: fee.id },
        data: {
          status: TuitionFeeStatus.CANCELLED,
          cancellationReason: reason,
          version: { increment: 1 },
          updatedBy: actorId,
        },
        select: { id: true, feeNo: true, status: true, version: true, cancellationReason: true },
      });
      await tx.tuitionAuditLog.create({
        data: {
          entityType: "TUITION_FEE",
          entityId: fee.id,
          action: "CANCEL",
          reason,
          dataBefore: fee as unknown as Prisma.InputJsonValue,
          dataAfter: updated as unknown as Prisma.InputJsonValue,
          performedBy: actorId,
        },
      });
    }

    return { classId, classCode: classData.code, className: classData.name, cancelledCount: fees.length };
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const classes = await getCancelledClasses(options.classIds);
  const preview = classes.map((classData) => {
    const breakdown = new Map<string, number>();
    for (const fee of classData.tuitionFees) {
      const category = classifyFee(fee);
      breakdown.set(category, (breakdown.get(category) ?? 0) + 1);
    }
    return {
      classId: classData.id,
      classCode: classData.code,
      className: classData.name,
      fees: classData.tuitionFees.map((fee) => ({
        feeNo: fee.feeNo,
        studentCode: fee.student.code,
        studentName: fee.student.fullName,
        period: `${fee.billingYear}-${String(fee.billingMonth).padStart(2, "0")}`,
        status: fee.status,
        amount: fee.finalAmount.toString(),
        category: classifyFee(fee),
      })),
      summary: Object.fromEntries(breakdown),
    };
  });

  console.log(JSON.stringify({ mode: options.apply ? "apply" : "dry-run", classes: preview }, null, 2));
  if (!options.apply || !options.actorId) return;

  const results = [];
  for (const classData of classes) {
    results.push(await applyForClass(classData.id, options.actorId));
  }
  console.log(JSON.stringify({ applied: results }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
