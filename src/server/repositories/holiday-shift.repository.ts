import { query, queryOne, beginTransaction } from '../db/client.js';
import { logMasterDataChangeTx } from '../utils/audit-logger.js';

export class HolidayShiftRepository {
  // --- HOLIDAYS ---
  async getAllHolidays(orgId: string, filters: { year?: string, branchId?: string, employeeBranchId?: string } = {}) {
    let sql = `
      SELECT h.*, b.name as branch_name
      FROM holidays h
      LEFT JOIN branches b ON h.branch_id = b.id
      WHERE h.organization_id = $1
    `;
    const params: any[] = [orgId];
    let idx = 2;

    if (filters.year) {
      sql += ` AND h.date::text LIKE $${idx++}`;
      params.push(`${filters.year}%`);
    }
    
    if (filters.branchId && filters.branchId !== 'ALL') {
      sql += ` AND (h.branch_id IS NULL OR h.branch_id = $${idx++})`;
      params.push(filters.branchId);
    }

    if (filters.employeeBranchId) {
      sql += ` AND (h.branch_id IS NULL OR h.branch_id = $${idx++})`;
      params.push(filters.employeeBranchId);
    }

    const rows = await query(sql, params);
    return rows.map(r => ({
      id: r.id,
      name: r.title,
      date: r.date,
      type: r.type,
      branchId: r.branch_id || 'ALL',
      branchName: r.branch_name || (r.branch_id ? '-' : 'All Branches (Organization-wide)'),
      description: r.description
    }));
  }

  async checkHolidayOnDate(orgId: string, dateStr: string, branchId?: string) {
    const res = await queryOne(`
      SELECT * FROM holidays
      WHERE organization_id = $1 AND date = $2 AND (branch_id = $3 OR (branch_id IS NULL AND $3 IS NULL))
    `, [orgId, dateStr, branchId || null]);
    return res;
  }

  async createHoliday(orgId: string, data: any) {
    const res = await queryOne(`
      INSERT INTO holidays (organization_id, title, date, type, branch_id, description)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [orgId, data.name, data.date, data.type || 'PUBLIC', data.branchId === 'ALL' ? null : data.branchId, data.description]);

    const branch = res.branch_id ? await queryOne(`SELECT name FROM branches WHERE organization_id = $1 AND id = $2`, [orgId, res.branch_id]) : null;

    return {
      id: res.id,
      name: res.title,
      date: res.date,
      type: res.type,
      branchId: res.branch_id || 'ALL',
      description: res.description,
      branchName: branch ? branch.name : 'All Branches (Organization-wide)'
    };
  }

  async updateHoliday(orgId: string, id: string, data: any) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (data.name !== undefined) { fields.push(`title = $${idx++}`); values.push(data.name); }
    if (data.date !== undefined) { fields.push(`date = $${idx++}`); values.push(data.date); }
    if (data.type !== undefined) { fields.push(`type = $${idx++}`); values.push(data.type); }
    if (data.branchId !== undefined) { fields.push(`branch_id = $${idx++}`); values.push(data.branchId === 'ALL' ? null : data.branchId); }
    if (data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(data.description); }

    values.push(orgId);
    const orgIdIdx = idx++;
    values.push(id);
    const idIdx = idx++;

    const res = await queryOne(`
      UPDATE holidays SET ${fields.join(', ')} WHERE organization_id = $${orgIdIdx} AND id = $${idIdx} RETURNING *
    `, values);

    if (!res) return null;

    const branch = res.branch_id ? await queryOne(`SELECT name FROM branches WHERE organization_id = $1 AND id = $2`, [orgId, res.branch_id]) : null;

    return {
      id: res.id,
      name: res.title,
      date: res.date,
      type: res.type,
      branchId: res.branch_id || 'ALL',
      description: res.description,
      branchName: branch ? branch.name : 'All Branches (Organization-wide)'
    };
  }

  async deleteHoliday(orgId: string, id: string) {
    const res = await queryOne(`DELETE FROM holidays WHERE organization_id = $1 AND id = $2 RETURNING *`, [orgId, id]);
    return res ? { id: res.id, name: res.title } : null;
  }

  async getHolidayById(orgId: string, id: string) {
    return queryOne(`SELECT * FROM holidays WHERE organization_id = $1 AND id = $2`, [orgId, id]);
  }

  // --- ATTENDANCE LOCATIONS ---
  async getAllLocations(orgId: string) {
    const rows = await query(`
      SELECT * FROM attendance_locations 
      WHERE organization_id = $1 AND deleted_at IS NULL
      ORDER BY name ASC
    `, [orgId]);
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      radiusMeters: r.radius_meters,
      isActive: r.is_active,
      branchId: r.branch_id
    }));
  }

  async getLocationById(orgId: string, id: string) {
    return queryOne(`SELECT * FROM attendance_locations WHERE organization_id = $1 AND id = $2 AND deleted_at IS NULL`, [orgId, id]);
  }

  async createLocation(orgId: string, data: any, actorUserId?: string, ipAddress?: string, requestId?: string) {
    const client = await beginTransaction();
    try {
      const r = await client.queryOne(`
        INSERT INTO attendance_locations (organization_id, branch_id, name, latitude, longitude, radius_meters, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [orgId, data.branchId || null, data.name, data.latitude, data.longitude, data.radiusMeters || 200, data.isActive !== false]);

      await logMasterDataChangeTx(client, {
        organizationId: orgId,
        actorUserId: actorUserId || null,
        action: 'CREATE_ATTENDANCE_LOCATION',
        entityType: 'ATTENDANCE_LOCATION',
        entityId: r.id,
        oldValues: null,
        newValues: r,
        ipAddress,
        requestId
      });

      await client.commit();
      return {
        id: r.id,
        name: r.name,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        radiusMeters: r.radius_meters,
        isActive: r.is_active,
        branchId: r.branch_id
      };
    } catch (err) {
      await client.rollback();
      throw err;
    }
  }

