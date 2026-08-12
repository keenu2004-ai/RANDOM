import { Router, Request, Response, NextFunction } from 'express';
import { query, queryOne } from '../db/client.js';
import { authenticateToken, requireRoles, AuthenticatedRequest } from '../auth';
import { leaveRepository } from '../repositories/leave.repository';

export const leaveManagementRouter = Router();

// Get all Leave Types
leaveManagementRouter.get('/leaves/types', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const types = await leaveRepository.getAllLeaveTypes(req.user!.organizationId);
  return res.json(types);
});

// Create Custom Leave Type (Super Admin, Admin, HR Manager)
leaveManagementRouter.post('/leaves/types', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  const { name, code, annualQuota, carryForwardAllowed, requiresAttachment, description } = req.body;

  if (!name || !code || annualQuota === undefined) {
    return res.status(400).json({ error: 'Leave Name, Code, and Annual Quota are required.' });
  }

  const cleanCode = code.trim().toUpperCase();
  const existingCode = await leaveRepository.getLeaveTypeByCode(req.user!.organizationId, cleanCode);
  if (existingCode) {
    return res.status(400).json({ error: `A leave category with code '${cleanCode}' already exists.` });
  }

  const newLeaveType = await leaveRepository.createLeaveType(req.user!.organizationId, {
    name: name.trim(),
    code: cleanCode,
    annualQuota: Number(annualQuota),
    carryForwardAllowed: Boolean(carryForwardAllowed),
    requiresAttachment: Boolean(requiresAttachment),
    description: description || ''
  });

  return res.status(201).json(newLeaveType);
});

// Get Leave Requests (With Enriched Employee & Leave Type Info)
leaveManagementRouter.get('/leaves', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  let filters: any = {
    status: req.query.status,
    leaveTypeId: req.query.leaveTypeId,
    employeeId: req.query.employeeId,
    departmentId: req.query.departmentId
  };

  if (req.user!.role === 'EMPLOYEE') {
    filters.employeeId = req.user!.employeeId;
  } else if (req.user!.role === 'MANAGER') {
    const teamEmps = await leaveRepository.getTeamEmployees(req.user!.organizationId, req.user!.employeeId!);
    filters.employeeIds = teamEmps.map(e => e.id);
  }

  const enrichedRequests = await leaveRepository.getLeaveRequests(req.user!.organizationId, filters);
  return res.json(enrichedRequests);
});

// Get Leave Balances for an Employee
leaveManagementRouter.get('/leaves/balances', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const empId = (req.query.employeeId as string) || req.user!.employeeId;
  if (!empId) return res.status(400).json({ error: 'Employee ID required' });
  
  if (req.user!.role === 'EMPLOYEE' && empId !== req.user!.employeeId) {
    return res.status(403).json({ error: 'Access Denied: You can only view your own leave balances.' });
  }
  
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  const balances = await leaveRepository.getLeaveBalances(req.user!.organizationId, empId, year);
  return res.json(balances);
});

// Apply For Leave
leaveManagementRouter.post('/leaves/apply', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const empId = req.user!.employeeId;
  if (!empId) {
    return res.status(400).json({ error: 'An active employee profile is required to apply for leave.' });
  }

  const { leaveTypeId, startDate, endDate, isHalfDay, reason, attachmentUrl } = req.body;

  if (!leaveTypeId || !startDate || !endDate || !reason || !reason.trim()) {
    return res.status(400).json({ error: 'Leave Type, Start Date, End Date, and Reason are required.' });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ error: 'Invalid date format provided.' });
  }
  if (end < start) {
    return res.status(400).json({ error: 'End Date cannot be earlier than Start Date.' });
  }

  try {
    const newRequest = await leaveRepository.applyLeave(req.user!.organizationId, {
      employeeId: empId,
      leaveTypeId,
      startDate,
      endDate,
      isHalfDay: !!isHalfDay,
      reason: reason.trim(),
      attachmentUrl,
      year: start.getFullYear()
    });

    return res.status(201).json(newRequest);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Cancel Pending Leave Request
leaveManagementRouter.patch('/leaves/:id/cancel', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const request = await leaveRepository.getLeaveRequestById(req.user!.organizationId, req.params.id);
  if (!request) {
    return res.status(404).json({ error: 'Leave request not found.' });
  }

  const isAdminOrMgr = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(req.user!.role);
  if (!isAdminOrMgr && request.employeeId !== req.user!.employeeId) {
    return res.status(403).json({ error: 'Access Denied: You can only cancel your own leave requests.' });
  }

  if (request.status !== 'PENDING') {
    return res.status(400).json({ error: `Cannot cancel request with status '${request.status}'. Only PENDING requests can be cancelled.` });
  }

  const cancelled = await leaveRepository.cancelLeave(req.user!.organizationId, req.params.id);

  return res.json({ message: 'Leave request cancelled successfully.', request: cancelled });
});

