import { Router, Request, Response, NextFunction } from 'express';
import { query, queryOne } from '../db/client.js';
import { authenticateToken, requireRoles, AuthenticatedRequest } from '../auth';
import { payrollRepository } from '../repositories/payroll.repository';
import { generateId, logAudit } from '../utils';

export const payrollSalaryStructureManagementRouter = Router();

// Get Salary Structures
payrollSalaryStructureManagementRouter.get('/salary-structures', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const empId = req.user!.role === 'EMPLOYEE' ? req.user!.employeeId : undefined;
  const structures = await payrollRepository.getSalaryStructures(req.user!.organizationId, empId);
  return res.json(structures);
});

// Get Salary Structure for Specific Employee
payrollSalaryStructureManagementRouter.get('/salary-structures/:employeeId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role === 'EMPLOYEE' && req.user!.employeeId !== req.params.employeeId) {
    return res.status(403).json({ error: 'Access Denied: You can only view your own salary structure.' });
  }
  const struct = await payrollRepository.getSalaryStructureForEmployee(req.user!.organizationId, req.params.employeeId);
  if (!struct) return res.status(404).json({ error: 'Employee or salary structure not found.' });
  return res.json(struct);
});

// Create or Update Salary Structure (Admin / HR)
payrollSalaryStructureManagementRouter.post('/salary-structures', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  if (!req.body.employeeId || req.body.basicSalary === undefined) {
    return res.status(400).json({ error: 'Employee ID and Basic Salary are required.' });
  }
  if (Number(req.body.basicSalary) <= 0) {
    return res.status(400).json({ error: 'Basic salary must be greater than 0.' });
  }

  try {
    const struct = await payrollRepository.saveSalaryStructure(req.user!.organizationId, {
      ...req.body,
      basicSalary: Number(req.body.basicSalary),
      hra: Number(req.body.hra || 0),
      specialAllowance: Number(req.body.specialAllowance || 0),
      medicalAllowance: Number(req.body.medicalAllowance || 0),
      conveyanceAllowance: Number(req.body.conveyanceAllowance || 0),
      otherAllowances: Number(req.body.otherAllowances || 0),
      bonus: Number(req.body.bonus || 0),
      incentives: Number(req.body.incentives || 0),
      otherDeductions: Number(req.body.otherDeductions || 0),
      effectiveDate: req.body.effectiveDate || new Date().toISOString().split('T')[0]
    });
    
    logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.employeeName || req.user!.email, 'SAVE_SALARY_STRUCTURE', 'PAYROLL', req.body.employeeId, `Updated salary structure for employee ${req.body.employeeId}`);
    
    return res.json(struct);
  } catch (err: any) {
    const status = err.statusCode === 422 ? 422 : 400;
    return res.status(status).json({ error: err.message, ...(err.code ? { code: err.code } : {}) });
  }
});


// Statutory Rules Config API
payrollSalaryStructureManagementRouter.get('/statutory-rules', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const rules = await payrollRepository.getStatutoryRules(req.user!.organizationId);
  return res.json(rules);
});

payrollSalaryStructureManagementRouter.post('/statutory-rules', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  if (!req.body.ruleName || !req.body.category) {
    return res.status(400).json({ error: 'Rule Name and Category are required.' });
  }

  const rule = await payrollRepository.createStatutoryRule(req.user!.organizationId, req.body);
  return res.status(201).json(rule);
});

payrollSalaryStructureManagementRouter.put('/statutory-rules/:id', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rule = await payrollRepository.updateStatutoryRule(req.user!.organizationId, req.params.id, req.body);
    return res.json(rule);
  } catch (err: any) {
    return res.status(404).json({ error: err.message });
  }
});

// Payroll Periods
payrollSalaryStructureManagementRouter.get('/payroll/periods', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const periods = await payrollRepository.getPayrollPeriods(req.user!.organizationId);
  return res.json(periods);
});

