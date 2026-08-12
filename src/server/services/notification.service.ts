import { query, queryOne } from '../db';
import { pushService } from './PushNotificationService';

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface CreateNotificationParams {
  organizationId: string;
  recipientEmployeeId: string;
  actorEmployeeId?: string;
  notificationType: string;
  entityType?: string;
  entityId?: string;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: any;
  priority?: NotificationPriority;
  expiresAt?: string | Date;
}

export class NotificationService {
  /**
   * Safely migrates legacy notifications, preserving their data while enriching them with employee/organization IDs where possible.
   */
  async migrateLegacyNotifications() {
    try {
      // Add columns safely
      await query(`
        ALTER TABLE notifications
        ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS recipient_employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS actor_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS notification_type VARCHAR(50) DEFAULT 'SYSTEM',
        ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50),
        ADD COLUMN IF NOT EXISTS entity_id UUID,
        ADD COLUMN IF NOT EXISTS action_url VARCHAR(255),
        ADD COLUMN IF NOT EXISTS metadata JSONB,
        ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'NORMAL',
        ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
      `);

      // 1. Get total legacy count
      const totalRes = await queryOne(`SELECT COUNT(*) as cnt FROM notifications WHERE recipient_employee_id IS NULL AND user_id IS NOT NULL`);
      const totalLegacy = parseInt(totalRes?.cnt || '0');

      if (totalLegacy > 0) {
        // Map user_id to recipient_employee_id and organization_id via employees table
        await query(`
          UPDATE notifications n
          SET 
            recipient_employee_id = e.id,
            organization_id = e.organization_id,
            notification_type = COALESCE(n.type, 'SYSTEM'),
            action_url = COALESCE(n.link, NULL)
          FROM employees e
          WHERE n.user_id = e.user_id
            AND n.recipient_employee_id IS NULL;
        `);

        // Get counts after migration
        const unmappedRes = await queryOne(`SELECT COUNT(*) as cnt FROM notifications WHERE recipient_employee_id IS NULL AND user_id IS NOT NULL`);
        const unmappedCount = parseInt(unmappedRes?.cnt || '0');
        const mappedCount = totalLegacy - unmappedCount;

        console.log(`--- NOTIFICATION MIGRATION REPORT ---`);
        console.log(`Total Legacy Unmapped: ${totalLegacy}`);
        console.log(`Successfully Mapped: ${mappedCount}`);
        console.log(`Remaining Unmapped (Missing Employee): ${unmappedCount}`);
        console.log(`-------------------------------------`);
      } else {
        console.log(`Notification Migration: No legacy unmapped notifications found (Idempotent success).`);
      }
    } catch (err) {
      console.error('Failed to migrate legacy notifications:', err);
    }
  }

