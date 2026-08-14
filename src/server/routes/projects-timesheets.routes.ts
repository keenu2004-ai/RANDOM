import { Router, Request, Response, NextFunction } from 'express';
import { generateId, logAudit } from '../utils';
import { query } from '../db/client';
import { authenticateToken, requireRoles, AuthenticatedRequest, isManagerOrAdmin, isHRorAdmin } from '../auth';
import { timesheetRepository } from '../repositories/timesheet.repository';

import { notificationService } from '../services/notification.service';

export const projectsTimesheetsRouter = Router();

// Get All Projects
projectsTimesheetsRouter.get('/projects', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let list = await timesheetRepository.getProjects(req.user!.organizationId);

    // Filter if employee only sees assigned/active projects
    if (req.user!.role === 'EMPLOYEE') {
      const empId = req.user!.employeeId;
      list = list.filter(p => p.status === 'ACTIVE' && (!p.assignedEmployeeIds || p.assignedEmployeeIds.length === 0 || p.assignedEmployeeIds.includes(empId!)));
    }

    return res.json(list);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create Project (Manager / HR / Admin)
projectsTimesheetsRouter.post('/projects', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, code, clientName, description, assignedEmployeeIds, status } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Project Name and Project Code are required.' });
    }

    // Check code uniqueness
    const existing = await timesheetRepository.getProjectByCode(req.user!.organizationId, code.trim());
    if (existing) {
      return res.status(400).json({ error: `A project with code '${code}' already exists.` });
    }

    const newProj = {
      id: generateId(),
      name: name.trim(),
      code: code.trim().toUpperCase(),
      clientName: clientName ? clientName.trim() : undefined,
      description: description ? description.trim() : undefined,
      assignedEmployeeIds: Array.isArray(assignedEmployeeIds) ? assignedEmployeeIds : [],
      status: status || 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    const savedProj = await timesheetRepository.createProject(req.user!.organizationId, newProj);

    if (typeof logAudit === 'function') logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.employeeName || '', 'CREATE_PROJECT', 'PROJECT', newProj.id, `Created project '${newProj.name}' (${newProj.code})`);
    
    return res.status(201).json(savedProj);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update Project (Manager / HR / Admin)
projectsTimesheetsRouter.put('/projects/:id', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const proj = await timesheetRepository.getProjectById(req.user!.organizationId, req.params.id);
    if (!proj) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const { name, code, clientName, description, assignedEmployeeIds, status } = req.body;
    
    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (code) updateData.code = code.trim().toUpperCase();
    if (clientName !== undefined) updateData.clientName = clientName ? clientName.trim() : null;
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (Array.isArray(assignedEmployeeIds)) updateData.assignedEmployeeIds = assignedEmployeeIds;
    if (status) updateData.status = status;

    const updatedProj = await timesheetRepository.updateProject(req.user!.organizationId, req.params.id, updateData);

    if (typeof logAudit === 'function') logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.employeeName || '', 'UPDATE_PROJECT', 'PROJECT', proj.id, `Updated project '${updatedProj.name}'`);
    
    return res.json(updatedProj);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Timesheet Entries