  async updateLocation(orgId: string, id: string, data: any, actorUserId?: string, ipAddress?: string, requestId?: string) {
    const client = await beginTransaction();
    try {
      const oldLoc = await client.queryOne(`SELECT * FROM attendance_locations WHERE organization_id = $1 AND id = $2 AND deleted_at IS NULL`, [orgId, id]);
      if (!oldLoc) throw new Error('Location not found');

      const fields = [];
      const values = [];
      let idx = 1;

      if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
      if (data.latitude !== undefined) { fields.push(`latitude = $${idx++}`); values.push(data.latitude); }
      if (data.longitude !== undefined) { fields.push(`longitude = $${idx++}`); values.push(data.longitude); }
      if (data.radiusMeters !== undefined) { fields.push(`radius_meters = $${idx++}`); values.push(data.radiusMeters); }
      if (data.isActive !== undefined) { fields.push(`is_active = $${idx++}`); values.push(data.isActive); }

      values.push(orgId);
      const orgIdIdx = idx++;
      values.push(id);
      const idIdx = idx++;

      const r = await client.queryOne(`
        UPDATE attendance_locations SET ${fields.join(', ')} WHERE organization_id = $${orgIdIdx} AND id = $${idIdx} AND deleted_at IS NULL RETURNING *
      `, values);

      if (!r) throw new Error('Location update failed');

      await logMasterDataChangeTx(client, {
        organizationId: orgId,
        actorUserId: actorUserId || null,
        action: 'UPDATE_ATTENDANCE_LOCATION',
        entityType: 'ATTENDANCE_LOCATION',
        entityId: r.id,
        oldValues: oldLoc,
        newValues: r,
        ipAddress,
        requestId
      });

      await client.commit();
      return {
        id: r.id,
        name: r.name,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        radiusMeters: r.radius_meters,
        isActive: r.is_active,
        branchId: r.branch_id
      };
    } catch (err) {
      await client.rollback();
      throw err;
    }
  }

