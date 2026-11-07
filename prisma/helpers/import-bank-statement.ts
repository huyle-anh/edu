import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { importBankStatement } from "@/modules/finance/bank/services/bank-csv.service";

const prisma = new PrismaClient();

async function main() {
  const filePath = process.argv[2];
  if (!filePath) throw new Error("Gebruik: npm run bank:import -- <xlsx-pad> [bank-account-id] (BIDV hoặc Techcombank)");
  const actor = await prisma.user.findFirst({ where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } });
  if (!actor) throw new Error("Geen user ACTIVE để ghi audit/import");
  let bankAccountId = process.argv[3];
  if (!bankAccountId) {
    const existing = await prisma.bankAccount.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
    if (existing) bankAccountId = existing.id;
    else {
      const account = await prisma.bankAccount.create({ data: { bankCode: "BIDV", bankName: "BIDV", accountNo: "7802866666", accountName: "MA HONG LAN", createdBy: actor.id, updatedBy: actor.id } });
      bankAccountId = account.id;
    }
  }
  const result = await importBankStatement({ buffer: fs.readFileSync(filePath), fileName: path.basename(filePath), bankAccountId });
  console.log(JSON.stringify({ fileName: result.fileName, totalRows: result.totalRows, matchedRows: result.matchedRows, unmatchedRows: result.unmatchedRows, duplicatedRows: result.duplicatedRows, ignoredRows: result.ignoredRows }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