  /**
   * Creates a notification with idempotent duplicate prevention inside a transaction.
   */
  async createNotification(params: CreateNotificationParams, existingClient?: any) {
    const runQueryOne = existingClient ? (q: string, vals: any[]) => existingClient.query(q, vals).then((r:any) => r.rows[0]) : queryOne;

    // Idempotency check: Don't duplicate if exact same unread notification exists for this entity/type
    if (params.entityType && params.entityId) {
      const existing = await runQueryOne(`
        SELECT id FROM notifications 
        WHERE organization_id = $1 
          AND recipient_employee_id = $2 
          AND notification_type = $3 
          AND entity_type = $4 
          AND entity_id = $5 
          AND is_read = FALSE
          AND deleted_at IS NULL
      `, [params.organizationId, params.recipientEmployeeId, params.notificationType, params.entityType, params.entityId]);

      if (existing) {
        return existing; // Silently return existing to prevent spam
      }
    }

    const sql = `
      INSERT INTO notifications (
        organization_id, recipient_employee_id, actor_employee_id, notification_type,
        entity_type, entity_id, title, message, action_url, metadata, priority, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      params.organizationId,
      params.recipientEmployeeId,
      params.actorEmployeeId || null,
      params.notificationType,
      params.entityType || null,
      params.entityId || null,
      params.title,
      params.message,
      params.actionUrl || null,
      params.metadata ? JSON.stringify(params.metadata) : null,
      params.priority || 'NORMAL',
      params.expiresAt || null
    ];

    const result = await runQueryOne(sql, values);
    
    // Async push - do not await or fail the business transaction
    pushService.sendToEmployee(
      params.organizationId,
      params.recipientEmployeeId,
      params.title,
      params.message,
      { notificationId: result.id, actionUrl: params.actionUrl }
    ).catch(err => console.error('[NotificationService] Push delivery exception:', err));
    
    return result;
  }

  async notifyManager(
    organizationId: string, 
    employeeId: string, 
    params: Omit<CreateNotificationParams, 'organizationId' | 'recipientEmployeeId'>,
    existingClient?: any
  ) {
    const runQueryOne = existingClient ? (q: string, vals: any[]) => existingClient.query(q, vals).then((r:any) => r.rows[0]) : queryOne;
    
    // Resolve manager
    const emp = await runQueryOne(`SELECT manager_id FROM employees WHERE id = $1 AND organization_id = $2`, [employeeId, organizationId]);
    if (emp && emp.manager_id) {
      return this.createNotification({
        ...params,
        organizationId,
        recipientEmployeeId: emp.manager_id,
        actorEmployeeId: employeeId
      }, existingClient);
    }
    return null;
  }

  async getUnreadCount(organizationId: string, employeeId: string) {
    const res = await queryOne(`
      SELECT COUNT(*)::int as count 
      FROM notifications 
      WHERE organization_id = $1 
        AND recipient_employee_id = $2 
        AND is_read = FALSE 
        AND deleted_at IS NULL
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `, [organizationId, employeeId]);
    return res?.count || 0;
  }

  async getNotifications(organizationId: string, employeeId: string, filters: any = {}) {
    const page = Math.max(1, parseInt(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(filters.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = [
      'organization_id = $1',
      'recipient_employee_id = $2',
      'deleted_at IS NULL',
      '(expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)'
    ];
    const values: any[] = [organizationId, employeeId];
    let paramIdx = 3;

    if (filters.isRead !== undefined && filters.isRead !== 'ALL') {
      conditions.push(`is_read = $${paramIdx++}`);
      values.push(filters.isRead === 'true' || filters.isRead === true);
    }
    
    if (filters.notificationType && filters.notificationType !== 'ALL') {
      conditions.push(`notification_type = $${paramIdx++}`);
      values.push(filters.notificationType);
    }

    if (filters.priority && filters.priority !== 'ALL') {
      conditions.push(`priority = $${paramIdx++}`);
      values.push(filters.priority);
    }

    const whereClause = conditions.join(' AND ');

    // Validate sorting
    const allowedSort = ['created_at', 'priority', 'notification_type', 'is_read'];
    let sortBy = 'created_at';
    if (filters.sortBy && allowedSort.includes(filters.sortBy)) {
      sortBy = filters.sortBy;
    }
    const sortDir = filters.sortDir === 'asc' ? 'ASC' : 'DESC';

    const sql = `
      SELECT *, COUNT(*) OVER() as total_count 
      FROM notifications 
      WHERE ${whereClause}
      ORDER BY ${sortBy} ${sortDir}
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;
    
    values.push(limit, offset);

    const data = await query(sql, values);
    const total = data.length > 0 ? parseInt(data[0].total_count) : 0;

    return {
      data: data.map((d: any) => {
        delete d.total_count;
        return d;
      }),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async markAsRead(organizationId: string, employeeId: string, notificationId: string) {
    return await queryOne(`
      UPDATE notifications 
      SET is_read = TRUE, read_at = CURRENT_TIMESTAMP 
      WHERE id = $1 AND organization_id = $2 AND recipient_employee_id = $3 AND is_read = FALSE
      RETURNING *
    `, [notificationId, organizationId, employeeId]);
  }

  async markAllAsRead(organizationId: string, employeeId: string) {
    return await query(`
      UPDATE notifications 
      SET is_read = TRUE, read_at = CURRENT_TIMESTAMP 
      WHERE organization_id = $1 AND recipient_employee_id = $2 AND is_read = FALSE AND deleted_at IS NULL
    `, [organizationId, employeeId]);
  }

  async deleteNotification(organizationId: string, employeeId: string, notificationId: string) {
    return await queryOne(`
      UPDATE notifications 
      SET deleted_at = CURRENT_TIMESTAMP 
      WHERE id = $1 AND organization_id = $2 AND recipient_employee_id = $3 AND deleted_at IS NULL
      RETURNING id
    `, [notificationId, organizationId, employeeId]);
  }
}

export const notificationService = new NotificationService();