  async deleteLocation(orgId: string, id: string, actorUserId?: string, ipAddress?: string, requestId?: string) {
    const client = await beginTransaction();
    try {
      const oldLoc = await client.queryOne(`SELECT * FROM attendance_locations WHERE organization_id = $1 AND id = $2 AND deleted_at IS NULL`, [orgId, id]);
      if (!oldLoc) throw new Error('Location not found');

      const r = await client.queryOne(`
        UPDATE attendance_locations SET deleted_at = CURRENT_TIMESTAMP, is_active = false WHERE organization_id = $1 AND id = $2 RETURNING *
      `, [orgId, id]);

      await logMasterDataChangeTx(client, {
        organizationId: orgId,
        actorUserId: actorUserId || null,
        action: 'DELETE_ATTENDANCE_LOCATION',
        entityType: 'ATTENDANCE_LOCATION',
        entityId: id,
        oldValues: oldLoc,
        newValues: r,
        ipAddress,
        requestId
      });

      await client.commit();
      return { id: r.id, name: r.name };
    } catch (err) {
      await client.rollback();
      throw err;
    }
  }

  // --- SHIFTS ---
  async getAllShifts(orgId: string) {
    const rows = await query(`SELECT * FROM shifts WHERE organization_id = $1`, [orgId]);
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      startTime: r.start_time,
      endTime: r.end_time,
      gracePeriodMinutes: r.grace_period_minutes,
      breakDurationMinutes: r.break_duration_minutes,
      workingHours: r.working_hours,
      weekOffs: JSON.parse(r.week_offs || '[]'),
      active: r.active,
      locationId: r.location_id
    }));
  }

  async getShiftById(orgId: string, id: string) {
    const r = await queryOne(`SELECT * FROM shifts WHERE organization_id = $1 AND id = $2`, [orgId, id]);
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      startTime: r.start_time,
      endTime: r.end_time,
      gracePeriodMinutes: r.grace_period_minutes,
      breakDurationMinutes: r.break_duration_minutes,
      workingHours: r.working_hours,
      weekOffs: JSON.parse(r.week_offs || '[]'),
      active: r.active,
      locationId: r.location_id
    };
  }

  async createShift(orgId: string, data: any, actorUserId?: string, ipAddress?: string, requestId?: string) {
    const client = await beginTransaction();
    try {
      const weekOffsStr = JSON.stringify(data.weekOffs || ['SATURDAY', 'SUNDAY']);
      const r = await client.queryOne(`
        INSERT INTO shifts (organization_id, name, start_time, end_time, grace_period_minutes, break_duration_minutes, working_hours, week_offs, active, location_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [orgId, data.name, data.startTime, data.endTime, data.gracePeriodMinutes, data.breakDurationMinutes, data.workingHours, weekOffsStr, data.active, data.locationId || null]);

      await logMasterDataChangeTx(client, {
        organizationId: orgId,
        actorUserId: actorUserId || null,
        action: 'CREATE_SHIFT',
        entityType: 'SHIFT',
        entityId: r.id,
        oldValues: null,
        newValues: r,
        ipAddress,
        requestId
      });

      await client.commit();
      return {
        id: r.id,
        name: r.name,
        startTime: r.start_time,
        endTime: r.end_time,
        gracePeriodMinutes: r.grace_period_minutes,
        breakDurationMinutes: r.break_duration_minutes,
        workingHours: r.working_hours,
        weekOffs: JSON.parse(r.week_offs),
        active: r.active,
        locationId: r.location_id
      };
    } catch (err) {
      await client.rollback();
      throw err;
    }
  }

  async updateShift(orgId: string, id: string, data: any, actorUserId?: string, ipAddress?: string, requestId?: string) {
    const client = await beginTransaction();
    try {
      const oldShift = await client.queryOne(`SELECT * FROM shifts WHERE organization_id = $1 AND id = $2`, [orgId, id]);
      if (!oldShift) throw new Error('Shift not found');

      const fields = [];
      const values = [];
      let idx = 1;

      if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
      if (data.startTime !== undefined) { fields.push(`start_time = $${idx++}`); values.push(data.startTime); }
      if (data.endTime !== undefined) { fields.push(`end_time = $${idx++}`); values.push(data.endTime); }
      if (data.gracePeriodMinutes !== undefined) { fields.push(`grace_period_minutes = $${idx++}`); values.push(data.gracePeriodMinutes); }
      if (data.breakDurationMinutes !== undefined) { fields.push(`break_duration_minutes = $${idx++}`); values.push(data.breakDurationMinutes); }
      if (data.workingHours !== undefined) { fields.push(`working_hours = $${idx++}`); values.push(data.workingHours); }
      if (data.weekOffs !== undefined) { fields.push(`week_offs = $${idx++}`); values.push(JSON.stringify(data.weekOffs)); }
      if (data.active !== undefined) { fields.push(`active = $${idx++}`); values.push(data.active); }
      if (data.locationId !== undefined) { fields.push(`location_id = $${idx++}`); values.push(data.locationId); }

      values.push(orgId);
      const orgIdIdx = idx++;
      values.push(id);
      const idIdx = idx++;

      const r = await client.queryOne(`
        UPDATE shifts SET ${fields.join(', ')} WHERE organization_id = $${orgIdIdx} AND id = $${idIdx} RETURNING *
      `, values);

      if (!r) throw new Error('Shift update failed');

      await logMasterDataChangeTx(client, {
        organizationId: orgId,
        actorUserId: actorUserId || null,
        action: 'UPDATE_SHIFT',
        entityType: 'SHIFT',
        entityId: r.id,
        oldValues: oldShift,
        newValues: r,
        ipAddress,
        requestId
      });

      await client.commit();

      return {
        id: r.id,
        name: r.name,
        startTime: r.start_time,
        endTime: r.end_time,
        gracePeriodMinutes: r.grace_period_minutes,
        breakDurationMinutes: r.break_duration_minutes,
        workingHours: r.working_hours,
        weekOffs: JSON.parse(r.week_offs),
        active: r.active,
        locationId: r.location_id
      };
    } catch (err) {
      await client.rollback();
      throw err;
    }
  }

  async assignShiftSingle(orgId: string, employeeId: string, shiftId: string, reason: string, assignedBy: string, assignedByName: string, actorUserId?: string, ipAddress?: string, requestId?: string) {
    const client = await beginTransaction();
    try {
      const emp = await client.queryOne(`SELECT * FROM employees WHERE organization_id = $1 AND id = $2`, [orgId, employeeId]);
      if (!emp) throw new Error('Employee not found');

      const shift = await client.queryOne(`SELECT * FROM shifts WHERE organization_id = $1 AND id = $2`, [orgId, shiftId]);
      if (!shift) throw new Error('Shift not found');

      await client.queryOne(`UPDATE employees SET shift_id = $1, updated_at = NOW() WHERE organization_id = $2 AND id = $3`, [shiftId, orgId, employeeId]);

      // Manage employee_shifts table (Effective-dated assignments)
      const oldEmpShift = await client.queryOne(`
        SELECT * FROM employee_shifts 
        WHERE employee_id = $1 AND (effective_to IS NULL OR effective_to >= CURRENT_DATE) 
        ORDER BY created_at DESC LIMIT 1
      `, [employeeId]);

      if (oldEmpShift) {
        await client.query(`
          UPDATE employee_shifts SET effective_to = CURRENT_DATE - INTERVAL '1 day' 
          WHERE id = $1
        `, [oldEmpShift.id]);
      }

      const newEmpShift = await client.queryOne(`
        INSERT INTO employee_shifts (employee_id, shift_id, effective_from, effective_to)
        VALUES ($1, $2, CURRENT_DATE, NULL)
        RETURNING *
      `, [employeeId, shiftId]);

      const historyRecord = await client.queryOne(`
        INSERT INTO shift_assignments (organization_id, employee_id, employee_name, employee_code, shift_id, shift_name, assigned_by, assigned_by_name, reason)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [orgId, employeeId, `${emp.first_name} ${emp.last_name}`, emp.employee_code, shiftId, shift.name, assignedBy, assignedByName, reason]);

      await logMasterDataChangeTx(client, {
        organizationId: orgId,
        actorUserId: actorUserId || null,
        action: 'ASSIGN_EMPLOYEE_SHIFT',
        entityType: 'EMPLOYEE_SHIFT',
        entityId: newEmpShift.id,
        oldValues: oldEmpShift || null,
        newValues: newEmpShift,
        ipAddress,
        requestId
      });

      await client.commit();
      
      return { employee: { ...emp, shiftId }, assignment: {
        id: historyRecord.id,
        employeeId: historyRecord.employee_id,
        employeeName: historyRecord.employee_name,
        employeeCode: historyRecord.employee_code,
        shiftId: historyRecord.shift_id,
        shiftName: historyRecord.shift_name,
        assignedBy: historyRecord.assigned_by,
        assignedByName: historyRecord.assigned_by_name,
        assignedAt: historyRecord.assigned_at,
        reason: historyRecord.reason
      }};
    } catch (err) {
      await client.rollback();
      throw err;
    }
  }

  async getEmployeesForBulkAssign(orgId: string, employeeIds: string[], departmentId: string, branchId: string) {
    let sql = 'SELECT * FROM employees WHERE organization_id = $1 AND status = $2 AND deleted_at IS NULL';
    let params: any[] = [orgId, 'ACTIVE'];
    let idx = 3;

    if (employeeIds && employeeIds.length > 0) {
      sql += ` AND id = ANY($${idx++})`;
      params.push(employeeIds);
    } else if (departmentId && departmentId !== 'ALL') {
      sql += ` AND department_id = $${idx++})`;
      params.push(departmentId);
    } else if (branchId && branchId !== 'ALL') {
      sql += ` AND branch_id = $${idx++})`;
      params.push(branchId);
    }

    const rows = await query(sql, params);
    return rows;
  }

  async assignShiftBulk(orgId: string, employees: any[], shift: any, reason: string, assignedBy: string, assignedByName: string, actorUserId?: string, ipAddress?: string, requestId?: string) {
    const client = await beginTransaction();
    try {
      for (const emp of employees) {
        await client.queryOne(`UPDATE employees SET shift_id = $1, updated_at = NOW() WHERE organization_id = $2 AND id = $3`, [shift.id, orgId, emp.id]);
        
        const oldEmpShift = await client.queryOne(`
          SELECT * FROM employee_shifts 
          WHERE employee_id = $1 AND (effective_to IS NULL OR effective_to >= CURRENT_DATE) 
          ORDER BY created_at DESC LIMIT 1
        `, [emp.id]);

        if (oldEmpShift) {
          await client.query(`
            UPDATE employee_shifts SET effective_to = CURRENT_DATE - INTERVAL '1 day' 
            WHERE id = $1
          `, [oldEmpShift.id]);
        }

        const newEmpShift = await client.queryOne(`
          INSERT INTO employee_shifts (employee_id, shift_id, effective_from, effective_to)
          VALUES ($1, $2, CURRENT_DATE, NULL)
          RETURNING *
        `, [emp.id, shift.id]);

        await client.queryOne(`
          INSERT INTO shift_assignments (organization_id, employee_id, employee_name, employee_code, shift_id, shift_name, assigned_by, assigned_by_name, reason)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [orgId, emp.id, `${emp.first_name} ${emp.last_name}`, emp.employee_code, shift.id, shift.name, assignedBy, assignedByName, reason]);

        await logMasterDataChangeTx(client, {
          organizationId: orgId,
          actorUserId: actorUserId || null,
          action: 'BULK_ASSIGN_EMPLOYEE_SHIFT',
          entityType: 'EMPLOYEE_SHIFT',
          entityId: newEmpShift.id,
          oldValues: oldEmpShift || null,
          newValues: newEmpShift,
          ipAddress,
          requestId
        });
      }
      await client.commit();
    } catch (err) {
      await client.rollback();
      throw err;
    }
  }

  async getShiftAssignmentsHistory(orgId: string) {
    const rows = await query(`SELECT * FROM shift_assignments WHERE organization_id = $1 ORDER BY assigned_at DESC`, [orgId]);
    return rows.map(r => ({
      id: r.id,
      employeeId: r.employee_id,
      employeeName: r.employee_name,
      employeeCode: r.employee_code,
      shiftId: r.shift_id,
      shiftName: r.shift_name,
      assignedBy: r.assigned_by,
      assignedByName: r.assigned_by_name,
      assignedAt: r.assigned_at,
      reason: r.reason
    }));
  }
}

export const holidayShiftRepository = new HolidayShiftRepository();
