import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import {
  bankReconciliationGroupConfirmSchema,
  bankReconciliationBulkConfirmSchema,
  bankReconciliationConfirmSchema,
} from "@/modules/finance/bank/schemas/bank-reconciliation.schema";
import {
  confirmBankReconciliationGroup,
  confirmBankReconciliation,
  confirmBankReconciliations,
} from "@/modules/finance/bank/services/bank-csv.service";
import { getAuditContext } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const body: unknown = await request.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "batchIds" in body
    ) {
      const groupBody = bankReconciliationGroupConfirmSchema.parse(body);
      return apiSuccess(
        await confirmBankReconciliationGroup({
          confirmationToken: groupBody.confirmationToken,
          batchIds: groupBody.batchIds,
          actorId: user.id,
          auditContext: getAuditContext(request),
        }),
      );
    }
    if (
      typeof body === "object" &&
      body !== null &&
      "confirmations" in body
    ) {
      const bulkBody = bankReconciliationBulkConfirmSchema.parse(body);
      return apiSuccess(
        await confirmBankReconciliations({
          confirmations: bulkBody.confirmations,
          actorId: user.id,
          auditContext: getAuditContext(request),
        }),
      );
    }
    const singleBody = bankReconciliationConfirmSchema.parse(body);
    return apiSuccess(
      await confirmBankReconciliation({ ...singleBody, actorId: user.id, auditContext: getAuditContext(request) }),
    );
  } catch (error) {
    return handleApiError(error, "Không thể xác nhận đối soát");
  }
}
