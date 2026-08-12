import { query, queryOne, beginTransaction } from '../db/client';

export class EmployeeRepository {
  async getOrganizationMeta(organizationId: string) {
    const settings = await queryOne(`SELECT * FROM organizations WHERE id = $1 LIMIT 1`, [organizationId]);
    const branches = await query(`SELECT * FROM branches WHERE organization_id = $1`, [organizationId]);
    const departments = await query(`SELECT * FROM departments WHERE organization_id = $1`, [organizationId]);
    const designations = await query(`SELECT * FROM designations WHERE organization_id = $1`, [organizationId]);
    const teams = await query(`SELECT * FROM teams WHERE organization_id = $1`, [organizationId]);
    const shifts = await query(`SELECT * FROM shifts WHERE organization_id = $1`, [organizationId]);
    const managers = await query(`
      SELECT id, first_name || ' ' || last_name as name, employee_code as code, email 
      FROM employees 
      WHERE organization_id = $1 AND deleted_at IS NULL AND status = 'ACTIVE'
    `, [organizationId]);
    
    return {
      organization: settings,
      branches,
      departments,
      designations,
      teams,
      shifts,
      managers
    };
  }

  async getEmployees(organizationId: string, filters: any) {
    let sql = `SELECT * FROM employees WHERE organization_id = $1`;
    const params: any[] = [organizationId];
    let idx = 2;

    if (!filters.canSeeDeleted || filters.includeDeleted !== 'true') {
      sql += ` AND deleted_at IS NULL`;
    }
    if (filters.managerId) {
      sql += ` AND (manager_id = $${idx} OR id = $${idx})`;
      params.push(filters.managerId);
      idx++;
    } else if (filters.employeeId) {
      sql += ` AND id = $${idx++}`;
      params.push(filters.employeeId);
    }

    if (filters.search) {
      sql += ` AND (LOWER(first_name) LIKE $${idx} OR LOWER(last_name) LIKE $${idx} OR LOWER(employee_code) LIKE $${idx} OR LOWER(email) LIKE $${idx} OR phone LIKE $${idx})`;
      params.push(`%${filters.search.toLowerCase().trim()}%`);
      idx++;
    }
    if (filters.departmentId) {
      sql += ` AND department_id = $${idx++}`;
      params.push(filters.departmentId);
    }
    if (filters.branchId) {
      sql += ` AND branch_id = $${idx++}`;
      params.push(filters.branchId);
    }
    if (filters.designationId) {
      sql += ` AND designation_id = $${idx++}`;
      params.push(filters.designationId);
    }
    if (filters.status) {
      sql += ` AND status = $${idx++}`;
      params.push(filters.status);
    }
    if (filters.employmentType) {
      sql += ` AND employment_type = $${idx++}`;
      params.push(filters.employmentType);
    }

    // Get total count before pagination
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countResult = await queryOne(countSql, params);
    const total = parseInt(countResult?.total || '0');

    // Sorting
    const validSortFields = ['first_name', 'last_name', 'email', 'employee_code', 'date_of_joining', 'created_at'];
    let sortBy = 'created_at';
    if (filters.sortBy && validSortFields.includes(filters.sortBy)) {
      sortBy = filters.sortBy;
    }
    const sortOrder = (filters.sortOrder && filters.sortOrder.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
    sql += ` ORDER BY ${sortBy} ${sortOrder}`;

    // Pagination
    const page = Math.max(1, parseInt(filters.page) || 1);
    const limit = Math.max(1, parseInt(filters.limit) || 100);
    const offset = (page - 1) * limit;
    
    sql += ` LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const rows = await query(sql, params);

    const data = rows.map(r => this.mapEmployeeRow(r, filters.canViewSalary));

    return { data, total };
  }

  async getEmployeeById(organizationId: string, id: string, canViewSalary: boolean = false) {
    const sql = `
      SELECT e.*, d.name as department_name, ds.title as designation_name, b.name as branch_name, s.name as shift_name,
             m.first_name as m_first, m.last_name as m_last
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations ds ON e.designation_id = ds.id
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN shifts s ON e.shift_id = s.id
      LEFT JOIN employees m ON e.manager_id = m.id
      WHERE e.organization_id = $1 AND e.id = $2
    `;
    const r = await queryOne(sql, [organizationId, id]);
    if (!r) return null;

    return {
      ...this.mapEmployeeRow(r, canViewSalary),
      departmentName: r.department_name || 'Unassigned',
      designationName: r.designation_name || 'Unassigned',
      branchName: r.branch_name || 'Main Office',
      shiftName: r.shift_name || 'General Shift',
      managerName: r.m_first ? `${r.m_first} ${r.m_last}` : 'N/A'
    };
  }

  async createEmployee(organizationId: string, data: any) {
    const client = await beginTransaction();
    try {
      const emailCheck = await client.queryOne(`SELECT id FROM employees WHERE organization_id = $1 AND LOWER(email) = LOWER($2) AND deleted_at IS NULL`, [organizationId, data.email]);
      if (emailCheck) throw new Error('An active employee with this official email address already exists');

      if (data.employeeCode) {
        const codeCheck = await client.queryOne(`SELECT id FROM employees WHERE organization_id = $1 AND LOWER(employee_code) = LOWER($2) AND deleted_at IS NULL`, [organizationId, data.employeeCode]);
        if (codeCheck) throw new Error('An employee with this Employee Code already exists');
      }

      let empCode = data.employeeCode?.trim();
      if (!empCode) {
        const resCount = await client.queryOne(`SELECT COUNT(*) as cnt FROM employees WHERE organization_id = $1`, [organizationId]);
        empCode = 'TE-' + (1000 + parseInt(resCount.cnt) + 1);
      }

      const org = await client.queryOne(`SELECT id FROM organizations WHERE id = $1 LIMIT 1`, [organizationId]);

      const emp = await client.queryOne(`
        INSERT INTO employees (
          organization_id, employee_code, first_name, last_name, email, phone, profile_photo, date_of_birth, gender,
          address, city, state, country, emergency_contact_name, emergency_contact_phone, department_id, designation_id,
          branch_id, team_id, manager_id, date_of_joining, employment_type, status, work_location, shift_id, base_salary_inr,
          hra, allowances, bank_name, bank_account_number, bank_ifsc, pan_number, uan_number, pf_number, esi_number
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35
        ) RETURNING *
      `, [
        org?.id, empCode, data.firstName, data.lastName, data.email.toLowerCase(), data.phone || '', data.profilePhoto || '', data.dateOfBirth || '1995-01-01', data.gender || 'OTHER',
        data.address || '', data.city || 'Bengaluru', data.state || 'Karnataka', data.country || 'India', data.emergencyContactName || '', data.emergencyContactPhone || '',
        data.departmentId || null, data.designationId || null, data.branchId || null, data.teamId || null, data.managerId || null, data.joiningDate || new Date().toISOString().split('T')[0],
        data.employmentType || 'FULL_TIME', data.status || 'ACTIVE', data.workLocation || 'Bengaluru HQ', data.shiftId || null, data.basicSalary || 50000,
        data.hra || 20000, data.allowances || 10000, data.bankName || 'HDFC Bank', data.accountNumber || '1234567890', data.ifscCode || 'HDFC0001234',
        data.panNumber || 'ABCDE1234F', data.uanNumber || '', data.pfNumber || '', data.esiNumber || ''
      ]);

      let user = await client.queryOne(`SELECT id FROM users WHERE organization_id = $1 AND LOWER(email) = LOWER($2)`, [organizationId, emp.email]);
      if (!user) {
        user = await client.queryOne(`
          INSERT INTO users (organization_id, email, password_hash, is_active)
          VALUES ($1, $2, $3, TRUE) RETURNING *
        `, [organizationId, emp.email, 'password_hash_placeholder']);
        
        // Find role id
        const role = await client.queryOne(`SELECT id FROM roles WHERE name = $1`, [data.role || 'EMPLOYEE']);
        if (role) {
          await client.queryOne(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [user.id, role.id]);
        }
      }
      
      await client.queryOne(`UPDATE employees SET user_id = $1 WHERE id = $2`, [user.id, emp.id]);

      const currentYear = new Date().getFullYear();
      const leaveTypes = await client.query(`SELECT * FROM leave_types WHERE organization_id = $1`, [organizationId]);
      for (const lt of leaveTypes) {
        await client.queryOne(`
          INSERT INTO leave_balances (employee_id, leave_type_id, year, total_quota, used, pending, available)
          VALUES ($1, $2, $3, $4, 0, 0, $4)
        `, [emp.id, lt.id, currentYear, lt.annual_quota]);
      }

      await client.commit();
      return this.mapEmployeeRow(emp, true);
    } catch (e) {
      await client.rollback();
      throw e;
    }
  }

  async updateEmployee(organizationId: string, id: string, data: any) {
    const client = await beginTransaction();
    try {
      const existing = await client.queryOne(`SELECT * FROM employees WHERE organization_id = $1 AND id = $2`, [organizationId, id]);
      if (!existing) throw new Error('Employee record not found');

      if (data.email && data.email.toLowerCase().trim() !== existing.email.toLowerCase()) {
        const emailCheck = await client.queryOne(`SELECT id FROM employees WHERE organization_id = $1 AND id != $2 AND LOWER(email) = LOWER($3) AND deleted_at IS NULL`, [organizationId, id, data.email]);
        if (emailCheck) throw new Error('Another active employee already uses this email address');
      }

      if (data.employeeCode && data.employeeCode.toLowerCase().trim() !== existing.employee_code.toLowerCase()) {
        const codeCheck = await client.queryOne(`SELECT id FROM employees WHERE organization_id = $1 AND id != $2 AND LOWER(employee_code) = LOWER($3) AND deleted_at IS NULL`, [organizationId, id, data.employeeCode]);
        if (codeCheck) throw new Error('Another active employee already uses this Employee Code');
      }

      const updates: any[] = [];
      const values: any[] = [];
      let idx = 1;
      
      const mapField = (objKey: string, dbKey: string) => {
        if (data[objKey] !== undefined) {
          updates.push(`${dbKey} = $${idx++}`);
          values.push(data[objKey]);
        }
      };

      mapField('firstName', 'first_name');
      mapField('lastName', 'last_name');
      mapField('email', 'email');
      mapField('employeeCode', 'employee_code');
      mapField('phone', 'phone');
      mapField('profilePhoto', 'profile_photo');
      mapField('dateOfBirth', 'date_of_birth');
      mapField('gender', 'gender');
      mapField('address', 'address');
      mapField('city', 'city');
      mapField('state', 'state');
      mapField('country', 'country');
      mapField('emergencyContactName', 'emergency_contact_name');
      mapField('emergencyContactPhone', 'emergency_contact_phone');
      mapField('departmentId', 'department_id');
      mapField('designationId', 'designation_id');
      mapField('branchId', 'branch_id');
      mapField('teamId', 'team_id');
      mapField('managerId', 'manager_id');
      mapField('joiningDate', 'date_of_joining');
      mapField('employmentType', 'employment_type');
      mapField('status', 'status');
      mapField('workLocation', 'work_location');
      mapField('shiftId', 'shift_id');
      mapField('basicSalary', 'base_salary_inr');
      mapField('hra', 'hra');
      mapField('allowances', 'allowances');
      mapField('bankName', 'bank_name');
      mapField('accountNumber', 'bank_account_number');
      mapField('ifscCode', 'bank_ifsc');
      mapField('panNumber', 'pan_number');
      mapField('uanNumber', 'uan_number');
      mapField('pfNumber', 'pf_number');
      mapField('esiNumber', 'esi_number');

      if (updates.length > 0) {
        updates.push(`updated_at = NOW()`);
        values.push(id, organizationId);
        const emp = await client.queryOne(`UPDATE employees SET ${updates.join(', ')} WHERE id = $${idx} AND organization_id = $${idx+1} RETURNING *`, values);
        
        if (data.email && emp) {
          await client.queryOne(`UPDATE users SET email = $1 WHERE id = $2`, [data.email.toLowerCase().trim(), emp.user_id]);
        }
        await client.commit();
        return this.mapEmployeeRow(emp, true);
      }
      await client.commit();
      return this.mapEmployeeRow(existing, true);
    } catch (e) {
      await client.rollback();
      throw e;
    }
  }

  async softDeleteEmployee(organizationId: string, id: string) {
    const client = await beginTransaction();
    try {
      const emp = await client.queryOne(`UPDATE employees SET deleted_at = NOW(), status = 'INACTIVE', updated_at = NOW() WHERE organization_id = $1 AND id = $2 RETURNING *`, [organizationId, id]);
      if (!emp) throw new Error('Employee record not found');
      await client.queryOne(`UPDATE users SET updated_at = NOW(), is_active = FALSE WHERE id = $1`, [emp.user_id]);
      await client.commit();
      return this.mapEmployeeRow(emp, true);
    } catch (e) {
      await client.rollback();
      throw e;
    }
  }

  async restoreEmployee(organizationId: string, id: string) {
    const client = await beginTransaction();
    try {
      const emp = await client.queryOne(`UPDATE employees SET deleted_at = NULL, status = 'ACTIVE', updated_at = NOW() WHERE organization_id = $1 AND id = $2 RETURNING *`, [organizationId, id]);
      if (!emp) throw new Error('Employee record not found');
      await client.queryOne(`UPDATE users SET updated_at = NOW(), is_active = TRUE WHERE id = $1`, [emp.user_id]);
      await client.commit();
      return this.mapEmployeeRow(emp, true);
    } catch (e) {
      await client.rollback();
      throw e;
    }
  }

  async updatePhoto(organizationId: string, id: string, photoUrl: string) {
    const emp = await queryOne(`UPDATE employees SET profile_photo = $1, updated_at = NOW() WHERE organization_id = $2 AND id = $3 RETURNING *`, [photoUrl, organizationId, id]);
    if (!emp) return null;
    return this.mapEmployeeRow(emp, true);
  }

  private mapEmployeeRow(r: any, canViewSalary: boolean = true) {
    const employee: any = {
      id: r.id,
      employeeCode: r.employee_code,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      phone: r.phone,
      profilePhoto: r.profile_photo,
      dateOfBirth: r.date_of_birth,
      gender: r.gender,
      address: r.address,
      city: r.city,
      state: r.state,
      country: r.country,
      emergencyContactName: r.emergency_contact_name,
      emergencyContactPhone: r.emergency_contact_phone,
      departmentId: r.department_id,
      designationId: r.designation_id,
      branchId: r.branch_id,
      teamId: r.team_id,
      managerId: r.manager_id,
      joiningDate: r.date_of_joining,
      employmentType: r.employment_type,
      status: r.status,
      workLocation: r.work_location,
      shiftId: r.shift_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at
    };

    if (canViewSalary) {
      employee.basicSalary = r.base_salary_inr;
      employee.hra = r.hra;
      employee.allowances = r.allowances;
      employee.bankName = r.bank_name;
      employee.accountNumber = r.bank_account_number;
      employee.ifscCode = r.bank_ifsc;
      employee.panNumber = r.pan_number;
      employee.uanNumber = r.uan_number;
      employee.pfNumber = r.pf_number;
      employee.esiNumber = r.esi_number;
    }

    return employee;
  }
}

export const employeeRepository = new EmployeeRepository();
