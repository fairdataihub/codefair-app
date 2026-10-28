interface AdminMaintenanceRow {
  enabled: boolean;
  enabledAt: string | null;
  key: import("#shared/utils/maintenance").MaintenanceKey;
  message: string;
  previewMessage: string;
  updatedAt: string | null;
  updatedBy: { id: string; username: string } | null;
}

interface AdminUserRow {
  id: string;
  username: string;
  github_id: number;
  last_login: string;
  role?: string;
}

interface AdminAuditLogRow {
  id: string;
  action: string;
  actor: { id: string; username: string; github_id: number } | null;
  actorLabel: string;
  createdAt: string;
  details: Record<string, unknown> | null;
  entityId: string;
  entityType: string;
}
