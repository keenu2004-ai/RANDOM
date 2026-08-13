import { query, queryOne, beginTransaction } from '../db/client';
import { getWorkingDays } from '../services/calendar.service';
import { notificationService } from '../services/notification.service';
import { logMasterDataChangeTx } from '../utils/audit-logger';

export class LeaveRepository {
  async getAllLeaveTypes(orgId: string) {
    const rows = await query(`SELECT * FROM leave_types WHERE organization_id = $1`, [orgId]);
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      code: r.code,
      annualQuota: r.annual_quota,
      carryForwardAllowed: r.carry_forward_allowed,
      requiresAttachment: r.requires_attachment,
      description: r.description
    }));
  }

  async getLeaveTypeByCode(orgId: string, code: string) {
    const r = await queryOne(`SELECT * FROM leave_types WHERE organization_id = $1 AND code = $2`, [orgId, code]);
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      code: r.code,
      annualQuota: r.annual_quota,
      carryForwardAllowed: r.carry_forward_allowed,
      requiresAttachment: r.requires_attachment,
      description: r.description
    };
  }

  async createLeaveType(orgId: string, data: any) {
    const client = await beginTransaction();
    try {
      const lt = await client.queryOne(`
        INSERT INTO leave_types (organization_id, name, code, annual_quota, carry_forward_allowed, requires_attachment, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [orgId, data.name, data.code, data.annualQuota, data.carryForwardAllowed, data.requiresAttachment, data.description]);

      // Provision leave balances for all active employees for current year
      const currentYear = new Date().getFullYear();
      const employees = await client.query(`SELECT id FROM employees WHERE organization_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL`, [orgId]);
      
      for (const emp of employees) {
        await client.queryOne(`
          INSERT INTO leave_balances (organization_id, employee_id, leave_type_id, year, total_quota, used, pending, available)
          VALUES ($1, $2, $3, $4, $5, 0, 0, $5)
          ON CONFLICT DO NOTHING
        `, [orgId, emp.id, lt.id, currentYear, lt.annual_quota]);
      }

      await client.commit();
      return {
        id: lt.id,
        name: lt.name,
        code: lt.code,
        annualQuota: lt.annual_quota,
        carryForwardAllowed: lt.carry_forward_allowed,
        requiresAttachment: lt.requires_attachment,
        description: lt.description
      };
    } catch (err) {
      await client.rollback();
      throw err;
    }
  }

  async getLeaveRequests(orgId: string, filters: any) {
    let baseQuery = `
      FROM leave_requests r
      JOIN employees e ON r.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      JOIN leave_types lt ON r.leave_type_id = lt.id
      WHERE r.organization_id = $1
    `;
    const params: any[] = [orgId];
    let idx = 2;

    if (filters.employeeIds && filters.employeeIds.length > 0) {
      baseQuery += ` AND r.employee_id = ANY($${idx++})`;
      params.push(filters.employeeIds);
    }
    if (filters.status) {
      baseQuery += ` AND r.status = $${idx++}`;
      params.push(filters.status);
    }
    if (filters.leaveTypeId) {
      baseQuery += ` AND r.leave_type_id = $${idx++}`;
      params.push(filters.leaveTypeId);
    }
    if (filters.employeeId) {
      baseQuery += ` AND r.employee_id = $${idx++}`;
      params.push(filters.employeeId);
    }
    if (filters.departmentId) {
      baseQuery += ` AND e.department_id = $${idx++}`;
      params.push(filters.departmentId);
    }

    const sortField = filters.sortBy && ['start_date', 'created_at', 'status'].includes(filters.sortBy) ? filters.sortBy : 'created_at';
    const sortOrder = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const limit = Math.max(1, parseInt(filters.limit as string) || 10);
    const page = Math.max(1, parseInt(filters.page as string) || 1);
    const offset = (page - 1) * limit;

    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const countRes = await query(countQuery, params);
    const total = parseInt(countRes[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    const dataQuery = `
      SELECT r.*, e.first_name, e.last_name, e.employee_code, d.name as department_name, lt.name as leave_type_name, lt.code as leave_type_code
      ${baseQuery}
      ORDER BY r.${sortField} ${sortOrder} LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, offset);

    const rows = await query(dataQuery, params);
    return {
      data: rows.map(r => ({
        id: r.id,
        employeeId: r.employee_id,
        leaveTypeId: r.leave_type_id,
        startDate: r.start_date,
        endDate: r.end_date,
        daysCount: r.days_count,
        isHalfDay: r.is_half_day,
        reason: r.reason,
        attachmentUrl: r.attachment_url,
        status: r.status,
        reviewedBy: r.reviewed_by,
        reviewReason: r.review_reason,
        createdAt: r.created_at,
        employeeName: `${r.first_name} ${r.last_name}`,
        employeeCode: r.employee_code,
        departmentName: r.department_name || '-',
        leaveTypeName: r.leave_type_name,
        leaveTypeCode: r.leave_type_code
      })),
      pagination: { total, page, limit, totalPages }
    };
  }

  async getLeaveBalances(orgId: string, employeeId: string, year: number) {
    const client = await beginTransaction();
    try {
      let balances = await client.query(`
        SELECT b.*, lt.name as leave_type_name, lt.code as leave_type_code
        FROM leave_balances b
        JOIN leave_types lt ON b.leave_type_id = lt.id
        WHERE b.organization_id = $1 AND b.employee_id = $2 AND b.year = $3
      `, [orgId, employeeId, year]);

      if (balances.length === 0) {
        const types = await client.query(`SELECT * FROM leave_types WHERE organization_id = $1`, [orgId]);
        for (const lt of types) {
          await client.queryOne(`
            INSERT INTO leave_balances (organization_id, employee_id, leave_type_id, year, total_quota, used, pending, available)
            VALUES ($1, $2, $3, $4, $5, 0, 0, $5)
          `, [orgId, employeeId, lt.id, year, lt.annual_quota]);
        }
        balances = await client.query(`
          SELECT b.*, lt.name as leave_type_name, lt.code as leave_type_code
          FROM leave_balances b
          JOIN leave_types lt ON b.leave_type_id = lt.id
          WHERE b.organization_id = $1 AND b.employee_id = $2 AND b.year = $3
        `, [orgId, employeeId, year]);
      }
      
      await client.commit();
      return balances.map(b => ({
        id: b.id,
        employeeId: b.employee_id,
        leaveTypeId: b.leave_type_id,
        totalQuota: b.total_quota,
        used: b.used,
        pending: b.pending,
        available: b.available,
        year: b.year,
        leaveTypeName: b.leave_type_name,
        leaveTypeCode: b.leave_type_code
      }));
    } catch (err) {
      await client.rollback();
      throw err;
    }
  }

  async applyLeave(orgId: string, data: any) {
    const client = await beginTransaction();
    try {
      const emp = await client.queryOne(`SELECT * FROM employees WHERE organization_id = $1 AND id = $2`, [orgId, data.employeeId]);
      if (!emp || emp.status !== 'ACTIVE' || emp.deleted_at) {
        throw new Error('Leave Application Denied: Only active employees in the organization can apply for leaves.');
      }

      const lt = await client.queryOne(`SELECT * FROM leave_types WHERE organization_id = $1 AND id = $2`, [orgId, data.leaveTypeId]);
      if (!lt) throw new Error('Selected Leave Category does not exist or is invalid.');

      // Calculate daysCount on backend
      const workingDaysList = await getWorkingDays(orgId, data.employeeId, data.startDate, data.endDate);
      const workDays = workingDaysList.length;
      
      let daysCount = data.isHalfDay ? Math.max(0.5, workDays - 0.5) : workDays;
      if (workDays === 0) daysCount = 0;

      if (daysCount <= 0) {
        throw new Error('Requested period contains only non-working days.');
      }

      if (lt.code !== 'LOP') {
        let balance = await client.queryOne(`SELECT * FROM leave_balances WHERE organization_id = $1 AND employee_id = $2 AND leave_type_id = $3 AND year = $4 FOR UPDATE`, [orgId, data.employeeId, data.leaveTypeId, data.year]);
        if (!balance) {
          balance = await client.queryOne(`
            INSERT INTO leave_balances (organization_id, employee_id, leave_type_id, year, total_quota, used, pending, available)
            VALUES ($1, $2, $3, $4, $5, 0, 0, $5)
            RETURNING *
          `, [orgId, data.employeeId, data.leaveTypeId, data.year, lt.annual_quota]);
        }
        if (balance.available < daysCount) {
          throw new Error(`Insufficient leave balance: You have ${balance.available} days available for ${lt.name}, but requested ${daysCount} days.`);
        }
      }

      const overlap = await client.queryOne(`
        SELECT id FROM leave_requests 
        WHERE organization_id = $1 AND employee_id = $2 AND (status = 'PENDING' OR status = 'APPROVED')
        AND (start_date <= $4 AND end_date >= $3)
      `, [orgId, data.employeeId, data.startDate, data.endDate]);

      if (overlap) {
        throw new Error('Overlapping Leave Request: You already have a pending or approved leave request during these dates.');
      }

      if (lt.requires_attachment && !data.attachmentUrl && data.daysCount > 2) {
        throw new Error(`${lt.name} requires supporting medical/official attachment documentation for requests over 2 days.`);
      }

      const req = await client.queryOne(`
        INSERT INTO leave_requests (organization_id, employee_id, leave_type_id, start_date, end_date, days_count, is_half_day, reason, attachment_url, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING')
        RETURNING *
      `, [orgId, data.employeeId, data.leaveTypeId, data.startDate, data.endDate, daysCount, data.isHalfDay, data.reason, data.attachmentUrl]);

      const dept = await client.queryOne(`SELECT name FROM departments WHERE organization_id = $1 AND id = $2`, [orgId, emp.department_id]);

      await notificationService.notifyManager(orgId, data.employeeId, {
        notificationType: 'LEAVE_SUBMITTED',
        title: 'Leave Request Submitted',
        message: 'A new leave request is pending approval.',
        entityType: 'LEAVE',
        entityId: req.id,
        priority: 'NORMAL'
      }, client);

      await client.commit();
      
      return {
        id: req.id,
        employeeId: req.employee_id,
        leaveTypeId: req.leave_type_id,
        startDate: req.start_date,
        endDate: req.end_date,
        daysCount: req.days_count,
        isHalfDay: req.is_half_day,
        reason: req.reason,
        attachmentUrl: req.attachment_url,
        status: req.status,
        createdAt: req.created_at,
        employeeName: `${emp.first_name} ${emp.last_name}`,
        employeeCode: emp.employee_code,
    let idx = 2;

    if (filters.employeeIds && filters.employeeIds.length > 0) {
      baseQuery += ` AND r.employee_id = ANY($${idx++})`;
      params.push(filters.employeeIds);
    }
    if (filters.status) {
      baseQuery += ` AND r.status = $${idx++}`;
      params.push(filters.status);
    }
    if (filters.leaveTypeId) {
      baseQuery += ` AND r.leave_type_id = $${idx++}`;
      params.push(filters.leaveTypeId);
    }
    if (filters.employeeId) {
      baseQuery += ` AND r.employee_id = $${idx++}`;
      params.push(filters.employeeId);
    }
    if (filters.departmentId) {
      baseQuery += ` AND e.department_id = $${idx++}`;
      params.push(filters.departmentId);
    }

    const sortField = filters.sortBy && ['start_date', 'created_at', 'status'].includes(filters.sortBy) ? filters.sortBy : 'created_at';
    const sortOrder = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const limit = Math.max(1, parseInt(filters.limit as string) || 10);
    const page = Math.max(1, parseInt(filters.page as string) || 1);
    const offset = (page - 1) * limit;

    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const countRes = await query(countQuery, params);
    const total = parseInt(countRes[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    const dataQuery = `
      SELECT r.*, e.first_name, e.last_name, e.employee_code, d.name as department_name, lt.name as leave_type_name, lt.code as leave_type_code
      ${baseQuery}
      ORDER BY r.${sortField} ${sortOrder} LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, offset);

    const rows = await query(dataQuery, params);
    return {
      data: rows.map(r => ({
        id: r.id,
        employeeId: r.employee_id,
        leaveTypeId: r.leave_type_id,
        startDate: r.start_date,
        endDate: r.end_date,
        daysCount: r.days_count,
        isHalfDay: r.is_half_day,
        reason: r.reason,
        attachmentUrl: r.attachment_url,
        status: r.status,
        reviewedBy: r.reviewed_by,
        reviewReason: r.review_reason,
        createdAt: r.created_at,
        employeeName: `${r.first_name} ${r.last_name}`,
        employeeCode: r.employee_code,
        departmentName: r.department_name || '-',
        leaveTypeName: r.leave_type_name,
        leaveTypeCode: r.leave_type_code
      })),
      pagination: { total, page, limit, totalPages }
    };
  }

  async getLeaveBalances(orgId: string, employeeId: string, year: number) {
    const client = await beginTransaction();
    try {
      let balances = await client.query(`
        SELECT b.*, lt.name as leave_type_name, lt.code as leave_type_code
        FROM leave_balances b
        JOIN leave_types lt ON b.leave_type_id = lt.id
        WHERE b.organization_id = $1 AND b.employee_id = $2 AND b.year = $3
      `, [orgId, employeeId, year]);

      if (balances.length === 0) {
        const types = await client.query(`SELECT * FROM leave_types WHERE organization_id = $1`, [orgId]);
        for (const lt of types) {
          await client.queryOne(`
            INSERT INTO leave_balances (organization_id, employee_id, leave_type_id, year, total_quota, used, pending, available)
            VALUES ($1, $2, $3, $4, $5, 0, 0, $5)
          `, [orgId, employeeId, lt.id, year, lt.annual_quota]);
        }
        balances = await client.query(`
          SELECT b.*, lt.name as leave_type_name, lt.code as leave_type_code
          FROM leave_balances b
          JOIN leave_types lt ON b.leave_type_id = lt.id
          WHERE b.organization_id = $1 AND b.employee_id = $2 AND b.year = $3
        `, [orgId, employeeId, year]);
      }
      
      await client.commit();
      return balances.map(b => ({
        id: b.id,
        employeeId: b.employee_id,
        leaveTypeId: b.leave_type_id,
        totalQuota: b.total_quota,
        used: b.used,
        pending: b.pending,
        available: b.available,
        year: b.year,
        leaveTypeName: b.leave_type_name,
        leaveTypeCode: b.leave_type_code
      }));
    } catch (err) {
      await client.rollback();
      throw err;
    }
  }

  async applyLeave(orgId: string, data: any) {
    const client = await beginTransaction();
    try {
      const emp = await client.queryOne(`SELECT * FROM employees WHERE organization_id = $1 AND id = $2`, [orgId, data.employeeId]);
      if (!emp || emp.status !== 'ACTIVE' || emp.deleted_at) {
        throw new Error('Leave Application Denied: Only active employees in the organization can apply for leaves.');
      }

      const lt = await client.queryOne(`SELECT * FROM leave_types WHERE organization_id = $1 AND id = $2`, [orgId, data.leaveTypeId]);
      if (!lt) throw new Error('Selected Leave Category does not exist or is invalid.');

      // Calculate daysCount on backend
      const workingDaysList = await getWorkingDays(orgId, data.employeeId, data.startDate, data.endDate);
      const workDays = workingDaysList.length;
      
      let daysCount = data.isHalfDay ? Math.max(0.5, workDays - 0.5) : workDays;
      if (workDays === 0) daysCount = 0;

      if (daysCount <= 0) {
        throw new Error('Requested period contains only non-working days.');
      }

      if (lt.code !== 'LOP') {
        let balance = await client.queryOne(`SELECT * FROM leave_balances WHERE organization_id = $1 AND employee_id = $2 AND leave_type_id = $3 AND year = $4 FOR UPDATE`, [orgId, data.employeeId, data.leaveTypeId, data.year]);
        if (!balance) {
          balance = await client.queryOne(`
            INSERT INTO leave_balances (organization_id, employee_id, leave_type_id, year, total_quota, used, pending, available)
            VALUES ($1, $2, $3, $4, $5, 0, 0, $5)
            RETURNING *
          `, [orgId, data.employeeId, data.leaveTypeId, data.year, lt.annual_quota]);
        }
        if (balance.available < daysCount) {
          throw new Error(`Insufficient leave balance: You have ${balance.available} days available for ${lt.name}, but requested ${daysCount} days.`);
        }
      }

      const overlap = await client.queryOne(`
        SELECT id FROM leave_requests 
        WHERE organization_id = $1 AND employee_id = $2 AND (status = 'PENDING' OR status = 'APPROVED')
        AND (start_date <= $4 AND end_date >= $3)
      `, [orgId, data.employeeId, data.startDate, data.endDate]);

      if (overlap) {
        throw new Error('Overlapping Leave Request: You already have a pending or approved leave request during these dates.');
      }

      if (lt.requires_attachment && !data.attachmentUrl && data.daysCount > 2) {
        throw new Error(`${lt.name} requires supporting medical/official attachment documentation for requests over 2 days.`);
      }

      const req = await client.queryOne(`
        INSERT INTO leave_requests (organization_id, employee_id, leave_type_id, start_date, end_date, days_count, is_half_day, reason, attachment_url, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING')
        RETURNING *
      `, [orgId, data.employeeId, data.leaveTypeId, data.startDate, data.endDate, daysCount, data.isHalfDay, data.reason, data.attachmentUrl]);

      const dept = await client.queryOne(`SELECT name FROM departments WHERE organization_id = $1 AND id = $2`, [orgId, emp.department_id]);

      await notificationService.notifyManager(orgId, data.employeeId, {
        notificationType: 'LEAVE_SUBMITTED',
        title: 'Leave Request Submitted',
        message: 'A new leave request is pending approval.',
        entityType: 'LEAVE',
        entityId: req.id,
        priority: 'NORMAL'
      }, client);

      await client.commit();
      
      return {
        id: req.id,
        employeeId: req.employee_id,
        leaveTypeId: req.leave_type_id,
        startDate: req.start_date,
        endDate: req.end_date,
        daysCount: req.days_count,
        isHalfDay: req.is_half_day,
        reason: req.reason,
        attachmentUrl: req.attachment_url,
        status: req.status,
        createdAt: req.created_at,
        employeeName: `${emp.first_name} ${emp.last_name}`,
        employeeCode: emp.employee_code,
        departmentName: dept ? dept.name : '-',
        leaveTypeName: lt.name,
        leaveTypeCode: lt.code,
        managerId: emp.manager_id
      };
    } catch (err) {
  }

  async getLeaveRequestById(orgId: string, id: string) {
    const r = await queryOne(`SELECT * FROM leave_requests WHERE organization_id = $1 AND id = $2`, [orgId, id]);
    if (!r) return null;
    return {
      id: r.id,
      employeeId: r.employee_id,
      leaveTypeId: r.leave_type_id,
      startDate: r.start_date,
      endDate: r.end_date,
      daysCount: r.days_count,
      status: r.status
    };
  }

  async cancelLeave(orgId: string, id: string) {
    const client = await beginTransaction();
    try {
      const existing = await client.queryOne(`SELECT * FROM leave_requests WHERE organization_id = $1 AND id = $2 FOR UPDATE`, [orgId, id]);
      if (!existing) throw new Error('Leave request not found');
      const r = await client.queryOne(`UPDATE leave_requests SET status = 'CANCELLED', updated_at = NOW() WHERE organization_id = $1 AND id = $2 RETURNING *`, [orgId, id]);

      await logMasterDataChangeTx(client, {
        organizationId: orgId,
        action: 'CANCEL_LEAVE',
        entityType: 'ORGANIZATION' as any,
        entityId: id,
        oldValues: existing,
        newValues: r
      });

      await client.commit();
      return r;
    } catch (err) {
      await client.rollback();
      throw err;
    }
  }

  async approveLeave(orgId: string, id: string, reviewerId: string, reviewReason: string) {
    const client = await beginTransaction();
    try {
      const req = await client.queryOne(`SELECT * FROM leave_requests WHERE organization_id = $1 AND id = $2 FOR UPDATE`, [orgId, id]);
      if (!req) throw new Error('Not found');
      if (req.status !== 'PENDING') throw new Error(`Leave request has already been ${req.status.toLowerCase()}.`);

      await client.queryOne(`
        UPDATE leave_requests SET status = 'APPROVED', reviewed_by = $1, review_reason = $2, updated_at = NOW() WHERE organization_id = $3 AND id = $4
      `, [reviewerId, reviewReason, orgId, id]);

      const year = new Date(req.start_date).getFullYear();
      let balance = await client.queryOne(`SELECT * FROM leave_balances WHERE organization_id = $1 AND employee_id = $2 AND leave_type_id = $3 AND year = $4 FOR UPDATE`, [orgId, req.employee_id, req.leave_type_id, year]);
      
      const ltype = await client.queryOne(`SELECT * FROM leave_types WHERE organization_id = $1 AND id = $2`, [orgId, req.leave_type_id]);

      if (!balance) {
        balance = await client.queryOne(`
          INSERT INTO leave_balances (organization_id, employee_id, leave_type_id, year, total_quota, used, pending, available)
          VALUES ($1, $2, $3, $4, $5, 0, 0, $5)
          RETURNING *
        `, [orgId, req.employee_id, req.leave_type_id, year, ltype ? ltype.annual_quota : 12]);
      }

      if (ltype && ltype.code !== 'LOP') {
        if (parseFloat(balance.available) < parseFloat(req.days_count)) {
          throw new Error(`INSUFFICIENT_LEAVE_BALANCE: Available balance is ${balance.available} days, but request requires ${req.days_count} days.`);
        }
      }

      await client.queryOne(`
        UPDATE leave_balances SET used = used + $1, available = GREATEST(0, total_quota - (used + $1)) WHERE organization_id = $2 AND id = $3
      `, [req.days_count, orgId, balance.id]);

      const emp = await client.queryOne(`SELECT * FROM employees WHERE organization_id = $1 AND id = $2`, [orgId, req.employee_id]);

      await notificationService.createNotification({
        organizationId: orgId,
        recipientEmployeeId: req.employee_id,
        notificationType: 'LEAVE_APPROVED',
        title: 'Leave Request APPROVED',
        message: 'Your leave request has been approved',
        entityType: 'LEAVE',
        entityId: id,
        priority: 'HIGH'
      }, client);

      await logMasterDataChangeTx(client, {
        organizationId: orgId,
        actorUserId: reviewerId,
        action: 'LEAVE_APPROVED',
        entityType: 'ORGANIZATION' as any,
        entityId: id,
        oldValues: req,
        newValues: { ...req, status: 'APPROVED' }
      });

      await client.commit();
      return {
        id: req.id,
        employeeId: req.employee_id,
        startDate: req.start_date,
        endDate: req.end_date,
        daysCount: req.days_count,
        employeeName: emp ? `${emp.first_name} ${emp.last_name}` : '-',
        leaveTypeName: ltype ? ltype.name : 'Leave'
      };
    } catch (err) {
      await client.rollback();
      throw err;
    }
  }

  async rejectLeave(orgId: string, id: string, reviewerId: string, reviewReason: string) {
    const client = await beginTransaction();
    try {
      const existingReq = await client.queryOne(`SELECT * FROM leave_requests WHERE organization_id = $1 AND id = $2 FOR UPDATE`, [orgId, id]);
      if (!existingReq) throw new Error('Not found');
      if (existingReq.status !== 'PENDING') throw new Error(`Leave request has already been ${existingReq.status.toLowerCase()}.`);

      const req = await client.queryOne(`
        UPDATE leave_requests SET status = 'REJECTED', reviewed_by = $1, review_reason = $2, updated_at = NOW() WHERE organization_id = $3 AND id = $4 RETURNING *
      `, [reviewerId, reviewReason, orgId, id]);

      const emp = await client.queryOne(`SELECT * FROM employees WHERE organization_id = $1 AND id = $2`, [orgId, req.employee_id]);
      const ltype = await client.queryOne(`SELECT * FROM leave_types WHERE organization_id = $1 AND id = $2`, [orgId, req.leave_type_id]);

      await notificationService.createNotification({
        organizationId: orgId,
        recipientEmployeeId: req.employee_id,
        notificationType: 'LEAVE_REJECTED',
        title: 'Leave Request REJECTED',
        message: 'Your leave request has been rejected',
        entityType: 'LEAVE',
        entityId: id,
        priority: 'HIGH'
      }, client);

      await logMasterDataChangeTx(client, {
        organizationId: orgId,
        actorUserId: reviewerId,
        action: 'LEAVE_REJECTED',
        entityType: 'ORGANIZATION' as any,
        entityId: id,
        oldValues: existingReq,
        newValues: req
      });

      await client.commit();
      return {
        id: req.id,
        employeeId: req.employee_id,
        startDate: req.start_date,
        endDate: req.end_date,
        employeeName: emp ? `${emp.first_name} ${emp.last_name}` : '-',
        leaveTypeName: ltype ? ltype.name : 'Leave'
      };
    } catch (err) {
      await client.rollback();
      throw err;
    }
  }

  async createCorrectionRequest(orgId: string, payload: any, reqEmpId: string) {
    const client = await beginTransaction();
    try {
      const originalReq = await client.queryOne(
        `SELECT * FROM leave_requests WHERE organization_id = $1 AND id = $2 AND employee_id = $3`,
        [orgId, payload.leaveRequestId, reqEmpId]
      );
      if (!originalReq) throw new Error('Original leave request not found or unauthorized.');
      if (originalReq.status !== 'APPROVED') throw new Error('Can only correct APPROVED leave requests.');
      
      const corr = await client.queryOne(
        `INSERT INTO leave_correction_requests (
           organization_id, employee_id, leave_request_id, 
           new_start_date, new_end_date, new_is_half_day, reason, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING') RETURNING *`,
        [orgId, reqEmpId, payload.leaveRequestId, payload.newStartDate, payload.newEndDate, !!payload.newIsHalfDay, payload.reason]
      );
      
      await client.commit();
      return {
        id: corr.id,
        leaveRequestId: corr.leave_request_id,
        newStartDate: corr.new_start_date,
        newEndDate: corr.new_end_date,
        newIsHalfDay: corr.new_is_half_day,
        reason: corr.reason,
        status: corr.status,
        createdAt: corr.created_at
      };
    } catch(err) {
      await client.rollback();
      throw err;
    }
  }

  async getCorrectionRequests(orgId: string, filters: any, role: string, reqEmpId: string) {
    let baseQuery = `
      FROM leave_correction_requests c
      JOIN leave_requests r ON c.leave_request_id = r.id
      JOIN employees e ON c.employee_id = e.id
      JOIN leave_types lt ON r.leave_type_id = lt.id
      WHERE c.organization_id = $1
    `;
    const params: any[] = [orgId];
    let idx = 2;

    if (role === 'EMPLOYEE') {
      baseQuery += ` AND c.employee_id = $${idx++}`;
      params.push(reqEmpId);
    } else if (role === 'MANAGER') {
      const teamEmps = await this.getTeamEmployees(orgId, reqEmpId);
      const teamIds = teamEmps.map((e: any) => e.id);
      if (teamIds.length > 0) {
        baseQuery += ` AND c.employee_id = ANY($${idx++})`;
        params.push(teamIds);
      } else {
        baseQuery += ` AND 1 = 0`; // No team members
      }
    }

    if (filters.status) {
      baseQuery += ` AND c.status = $${idx++}`;
      params.push(filters.status);
    }

    const limit = Math.max(1, parseInt(filters.limit as string) || 10);
    const page = Math.max(1, parseInt(filters.page as string) || 1);
    const offset = (page - 1) * limit;

    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const countRes = await query(countQuery, params);
    const total = parseInt(countRes[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    const dataQuery = `
      SELECT c.*, 
             r.start_date as old_start_date, r.end_date as old_end_date, r.is_half_day as old_is_half_day, r.days_count as old_days_count,
             e.first_name, e.last_name, lt.name as leave_type_name
      ${baseQuery}
      ORDER BY c.created_at DESC LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, offset);
    
    const rows = await query(dataQuery, params);
    return {
      data: rows.map((r: any) => ({
        id: r.id,
        leaveRequestId: r.leave_request_id,
        employeeId: r.employee_id,
        employeeName: `${r.first_name} ${r.last_name}`,
        leaveTypeName: r.leave_type_name,
        oldStartDate: r.old_start_date,
        oldEndDate: r.old_end_date,
        oldIsHalfDay: r.old_is_half_day,
        oldDaysCount: r.old_days_count,
        newStartDate: r.new_start_date,
        newEndDate: r.new_end_date,
        newIsHalfDay: r.new_is_half_day,
        reason: r.reason,
        status: r.status,
        reviewedBy: r.reviewed_by,
        reviewReason: r.review_reason,
        createdAt: r.created_at
      })),
      pagination: { total, page, limit, totalPages }
    };
  }

  async approveCorrectionRequest(orgId: string, reqId: string, reviewerEmpId: string) {
    const client = await beginTransaction();
    try {
      const corrReq = await client.queryOne(
        `SELECT * FROM leave_correction_requests WHERE organization_id = $1 AND id = $2 FOR UPDATE`,
        [orgId, reqId]
      );
      if (!corrReq) throw new Error('Correction request not found.');
      if (corrReq.status !== 'PENDING') throw new Error('Request already processed.');

      const leaveReq = await client.queryOne(
        `SELECT * FROM leave_requests WHERE organization_id = $1 AND id = $2 FOR UPDATE`,
        [orgId, corrReq.leave_request_id]
      );
      
      const year = new Date(corrReq.new_start_date).getFullYear();

      const balance = await client.queryOne(
        `SELECT * FROM leave_balances WHERE organization_id = $1 AND employee_id = $2 AND leave_type_id = $3 AND year = $4 FOR UPDATE`,
        [orgId, leaveReq.employee_id, leaveReq.leave_type_id, year]
      );

      const workingDaysList = await getWorkingDays(orgId, leaveReq.employee_id, corrReq.new_start_date, corrReq.new_end_date);
      const workDays = workingDaysList.length;
      let newDaysCount = corrReq.new_is_half_day ? Math.max(0.5, workDays - 0.5) : workDays;
      if (workDays === 0) newDaysCount = 0;

      const daysDiff = newDaysCount - leaveReq.days_count;

      if (balance && daysDiff > 0 && balance.available < daysDiff) {
        throw new Error('Insufficient leave balance for correction.');
      }

      await client.queryOne(
        `UPDATE leave_requests SET start_date = $1, end_date = $2, is_half_day = $3, days_count = $4, updated_at = NOW() WHERE organization_id = $5 AND id = $6`,
        [corrReq.new_start_date, corrReq.new_end_date, corrReq.new_is_half_day, newDaysCount, orgId, leaveReq.id]
      );

      if (balance) {
        await client.queryOne(
          `UPDATE leave_balances SET used = used + $1, available = GREATEST(0, total_quota - (used + $1)) WHERE id = $2`,
          [daysDiff, balance.id]
        );
      }

      await client.queryOne(
        `UPDATE leave_correction_requests SET status = 'APPROVED', reviewed_by = $1, updated_at = NOW() WHERE id = $2`,
        [reviewerEmpId, reqId]
      );

      await client.queryOne(`
        INSERT INTO audit_logs (organization_id, user_email, action, module, details)
        VALUES ($1, 'system', 'APPROVE_CORRECTION', 'LEAVE', $2)
      `, [orgId, `Correction req ${reqId} approved by ${reviewerEmpId}`]);

      await notificationService.createNotification({
        organizationId: orgId,
        recipientEmployeeId: leaveReq.employee_id,
        notificationType: 'LEAVE_CORRECTION_APPROVED',
        title: 'Leave Correction Approved',
        message: 'Your leave correction request has been approved.',
        entityType: 'LEAVE_CORRECTION',
        entityId: reqId,
        priority: 'NORMAL'
      }, client);

      await client.commit();
      return { id: reqId, status: 'APPROVED' };
    } catch(err) {
      await client.rollback();
      throw err;
    }
  }

  async rejectCorrectionRequest(orgId: string, reqId: string, reviewerEmpId: string, reason: string) {
    const client = await beginTransaction();
    try {
      const corrReq = await client.queryOne(
        `SELECT * FROM leave_correction_requests WHERE organization_id = $1 AND id = $2 FOR UPDATE`,
        [orgId, reqId]
      );
      if (!corrReq) throw new Error('Correction request not found.');
      if (corrReq.status !== 'PENDING') throw new Error('Request already processed.');

      const req = await client.queryOne(
        `UPDATE leave_correction_requests SET status = 'REJECTED', reviewed_by = $1, review_reason = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
        [reviewerEmpId, reason, reqId]
      );

      await notificationService.createNotification({
        organizationId: orgId,
        recipientEmployeeId: req.employee_id,
        notificationType: 'LEAVE_CORRECTION_REJECTED',
        title: 'Leave Correction Rejected',
        message: 'Your leave correction request has been rejected.',
        entityType: 'LEAVE_CORRECTION',
        entityId: reqId,
        priority: 'NORMAL'
      }, client);

      await client.commit();
      return { id: reqId, status: 'REJECTED' };
    } catch(err) {
      await client.rollback();
      throw err;
    }
  }

  async getTeamEmployees(orgId: string, managerId: string) {
    return query(`SELECT id, department_id, manager_id FROM employees WHERE organization_id = $1 AND (manager_id = $2 OR id = $2)`, [orgId, managerId]);
  }

  async getEmployeeById(orgId: string, id: string) {
    return queryOne(`SELECT id, department_id, manager_id FROM employees WHERE organization_id = $1 AND id = $2`, [orgId, id]);
  }
}
export const leaveRepository = new LeaveRepository();
