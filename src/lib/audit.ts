import { isIP } from "node:net";

export type AuditContext = {
  ipAddress: string | null;
  userAgent: string | null;
};

export function getAuditContext(request: Request): AuditContext {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const candidate = forwardedFor || realIp || null;

  return {
    ipAddress: candidate && isIP(candidate) ? candidate : null,
    userAgent: request.headers.get("user-agent"),
  };
}

export function auditFields(context?: AuditContext) {
  return {
    ipAddress: context?.ipAddress ?? null,
    userAgent: context?.userAgent ?? null,
  };
}
