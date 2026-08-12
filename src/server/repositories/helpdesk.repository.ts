import { query, queryOne, beginTransaction } from '../db/client';

export interface GetTicketsFilter {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  category?: string;
  assignedTo?: string;
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export class HelpdeskRepository {
  async getTickets(orgId: string, role: string, userEmpId: string, filters: GetTicketsFilter = {}) {
    let sql = `SELECT * FROM helpdesk_tickets WHERE organization_id = $1 AND deleted_at IS NULL`;
    let params: any[] = [orgId];
    let paramIndex = 2;

    if (role === 'EMPLOYEE') {
      sql += ` AND employee_id = $${paramIndex++}`;
      params.push(userEmpId);
    } else if (filters.employeeId) {
      sql += ` AND employee_id = $${paramIndex++}`;
      params.push(filters.employeeId);
    }

    if (filters.status) {
      sql += ` AND status = $${paramIndex++}`;
      params.push(filters.status);
    }
    if (filters.priority) {
      sql += ` AND priority = $${paramIndex++}`;
      params.push(filters.priority);
    }
    if (filters.category) {
      sql += ` AND category = $${paramIndex++}`;
      params.push(filters.category);
    }
    if (filters.assignedTo) {
      sql += ` AND assigned_to = $${paramIndex++}`;
      params.push(filters.assignedTo);
    }
    if (filters.startDate) {
      sql += ` AND created_at >= $${paramIndex++}`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ` AND created_at <= $${paramIndex++}`;
      params.push(filters.endDate);
    }
    if (filters.search) {
      sql += ` AND (subject ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR ticket_number ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    // Pagination
    const limit = filters.limit ? parseInt(filters.limit as any, 10) : 50;
    const page = filters.page ? parseInt(filters.page as any, 10) : 1;
    const offset = (page - 1) * limit;

    const countSql = `SELECT COUNT(*) FROM (${sql}) AS count_query`;
    const countRes = await queryOne<{count: string}>(countSql, params);
    const totalCount = parseInt(countRes?.count || '0', 10);

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const res = await query(sql, params);
    
    return {
      data: res.map(r => ({
        id: r.id,
        organizationId: r.organization_id,
        employeeId: r.employee_id,
        ticketNumber: r.ticket_number,
        subject: r.subject,
        description: r.description,
        categoryId: r.category_id,
        category: r.category,
        priority: r.priority,
        status: r.status,
        assignedTo: r.assigned_to,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        resolvedAt: r.resolved_at,
        closedAt: r.closed_at,
        createdBy: r.created_by
      })),
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    };
  }

  async getTicket(orgId: string, id: string, role: string, userEmpId: string) {
    let sql = `SELECT * FROM helpdesk_tickets WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`;
    let params: any[] = [id, orgId];
    
    if (role === 'EMPLOYEE') {
      sql += ` AND employee_id = $3`;
      params.push(userEmpId);
    }

    const res = await queryOne(sql, params);
    if (!res) return null;
    
    return {
      id: res.id,
      organizationId: res.organization_id,
      employeeId: res.employee_id,
      ticketNumber: res.ticket_number,
      subject: res.subject,
      description: res.description,
      categoryId: res.category_id,
      category: res.category,
      priority: res.priority,
      status: res.status,
      assignedTo: res.assigned_to,
      createdAt: res.created_at,
      updatedAt: res.updated_at,
      resolvedAt: res.resolved_at,
      closedAt: res.closed_at,
      createdBy: res.created_by
    };
  }

  async createTicket(ticket: any) {
    const trx = await beginTransaction();
    try {
      const year = new Date().getFullYear().toString().slice(-2);
      const seqRes = await trx.queryOne<{seq: string}>(`SELECT nextval('helpdesk_ticket_seq') as seq`);
      const seq = seqRes?.seq || '1';
      const ticketNumber = `TKT-${year}-${seq.toString().padStart(5, '0')}`;

      await trx.query(`
        INSERT INTO helpdesk_tickets (
          organization_id, employee_id, ticket_number, subject, description,
          category, priority, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        ticket.organizationId,
        ticket.employeeId,
        ticketNumber,
        ticket.subject,
        ticket.description,
        ticket.category,
        ticket.priority,
        ticket.status,
        ticket.createdBy
      ]);
      
      const newTicket = await trx.queryOne(`SELECT * FROM helpdesk_tickets WHERE ticket_number = $1 AND organization_id = $2`, [ticketNumber, ticket.organizationId]);
      
      await trx.commit();
      return {
        id: newTicket.id,
        organizationId: newTicket.organization_id,
        employeeId: newTicket.employee_id,
        ticketNumber: newTicket.ticket_number,
        subject: newTicket.subject,
        description: newTicket.description,
        categoryId: newTicket.category_id,
        category: newTicket.category,
        priority: newTicket.priority,
        status: newTicket.status,
        assignedTo: newTicket.assigned_to,
        createdAt: newTicket.created_at,
        updatedAt: newTicket.updated_at,
        resolvedAt: newTicket.resolved_at,
        closedAt: newTicket.closed_at,
        createdBy: newTicket.created_by
      };
    } catch (e) {
      await trx.rollback();
      throw e;
    }
  }

