import { query, queryOne, beginTransaction } from '../db/client';
import { notificationService } from '../services/notification.service';
import { logAudit } from '../utils';

function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const dPhi = (lat2 - lat1) * Math.PI / 180;
  const dLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export class AttendanceRepository {
  async getAttendance(organizationId: string, role: string, empId: string, queryParams: any) {
    const page = Number(queryParams.page) || 1;
    const limit = Number(queryParams.limit) || 10;
    const offset = (page - 1) * limit;

    const safeColumns = ['date', 'check_in', 'check_out', 'status', 'work_hours'];
    const sortBy = safeColumns.includes(queryParams.sortBy) ? queryParams.sortBy : 'date';
    const sortOrder = queryParams.sortOrder === 'asc' ? 'asc' : 'desc';

    let sql = `SELECT a.* FROM attendance a JOIN employees e ON a.employee_id = e.id WHERE e.organization_id = $1`;
    let countSql = `SELECT COUNT(*) FROM attendance a JOIN employees e ON a.employee_id = e.id WHERE e.organization_id = $1`;
    let params: any[] = [organizationId];
    let pIdx = 2;

    if (role === 'EMPLOYEE') {
      sql += ` AND a.employee_id = $${pIdx}`;
      countSql += ` AND a.employee_id = $${pIdx}`;
      params.push(empId);
      pIdx++;
    } else if (role === 'MANAGER') {
      if (queryParams.employeeId) {
        sql += ` AND a.employee_id = $${pIdx} AND e.manager_id = $${pIdx + 1}`;
        countSql += ` AND a.employee_id = $${pIdx} AND e.manager_id = $${pIdx + 1}`;
        params.push(queryParams.employeeId, empId);
        pIdx += 2;
      } else {
        sql += ` AND (e.manager_id = $${pIdx} OR a.employee_id = $${pIdx})`;
        countSql += ` AND (e.manager_id = $${pIdx} OR a.employee_id = $${pIdx})`;
        params.push(empId);
        pIdx++;
      }
    } else if (queryParams.employeeId) {
      sql += ` AND a.employee_id = $${pIdx}`;
      countSql += ` AND a.employee_id = $${pIdx}`;
      params.push(queryParams.employeeId);
      pIdx++;
    }

    if (queryParams.date) { sql += ` AND a.date = $${pIdx}`; countSql += ` AND a.date = $${pIdx}`; params.push(queryParams.date); pIdx++; }
    if (queryParams.startDate) { sql += ` AND a.date >= $${pIdx}`; countSql += ` AND a.date >= $${pIdx}`; params.push(queryParams.startDate); pIdx++; }
    if (queryParams.endDate) { sql += ` AND a.date <= $${pIdx}`; countSql += ` AND a.date <= $${pIdx}`; params.push(queryParams.endDate); pIdx++; }
    if (queryParams.status) { sql += ` AND a.status = $${pIdx}`; countSql += ` AND a.status = $${pIdx}`; params.push(queryParams.status); pIdx++; }

    sql += ` ORDER BY a.${sortBy} ${sortOrder} LIMIT $${pIdx++} OFFSET $${pIdx++}`;
    const limitParams = [...params, limit, offset];

    const data = await query(sql, limitParams);
    const countRes = await queryOne<{ count: string }>(countSql, params);
    const total = countRes ? parseInt(countRes.count, 10) : 0;

    return {
      data: data.map((r: any) => ({
        id: r.id, employeeId: r.employee_id, date: r.date, checkInTime: r.check_in, checkOutTime: r.check_out,
        status: r.status, workingHours: r.work_hours, checkInAddress: r.check_in_location
      })),
      total,
      page,
      limit
    };
  }

  async getAttendanceRecordForToday(organizationId: string, empId: string) {
    const res = await queryOne<any>(`
      SELECT a.* FROM attendance a 
      JOIN employees e ON a.employee_id = e.id 
      WHERE e.organization_id = $1 AND a.employee_id = $2 AND a.date = CURRENT_DATE
    `, [organizationId, empId]);
    return res ? { id: res.id, date: res.date, checkInTime: res.check_in, checkOutTime: res.check_out, status: res.status } : null;
  }

  async getShift(empId: string) {
    const res = await queryOne<any>(`
      SELECT s.* FROM shifts s
      JOIN employees e ON e.shift_id = s.id
      WHERE e.id = $1
    `, [empId]);
    if (res) {
      return { id: res.id, name: res.name, startTime: res.start_time, endTime: res.end_time, gracePeriodMinutes: res.grace_period_minutes };
    }
    return null;
  }

  async getStats(date: string) {
    return { date, totalEmployees: 1, present: 1, late: 0, absent: 0, onLeave: 0, halfDay: 0, weekOff: 0, avgWorkingHours: 0 };
  }

  async createAttendance(organizationId: string, att: any, userId: string, userEmail: string, userRole: string) {
    const client = await beginTransaction();
    try {
      const serverTimeRes = await client.query('SELECT CURRENT_TIMESTAMP as now, CURRENT_DATE as date');
      const now = serverTimeRes[0].now;
      const date = serverTimeRes[0].date;

      const dupRes = await client.query('SELECT id FROM attendance WHERE employee_id = $1 AND date = $2', [att.employeeId, date]);
      if (dupRes.length > 0) throw new Error('Duplicate check-in');

      if (att.accuracy > 500) throw new Error('GPS accuracy is too low (>500m)');

      const empRes = await client.query(`
          SELECT e.branch_id, bl.latitude, bl.longitude, bl.radius_meters 
          FROM employees e 
          LEFT JOIN attendance_locations bl ON e.branch_id = bl.branch_id
          WHERE e.id = $1 AND e.organization_id = $2
      `, [att.employeeId, organizationId]);

      if (empRes.length === 0) throw new Error('Employee not found');
      const emp = empRes[0];

      if (emp.latitude != null && emp.longitude != null) {
        const dist = getHaversineDistance(att.latitude, att.longitude, parseFloat(emp.latitude), parseFloat(emp.longitude));
        const radius = emp.radius_meters || 200;
        if (dist > radius) {
          throw new Error('Geofence error: Outside of allowed branch radius');
        }
      }

      let status = 'PRESENT';
      const shift = await this.getShift(att.employeeId);
      if (shift && shift.startTime) {
        const checkInDate = new Date(now);
        const [hours, minutes] = shift.startTime.split(':').map(Number);
        const shiftStart = new Date(now);
        shiftStart.setHours(hours, minutes, 0, 0);
        const graceMs = (shift.gracePeriodMinutes || 0) * 60 * 1000;

        if (checkInDate.getTime() > shiftStart.getTime() + graceMs) {
          status = 'LATE';
        }
      }

      const insRes = await client.query(`
          INSERT INTO attendance 
          (employee_id, date, check_in, check_in_location, check_in_latitude, check_in_longitude, check_in_accuracy, status) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
      `, [att.employeeId, date, now, att.address, att.latitude, att.longitude, att.accuracy, status]);

      await client.query(`
          INSERT INTO audit_logs (organization_id, user_id, user_email, user_role, action, module, details)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [organizationId, userId, userEmail, userRole, 'CHECK_IN', 'ATTENDANCE', `Checked in at ${now}`]);

      await client.commit();
      return insRes[0];
    } catch (e) {
      await client.rollback();
      throw e;
    }
  }

  async updateCheckOut(organizationId: string, id: string, data: any, userId: string, userEmail: string, userRole: string) {
    const client = await beginTransaction();
    try {
      const serverTimeRes = await client.query('SELECT CURRENT_TIMESTAMP as now, CURRENT_DATE as date');
      const now = serverTimeRes[0].now;

      if (data.accuracy > 500) throw new Error('GPS accuracy is too low (>500m)');

      const attRes = await client.query(`SELECT employee_id, check_in FROM attendance WHERE id = $1`, [id]);
      if (attRes.length === 0) throw new Error('Attendance record not found');
      const empId = attRes[0].employee_id;
      const checkInTime = new Date(attRes[0].check_in).getTime();
      const checkOutTime = new Date(now).getTime();

      const workHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);

      // calculate status based on shift (if late)
      let status = 'PRESENT';
      const shiftRes = await client.query(`
        SELECT s.start_time, s.grace_period_minutes 
        FROM shifts s JOIN employees e ON e.shift_id = s.id 
        WHERE e.id = $1
      `, [empId]);

      if (shiftRes.length > 0) {
        const shift = shiftRes[0];
        if (shift.start_time) {
          const checkInDate = new Date(attRes[0].check_in);
          const [hours, minutes] = shift.start_time.split(':').map(Number);
          const shiftStart = new Date(checkInDate);
          shiftStart.setHours(hours, minutes, 0, 0);
          const graceMs = (shift.grace_period_minutes || 0) * 60 * 1000;

          if (checkInTime > shiftStart.getTime() + graceMs) {
            status = 'LATE';
          }
        }
      }

      const updRes = await client.query(`
        UPDATE attendance 
        SET check_out = $1, check_out_location = $2, check_out_latitude = $3, check_out_longitude = $4, check_out_accuracy = $5, work_hours = $6, status = $7
        WHERE id = $8
        RETURNING *
      `, [now, data.address, data.latitude, data.longitude, data.accuracy, workHours.toFixed(2), status, id]);

      await client.query(`
          INSERT INTO audit_logs (organization_id, user_id, user_email, user_role, action, module, details)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [organizationId, userId, userEmail, userRole, 'CHECK_OUT', 'ATTENDANCE', `Checked out at ${now} with ${workHours.toFixed(2)} hours, status: ${status}`]);

      await client.commit();
      return updRes[0];
    } catch (e) {
      await client.rollback();
      throw e;
    }
  }

  async getSettings(organizationId: string) {
    const r = await queryOne<any>(`SELECT * FROM organizations WHERE id = $1`, [organizationId]);
    if (!r) return { officeLatitude: 28.6209, officeLongitude: 77.1363, allowedGeofenceRadiusMeters: 500, enforceGpsCheckIn: true, defaultShift: { startTime: '09:00', endTime: '18:00', gracePeriodMinutes: 15 } };

    return {
      officeLatitude: Number(r.office_latitude) || 28.6209,
      officeLongitude: Number(r.office_longitude) || 77.1363,
      allowedGeofenceRadiusMeters: Number(r.allowed_geofence_radius_meters) || 500,
      enforceGpsCheckIn: r.enforce_gps_check_in ?? true,
      defaultShift: {
        startTime: r.shift_start_time || '09:00',
        endTime: r.shift_end_time || '18:00',
        gracePeriodMinutes: Number(r.grace_period_minutes) || 15
      }
    };
  }

  async updateSettings(organizationId: string, settings: any) {
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (settings.officeLatitude !== undefined) { updates.push(`office_latitude = $${idx++}`); values.push(settings.officeLatitude); }
    if (settings.officeLongitude !== undefined) { updates.push(`office_longitude = $${idx++}`); values.push(settings.officeLongitude); }
    if (settings.allowedGeofenceRadiusMeters !== undefined) { updates.push(`allowed_geofence_radius_meters = $${idx++}`); values.push(settings.allowedGeofenceRadiusMeters); }
    if (settings.enforceGpsCheckIn !== undefined) { updates.push(`enforce_gps_check_in = $${idx++}`); values.push(settings.enforceGpsCheckIn); }
    if (settings.shiftStartTime !== undefined) { updates.push(`shift_start_time = $${idx++}`); values.push(settings.shiftStartTime); }
    if (settings.shiftEndTime !== undefined) { updates.push(`shift_end_time = $${idx++}`); values.push(settings.shiftEndTime); }
    if (settings.gracePeriodMinutes !== undefined) { updates.push(`grace_period_minutes = $${idx++}`); values.push(settings.gracePeriodMinutes); }

    if (updates.length > 0) {
      values.push(organizationId);
      await query(`UPDATE organizations SET ${updates.join(', ')} WHERE id = $${idx}`, values);
    }

    return this.getSettings(organizationId);
  }

  // Phase 14: Regularization Requests
  async createRegularizationRequest(organizationId: string, payload: any, reqEmpId: string) {
    const { attendanceId, date, requestedStatus, checkInTime, checkOutTime, reason } = payload;
    const res = await queryOne<any>(`
      INSERT INTO attendance_regularization_requests
      (organization_id, employee_id, attendance_id, date, requested_status, check_in_time, check_out_time, reason, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING')
      RETURNING *
    `, [
      organizationId, reqEmpId, attendanceId || null, date, requestedStatus,
      checkInTime || null, checkOutTime || null, reason
    ]);

    // notify manager
    await notificationService.notifyManager(organizationId, reqEmpId, {
      notificationType: 'ATTENDANCE_REGULARIZATION_REQUEST',
      entityType: 'ATTENDANCE_REGULARIZATION',
      entityId: res.id,
      title: 'New Attendance Regularization Request',
      message: `You have a new attendance regularization request for ${date}.`
    });

    return res;
  }

  async getRegularizationRequests(organizationId: string, filters: any, role: string, reqEmpId: string) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT r.*, e.first_name, e.last_name, e.employee_code, r2.first_name as reviewer_first_name, r2.last_name as reviewer_last_name
      FROM attendance_regularization_requests r
      JOIN employees e ON r.employee_id = e.id
      LEFT JOIN employees r2 ON r.reviewed_by = r2.id
      WHERE r.organization_id = $1
    `;
    let countSql = `
      SELECT COUNT(*) 
      FROM attendance_regularization_requests r
      JOIN employees e ON r.employee_id = e.id
      WHERE r.organization_id = $1
    `;
    let params: any[] = [organizationId];
    let pIdx = 2;

    if (role === 'EMPLOYEE') {
      sql += ` AND r.employee_id = $${pIdx}`;
      countSql += ` AND r.employee_id = $${pIdx}`;
      params.push(reqEmpId);
      pIdx++;
    } else if (role === 'MANAGER') {
      sql += ` AND (e.manager_id = $${pIdx} OR r.employee_id = $${pIdx})`;
      countSql += ` AND (e.manager_id = $${pIdx} OR r.employee_id = $${pIdx})`;
      params.push(reqEmpId);
      pIdx++;
    }

    if (filters.status && filters.status !== 'ALL') {
      sql += ` AND r.status = $${pIdx}`;
      countSql += ` AND r.status = $${pIdx}`;
      params.push(filters.status);
      pIdx++;
    }

    if (filters.employeeId && filters.employeeId !== 'ALL' && role !== 'EMPLOYEE') {
      sql += ` AND r.employee_id = $${pIdx}`;
      countSql += ` AND r.employee_id = $${pIdx}`;
      params.push(filters.employeeId);
      pIdx++;
    }

    sql += ` ORDER BY r.created_at DESC LIMIT $${pIdx++} OFFSET $${pIdx++}`;
    const limitParams = [...params, limit, offset];

    const data = await query(sql, limitParams);
    const countRes = await queryOne<{ count: string }>(countSql, params);
    const total = countRes ? parseInt(countRes.count, 10) : 0;

    return {
      data: data.map((r: any) => ({
        id: r.id,
        organizationId: r.organization_id,
        employeeId: r.employee_id,
        attendanceId: r.attendance_id,
        date: r.date,
        requestedStatus: r.requested_status,
        checkInTime: r.check_in_time,
        checkOutTime: r.check_out_time,
        reason: r.reason,
        status: r.status,
        reviewedBy: r.reviewed_by,
        reviewReason: r.review_reason,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        employeeName: `${r.first_name} ${r.last_name}`,
        employeeCode: r.employee_code,
        reviewedByName: r.reviewer_first_name ? `${r.reviewer_first_name} ${r.reviewer_last_name}` : undefined
      })),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    };
  }

  async approveRegularizationRequest(organizationId: string, reqId: string, reviewerEmpId: string, reviewerRole: string) {
    const client = await beginTransaction();
    try {
      // BEGIN; SELECT FOR UPDATE on request
      const reqRes = await client.query(`
        SELECT * FROM attendance_regularization_requests 
        WHERE id = $1 FOR UPDATE
      `, [reqId]);

      if (reqRes.length === 0) throw new Error('Request not found');
      const request = reqRes[0];

      if (request.organization_id !== organizationId) throw new Error('Cross-org isolation violation: organizations do not match');
      if (request.employee_id === reviewerEmpId) throw new Error('Cannot self-approve regularization requests');

      if (reviewerRole === 'MANAGER') {
        const empRes = await client.query(`SELECT manager_id FROM employees WHERE id = $1`, [request.employee_id]);
        if (empRes.length === 0 || empRes[0].manager_id !== reviewerEmpId) {
          throw new Error('You are not authorized to approve this request: Manager can only approve direct subordinates');
        }
      }

      if (request.status !== 'PENDING') throw new Error('Request is not in PENDING state');

      // Process Attendance Record
      if (request.attendance_id) {
        const attRes = await client.query(`
          SELECT * FROM attendance WHERE id = $1 FOR UPDATE
        `, [request.attendance_id]);

        if (attRes.length > 0) {
          const checkIn = request.check_in_time || attRes[0].check_in;
          const checkOut = request.check_out_time || attRes[0].check_out;

          let workHours = attRes[0].work_hours;
          if (checkIn && checkOut) {
            const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
            workHours = Math.max(0, ms / (1000 * 60 * 60)).toFixed(2);
          }

          await client.query(`
            UPDATE attendance 
            SET check_in = $1, check_out = $2, status = $3, work_hours = $4, notes = CONCAT(notes, ' [Source: REGULARIZATION]')
            WHERE id = $5
          `, [checkIn, checkOut, request.requested_status, workHours, request.attendance_id]);
        }
      } else {
        // No existing attendance record, create one
        let workHours = 0;
        if (request.check_in_time && request.check_out_time) {
          const ms = new Date(request.check_out_time).getTime() - new Date(request.check_in_time).getTime();
          workHours = Math.max(0, ms / (1000 * 60 * 60));
        }
        await client.query(`
          INSERT INTO attendance (employee_id, date, check_in, check_out, status, work_hours, notes)
          VALUES ($1, $2, $3, $4, $5, $6, '[Source: REGULARIZATION]')
        `, [request.employee_id, request.date, request.check_in_time, request.check_out_time, request.requested_status, workHours.toFixed(2)]);
      }

      const updReq = await client.query(`
        UPDATE attendance_regularization_requests
        SET status = 'APPROVED', reviewed_by = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [reviewerEmpId, reqId]);

      // fetch reviewer user details for audit
      const reviewerRes = await client.query(`SELECT u.id, u.email, e.first_name FROM employees e JOIN users u ON u.id = e.user_id WHERE e.id = $1`, [reviewerEmpId]);

      const revId = reviewerRes.length > 0 ? reviewerRes[0].id : 'system';
      const revEmail = reviewerRes.length > 0 ? reviewerRes[0].email : 'system@domain.com';
      const revName = reviewerRes.length > 0 ? reviewerRes[0].first_name : 'System';

      let auditDetails = `Approved request ${reqId}`;
      if (request.attendance_id) {
        // Find old values from earlier fetch
        const oldAttRes = await client.query(`SELECT check_in, check_out FROM attendance WHERE id = $1`, [request.attendance_id]);
        if (oldAttRes.length > 0) {
          auditDetails += `. Old CheckIn: ${oldAttRes[0].check_in}, Old CheckOut: ${oldAttRes[0].check_out}`;
        }
      }

      await client.query(`
          INSERT INTO audit_logs (organization_id, user_id, user_email, action, module, details)
          VALUES ($1, $2, $3, $4, $5, $6)
      `, [organizationId, revId, revEmail, 'APPROVE_REGULARIZATION', 'ATTENDANCE', auditDetails]);

      await client.commit();

      await notificationService.createNotification({
        organizationId,
        recipientEmployeeId: request.employee_id,
        notificationType: 'REGULARIZATION_APPROVED',
        title: 'Attendance Regularization Approved',
        message: `Your regularization request for ${request.date} was approved.`,
        entityType: 'ATTENDANCE_REGULARIZATION',
        entityId: reqId
      });

      return updReq[0];
    } catch (e) {
      await client.rollback();
      throw e;
    }
  }

  async rejectRegularizationRequest(organizationId: string, reqId: string, reviewerEmpId: string, reviewerRole: string, reason: string) {
    const client = await beginTransaction();
    try {
      const reqRes = await client.query(`
        SELECT * FROM attendance_regularization_requests 
        WHERE id = $1 FOR UPDATE
      `, [reqId]);

      if (reqRes.length === 0) throw new Error('Request not found');
      const request = reqRes[0];

      if (request.organization_id !== organizationId) throw new Error('Cross-org isolation violation: organizations do not match');
      if (request.employee_id === reviewerEmpId) throw new Error('Cannot self-reject regularization requests');

      if (reviewerRole === 'MANAGER') {
        const empRes = await client.query(`SELECT manager_id FROM employees WHERE id = $1`, [request.employee_id]);
        if (empRes.length === 0 || empRes[0].manager_id !== reviewerEmpId) {
          throw new Error('You are not authorized to reject this request: Manager can only reject direct subordinates');
        }
      }

      if (request.status !== 'PENDING') throw new Error('Request is not in PENDING state');

      const updReq = await client.query(`
        UPDATE attendance_regularization_requests
        SET status = 'REJECTED', reviewed_by = $1, review_reason = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `, [reviewerEmpId, reason, reqId]);

      const reviewerRes = await client.query(`SELECT u.id, u.email, e.first_name FROM employees e JOIN users u ON u.id = e.user_id WHERE e.id = $1`, [reviewerEmpId]);

      const revId = reviewerRes.length > 0 ? reviewerRes[0].id : 'system';
      const revEmail = reviewerRes.length > 0 ? reviewerRes[0].email : 'system@domain.com';

      await client.query(`
          INSERT INTO audit_logs (organization_id, user_id, user_email, action, module, details)
          VALUES ($1, $2, $3, $4, $5, $6)
      `, [organizationId, revId, revEmail, 'REJECT_REGULARIZATION', 'ATTENDANCE', `Rejected request ${reqId} with reason: ${reason}`]);

      await client.commit();

      await notificationService.createNotification({
        organizationId,
        recipientEmployeeId: reqRes[0].employee_id,
        notificationType: 'REGULARIZATION_REJECTED',
        title: 'Attendance Regularization Rejected',
        message: `Your regularization request for ${reqRes[0].date} was rejected. Reason: ${reason}`,
        entityType: 'ATTENDANCE_REGULARIZATION',
        entityId: reqId
      });

      return updReq[0];
    } catch (e) {
      await client.rollback();
      throw e;
    }
  }
}
export const attendanceRepository = new AttendanceRepository();
