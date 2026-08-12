import { query, queryOne } from '../db/client';

export class NotificationRepository {
  // --- Notifications ---
  async getNotifications(orgId: string, userId: string, filters: any) {
    let sql = `SELECT * FROM notifications WHERE organization_id = $1 AND user_id = $2`;
    const params: any[] = [orgId, userId];
    let idx = 3;

    if (filters.unreadOnly === 'true') {
      sql += ` AND is_read = FALSE`;
    }
    if (filters.type && filters.type !== 'ALL') {
      sql += ` AND type = $${idx++}`;
      params.push(filters.type);
    }
    if (filters.search) {
      sql += ` AND (LOWER(title) LIKE $${idx} OR LOWER(message) LIKE $${idx})`;
      params.push(`%${filters.search.toLowerCase()}%`);
      idx++;
    }

    sql += ` ORDER BY created_at DESC`;
    const rows = await query(sql, params);

    return rows.map(r => ({
      id: r.id,
      organizationId: r.organization_id,
      userId: r.user_id,
      title: r.title,
      message: r.message,
      isRead: r.is_read,
      type: r.type,
      link: r.link,
      createdAt: r.created_at
    }));
  }

  async markAsRead(orgId: string, id: string, userId: string) {
    const res = await queryOne(`UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 AND organization_id = $3 RETURNING *`, [id, userId, orgId]);
    if (!res) return null;
    return {
      id: res.id,
      organizationId: res.organization_id,
      userId: res.user_id,
      title: res.title,
      message: res.message,
      isRead: res.is_read,
      type: res.type,
      link: res.link,
      createdAt: res.created_at
    };
  }

  async markAllAsRead(orgId: string, userId: string) {
    await query(`UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND organization_id = $2`, [userId, orgId]);
  }

  async clearReadNotifications(orgId: string, userId: string) {
    await query(`DELETE FROM notifications WHERE user_id = $1 AND is_read = TRUE AND organization_id = $2`, [userId, orgId]);
  }

  async deleteNotification(orgId: string, id: string, userId: string) {
    const res = await queryOne(`DELETE FROM notifications WHERE id = $1 AND user_id = $2 AND organization_id = $3 RETURNING id`, [id, userId, orgId]);
    return !!res;
  }

