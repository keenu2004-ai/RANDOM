import { query, queryOne, beginTransaction } from '../db/client';

export interface ProjectRow {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  client_name: string | null;
  status: string;
  created_at: string;
}

export interface TimesheetRow {
  id: string;
  employee_id: string;
  project_id: string | null;
  date: string;
  hours: string;
  task_description: string;
  status: string;
  created_at: string;
  updated_at: string;
  
  // Joins
  employee_first_name?: string;
  employee_last_name?: string;
  employee_code?: string;
  project_name?: string;
}

export class TimesheetRepository {
  async getProjects(organizationId: string): Promise<any[]> {
    return await query(`
      SELECT 
        id, name, code, client_name as "clientName", status, created_at as "createdAt",
        '[]'::json as "assignedEmployeeIds" 
      FROM projects
      WHERE organization_id = $1
      ORDER BY created_at DESC
    `, [organizationId]);
  }

  async getProjectByCode(organizationId: string, code: string): Promise<any | null> {
    const rows = await query(`
      SELECT id, name, code, client_name as "clientName", status
      FROM projects WHERE organization_id = $1 AND LOWER(code) = LOWER($2)
    `, [organizationId, code]);
    return rows.length ? rows[0] : null;
  }

  async getProjectById(organizationId: string, id: string): Promise<any | null> {
    const rows = await query(`
      SELECT id, name, code, client_name as "clientName", status
      FROM projects WHERE organization_id = $1 AND id = $2
    `, [organizationId, id]);
    return rows.length ? rows[0] : null;
  }

  async createProject(organizationId: string, project: any): Promise<any> {
    const result = await query(`
      INSERT INTO projects (id, organization_id, name, code, client_name, status, created_at)
      VALUES (
        $1, $2, $3, $4, $5, $6, $7
      ) RETURNING id, name, code, client_name as "clientName", status, created_at as "createdAt"
    `, [
      project.id, organizationId, project.name, project.code, project.clientName || null,
      project.status, project.createdAt
    ]);
    return { ...result[0], assignedEmployeeIds: project.assignedEmployeeIds || [] };
  }

  async updateProject(organizationId: string, id: string, data: any): Promise<any> {
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.name !== undefined) { updates.push(`name = $${idx++}`); values.push(data.name); }
    if (data.code !== undefined) { updates.push(`code = $${idx++}`); values.push(data.code); }
    if (data.clientName !== undefined) { updates.push(`client_name = $${idx++}`); values.push(data.clientName); }
    if (data.status !== undefined) { updates.push(`status = $${idx++}`); values.push(data.status); }

    if (updates.length === 0) return this.getProjectById(organizationId, id);

    values.push(organizationId);
    const orgIdx = idx++;
    values.push(id);
    const idIdx = idx++;
    
