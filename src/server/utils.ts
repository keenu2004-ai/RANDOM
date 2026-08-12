import { v4 as uuidv4 } from 'uuid';
import { query } from './db/client';

export function generateId(): string {
  return uuidv4();
}

export async function logAudit(orgId: string, userId: string, userEmail: string, userName: string, action: string, moduleName: string, entityId: string, details: string): Promise<void> {
  try {
    await query(`
      INSERT INTO audit_logs (organization_id, user_id, user_email, action, module, details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [orgId, userId, userEmail, action, moduleName, details]);
  } catch (err) {
    console.error('Failed to log audit event', err);
  }
}

export function resetDb(): void {
  // stub
}