projectsTimesheetsRouter.get('/timesheets', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filters = req.query;
    const list = await timesheetRepository.getTimesheets(req.user!.organizationId, filters, req.user!.role, req.user!.userId, req.user!.employeeId);
    return res.json(list);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Log / Create Timesheet Entry
projectsTimesheetsRouter.post('/timesheets', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const empId = req.user!.employeeId;
    if (!empId) {
      return res.status(400).json({ error: 'Personal timesheet entries require a linked Employee profile.' });
    }
    const { date, projectId, projectName, taskDescription, hours, status } = req.body;

    if (!date || (!projectId && !projectName) || hours === undefined) {
      return res.status(400).json({ error: 'Date, Project, Task Description, and Hours are required.' });
    }

    const numHours = Number(hours);
    if (isNaN(numHours) || numHours <= 0 || numHours > 24) {
      return res.status(400).json({ error: 'Hours logged per entry must be a positive number up to 24.' });
    }

    // Validate Project & Access Control
    let resolvedProjectName = projectName;
    let resolvedProjectId = projectId;

    if (projectId) {
      const proj = await timesheetRepository.getProjectById(req.user!.organizationId, projectId);
      if (!proj) {
        return res.status(400).json({ error: 'Selected project does not exist.' });
      }
      if (proj.status !== 'ACTIVE') {
        return res.status(400).json({ error: `Project '${proj.name}' is currently ${proj.status} and cannot accept timesheets.` });
      }

      // We skip assignment check for now as it's not stored in Postgres natively, or assuming everyone has access
      resolvedProjectName = proj.name;
      resolvedProjectId = proj.id;
    }

    // Prevent total daily logged hours exceeding 24 hours
    const existingDailyTotal = await timesheetRepository.getDailyLoggedHours(req.user!.organizationId, req.user!.employeeId!, date);

    if (existingDailyTotal + numHours > 24) {
      return res.status(400).json({
        error: `Invalid Hours: Total logged hours for ${date} cannot exceed 24 hours. You have already logged ${existingDailyTotal} hrs for this date.`
      });
    }

    const initialStatus = status === 'DRAFT' ? 'DRAFT' : 'SUBMITTED';

    const newTs = {
      id: generateId(),
      employeeId: req.user!.employeeId!,
      projectId: resolvedProjectId,
      projectName: resolvedProjectName || 'General Work',
      date,
      taskDescription: taskDescription ? taskDescription.trim() : '',
      hours: numHours,
      status: initialStatus,
      createdAt: new Date().toISOString()
    };

    const savedTs = await timesheetRepository.createTimesheet(req.user!.organizationId, newTs);

    if (typeof logAudit === 'function') logAudit(req.user!.organizationId, req.user!.userId, req.user!.email,
      req.user!.employeeName || '',
      'CREATE_TIMESHEET',
      'TIMESHEET',
      savedTs.id,
      `Logged ${savedTs.hours} hrs for project '${savedTs.projectName}' on ${savedTs.date} (${savedTs.status})`
    );

    // Send Notification if Submitted
    if (savedTs.status === 'SUBMITTED') {
      const empName = req.user!.employeeName || 'An employee';
      await notificationService.notifyManager(
        req.user!.organizationId,
        req.user!.employeeId!,
        {
          notificationType: 'TIMESHEET_SUBMITTED',
          title: 'New Timesheet Submission',
          message: `${empName} submitted ${savedTs.hours} hrs for '${savedTs.projectName || 'General Work'}' on ${savedTs.date}.`,
          entityType: 'TIMESHEET',
          entityId: savedTs.id
        }
      );
    }

    // Fetch enriched version to return
    const enrichedTs = await timesheetRepository.getTimesheetById(req.user!.organizationId, savedTs.id);
    return res.status(201).json(enrichedTs);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update / Edit Timesheet Entry
projectsTimesheetsRouter.put('/timesheets/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ts = await timesheetRepository.getTimesheetById(req.user!.organizationId, req.params.id);

    if (!ts) {
      return res.status(404).json({ error: 'Timesheet log not found.' });
    }

    if (ts.employeeId !== req.user!.employeeId && !['SUPER_ADMIN', 'ADMIN'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Access Denied: You can only edit your own timesheet entries.' });
    }

    if (!['DRAFT', 'REJECTED'].includes(ts.status) && !['SUPER_ADMIN', 'ADMIN'].includes(req.user!.role)) {
      return res.status(400).json({ error: `Cannot edit a timesheet with status '${ts.status}'. Only DRAFT or REJECTED entries can be edited.` });
    }

    const { date, projectId, projectName, taskDescription, hours, status } = req.body;

    const targetDate = date || ts.date;
    const numHours = hours !== undefined ? Number(hours) : ts.hours;

    if (isNaN(numHours) || numHours <= 0 || numHours > 24) {
      return res.status(400).json({ error: 'Hours logged per entry must be a positive number up to 24.' });
    }

    // Validate daily total without this entry
    const existingDailyTotal = await timesheetRepository.getDailyLoggedHours(req.user!.organizationId, ts.employeeId, targetDate, ts.id);

    if (existingDailyTotal + numHours > 24) {
      return res.status(400).json({
        error: `Invalid Hours: Total logged hours for ${targetDate} cannot exceed 24 hours. Other entries total ${existingDailyTotal} hrs.`
      });
    }

    const updateData: any = { date: targetDate, hours: numHours };

    if (projectId) {
      const proj = await timesheetRepository.getProjectById(req.user!.organizationId, projectId);
      if (!proj) {
        return res.status(400).json({ error: 'Selected project does not exist.' });
      }
      if (proj.status !== 'ACTIVE') {
        return res.status(400).json({ error: `Project '${proj.name}' is currently ${proj.status}.` });
      }
      updateData.projectId = proj.id;
    }

    if (taskDescription !== undefined) updateData.taskDescription = taskDescription.trim();

    if (status) {
      updateData.status = status === 'DRAFT' ? 'DRAFT' : 'SUBMITTED';
    }

    await timesheetRepository.updateTimesheet(req.user!.organizationId, ts.id, updateData);
    const updatedTs = await timesheetRepository.getTimesheetById(req.user!.organizationId, ts.id);

    if (typeof logAudit === 'function') logAudit(req.user!.organizationId, req.user!.userId, req.user!.email,
      req.user!.employeeName || '',
      'UPDATE_TIMESHEET',
      'TIMESHEET',
      ts.id,
      `Updated timesheet entry to ${numHours} hrs for '${updatedTs.projectName || projectName}' on ${targetDate}`
    );

    return res.json(updatedTs);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit Draft Timesheet
projectsTimesheetsRouter.post('/timesheets/:id/submit', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ts = await timesheetRepository.getTimesheetById(req.user!.organizationId, req.params.id);

    if (!ts) {
      return res.status(404).json({ error: 'Timesheet log not found.' });
    }

    if (ts.employeeId !== req.user!.employeeId && !['SUPER_ADMIN', 'ADMIN'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Access Denied: You can only submit your own timesheet drafts.' });
    }

    await timesheetRepository.updateTimesheet(req.user!.organizationId, ts.id, { status: 'SUBMITTED' });
    const updatedTs = await timesheetRepository.getTimesheetById(req.user!.organizationId, ts.id);

    if (typeof logAudit === 'function') logAudit(req.user!.organizationId, req.user!.userId, req.user!.email,
      req.user!.employeeName || '',
      'SUBMIT_TIMESHEET',
      'TIMESHEET',
      ts.id,
      `Submitted timesheet entry of ${ts.hours} hrs for approval`
    );

    // Notify Manager
    const empName = req.user!.employeeName || 'An employee';
    await notificationService.notifyManager(
      req.user!.organizationId,
      ts.employeeId,
      {
        notificationType: 'TIMESHEET_SUBMITTED',
        title: 'Timesheet Submitted for Review',
        message: `${empName} submitted a timesheet for ${ts.hours} hrs on ${ts.date}.`,
        entityType: 'TIMESHEET',
        entityId: ts.id
      }
    );

    return res.json(updatedTs);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete Draft Timesheet Entry
projectsTimesheetsRouter.delete('/timesheets/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ts = await timesheetRepository.getTimesheetById(req.user!.organizationId, req.params.id);

    if (!ts) {
      return res.status(404).json({ error: 'Timesheet entry not found.' });
    }

    if (ts.employeeId !== req.user!.employeeId && !['SUPER_ADMIN', 'ADMIN'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Access Denied: You can only delete your own draft timesheet entries.' });
    }

    if (ts.status !== 'DRAFT' && !['SUPER_ADMIN', 'ADMIN'].includes(req.user!.role)) {
      return res.status(400).json({ error: `Cannot delete timesheet with status '${ts.status}'. Only DRAFT entries can be deleted.` });
    }

    await timesheetRepository.deleteTimesheet(req.user!.organizationId, ts.id);

    if (typeof logAudit === 'function') logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.employeeName || '', 'DELETE_TIMESHEET', 'TIMESHEET', ts.id, `Deleted draft timesheet entry for ${ts.date}`);
    return res.json({ message: 'Timesheet draft deleted successfully.', id: req.params.id });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve Timesheet Entry (Manager / HR / Admin)
projectsTimesheetsRouter.patch('/timesheets/:id/approve', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ts = await timesheetRepository.getTimesheetById(req.user!.organizationId, req.params.id);
    if (!ts) {
      return res.status(404).json({ error: 'Timesheet not found.' });
    }

    // Self-approval block
    if (req.user!.employeeId === ts.employeeId) {
      return res.status(403).json({ error: 'You cannot approve your own timesheet.' });
    }

    // Manager scope check using manager_id from employee record
    if (req.user!.role === 'MANAGER' && ts.managerIdOfEmployee !== req.user!.employeeId) {
      return res.status(403).json({ error: 'Access Denied: You are not the direct manager of this employee.' });
    }

    if (ts.status !== 'SUBMITTED') {
      return res.status(409).json({ error: `Only SUBMITTED timesheets can be approved. Current: ${ts.status}` });
    }

    const approverId = req.user!.employeeId || req.user!.userId;
    const updated = await timesheetRepository.approveTimesheet(req.user!.organizationId, req.params.id, approverId!);

    if (typeof logAudit === 'function') logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.employeeName || '', 'APPROVE_TIMESHEET', 'TIMESHEET', ts.id, `Approved ${ts.hours} hrs timesheet for '${ts.projectName || 'General Work'}'`);

    // Notify Employee
    await notificationService.createNotification({
      organizationId: req.user!.organizationId,
      recipientEmployeeId: ts.employeeId,
      notificationType: 'TIMESHEET_APPROVED',
      title: 'Timesheet Entry Approved',
      message: `Your timesheet entry of ${ts.hours} hrs for '${ts.projectName || 'General Work'}' on ${ts.date} has been APPROVED.`,
      entityType: 'TIMESHEET',
      entityId: ts.id
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Reject Timesheet Entry (Manager / HR / Admin)
projectsTimesheetsRouter.patch('/timesheets/:id/reject', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ts = await timesheetRepository.getTimesheetById(req.user!.organizationId, req.params.id);
    if (!ts) {
      return res.status(404).json({ error: 'Timesheet not found.' });
    }

    // Self-approval block
    if (req.user!.employeeId === ts.employeeId) {
      return res.status(403).json({ error: 'You cannot reject your own timesheet.' });
    }

    // Manager scope check using manager_id from employee record
    if (req.user!.role === 'MANAGER' && ts.managerIdOfEmployee !== req.user!.employeeId) {
      return res.status(403).json({ error: 'Access Denied: You are not the direct manager of this employee.' });
    }

    if (ts.status !== 'SUBMITTED') {
      return res.status(409).json({ error: `Only SUBMITTED timesheets can be rejected. Current: ${ts.status}` });
    }

    const { rejectionReason } = req.body;
    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({ error: 'Rejection reason is required.' });
    }

    const rejectorId = req.user!.employeeId || req.user!.userId;
    const updated = await timesheetRepository.rejectTimesheet(req.user!.organizationId, req.params.id, rejectorId!, rejectionReason);

    if (typeof logAudit === 'function') logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.employeeName || '', 'REJECT_TIMESHEET', 'TIMESHEET', ts.id, `Rejected timesheet entry for '${ts.projectName || 'General Work'}': ${rejectionReason}`);

    // Notify Employee
    await notificationService.createNotification({
      organizationId: req.user!.organizationId,
      recipientEmployeeId: ts.employeeId,
      notificationType: 'TIMESHEET_REJECTED',
      title: 'Timesheet Entry Rejected',
      message: `Your timesheet entry for '${ts.projectName || 'General Work'}' on ${ts.date} was REJECTED: ${rejectionReason}`,
      entityType: 'TIMESHEET',
      entityId: ts.id,
      priority: 'HIGH'
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create Correction Request
projectsTimesheetsRouter.post('/timesheets/corrections', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { timesheet_id, requested_date, requested_hours, requested_project_id, reason } = req.body;
    if (!timesheet_id || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (requested_hours !== undefined) {
      const hrs = Number(requested_hours);
      if (isNaN(hrs) || hrs <= 0 || hrs > 24) {
        return res.status(400).json({ error: 'Hours must be > 0 and <= 24' });
      }
    }

    const ts = await timesheetRepository.getTimesheetById(req.user!.organizationId, timesheet_id);
    if (!ts) {
      return res.status(404).json({ error: 'Timesheet not found' });
    }
    if (ts.employeeId !== req.user!.employeeId) {
      return res.status(403).json({ error: 'Cannot request correction for another user\'s timesheet' });
    }

    const payload = {
      timesheet_id,
      requested_date,
      requested_hours: requested_hours !== undefined ? Number(requested_hours) : undefined,
      requested_project_id,
      reason
    };

    const savedCr = await timesheetRepository.createCorrectionRequest(req.user!.organizationId, payload, req.user!.employeeId!);
    
    if (typeof logAudit === 'function') logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.employeeName || '', 'CREATE_TIMESHEET_CORRECTION', 'TIMESHEET_CORRECTION', savedCr.id, `Requested correction for timesheet ${timesheet_id}`);

    return res.status(201).json(savedCr);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Correction Requests
projectsTimesheetsRouter.get('/timesheets/corrections', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filters = req.query;
    const list = await timesheetRepository.getCorrectionRequests(req.user!.organizationId, filters, req.user!.role, req.user!.employeeId!);
    return res.json(list);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve Correction Request
projectsTimesheetsRouter.patch('/timesheets/corrections/:id/approve', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cr = await timesheetRepository.getCorrectionRequestById(req.user!.organizationId, req.params.id);
    if (!cr) return res.status(404).json({ error: 'Correction request not found.' });

    if (req.user!.employeeId === cr.employee_id) {
      return res.status(403).json({ error: 'You cannot approve your own correction request.' });
    }

    if (req.user!.role === 'MANAGER' && cr.managerIdOfEmployee !== req.user!.employeeId) {
      return res.status(403).json({ error: 'Access Denied: You are not the direct manager of this employee.' });
    }

    if (cr.requested_hours !== null && cr.requested_hours !== undefined) {
      const hrs = Number(cr.requested_hours);
      if (isNaN(hrs) || hrs <= 0 || hrs > 24) {
        return res.status(400).json({ error: 'Hours must be > 0 and <= 24' });
      }
      
      const ts = await timesheetRepository.getTimesheetById(req.user!.organizationId, cr.timesheet_id);
      if (ts) {
        const targetDate = cr.requested_date || ts.date;
        const existingDailyTotal = await timesheetRepository.getDailyLoggedHours(req.user!.organizationId, cr.employee_id, targetDate, ts.id);
        if (existingDailyTotal + hrs > 24) {
          return res.status(400).json({ error: `Daily total would exceed 24 hours (Current: ${existingDailyTotal} hrs + requested ${hrs} hrs).` });
        }
      }
    }

    const approverId = req.user!.employeeId || req.user!.userId;
    const updated = await timesheetRepository.approveCorrectionRequest(req.user!.organizationId, req.params.id, approverId!);

    if (typeof logAudit === 'function') logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.employeeName || '', 'APPROVE_TIMESHEET_CORRECTION', 'TIMESHEET_CORRECTION', req.params.id, `Approved timesheet correction ${req.params.id}`);

    await notificationService.createNotification({
      organizationId: req.user!.organizationId,
      recipientEmployeeId: cr.employee_id,
      notificationType: 'TIMESHEET_CORRECTION_APPROVED',
      title: 'Timesheet Correction Approved',
      message: `Your correction request for timesheet was APPROVED.`,
      entityType: 'TIMESHEET_CORRECTION',
      entityId: req.params.id
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Reject Correction Request
projectsTimesheetsRouter.patch('/timesheets/corrections/:id/reject', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cr = await timesheetRepository.getCorrectionRequestById(req.user!.organizationId, req.params.id);
    if (!cr) return res.status(404).json({ error: 'Correction request not found.' });

    if (req.user!.employeeId === cr.employee_id) {
      return res.status(403).json({ error: 'You cannot reject your own correction request.' });
    }

    if (req.user!.role === 'MANAGER' && cr.managerIdOfEmployee !== req.user!.employeeId) {
      return res.status(403).json({ error: 'Access Denied: You are not the direct manager of this employee.' });
    }

    const { rejectionReason, reason } = req.body;
    const finalReason = rejectionReason || reason;
    if (!finalReason) return res.status(400).json({ error: 'Rejection reason is required.' });

    const rejectorId = req.user!.employeeId || req.user!.userId;
    const updated = await timesheetRepository.rejectCorrectionRequest(req.user!.organizationId, req.params.id, rejectorId!, finalReason);

    if (typeof logAudit === 'function') logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.employeeName || '', 'REJECT_TIMESHEET_CORRECTION', 'TIMESHEET_CORRECTION', req.params.id, `Rejected timesheet correction ${req.params.id}`);

    await notificationService.createNotification({
      organizationId: req.user!.organizationId,
      recipientEmployeeId: cr.employee_id,
      notificationType: 'TIMESHEET_CORRECTION_REJECTED',
      title: 'Timesheet Correction Rejected',
      message: `Your correction request for timesheet was REJECTED: ${finalReason}`,
      entityType: 'TIMESHEET_CORRECTION',
      entityId: req.params.id,
      priority: 'HIGH'
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});
