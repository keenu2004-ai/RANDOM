import { query, queryOne } from '../db/client';

export class ReportRepository {
  private getEmployeeFilter(role: string, employeeId: string, paramIndex: number, alias: string = 'e'): { filter: string, params: any[] } {
    if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'HR_MANAGER') {
      return { filter: '', params: [] };
    }
    if (role === 'MANAGER') {
      return { filter: ` AND (${alias}.manager_id = $${paramIndex} OR ${alias}.id = $${paramIndex})`, params: [employeeId] };
    }
    return { filter: ` AND ${alias}.id = $${paramIndex}`, params: [employeeId] };
  }

  async getStats(orgId: string, role: string, employeeId: string, dateStr: string) {
    const { filter: empFilter, params: empParams } = this.getEmployeeFilter(role, employeeId, 2, 'e');
    const params = [orgId, ...empParams];
    const pLen = params.length + 1;

    const totalEmployees = await queryOne(`SELECT COUNT(*) as count FROM employees e WHERE e.organization_id = $1 AND e.deleted_at IS NULL ${empFilter}`, params);
    
    // Attendance stats for today
    const presentToday = await queryOne(`SELECT COUNT(*) as count FROM attendance a JOIN employees e ON a.employee_id = e.id WHERE e.organization_id = $1 AND a.date = $${pLen} AND a.status = 'PRESENT' ${empFilter}`, [...params, dateStr]);
    
    // Leaves today
    const leavesToday = await queryOne(`SELECT COUNT(*) as count FROM leave_requests l JOIN employees e ON l.employee_id = e.id WHERE e.organization_id = $1 AND l.start_date <= $${pLen} AND l.end_date >= $${pLen} AND l.status = 'APPROVED' ${empFilter}`, [...params, dateStr]);

    // Additional stats for complete dashboard
    const activeEmployees = await queryOne(`SELECT COUNT(*) as count FROM employees e WHERE e.organization_id = $1 AND e.deleted_at IS NULL AND e.status = 'ACTIVE' ${empFilter}`, params);
    const lateToday = await queryOne(`SELECT COUNT(*) as count FROM attendance a JOIN employees e ON a.employee_id = e.id WHERE e.organization_id = $1 AND a.date = $${pLen} AND a.status = 'LATE' ${empFilter}`, [...params, dateStr]);
    const pendingLeaveRequests = await queryOne(`SELECT COUNT(*) as count FROM leave_requests l JOIN employees e ON l.employee_id = e.id WHERE e.organization_id = $1 AND l.status = 'PENDING' ${empFilter}`, params);
    const pendingExpenseRequests = await queryOne(`SELECT COUNT(*) as count FROM expenses ex JOIN employees e ON ex.employee_id = e.id WHERE ex.organization_id = $1 AND ex.status = 'SUBMITTED' ${empFilter}`, params);
    const upcomingHolidays = await query(`SELECT id, title as name, date, type, description FROM holidays WHERE organization_id = $1 AND date >= $2 AND date <= $3 ORDER BY date LIMIT 5`, [orgId, dateStr, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]]);
    const organization = await queryOne(`SELECT id, name as orgName, office_latitude, office_longitude, allowed_geofence_radius_meters FROM organizations WHERE id = $1`, [orgId]);

    return {
      totalEmployees: parseInt(totalEmployees?.count || '0'),
      activeEmployees: parseInt(activeEmployees?.count || '0'),
      presentToday: parseInt(presentToday?.count || '0'),
      lateToday: parseInt(lateToday?.count || '0'),
      onLeaveToday: parseInt(leavesToday?.count || '0'),
      absentToday: parseInt(totalEmployees?.count || '0') - parseInt(presentToday?.count || '0') - parseInt(leavesToday?.count || '0'),
      pendingLeaveRequests: parseInt(pendingLeaveRequests?.count || '0'),
      pendingExpenseRequests: parseInt(pendingExpenseRequests?.count || '0'),
      upcomingHolidays: upcomingHolidays || [],
      organization: organization ? {
        id: organization.id,
        orgName: organization.orgName,
        officeLatitude: organization.office_latitude,
        officeLongitude: organization.office_longitude,
        allowedGeofenceRadiusMeters: organization.allowed_geofence_radius_meters
      } : null
    };
  }

  async getCharts(orgId: string, role: string, employeeId: string) {
    const { filter: empFilter, params: empParams } = this.getEmployeeFilter(role, employeeId, 2, 'e');
    const params = [orgId, ...empParams];

    // Example charts
    const departmentDistribution = await query(`
      SELECT d.name as department, COUNT(e.id) as count 
      FROM employees e 
      LEFT JOIN departments d ON e.department_id = d.id 
      WHERE e.organization_id = $1 AND e.deleted_at IS NULL ${empFilter}
      GROUP BY d.name
    `, params);

    return {
      departmentDistribution: departmentDistribution.map((d: any) => ({ name: d.department || 'Unassigned', value: parseInt(d.count) }))
    };
  }

  async getReportData(orgId: string, reportType: string, filters: any, role: string, employeeId: string) {
    let rows: any[] = [];
    let summary: Record<string, any> = {};
    const branches = await query(`SELECT id, name FROM branches WHERE organization_id = $1`, [orgId]);
    const departments = await query(`SELECT id, name FROM departments WHERE organization_id = $1`, [orgId]);
    const employees = await query(`SELECT id, first_name, last_name, employee_code FROM employees WHERE organization_id = $1 AND deleted_at IS NULL`, [orgId]);

    const { filter: empFilter, params: empParams } = this.getEmployeeFilter(role, employeeId, 2, 'e');
    const baseParams = [orgId, ...empParams];

    if (reportType === 'employee') {
      let q = `SELECT e.*, d.name as department_name, b.name as branch_name, des.title as designation_name
                 FROM employees e 
                 LEFT JOIN departments d ON e.department_id = d.id
                 LEFT JOIN branches b ON e.branch_id = b.id
                 LEFT JOIN designations des ON e.designation_id = des.id
                 WHERE e.deleted_at IS NULL AND e.organization_id = $1 ${empFilter}`;
      
      const result = await query(q, baseParams);
      rows = result.map((e: any) => ({
        id: e.id,
        employeeCode: e.employee_code,
        fullName: `${e.first_name} ${e.last_name}`,
        email: e.email,
        phone: e.phone || '-',
        department: e.department_name || 'Unassigned',
        designation: e.designation_name || 'Unassigned',
        branch: e.branch_name || 'Main Office',
        status: e.status,
        employmentType: e.employment_type || 'FULL_TIME',
        joiningDate: e.date_of_joining,
        basicSalary: (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'HR_MANAGER' || e.id === employeeId) ? Number(e.base_salary_inr) || 0 : 'HIDDEN',
        grossSalary: (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'HR_MANAGER' || e.id === employeeId) ? (Number(e.base_salary_inr) || 0) : 'HIDDEN',
        workLocation: 'Office'
      }));
      summary = { totalRecords: rows.length };
    } else if (reportType === 'attendance') {
      let q = `SELECT a.*, e.employee_code, e.first_name, e.last_name, d.name as dept_name, b.name as branch_name
                 FROM attendance a
                 JOIN employees e ON a.employee_id = e.id
                 LEFT JOIN departments d ON e.department_id = d.id
                 LEFT JOIN branches b ON e.branch_id = b.id
                 WHERE e.organization_id = $1 ${empFilter}`;
      const result = await query(q, baseParams);
      let totalWorkHours = 0;
      rows = result.map((a: any) => {
        const wh = Number(a.work_hours) || 0;
        totalWorkHours += wh;
        return {
          id: a.id,
          date: a.date,
          employeeCode: a.employee_code,
          employeeName: `${a.first_name} ${a.last_name}`,
          department: a.dept_name || '-',
          branch: a.branch_name || '-',
          checkIn: a.check_in,
          checkOut: a.check_out,
          workingHours: wh,
          status: a.status,
          checkInAddress: a.check_in_location || 'Office GPS'
        };
      });
      summary = { totalRecords: rows.length, totalWorkHours, avgWorkHours: rows.length > 0 ? (totalWorkHours / rows.length).toFixed(2) : 0 };
    } else if (reportType === 'leaves') {
       let q = `SELECT l.*, e.employee_code, e.first_name, e.last_name
                FROM leave_requests l JOIN employees e ON l.employee_id = e.id
                WHERE e.organization_id = $1 ${empFilter}`;
       const result = await query(q, baseParams);
       rows = result.map((l: any) => ({
         id: l.id,
         employeeCode: l.employee_code,
         employeeName: `${l.first_name} ${l.last_name}`,
         leaveType: l.leave_type,
         startDate: l.start_date,
         endDate: l.end_date,
         status: l.status,
         reason: l.reason
       }));
       summary = { totalRecords: rows.length };
    } else if (reportType === 'expenses') {
       let q = `SELECT ex.*, e.employee_code, e.first_name, e.last_name
                FROM expenses ex JOIN employees e ON ex.employee_id = e.id
                WHERE ex.organization_id = $1 ${empFilter}`;
       const result = await query(q, baseParams);
       let totalAmount = 0;
       rows = result.map((ex: any) => {
         const amount = Number(ex.amount) || 0;
         totalAmount += amount;
         return {
           id: ex.id,
           employeeCode: ex.employee_code,
           employeeName: `${ex.first_name} ${ex.last_name}`,
           category: ex.category,
           amount: amount,
           status: ex.status,
           date: ex.expense_date
         };
       });
       summary = { totalRecords: rows.length, totalAmount };
    } else if (reportType === 'timesheets') {
       let q = `SELECT t.*, e.employee_code, e.first_name, e.last_name
                FROM timesheets t JOIN employees e ON t.employee_id = e.id
                WHERE t.organization_id = $1 ${empFilter}`;
       const result = await query(q, baseParams);
       let totalHours = 0;
       rows = result.map((t: any) => {
         const hours = Number(t.hours_worked) || 0;
         totalHours += hours;
         return {
           id: t.id,
           employeeCode: t.employee_code,
           employeeName: `${t.first_name} ${t.last_name}`,
           date: t.date,
           hours: hours,
           status: t.status,
           task: t.task_description
         };
       });
       summary = { totalRecords: rows.length, totalHours };
    } else if (reportType === 'payroll') {
       let q = `SELECT p.*, pp.month, pp.year, e.employee_code, e.first_name, e.last_name
                FROM payroll_records p 
                JOIN payroll_periods pp ON p.payroll_period_id = pp.id
                JOIN employees e ON p.employee_id = e.id
                WHERE p.organization_id = $1 ${empFilter}`;
       const result = await query(q, baseParams);
       let totalNet = 0;
       rows = result.map((p: any) => {
         const canViewAmounts = (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'HR_MANAGER' || p.employee_id === employeeId);
         const netPay = canViewAmounts ? Number(p.net_pay) : 0;
         if (canViewAmounts) totalNet += netPay;
         
         return {
           id: p.id,
           employeeCode: p.employee_code,
           employeeName: `${p.first_name} ${p.last_name}`,
           month: p.month,
           year: p.year,
           basicPay: canViewAmounts ? Number(p.basic_pay) : 'HIDDEN',
           netPay: canViewAmounts ? netPay : 'HIDDEN',
           status: p.status
         };
       });
       summary = { totalRecords: rows.length, totalNetPay: role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'HR_MANAGER' ? totalNet : 'HIDDEN' };
    }
    
    return { 
      rows, 
      summary, 
      branches: branches.map(b => ({ id: b.id, name: b.name })), 
      departments: departments.map(d => ({ id: d.id, name: d.name })), 
      employees: employees.map(e => ({ id: e.id, name: `${e.first_name} ${e.last_name}` })) 
    };
  }

  async getUsers(orgId: string) {
    const res = await query(`
      SELECT u.id, u.organization_id, u.email, u.is_active, u.created_at, e.first_name, e.last_name, e.employee_code, r.name as role, e.id as employee_id
      FROM users u
      LEFT JOIN employees e ON e.user_id = u.id
      LEFT JOIN user_roles ur ON u.id = ur.user_id 
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.organization_id = $1
      ORDER BY u.created_at DESC
    `, [orgId]);
    return res.map((r: any) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      employeeId: r.employee_id,
      employeeCode: r.employee_code,
      firstName: r.first_name,
      lastName: r.last_name,
      createdAt: r.created_at
    }));
  }

  async getUserById(orgId: string, userId: string) {
    const r = await queryOne(`
      SELECT u.id, u.organization_id, u.email, u.is_active, u.created_at, r.name as role, e.id as employee_id
      FROM users u
      LEFT JOIN employees e ON e.user_id = u.id
      LEFT JOIN user_roles ur ON u.id = ur.user_id 
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.id = $1 AND u.organization_id = $2
    `, [userId, orgId]);
    if (!r) return null;
    return {
      id: r.id,
      email: r.email,
      role: r.role,
      employeeId: r.employee_id
    };
  }

  async updateUserRole(orgId: string, userId: string, role: string) {
    await query(`UPDATE users SET role = $1 WHERE id = $2 AND organization_id = $3`, [role, userId, orgId]);
  }

  async getAuditLogs(orgId: string, page: number = 1, limit: number = 10, filters?: any) {
    let where = `organization_id = $1`;
    const params: any[] = [orgId];
    let pIdx = 2;

    if (filters?.actor) {
      where += ` AND user_email ILIKE $${pIdx}`;
      params.push(`%${filters.actor}%`);
      pIdx++;
    }
    if (filters?.action) {
      where += ` AND action = $${pIdx}`;
      params.push(filters.action);
      pIdx++;
    }
    if (filters?.startDate && filters?.endDate) {
      where += ` AND timestamp BETWEEN $${pIdx} AND $${pIdx + 1}`;
      params.push(filters.startDate, filters.endDate);
      pIdx += 2;
    }

    // Whitelisted sorting
    const validSortCols = ['timestamp', 'action', 'user_email'];
    const validDirs = ['ASC', 'DESC'];
    const sortBy = validSortCols.includes(filters?.sortBy) ? filters.sortBy : 'timestamp';
    const sortDir = validDirs.includes(filters?.sortDir?.toUpperCase()) ? filters.sortDir.toUpperCase() : 'DESC';

    const countRes = await queryOne(`SELECT COUNT(*) as total FROM audit_logs WHERE ${where}`, params);
    const total = parseInt(countRes?.total || '0');

    const offset = (page - 1) * limit;
    
    const queryStr = `SELECT * FROM audit_logs WHERE ${where} ORDER BY ${sortBy} ${sortDir} LIMIT $${pIdx} OFFSET $${pIdx + 1}`;
    params.push(limit, offset);

    const res = await query(queryStr, params);
    const data = res.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      email: r.user_email,
      userName: r.user_name,
      action: r.action,
      resourceType: r.resource_type,
      resourceId: r.resource_id,
      details: r.details,
      timestamp: r.timestamp
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getSettings(orgId: string) {
    const r = await queryOne(`SELECT * FROM organizations WHERE id = $1`, [orgId]);
    if (!r) return {};
    return {
      id: r.id,
      orgName: r.name,
      code: r.code,
      website: r.website,
      officeLatitude: r.office_latitude,
      officeLongitude: r.office_longitude,
      allowedGeofenceRadiusMeters: r.allowed_geofence_radius_meters,
      enforceGpsCheckIn: r.enforce_gps_check_in
    };
  }

  async updateSettings(orgId: string, settings: any) {
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (settings.orgName !== undefined || settings.name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(settings.orgName || settings.name);
    }
    if (settings.website !== undefined) { updates.push(`website = $${idx++}`); values.push(settings.website); }
    if (settings.officeLatitude !== undefined) { updates.push(`office_latitude = $${idx++}`); values.push(settings.officeLatitude); }
    if (settings.officeLongitude !== undefined) { updates.push(`office_longitude = $${idx++}`); values.push(settings.officeLongitude); }
    if (settings.allowedGeofenceRadiusMeters !== undefined) { updates.push(`allowed_geofence_radius_meters = $${idx++}`); values.push(settings.allowedGeofenceRadiusMeters); }
    if (settings.enforceGpsCheckIn !== undefined) { updates.push(`enforce_gps_check_in = $${idx++}`); values.push(settings.enforceGpsCheckIn); }

    if (updates.length > 0) {
      values.push(orgId);
      await query(`UPDATE organizations SET ${updates.join(', ')} WHERE id = $${idx}`, values);
    }
    
    return this.getSettings(orgId);
  }
}

export const reportRepository = new ReportRepository();
