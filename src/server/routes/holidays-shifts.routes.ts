import { Router, Request, Response, NextFunction } from 'express';
import { query, queryOne } from '../db/client.js';
import { authenticateToken, requireRoles, AuthenticatedRequest } from '../auth';
import { holidayShiftRepository } from '../repositories/holiday-shift.repository';

export const holidaysShiftsRouter = Router();

// GET Holidays (supports branch filter & employee applicability)
holidaysShiftsRouter.get('/holidays', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { branchId, year } = req.query;
  const filters: any = {};
  
  if (year) filters.year = String(year);

  if (req.user!.role === 'EMPLOYEE') {
    const emp = await queryOne(`SELECT branch_id FROM employees WHERE organization_id = $1 AND id = $2`, [req.user!.organizationId, req.user!.employeeId]);
    if (emp) {
      filters.employeeBranchId = emp.branch_id;
    }
  } else if (branchId && branchId !== 'ALL') {
    filters.branchId = String(branchId);
  }

  const holidays = await holidayShiftRepository.getAllHolidays(req.user!.organizationId, filters);

  return res.json(holidays);
});

// Create Holiday
holidaysShiftsRouter.post('/holidays', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  const { name, date, type, branchId, description } = req.body;
  if (!name || !date) {
    return res.status(400).json({ error: 'Holiday Name and Date are required' });
  }

  const newHoliday = await holidayShiftRepository.createHoliday(req.user!.organizationId, { name: name.trim(), date, type: type || 'NATIONAL', branchId, description: description ? description.trim() : '' });

  await query(`
      INSERT INTO audit_logs (organization_id, user_id, user_email, user_role, action, module, details)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.role, 'CREATE', 'HOLIDAY', `Created holiday ${newHoliday.name} on ${newHoliday.date}`]);

  return res.status(201).json(newHoliday);
});

// Update Holiday
holidaysShiftsRouter.put('/holidays/:id', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  const holiday = await holidayShiftRepository.getHolidayById(req.user!.organizationId, req.params.id);
  if (!holiday) {
    return res.status(404).json({ error: 'Holiday not found' });
  }

  const updatedHoliday = await holidayShiftRepository.updateHoliday(req.user!.organizationId, req.params.id, req.body);
  
  await query(`
      INSERT INTO audit_logs (organization_id, user_id, user_email, user_role, action, module, details)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.role, 'UPDATE', 'HOLIDAY', `Updated holiday ${updatedHoliday?.name} on ${updatedHoliday?.date}`]);

  return res.json(updatedHoliday);
});

