type SecurityAuditInput = {
  action: string;
  userId: string;
  resourceId?: string;
  detail?: string;
};

export function logSecurityEvent({
  action,
  userId,
  resourceId,
  detail,
}: SecurityAuditInput) {
  console.warn("[SECURITY]", {
    action,
    userId,
    resourceId: resourceId ?? null,
    detail: detail ?? null,
    occurredAt: new Date().toISOString(),
  });
}