    const result = await query(`
      UPDATE projects SET ${updates.join(', ')} WHERE organization_id = $${orgIdx} AND id = $${idIdx}
      RETURNING id, name, code, client_name as "clientName", status, created_at as "createdAt"
    `, values);
    return result.length ? { ...result[0], assignedEmployeeIds: data.assignedEmployeeIds || [] } : null;
  }

  async getTimesheets(organizationId: string, filters: any, userRole: string, userId: string, employeeId?: string): Promise<any> {
    let sql = `
      SELECT t.id, t.employee_id as "employeeId", t.project_id as "projectId", t.date, 
             CAST(t.hours AS FLOAT) as hours, t.task_description as "taskDescription", t.status, 
             t.created_at as "createdAt",
             e.first_name as "employeeFirstName", e.last_name as "employeeLastName", e.employee_code as "employeeCode",
             p.name as "projectName", d.name as "departmentName"
      FROM timesheets t
      JOIN employees e ON t.employee_id = e.id
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.organization_id = $1
    `;
    let countSql = `
      SELECT COUNT(*) as total
      FROM timesheets t
      JOIN employees e ON t.employee_id = e.id
      WHERE e.organization_id = $1
    `;
    const params: any[] = [organizationId];
    let idx = 2;

    const addCondition = (cond: string, param?: any) => {
      sql += ` AND ${cond}`;
      countSql += ` AND ${cond}`;
      if (param !== undefined) {
        params.push(param);
        idx++;
      }
    };

    if (userRole === 'EMPLOYEE' && employeeId) {
      addCondition(`t.employee_id = $${idx}`, employeeId);
    } else if (userRole === 'MANAGER' && employeeId) {
      addCondition(`t.employee_id IN (SELECT id FROM employees WHERE organization_id=$1 AND (manager_id=$${idx} OR id=$${idx}))`, employeeId);
    }

    if (filters.date) addCondition(`t.date = $${idx}`, filters.date);
    if (filters.startDate) addCondition(`t.date >= $${idx}`, filters.startDate);
    if (filters.endDate) addCondition(`t.date <= $${idx}`, filters.endDate);
    if (filters.status) addCondition(`t.status = $${idx}`, filters.status);
    if (filters.employeeId) addCondition(`t.employee_id = $${idx}`, filters.employeeId);
    if (filters.projectId) addCondition(`t.project_id = $${idx}`, filters.projectId);

    // Sorting
    const sortWhitelist: Record<string, string> = {
      date: 't.date',
      hours: 't.hours',
      createdAt: 't.created_at',
      status: 't.status'
    };
    const sortBy = sortWhitelist[filters.sortBy] || 't.date';
    const sortOrder = String(filters.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    sql += ` ORDER BY ${sortBy} ${sortOrder}`;

    // Pagination
    const page = Math.max(1, parseInt(filters.page) || 1);
    const limit = Math.max(1, parseInt(filters.limit) || 50);
    const offset = (page - 1) * limit;

    sql += ` LIMIT $${idx++} OFFSET $${idx++}`;
    const pagedParams = [...params, limit, offset];

    const [rows, countRes] = await Promise.all([
      query(sql, pagedParams),
      queryOne(countSql, params)
    ]);

    const total = parseInt(countRes?.total || '0', 10);
    const totalPages = Math.ceil(total / limit);

    return {
      data: rows.map(r => ({
        id: r.id,
        employeeId: r.employeeId,
        projectId: r.projectId,
        date: r.date,
        hours: r.hours,
        taskDescription: r.taskDescription,
        status: r.status,
        createdAt: r.createdAt,
        employeeName: (r.employeeFirstName && r.employeeLastName) ? `${r.employeeFirstName} ${r.employeeLastName}` : undefined,
        employeeCode: r.employeeCode,
        projectName: r.projectName,
        departmentName: r.departmentName
      })),
      pagination: { total, page, limit, totalPages }
    };
  }

  async getTimesheetById(organizationId: string, id: string): Promise<any | null> {
    const rows = await query(`
      SELECT t.id, t.employee_id as "employeeId", t.project_id as "projectId", t.date, 
             CAST(t.hours AS FLOAT) as hours, t.task_description as "taskDescription", t.status, 
             t.created_at as "createdAt",
             p.name as "projectName", e.manager_id as "managerIdOfEmployee",
             e.first_name as "employeeFirstName", e.last_name as "employeeLastName"
      FROM timesheets t
      JOIN employees e ON t.employee_id = e.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE e.organization_id = $1 AND t.id = $2
    `, [organizationId, id]);
    return rows.length ? {
      ...rows[0],
      employeeName: (rows[0].employeeFirstName && rows[0].employeeLastName) ? `${rows[0].employeeFirstName} ${rows[0].employeeLastName}` : undefined
    } : null;
  }

  async getDailyLoggedHours(organizationId: string, employeeId: string, date: string, excludeTimesheetId?: string): Promise<number> {
    let sql = `SELECT COALESCE(SUM(hours), 0) as total FROM timesheets t JOIN employees e ON t.employee_id = e.id WHERE e.organization_id = $1 AND t.employee_id = $2 AND t.date = $3`;
    const params: any[] = [organizationId, employeeId, date];
    if (excludeTimesheetId) {
      sql += ` AND t.id != $4`;
      params.push(excludeTimesheetId);
    }
    const res = await queryOne(sql, params);
    return res ? parseFloat(res.total) : 0;
  }

  async createTimesheet(organizationId: string, ts: any): Promise<any> {
    const res = await query(`
      INSERT INTO timesheets (id, employee_id, project_id, date, hours, task_description, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
      RETURNING id, employee_id as "employeeId", project_id as "projectId", date, CAST(hours AS FLOAT) as hours, task_description as "taskDescription", status, created_at as "createdAt"
    `, [ts.id, ts.employeeId, ts.projectId || null, ts.date, ts.hours, ts.taskDescription, ts.status, ts.createdAt]);
    return res[0];
  }

  async updateTimesheet(organizationId: string, id: string, ts: any): Promise<any> {
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (ts.projectId !== undefined) { updates.push(`project_id = $${idx++}`); values.push(ts.projectId); }
    if (ts.date !== undefined) { updates.push(`date = $${idx++}`); values.push(ts.date); }
    if (ts.hours !== undefined) { updates.push(`hours = $${idx++}`); values.push(ts.hours); }
    if (ts.taskDescription !== undefined) { updates.push(`task_description = $${idx++}`); values.push(ts.taskDescription); }
    if (ts.status !== undefined) { updates.push(`status = $${idx++}`); values.push(ts.status); }

    updates.push(`updated_at = NOW()`);
    
    values.push(id);
    const idIdx = idx++;
    values.push(organizationId);
    const orgIdx = idx++;

    const res = await query(`
      UPDATE timesheets SET ${updates.join(', ')} 
      WHERE id = $${idIdx} AND employee_id IN (SELECT id FROM employees WHERE organization_id = $${orgIdx})
      RETURNING id, employee_id as "employeeId", project_id as "projectId", date, CAST(hours AS FLOAT) as hours, task_description as "taskDescription", status
    `, values);
    return res[0];
  }

  async deleteTimesheet(organizationId: string, id: string): Promise<void> {
    await query(`DELETE FROM timesheets WHERE id = $1 AND employee_id IN (SELECT id FROM employees WHERE organization_id = $2)`, [id, organizationId]);
  }

  async getManagerByEmployeeId(employeeId: string): Promise<any | null> {
    return await queryOne(`
      SELECT m.id, m.first_name, m.last_name, u.id as "userId"
      FROM employees e
      JOIN employees m ON e.manager_id = m.id
      JOIN users u ON m.id = u.employee_id
      WHERE e.id = $1
    `, [employeeId]);
  }

  async getUserAndEmployeeByEmployeeId(employeeId: string): Promise<any | null> {
    return await queryOne(`
      SELECT e.id, e.first_name, e.last_name, u.id as "userId"
      FROM employees e
      LEFT JOIN users u ON e.id = u.employee_id
      WHERE e.id = $1
    `, [employeeId]);
  }

  async approveTimesheet(orgId: string, id: string, approverId: string) {
    const client = await beginTransaction();
    try {
      const ts = await client.queryOne(`SELECT t.* FROM timesheets t JOIN employees e ON t.employee_id = e.id WHERE e.organization_id = $1 AND t.id = $2 FOR UPDATE`, [orgId, id]);
      if (!ts) { await client.rollback(); return null; }
      if (ts.status !== 'SUBMITTED') { await client.rollback(); throw new Error(`Timesheet is not in SUBMITTED state (current: ${ts.status})`); }
      const updated = await client.queryOne(`UPDATE timesheets SET status='APPROVED', approved_by=$1, approved_at=NOW(), updated_at=NOW() WHERE id=$2 AND status='SUBMITTED' RETURNING *`, [approverId, id]);
      if (!updated) { await client.rollback(); throw new Error('Timesheet was already processed'); }
      await client.commit();
      return updated;
    } catch(err) { await client.rollback(); throw err; }
  }

  async rejectTimesheet(orgId: string, id: string, rejectorId: string, reason: string) {
    const client = await beginTransaction();
    try {
      const ts = await client.queryOne(`SELECT t.* FROM timesheets t JOIN employees e ON t.employee_id = e.id WHERE e.organization_id = $1 AND t.id = $2 FOR UPDATE`, [orgId, id]);
      if (!ts) { await client.rollback(); return null; }
      if (ts.status !== 'SUBMITTED') { await client.rollback(); throw new Error(`Timesheet is not in SUBMITTED state (current: ${ts.status})`); }
      const updated = await client.queryOne(`UPDATE timesheets SET status='REJECTED', rejected_by=$1, rejected_at=NOW(), rejection_reason=$2, updated_at=NOW() WHERE id=$3 AND status='SUBMITTED' RETURNING *`, [rejectorId, reason, id]);
      if (!updated) { await client.rollback(); throw new Error('Timesheet was already processed'); }
      await client.commit();
      return updated;
    } catch(err) { await client.rollback(); throw err; }
  }

  async createCorrectionRequest(orgId: string, payload: any, reqEmpId: string) {
    const { timesheet_id, requested_hours, requested_date, requested_project_id, reason } = payload;
    const result = await query(`
      INSERT INTO timesheet_correction_requests 
        (organization_id, timesheet_id, employee_id, requested_hours, requested_date, requested_project_id, reason, status, requested_by)
      VALUES ($1, $2, (SELECT employee_id FROM timesheets WHERE id = $2), $3, $4, $5, $6, 'PENDING', $7)
      RETURNING *
    `, [orgId, timesheet_id, requested_hours, requested_date, requested_project_id, reason, reqEmpId]);
    return result[0];
  }

  async getCorrectionRequests(orgId: string, filters: any, role: string, reqEmpId: string): Promise<any> {
    let sql = `
      SELECT cr.id, cr.employee_id as "employeeId", cr.timesheet_id as "timesheetId",
             cr.requested_date as "requestedDate", CAST(cr.requested_hours AS FLOAT) as "requestedHours", 
             cr.requested_project_id as "requestedProjectId",
             cr.reason, cr.status, cr.rejection_reason as "rejectionReason", cr.created_at as "createdAt",
             e.first_name as "employeeFirstName", e.last_name as "employeeLastName", e.manager_id as "managerIdOfEmployee",
             p.name as "requestedProjectName",
             t.date as "oldDate", CAST(t.hours AS FLOAT) as "oldHours",
             op.name as "oldProjectName", t.task_description as "oldTaskDescription"
      FROM timesheet_correction_requests cr
      JOIN employees e ON cr.employee_id = e.id
      JOIN timesheets t ON cr.timesheet_id = t.id
      LEFT JOIN projects p ON cr.requested_project_id = p.id
      LEFT JOIN projects op ON t.project_id = op.id
      WHERE cr.organization_id = $1
    `;
    let countSql = `
      SELECT COUNT(*) as total
      FROM timesheet_correction_requests cr
      JOIN employees e ON cr.employee_id = e.id
      WHERE cr.organization_id = $1
    `;
    const params: any[] = [orgId];
    let idx = 2;

    const addCondition = (cond: string, param?: any) => {
      sql += ` AND ${cond}`;
      countSql += ` AND ${cond}`;
      if (param !== undefined) {
        params.push(param);
        idx++;
      }
    };

    if (role === 'EMPLOYEE') {
      addCondition(`cr.employee_id = $${idx}`, reqEmpId);
    } else if (role === 'MANAGER') {
      addCondition(`cr.employee_id IN (SELECT id FROM employees WHERE organization_id=$1 AND (manager_id=$${idx} OR id=$${idx}))`, reqEmpId);
    }

    if (filters.status) addCondition(`cr.status = $${idx}`, filters.status);
    if (filters.employeeId) addCondition(`cr.employee_id = $${idx}`, filters.employeeId);
    if (filters.timesheetId) addCondition(`cr.timesheet_id = $${idx}`, filters.timesheetId);

    sql += ` ORDER BY cr.created_at DESC`;

    const page = Math.max(1, parseInt(filters.page) || 1);
    const limit = Math.max(1, parseInt(filters.limit) || 50);
    const offset = (page - 1) * limit;

    sql += ` LIMIT $${idx++} OFFSET $${idx++}`;
    const pagedParams = [...params, limit, offset];

    const [rows, countRes] = await Promise.all([
      query(sql, pagedParams),
      queryOne(countSql, params)
    ]);

    const total = parseInt(countRes?.total || '0', 10);
    const totalPages = Math.ceil(total / limit);

    return {
      data: rows.map(r => ({
        ...r,
        employeeName: (r.employeeFirstName && r.employeeLastName) ? `${r.employeeFirstName} ${r.employeeLastName}` : undefined
      })),
      pagination: { total, page, limit, totalPages }
    };
  }

  async getCorrectionRequestById(orgId: string, reqId: string): Promise<any | null> {
    const rows = await query(`
      SELECT cr.*, e.manager_id as "managerIdOfEmployee"
      FROM timesheet_correction_requests cr
      JOIN employees e ON cr.employee_id = e.id
      WHERE cr.id = $1 AND cr.organization_id = $2
    `, [reqId, orgId]);
    return rows.length ? rows[0] : null;
  }

  async approveCorrectionRequest(orgId: string, reqId: string, reviewerEmpId: string): Promise<any> {
    const client = await beginTransaction();
    try {
      const cr = await client.queryOne(`
        SELECT * FROM timesheet_correction_requests 
        WHERE id = $1 AND organization_id = $2 FOR UPDATE
      `, [reqId, orgId]);
      
      if (!cr) { await client.rollback(); return null; }
      if (cr.status !== 'PENDING') { await client.rollback(); throw new Error(`Request is not PENDING (current: ${cr.status})`); }

      const ts = await client.queryOne(`
        SELECT * FROM timesheets 
        WHERE id = $1 FOR UPDATE
      `, [cr.timesheet_id]);

      if (!ts) { await client.rollback(); throw new Error('Timesheet not found'); }

      // Update Timesheet
      const updates = [];
      const vals = [];
      let idx = 1;
      if (cr.requested_date) { updates.push(`date = $${idx++}`); vals.push(cr.requested_date); }
      if (cr.requested_hours !== null && cr.requested_hours !== undefined) { updates.push(`hours = $${idx++}`); vals.push(cr.requested_hours); }
      if (cr.requested_project_id) { updates.push(`project_id = $${idx++}`); vals.push(cr.requested_project_id); }
      
      if (updates.length > 0) {
        updates.push(`updated_at = NOW()`);
        vals.push(cr.timesheet_id);
        await client.query(`
          UPDATE timesheets SET ${updates.join(', ')} WHERE id = $${idx}
        `, vals);
      }

      // Update Correction Request
      const updatedCr = await client.queryOne(`
        UPDATE timesheet_correction_requests 
        SET status = 'APPROVED', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW() 
        WHERE id = $2 RETURNING id, status, reviewed_by as "reviewedBy"
      `, [reviewerEmpId, reqId]);

      await client.commit();
      return updatedCr;
    } catch(err) { 
      await client.rollback(); 
      throw err; 
    }
  }

  async rejectCorrectionRequest(orgId: string, reqId: string, reviewerEmpId: string, reason: string): Promise<any> {
    const client = await beginTransaction();
    try {
      const cr = await client.queryOne(`
        SELECT * FROM timesheet_correction_requests 
        WHERE id = $1 AND organization_id = $2 FOR UPDATE
      `, [reqId, orgId]);
      
      if (!cr) { await client.rollback(); return null; }
      if (cr.status !== 'PENDING') { await client.rollback(); throw new Error(`Request is not PENDING (current: ${cr.status})`); }

      const updatedCr = await client.queryOne(`
        UPDATE timesheet_correction_requests 
        SET status = 'REJECTED', reviewed_by = $1, rejection_reason = $2, reviewed_at = NOW(), updated_at = NOW() 
        WHERE id = $3 RETURNING id, status, reviewed_by as "reviewedBy", rejection_reason as "rejectionReason"
      `, [reviewerEmpId, reason, reqId]);

      await client.commit();
      return updatedCr;
    } catch(err) { 
      await client.rollback(); 
      throw err; 
    }
  }
}

export const timesheetRepository = new TimesheetRepository();
