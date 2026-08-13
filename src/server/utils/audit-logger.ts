export interface AuditParams {
  organizationId: string;
  actorUserId?: string | null;
  action: string;
  entityType: 'SHIFT' | 'ATTENDANCE_LOCATION' | 'EMPLOYEE_SHIFT' | 'ORGANIZATION';
  entityId: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string | null;
  requestId?: string | null;
}

const SENSITIVE_KEYS = new Set([
  'password', 'password_hash', 'jwt_secret', 'jwt_refresh_secret',
  'database_url', 'access_token', 'refresh_token', 'token', 'secret',
  'passwordhash', 'reset_token_hash'
]);

function sanitizeValues(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeValues);

  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      clean[key] = '[REDACTED]';
    } else if (val && typeof val === 'object') {
      clean[key] = sanitizeValues(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

export async function logMasterDataChangeTx(client: any, params: AuditParams) {
  const oldClean = sanitizeValues(params.oldValues ?? null);
  const newClean = sanitizeValues(params.newValues ?? null);

  await client.query(`
    INSERT INTO master_data_audit_logs 
    (organization_id, actor_user_id, action, entity_type, entity_id, old_values, new_values, ip_address, request_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `, [
    params.organizationId,
    params.actorUserId || null,
    params.action,
    params.entityType,
    params.entityId,
    oldClean ? JSON.stringify(oldClean) : null,
    newClean ? JSON.stringify(newClean) : null,
    params.ipAddress || null,
    params.requestId || null
  ]);
}