  // --- Announcements ---
  async getAnnouncements(orgId: string, role: string, filters: any = {}) {
    const page = Math.max(1, parseInt(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(filters.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = ['organization_id = $1'];
    const params: any[] = [orgId];
    let idx = 2;

    if (role === 'EMPLOYEE') {
      conditions.push(`status = 'PUBLISHED'`);
      conditions.push(`deleted_at IS NULL`);
      conditions.push(`(expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`);
    } else {
      if (filters.status) {
        conditions.push(`status = $${idx++}`);
        params.push(filters.status);
      }
      conditions.push(`deleted_at IS NULL`);
    }

    if (filters.category && filters.category !== 'ALL') {
      conditions.push(`category = $${idx++}`);
      params.push(filters.category);
    }
    
    if (filters.priority && filters.priority !== 'ALL') {
      conditions.push(`priority = $${idx++}`);
      params.push(filters.priority);
    }

    if (filters.search) {
      conditions.push(`(LOWER(title) LIKE $${idx} OR LOWER(content) LIKE $${idx})`);
      params.push(`%${filters.search.toLowerCase()}%`);
      idx++;
    }

    const where = conditions.join(' AND ');
    
    const countSql = `SELECT COUNT(*) as total FROM announcements WHERE ${where}`;
    const countRes = await queryOne(countSql, params);
    const total = parseInt(countRes?.total || '0');

    const sql = `
      SELECT * FROM announcements 
      WHERE ${where} 
      ORDER BY created_at DESC 
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, offset);
    const rows = await query(sql, params);

    const data = rows.map(r => this.mapAnnouncement(r));
    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getAnnouncement(orgId: string, id: string, role: string) {
    let sql = `SELECT * FROM announcements WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`;
    if (role === 'EMPLOYEE') {
      sql += ` AND status = 'PUBLISHED' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`;
    }
    const row = await queryOne(sql, [id, orgId]);
    return row ? this.mapAnnouncement(row) : null;
  }

  async createAnnouncement(orgId: string, data: any, createdBy: string) {
    const res = await queryOne(`
      INSERT INTO announcements (
        organization_id, title, content, category, priority, status, audience, 
        target_id, target_name, publish_date, expiry_date, expires_at, attachment_name, 
        attachment_url, author_name, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `, [
      orgId, data.title, data.content, data.category || 'GENERAL', data.priority || 'NORMAL',
      'DRAFT', data.audience || 'ALL', data.targetId, data.targetName,
      data.publishDate, data.expiryDate, data.expiresAt || null, data.attachmentName,
      data.attachmentUrl, data.authorName, createdBy, createdBy
    ]);
    return this.mapAnnouncement(res);
  }

  async updateAnnouncement(orgId: string, id: string, data: any, updatedBy: string) {
    const res = await queryOne(`
      UPDATE announcements SET
        title = COALESCE($1, title),
        content = COALESCE($2, content),
        category = COALESCE($3, category),
        priority = COALESCE($4, priority),
        audience = COALESCE($5, audience),
        target_id = COALESCE($6, target_id),
        target_name = COALESCE($7, target_name),
        publish_date = COALESCE($8, publish_date),
        expiry_date = COALESCE($9, expiry_date),
        expires_at = COALESCE($10, expires_at),
        attachment_name = COALESCE($11, attachment_name),
        attachment_url = COALESCE($12, attachment_url),
        author_name = COALESCE($13, author_name),
        updated_by = $14,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $15 AND organization_id = $16 AND deleted_at IS NULL
      RETURNING *
    `, [
      data.title, data.content, data.category, data.priority, data.audience,
      data.targetId, data.targetName, data.publishDate, data.expiryDate, data.expiresAt,
      data.attachmentName, data.attachmentUrl, data.authorName, updatedBy, id, orgId
    ]);
    return res ? this.mapAnnouncement(res) : null;
  }

  async publishAnnouncement(orgId: string, id: string, updatedBy: string) {
    const res = await queryOne(`
      UPDATE announcements SET
        status = 'PUBLISHED',
        published_at = CURRENT_TIMESTAMP,
        updated_by = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND organization_id = $3 AND deleted_at IS NULL
      RETURNING *
    `, [updatedBy, id, orgId]);
    return res ? this.mapAnnouncement(res) : null;
  }

  async archiveAnnouncement(orgId: string, id: string, updatedBy: string) {
    const res = await queryOne(`
      UPDATE announcements SET
        status = 'ARCHIVED',
        updated_by = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND organization_id = $3 AND deleted_at IS NULL
      RETURNING *
    `, [updatedBy, id, orgId]);
    return res ? this.mapAnnouncement(res) : null;
  }

  async deleteAnnouncement(orgId: string, id: string) {
    const res = await queryOne(`
      UPDATE announcements SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
      RETURNING id
    `, [id, orgId]);
    return !!res;
  }

  private mapAnnouncement(r: any) {
    return {
      id: r.id,
      organizationId: r.organization_id,
      title: r.title,
      content: r.content,
      category: r.category,
      priority: r.priority,
      status: r.status,
      audience: r.audience,
      targetId: r.target_id,
      targetName: r.target_name,
      publishDate: r.publish_date,
      publishedAt: r.published_at,
      expiryDate: r.expiry_date,
      expiresAt: r.expires_at,
      attachmentName: r.attachment_name,
      attachmentUrl: r.attachment_url,
      authorName: r.author_name,
      createdBy: r.created_by,
      updatedBy: r.updated_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at
    };
  }

  async sendNotification(orgId: string, userId: string, title: string, message: string, type: string, link: string = '') {
    await queryOne(`
      INSERT INTO notifications (organization_id, user_id, title, message, type, link)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [orgId, userId, title, message, type, link]);
  }
}

export const notificationRepository = new NotificationRepository();