payrollSalaryStructureManagementRouter.post('/payroll/periods', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  if (!req.body.month || !req.body.year) {
    return res.status(400).json({ error: 'Month and Year are required.' });
  }

  try {
    const period = await payrollRepository.createPayrollPeriod(req.user!.organizationId, {
      month: Number(req.body.month),
      year: Number(req.body.year),
      name: req.body.name || `${Number(req.body.month)} ${Number(req.body.year)}`
    });
    return res.status(201).json(period);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Get Payroll Records
payrollSalaryStructureManagementRouter.get('/payroll/records', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await payrollRepository.getPayrollRecords(
      req.user!.organizationId,
      req.query,
      req.user!.role,
      req.user!.employeeId
    );
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Single Payroll Record
payrollSalaryStructureManagementRouter.get('/payroll/records/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const record = await payrollRepository.getPayrollRecordById(req.user!.organizationId, req.params.id);
    if (!record) return res.status(404).json({ error: 'Payroll record not found.' });

    if (req.user!.role === 'EMPLOYEE' && record.employeeId !== req.user!.employeeId) {
      return res.status(403).json({ error: 'Access Denied: You can only view your own payslips.' });
    }

    if (req.user!.role === 'MANAGER') {
      const team = await query(`SELECT id FROM employees WHERE organization_id = $1 AND (manager_id = $2 OR id = $2)`, [req.user!.organizationId, req.user!.employeeId]);
      const teamIds = team.map((t: any) => t.id);
      if (!teamIds.includes(record.employeeId)) {
        return res.status(403).json({ error: 'Access Denied: You can only view your team payslips.' });
      }
    }

    return res.json(record);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Process Payroll Engine
payrollSalaryStructureManagementRouter.post('/payroll/process', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  const { month, year, periodId } = req.body;
  if (!periodId && (!month || !year)) {
    return res.status(400).json({ error: 'Month and Year or Period ID are required.' });
  }

  try {
    const result = await payrollRepository.processPayroll(req.user!.organizationId, Number(month), Number(year), periodId);
    logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.employeeName || req.user!.email, 'PROCESS_PAYROLL', 'PAYROLL', result.period.id, `Processed payroll for ${result.period.name}`);
    return res.json({
      message: `Payroll successfully processed for ${result.period.name}`,
      period: result.period,
      recordsCount: result.recordsCount,
      processedEmployees: result.processedEmployees,
      skippedEmployees: result.skippedEmployees,
      skippedEmployeesDetails: result.skippedEmployeesDetails
    });
  } catch (err: any) {
    const status = err.statusCode === 409 ? 409 : err.statusCode === 422 ? 422 : 400;
    return res.status(status).json({ error: err.message, ...(err.code ? { code: err.code } : {}) });
  }
});


// Reprocess Individual Payroll Record
payrollSalaryStructureManagementRouter.post('/payroll/records/:id/reprocess', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const record = await payrollRepository.reprocessPayrollRecord(req.user!.organizationId, req.params.id);
    if (!record) return res.status(404).json({ error: 'Payroll record not found.' });
    return res.json(record);
  } catch (err: any) {
    const status = err.statusCode === 409 ? 409 : 400;
    return res.status(status).json({ error: err.message });
  }
});

// Mark Payroll Record as PAID
payrollSalaryStructureManagementRouter.patch('/payroll/records/:id/pay', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const record = await payrollRepository.markPayrollPaid(req.user!.organizationId, req.params.id, req.user!.userId);
    if (!record) return res.status(404).json({ error: 'Payroll record not found.' });
    logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.employeeName || req.user!.email, 'MARK_PAYROLL_PAID', 'PAYROLL', req.params.id, `Marked payroll record ${req.params.id} as PAID`);
    return res.json(record);
  } catch (err: any) {
    const status = err.statusCode === 409 ? 409 : 400;
    return res.status(status).json({ error: err.message });
  }
});

// Payroll Adjustments
payrollSalaryStructureManagementRouter.post('/adjustments', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Ensure employee identity comes ONLY from req.user.employeeId
    const payload = { ...req.body, employeeId: req.user!.role === 'EMPLOYEE' ? req.user!.employeeId : (req.body.employeeId || req.user!.employeeId) };
    const adj = await payrollRepository.createAdjustment(req.user!.organizationId, payload, req.user!.employeeId);
    logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.employeeName || req.user!.email, 'CREATE_PAYROLL_ADJUSTMENT', 'PAYROLL', adj.id, `Created payroll adjustment for employee ${adj.employeeId}`);
    return res.status(201).json(adj);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

payrollSalaryStructureManagementRouter.get('/adjustments', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await payrollRepository.getAdjustments(
      req.user!.organizationId,
      req.query,
      req.user!.role,
      req.user!.employeeId
    );
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

payrollSalaryStructureManagementRouter.patch('/adjustments/:id/approve', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await payrollRepository.approveAdjustment(req.user!.organizationId, req.params.id, req.user!.employeeId, req.user!.role);
    logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.employeeName || req.user!.email, 'APPROVE_PAYROLL_ADJUSTMENT', 'PAYROLL', req.params.id, `Approved payroll adjustment ${req.params.id}`);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

payrollSalaryStructureManagementRouter.patch('/adjustments/:id/reject', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.body.reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }
    const result = await payrollRepository.rejectAdjustment(req.user!.organizationId, req.params.id, req.user!.employeeId, req.body.reason, req.user!.role);
    logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.employeeName || req.user!.email, 'REJECT_PAYROLL_ADJUSTMENT', 'PAYROLL', req.params.id, `Rejected payroll adjustment ${req.params.id}`);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});