// Approve Leave Request (Manager / HR / Admin)
leaveManagementRouter.patch('/leaves/:id/approve', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  const request = await leaveRepository.getLeaveRequestById(req.user!.organizationId, req.params.id);
  if (!request) return res.status(404).json({ error: 'Leave request not found.' });

  if (req.user!.employeeId === request.employeeId) {
    return res.status(403).json({ error: 'Access Denied: You cannot approve/reject your own leave request.' });
  }

  if (request.status !== 'PENDING') {
    return res.status(400).json({ error: `Leave request has already been ${request.status.toLowerCase()}.` });
  }

  if (req.user!.role === 'MANAGER') {
    const emp = await leaveRepository.getEmployeeById(req.user!.organizationId, request.employeeId);
    if (!emp || (emp.manager_id !== req.user!.employeeId && emp.id !== req.user!.employeeId)) {
      return res.status(403).json({ error: 'Access Denied: You can only approve leave requests for your direct team members.' });
    }
  }

  try {
    const approved = await leaveRepository.approveLeave(req.user!.organizationId, req.params.id, req.user!.employeeId || req.user!.userId, req.body.reviewReason || 'Approved by Manager/HR');
    return res.json(approved);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

// Reject Leave Request (Manager / HR / Admin)
leaveManagementRouter.patch('/leaves/:id/reject', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  const request = await leaveRepository.getLeaveRequestById(req.user!.organizationId, req.params.id);
  if (!request) return res.status(404).json({ error: 'Leave request not found.' });

  if (req.user!.employeeId === request.employeeId) {
    return res.status(403).json({ error: 'Access Denied: You cannot approve/reject your own leave request.' });
  }

  if (request.status !== 'PENDING') {
    return res.status(400).json({ error: `Leave request has already been ${request.status.toLowerCase()}.` });
  }

  if (req.user!.role === 'MANAGER') {
    const emp = await leaveRepository.getEmployeeById(req.user!.organizationId, request.employeeId);
    if (!emp || (emp.manager_id !== req.user!.employeeId && emp.id !== req.user!.employeeId)) {
      return res.status(403).json({ error: 'Access Denied: You can only reject leave requests for your direct team members.' });
    }
  }

  try {
    const rejected = await leaveRepository.rejectLeave(req.user!.organizationId, req.params.id, req.user!.employeeId || req.user!.userId, req.body.reviewReason || req.body.reason || 'Rejected by Manager/HR');
    return res.json(rejected);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

// Leave Calendar API Endpoint
leaveManagementRouter.get('/leaves/calendar', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

  let filters: any = {};
  if (req.user!.role === 'EMPLOYEE') {
    const emp = await leaveRepository.getEmployeeById(req.user!.organizationId, req.user!.employeeId!);
    if (emp) {
      const teamEmps = await query(`SELECT id FROM employees WHERE organization_id = $1 AND (department_id = $2 OR id = $3)`, [req.user!.organizationId, emp.department_id, emp.id]);
      filters.employeeIds = teamEmps.map(e => e.id);
    }
  } else if (req.user!.role === 'MANAGER') {
    const teamEmps = await leaveRepository.getTeamEmployees(req.user!.organizationId, req.user!.employeeId!);
    filters.employeeIds = teamEmps.map(e => e.id);
  }

  let requestsResult = await leaveRepository.getLeaveRequests(req.user!.organizationId, { ...filters, limit: 10000 });
  let requests = requestsResult.data;

  if (req.user!.role === 'EMPLOYEE') {
    requests = requests.filter((r: any) => r.status === 'APPROVED' || r.employeeId === req.user!.employeeId);
  } else {
    requests = requests.filter((r: any) => r.status === 'APPROVED' || r.status === 'PENDING');
  }

  const monthStr = month < 10 ? `0${month}` : `${month}`;
  const monthPrefix = `${year}-${monthStr}`;

  const monthRequests = requests.filter(r => r.startDate.startsWith(monthPrefix) || r.endDate.startsWith(monthPrefix));

  const holidays = await query(`SELECT * FROM holidays WHERE organization_id = $1 AND date LIKE $2`, [req.user!.organizationId, `${monthPrefix}%`]);

  return res.json({
    month,
    year,
    leaves: monthRequests,
    holidays: holidays.map(h => ({ id: h.id, title: h.title, date: h.date, type: h.type }))
  });
});

// Leave Correction Routes
leaveManagementRouter.post('/leaves/corrections', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user!.employeeId) {
      return res.status(400).json({ error: 'Employee ID required.' });
    }
    const result = await leaveRepository.createCorrectionRequest(req.user!.organizationId, req.body, req.user!.employeeId);
    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

leaveManagementRouter.get('/leaves/corrections', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user!.employeeId) {
      return res.status(400).json({ error: 'Employee ID required.' });
    }
    const filters = {
      status: req.query.status,
      limit: req.query.limit,
      page: req.query.page
    };
    const result = await leaveRepository.getCorrectionRequests(req.user!.organizationId, filters, req.user!.role, req.user!.employeeId);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

leaveManagementRouter.patch('/leaves/corrections/:id/approve', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const request = await queryOne(`SELECT * FROM leave_correction_requests WHERE organization_id = $1 AND id = $2`, [req.user!.organizationId, req.params.id]);
    if (!request) return res.status(404).json({ error: 'Correction request not found.' });

    if (req.user!.employeeId === request.employee_id) {
      return res.status(403).json({ error: 'Access Denied: You cannot approve/reject your own request.' });
    }

    if (req.user!.role === 'MANAGER') {
      const emp = await leaveRepository.getEmployeeById(req.user!.organizationId, request.employee_id);
      if (!emp || (emp.manager_id !== req.user!.employeeId && emp.id !== req.user!.employeeId)) {
        return res.status(403).json({ error: 'Access Denied: You can only approve requests for your direct team members.' });
      }
    }

    const result = await leaveRepository.approveCorrectionRequest(req.user!.organizationId, req.params.id, req.user!.employeeId || req.user!.userId);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

leaveManagementRouter.patch('/leaves/corrections/:id/reject', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const request = await queryOne(`SELECT * FROM leave_correction_requests WHERE organization_id = $1 AND id = $2`, [req.user!.organizationId, req.params.id]);
    if (!request) return res.status(404).json({ error: 'Correction request not found.' });

    if (req.user!.employeeId === request.employee_id) {
      return res.status(403).json({ error: 'Access Denied: You cannot approve/reject your own request.' });
    }

    if (req.user!.role === 'MANAGER') {
      const emp = await leaveRepository.getEmployeeById(req.user!.organizationId, request.employee_id);
      if (!emp || (emp.manager_id !== req.user!.employeeId && emp.id !== req.user!.employeeId)) {
        return res.status(403).json({ error: 'Access Denied: You can only reject requests for your direct team members.' });
      }
    }

    const result = await leaveRepository.rejectCorrectionRequest(req.user!.organizationId, req.params.id, req.user!.employeeId || req.user!.userId, req.body.reason || 'Rejected by Manager/HR');
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});
