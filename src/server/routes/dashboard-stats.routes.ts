import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, requireRoles, AuthenticatedRequest, isManagerOrAdmin, isHRorAdmin } from '../auth';
import { reportRepository } from '../repositories/report.repository';

export const dashboardStatsRouter = Router();

dashboardStatsRouter.get('/dashboard/stats', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const role = req.user!.role;
  const empId = req.user!.employeeId;
  const orgId = req.user!.organizationId;

  if (!empId && role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
    return res.status(400).json({ error: 'Employee ID not found' });
  }

  const stats = await reportRepository.getStats(orgId, role, empId || '', todayStr);
  return res.json(stats);
});

dashboardStatsRouter.get('/dashboard/charts', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const role = req.user!.role;
  const empId = req.user!.employeeId;
  const orgId = req.user!.organizationId;
  
  const charts = await reportRepository.getCharts(orgId, role, empId || '');
  return res.json(charts);
});

