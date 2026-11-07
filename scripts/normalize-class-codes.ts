import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type ClassCodeRow = { id: string; code: string };
type CodeChange = { id: string; oldCode: string; newCode: string };

function normalizeClassCode(code: string): string | null {
  const ascii = code
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const normalized = ascii
    .replace(/[^A-Za-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!normalized || normalized.length > 50) return null;
  return normalized;
}

function findCollisions(rows: ClassCodeRow[], changes: CodeChange[]) {
  const proposedCodes = new Map<string, string[]>();
  const changedById = new Map(changes.map((change) => [change.id, change]));

  for (const row of rows) {
    const code = changedById.get(row.id)?.newCode ?? row.code;
    const ids = proposedCodes.get(code) ?? [];
    ids.push(row.id);
    proposedCodes.set(code, ids);
  }

  return [...proposedCodes.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([code, ids]) => ({ code, ids }));
}

async function main() {
  const args = process.argv.slice(2);
  const applyChanges = args.includes("--apply");
  const unknownArgs = args.filter((arg) => arg !== "--apply");
  if (unknownArgs.length > 0) {
    throw new Error(`Tham số không hỗ trợ: ${unknownArgs.join(", ")}`);
  }

  const rows = await prisma.class.findMany({
    select: { id: true, code: true },
    orderBy: { code: "asc" },
  });
  const changes: CodeChange[] = [];
  const unresolved: ClassCodeRow[] = [];

  for (const row of rows) {
    const newCode = normalizeClassCode(row.code);
    if (!newCode) {
      unresolved.push(row);
    } else if (newCode !== row.code) {
      changes.push({ id: row.id, oldCode: row.code, newCode });
    }
  }

  const collisions = findCollisions(rows, changes);
  console.log(
    JSON.stringify(
      {
        mode: applyChanges ? "apply" : "dry-run",
        totalClasses: rows.length,
        changes,
        unresolved,
        collisions,
      },
      null,
      2,
    ),
  );

  if (unresolved.length > 0 || collisions.length > 0) {
    throw new Error("Có mã cần xử lý thủ công; không cập nhật dữ liệu.");
  }
  if (!applyChanges || changes.length === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const change of changes) {
      const result = await tx.class.updateMany({
        where: { id: change.id, code: change.oldCode },
        data: { code: change.newCode },
      });
      if (result.count !== 1) {
        throw new Error(`Lớp ${change.id} đã thay đổi trong lúc chạy; rollback toàn bộ.`);
      }
    }
  });

  console.log(`Đã chuẩn hóa ${changes.length} mã lớp.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
