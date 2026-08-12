import { Router, Request, Response, NextFunction } from 'express';
import { generateId, logAudit, resetDb } from '../utils';
import { query } from '../db/client';
import { authenticateToken, requireRoles, AuthenticatedRequest, isManagerOrAdmin, isHRorAdmin } from '../auth';
import { reportRepository } from '../repositories/report.repository';

export const auditLogsReportsSettingsRouter = Router();

auditLogsReportsSettingsRouter.get('/reports/data', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type = 'employee', startDate, endDate, branchId, departmentId, employeeId, status } = req.query;

    const reportTypeStr = String(type).toLowerCase();
    const { rows, summary, branches, departments, employees } = await reportRepository.getReportData(
      req.user!.organizationId, 
      reportTypeStr, 
      req.query,
      req.user!.role,
      req.user!.employeeId || ''
    );

    return res.json({
      reportType: reportTypeStr,
      meta: {
        branches,
        departments,
        employees,
        generatedAt: new Date().toISOString()
      },
      summary,
      rows
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

auditLogsReportsSettingsRouter.get('/reports/export', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type = 'employee' } = req.query;
    const reportTypeStr = String(type).toLowerCase();
    const { rows } = await reportRepository.getReportData(
      req.user!.organizationId, 
      reportTypeStr, 
      req.query,
      req.user!.role,
      req.user!.employeeId || ''
    );

    if (rows.length === 0) {
      return res.status(404).send('No data available');
    }

    // Hard cap on CSV exports to prevent unbounded dataset extraction
    const MAX_EXPORT_ROWS = parseInt(process.env.MAX_CSV_EXPORT_ROWS || '5000', 10);
    const exportRows = rows.slice(0, MAX_EXPORT_ROWS);

    const headers = Object.keys(exportRows[0]).join(',');
    const csvContent = exportRows.map(row => 
      Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${reportTypeStr}_report_${new Date().toISOString().split('T')[0]}.csv"`);
    if (rows.length > MAX_EXPORT_ROWS) {
      res.setHeader('X-Export-Truncated', `true`);
      res.setHeader('X-Export-Total-Rows', `${rows.length}`);
      res.setHeader('X-Export-Limit', `${MAX_EXPORT_ROWS}`);
    }
    return res.send(`${headers}\n${csvContent}`);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

auditLogsReportsSettingsRouter.get('/users', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const usersEnriched = await reportRepository.getUsers(req.user!.organizationId);
    const mapped = usersEnriched.map((u: any) => ({
      id: u.id,
      email: u.email,
      role: u.role || 'USER',
      employeeId: u.employeeId,
      employeeCode: u.employeeCode || '-',
      employeeName: (u.firstName && u.lastName) ? `${u.firstName} ${u.lastName}` : 'System User',
      createdAt: u.createdAt
    }));
    return res.json(mapped);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

auditLogsReportsSettingsRouter.patch('/users/:id/role', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { role } = req.body;
    if (!role || !['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'].includes(role)) {
      return res.status(400).json({ error: 'Valid system user role is required.' });
    }

    const user = await reportRepository.getUserById(req.user!.organizationId, req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    const oldRole = user.role;
    await reportRepository.updateUserRole(req.user!.organizationId, user.id, role);

    if (typeof logAudit === 'function') logAudit(
      req.user!.organizationId,
      req.user!.userId,
      req.user!.email,
      req.user!.employeeName || '',
      'CHANGE_PERMISSIONS',
      'USER',
      user.id,
      `Changed user access role for ${user.email} from ${oldRole} to ${role}`
    );

    return res.json({ message: `Role updated to ${role} successfully`, user: { ...user, role } });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

auditLogsReportsSettingsRouter.get('/audit-logs', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page, limit, actor, action, startDate, endDate, sortBy, sortDir } = req.query;
    
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    
    const filters = {
      actor: actor as string,
      action: action as string,
      startDate: startDate as string,
      endDate: endDate as string,
      sortBy: sortBy as string,
      sortDir: sortDir as string
    };
    
    const paginatedLogs = await reportRepository.getAuditLogs(req.user!.organizationId, pageNum, limitNum, filters);
    return res.json(paginatedLogs);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

auditLogsReportsSettingsRouter.get('/settings/organization', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const settings = await reportRepository.getSettings(req.user!.organizationId);
    return res.json(settings);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

auditLogsReportsSettingsRouter.patch('/settings/organization', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await reportRepository.updateSettings(req.user!.organizationId, req.body);

    if (typeof logAudit === 'function') logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.employeeName || '', 'UPDATE_SETTINGS', 'SETTINGS', updated.id, 'Updated organization settings');

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

auditLogsReportsSettingsRouter.post('/system/reset-db', authenticateToken, requireRoles('SUPER_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  // This endpoint is disabled in production to prevent accidental data loss
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'This operation is not available in production.' });
  }
  
  try {
    if (typeof resetDb === 'function') resetDb();
    
    if (typeof logAudit === 'function') logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.employeeName || '', 'RESET_DATABASE', 'SYSTEM', 'all', 'Database restored to initial seed state');
    
    return res.json({ message: 'Database reset to initial seed state successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});