  async updateTicketStatus(orgId: string, id: string, status: string, resolvedAt?: string, closedAt?: string) {
    const trx = await beginTransaction();
    try {
      const ticket = await trx.queryOne(`SELECT status FROM helpdesk_tickets WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL FOR UPDATE`, [id, orgId]);
      if (!ticket) throw new Error("Ticket not found");
      
      const updates: string[] = ['status = $1'];
      const params: any[] = [status, new Date().toISOString(), id, orgId];
      let paramIdx = 5;

      updates.push('updated_at = $2');
      if (resolvedAt) {
        updates.push(`resolved_at = $${paramIdx++}`);
        params.push(resolvedAt);
      }
      if (closedAt) {
        updates.push(`closed_at = $${paramIdx++}`);
        params.push(closedAt);
      }

      await trx.query(`
        UPDATE helpdesk_tickets 
        SET ${updates.join(', ')} 
        WHERE id = $3 AND organization_id = $4
      `, params);
      await trx.commit();
    } catch (e) {
      await trx.rollback();
      throw e;
    }
  }

  async assignTicket(orgId: string, id: string, assignedTo: string) {
    const employee = await queryOne(`SELECT id FROM employees WHERE id = $1 AND organization_id = $2`, [assignedTo, orgId]);
    if (!employee) throw new Error("Assigned employee not found in the organization");

    await query(`UPDATE helpdesk_tickets SET assigned_to = $1, updated_at = NOW() WHERE id = $2 AND organization_id = $3 AND deleted_at IS NULL`, [assignedTo, id, orgId]);
  }

  async addComment(comment: any) {
    await query(`
      INSERT INTO ticket_comments (organization_id, ticket_id, author_employee_id, comment) 
      VALUES ($1, $2, $3, $4)
    `, [comment.organizationId, comment.ticketId, comment.authorEmployeeId, comment.comment]);
    
    const res = await queryOne(`SELECT * FROM ticket_comments WHERE ticket_id = $1 ORDER BY created_at DESC LIMIT 1`, [comment.ticketId]);
    return {
      id: res.id,
      organizationId: res.organization_id,
      ticketId: res.ticket_id,
      authorEmployeeId: res.author_employee_id,
      comment: res.comment,
      attachmentName: res.attachment_name,
      attachmentUrl: res.attachment_url,
      createdAt: res.created_at,
      updatedAt: res.updated_at
    };
  }

  async getTicketComments(orgId: string, ticketId: string) {
    const res = await query(`SELECT * FROM ticket_comments WHERE ticket_id = $1 AND organization_id = $2 AND deleted_at IS NULL ORDER BY created_at ASC`, [ticketId, orgId]);
    return res.map(r => ({
      id: r.id,
      organizationId: r.organization_id,
      ticketId: r.ticket_id,
      authorEmployeeId: r.author_employee_id,
      comment: r.comment,
      attachmentName: r.attachment_name,
      attachmentUrl: r.attachment_url,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }
}

export const helpdeskRepository = new HelpdeskRepository();