// Delete Holiday
holidaysShiftsRouter.delete('/holidays/:id', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  const deleted = await holidayShiftRepository.deleteHoliday(req.user!.organizationId, req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Holiday not found' });
  }

  await query(`
      INSERT INTO audit_logs (organization_id, user_id, user_email, user_role, action, module, details)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.role, 'DELETE', 'HOLIDAY', `Deleted holiday ${deleted.name}`]);

  return res.json({ message: 'Holiday deleted successfully', id: req.params.id });
});

// GET Shifts
holidaysShiftsRouter.get('/shifts', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const shifts = await holidayShiftRepository.getAllShifts(req.user!.organizationId);
  return res.json(shifts);
});

// Create Shift
holidaysShiftsRouter.post('/shifts', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  const { name, startTime, endTime, gracePeriodMinutes, breakDurationMinutes, workingHours, weekOffs, active } = req.body;

  if (!name || !startTime || !endTime) {
    return res.status(400).json({ error: 'Shift Name, Start Time, and End Time are required.' });
  }

  const grace = gracePeriodMinutes !== undefined ? Number(gracePeriodMinutes) : 15;
  const breakDur = breakDurationMinutes !== undefined ? Number(breakDurationMinutes) : 60;
  
  // Calculate working hours if not provided
  let calculatedHours = workingHours ? Number(workingHours) : 8.0;
  if (!workingHours && startTime && endTime) {
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    let startTotal = sH * 60 + sM;
    let endTotal = eH * 60 + eM;
    if (endTotal <= startTotal) endTotal += 24 * 60; // overnight shift
    const diffMins = endTotal - startTotal - breakDur;
    calculatedHours = Number(Math.max(0, diffMins / 60).toFixed(1));
  }

  const newShift = await holidayShiftRepository.createShift(req.user!.organizationId, {
    name: name.trim(),
    startTime,
    endTime,
    gracePeriodMinutes: grace,
    breakDurationMinutes: breakDur,
    workingHours: calculatedHours,
    weekOffs: Array.isArray(weekOffs) ? weekOffs : ['SATURDAY', 'SUNDAY'],
    active: active !== false,
  });

  return res.status(201).json(newShift);
});

// Edit Shift
holidaysShiftsRouter.put('/shifts/:id', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  const shift = await holidayShiftRepository.getShiftById(req.user!.organizationId, req.params.id);
  if (!shift) {
    return res.status(404).json({ error: 'Shift not found' });
  }

  const updatedShift = await holidayShiftRepository.updateShift(req.user!.organizationId, req.params.id, req.body);
  return res.json(updatedShift);
});

// Deactivate / Activate Shift
holidaysShiftsRouter.patch('/shifts/:id/status', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  const shift = await holidayShiftRepository.getShiftById(req.user!.organizationId, req.params.id);
  if (!shift) {
    return res.status(404).json({ error: 'Shift not found' });
  }

  const updatedShift = await holidayShiftRepository.updateShift(req.user!.organizationId, req.params.id, { active: Boolean(req.body.active) });
  return res.json(updatedShift);
});

// Single Employee Shift Assignment
holidaysShiftsRouter.post('/shifts/assign', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  const { employeeId, shiftId, reason } = req.body;

  if (!employeeId || !shiftId) {
    return res.status(400).json({ error: 'Employee ID and Shift ID are required.' });
  }

  if (req.user!.role === 'MANAGER') {
    const emp = await queryOne(`SELECT manager_id FROM employees WHERE organization_id = $1 AND id = $2`, [req.user!.organizationId, employeeId]);
    if (!emp || (emp.manager_id !== req.user!.employeeId && employeeId !== req.user!.employeeId)) {
      return res.status(403).json({ error: 'Access Denied: You can only assign shifts to your direct team members.' });
    }
  }

  try {
    const result = await holidayShiftRepository.assignShiftSingle(req.user!.organizationId, employeeId, shiftId, reason || 'Individual Shift Assignment', req.user!.employeeId || req.user!.userId, req.user!.employeeName || 'Admin');
    
    await query(`
        INSERT INTO audit_logs (organization_id, user_id, user_email, user_role, action, module, details)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.role, 'ASSIGN_SHIFT', 'SHIFT', `Assigned shift ${result.assignment.shiftName} to employee ${result.employee.employee_code}`]);

    return res.json({ message: `Shift assigned successfully.`, employee: result.employee, assignment: result.assignment });
  } catch (err: any) {
    return res.status(404).json({ error: err.message });
  }
});

// Bulk Shift Assignment
holidaysShiftsRouter.post('/shifts/bulk-assign', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  const { shiftId, employeeIds, departmentId, branchId, reason } = req.body;

  if (!shiftId) {
    return res.status(400).json({ error: 'Shift ID is required.' });
  }

  const shift = await holidayShiftRepository.getShiftById(req.user!.organizationId, shiftId);
  if (!shift) {
    return res.status(404).json({ error: 'Shift not found.' });
  }

  let targetEmployees = await holidayShiftRepository.getEmployeesForBulkAssign(req.user!.organizationId, employeeIds, departmentId, branchId);

  if (req.user!.role === 'MANAGER') {
    targetEmployees = targetEmployees.filter(e => e.manager_id === req.user!.employeeId || e.id === req.user!.employeeId);
  }

  if (targetEmployees.length === 0) {
    return res.status(400).json({ error: 'No matching employees found for shift assignment.' });
  }

  await holidayShiftRepository.assignShiftBulk(req.user!.organizationId, targetEmployees, shift, reason || 'Bulk Shift Assignment', req.user!.employeeId || req.user!.userId, req.user!.employeeName || 'Admin');

  await query(`
      INSERT INTO audit_logs (organization_id, user_id, user_email, user_role, action, module, details)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.role, 'ASSIGN_SHIFT_BULK', 'SHIFT', `Assigned shift ${shift.name} to ${targetEmployees.length} employees`]);

  return res.json({
    message: `Shift '${shift.name}' successfully assigned to ${targetEmployees.length} employees.`,
    assignedCount: targetEmployees.length
  });
});

// Shift Assignment History
holidaysShiftsRouter.get('/shifts/history', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  let history = await holidayShiftRepository.getShiftAssignmentsHistory(req.user!.organizationId);
  if (req.user!.role === 'EMPLOYEE') {
    history = history.filter(h => h.employeeId === req.user!.employeeId);
  } else if (req.user!.role === 'MANAGER') {
    const team = await query(`SELECT id FROM employees WHERE organization_id = $1 AND (manager_id = $2 OR id = $2)`, [req.user!.organizationId, req.user!.employeeId]);
    const teamIds = team.map(t => t.id);
    history = history.filter(h => teamIds.includes(h.employeeId));
  }
  return res.json(history);
});
