import { TuitionFeeStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { getVietnamDayStart } from "@/lib/vietnam-time";

// Kept as a literal so the application can boot safely during the migration
// window even when an older generated Prisma client is still present.
export const PARTIAL_FEE_STATUS = "PARTIAL" as TuitionFeeStatus;

export function getStoredTuitionFeeStatus(
  finalAmount: Prisma.Decimal,
  paidAmount: Prisma.Decimal,
) {
  if (paidAmount.greaterThanOrEqualTo(finalAmount)) return TuitionFeeStatus.PAID;
  if (paidAmount.greaterThan(0)) return PARTIAL_FEE_STATUS;
  return TuitionFeeStatus.UNPAID;
}

export function getEffectiveTuitionFeeStatus(
  status: TuitionFeeStatus,
  dueDate: Date | null,
  asOf = new Date(),
) {
  if (
    (status === TuitionFeeStatus.UNPAID || status === PARTIAL_FEE_STATUS) &&
    dueDate !== null &&
    dueDate < getVietnamDayStart(asOf)
  ) {
    return TuitionFeeStatus.OVERDUE;
  }
  return status;
}
