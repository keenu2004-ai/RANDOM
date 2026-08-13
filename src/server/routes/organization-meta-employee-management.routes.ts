import { Router, Request, Response, NextFunction } from 'express';
import { query, queryOne } from '../db/client.js';
import { authenticateToken, requireRoles, AuthenticatedRequest } from '../auth';
import { employeeRepository } from '../repositories/employee.repository';

export const organizationMetaEmployeeManagementRouter = Router();

organizationMetaEmployeeManagementRouter.get('/organization/meta', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const meta = await employeeRepository.getOrganizationMeta(req.user!.organizationId);
  return res.json(meta);
});

// --- DEPARTMENTS ---
organizationMetaEmployeeManagementRouter.post('/organization/departments', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || null;
    const dept = await employeeRepository.createDepartment(req.user!.organizationId, req.body, req.user!.userId, ip, req.headers['x-request-id'] as string);
    return res.json(dept);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

organizationMetaEmployeeManagementRouter.put('/organization/departments/:id', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || null;
    const dept = await employeeRepository.updateDepartment(req.user!.organizationId, req.params.id, req.body, req.user!.userId, ip, req.headers['x-request-id'] as string);
    return res.json(dept);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

organizationMetaEmployeeManagementRouter.delete('/organization/departments/:id', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || null;
    const dept = await employeeRepository.deleteDepartment(req.user!.organizationId, req.params.id, req.user!.userId, ip, req.headers['x-request-id'] as string);
    return res.json({ message: 'Department deleted', id: dept?.id });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

// --- BRANCHES ---
organizationMetaEmployeeManagementRouter.post('/organization/branches', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.body.name) return res.status(400).json({ error: 'Branch name is required' });
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || null;
    const branch = await employeeRepository.createBranch(req.user!.organizationId, req.body, req.user!.userId, ip, req.headers['x-request-id'] as string);
    return res.status(201).json(branch);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

organizationMetaEmployeeManagementRouter.put('/organization/branches/:id', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || null;
    const branch = await employeeRepository.updateBranch(req.user!.organizationId, req.params.id, req.body, req.user!.userId, ip, req.headers['x-request-id'] as string);
    return res.json(branch);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

organizationMetaEmployeeManagementRouter.delete('/organization/branches/:id', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || null;
    const branch = await employeeRepository.deleteBranch(req.user!.organizationId, req.params.id, req.user!.userId, ip, req.headers['x-request-id'] as string);
    return res.json({ message: 'Branch deactivated', id: branch?.id });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

// --- DESIGNATIONS ---
organizationMetaEmployeeManagementRouter.post('/organization/designations', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.body.title) return res.status(400).json({ error: 'Designation title is required' });
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || null;
    const des = await employeeRepository.createDesignation(req.user!.organizationId, req.body, req.user!.userId, ip, req.headers['x-request-id'] as string);
    return res.status(201).json(des);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

organizationMetaEmployeeManagementRouter.put('/organization/designations/:id', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || null;
    const des = await employeeRepository.updateDesignation(req.user!.organizationId, req.params.id, req.body, req.user!.userId, ip, req.headers['x-request-id'] as string);
    return res.json(des);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

organizationMetaEmployeeManagementRouter.delete('/organization/designations/:id', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || null;
    const des = await employeeRepository.deleteDesignation(req.user!.organizationId, req.params.id, req.user!.userId, ip, req.headers['x-request-id'] as string);
    return res.json({ message: 'Designation deleted', id: des?.id });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

// --- TEAMS ---
organizationMetaEmployeeManagementRouter.post('/organization/teams', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.body.name || !req.body.departmentId) return res.status(400).json({ error: 'Team name and departmentId are required' });
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || null;
    const team = await employeeRepository.createTeam(req.user!.organizationId, req.body, req.user!.userId, ip, req.headers['x-request-id'] as string);
    return res.status(201).json(team);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

organizationMetaEmployeeManagementRouter.put('/organization/teams/:id', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || null;
    const team = await employeeRepository.updateTeam(req.user!.organizationId, req.params.id, req.body, req.user!.userId, ip, req.headers['x-request-id'] as string);
    return res.json(team);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

organizationMetaEmployeeManagementRouter.delete('/organization/teams/:id', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || null;
    const team = await employeeRepository.deleteTeam(req.user!.organizationId, req.params.id, req.user!.userId, ip, req.headers['x-request-id'] as string);
    return res.json({ message: 'Team deleted', id: team?.id });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});



organizationMetaEmployeeManagementRouter.get('/employees', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  let filters: any = { ...req.query };
  const canSeeDeleted = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(req.user!.role);
  filters.canSeeDeleted = canSeeDeleted;
  const canViewSalary = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(req.user!.role);
  filters.canViewSalary = canViewSalary;

  if (req.user!.role === 'MANAGER') {
    filters.managerId = req.user!.employeeId;
  } else if (req.user!.role === 'EMPLOYEE') {
    filters.employeeId = req.user!.employeeId;
  }

  const pageNum = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.limit as string) || 100;
  filters.page = pageNum;
  filters.limit = pageSize;
  if (req.query.sortBy) filters.sortBy = req.query.sortBy;
  if (req.query.sortOrder) filters.sortOrder = req.query.sortOrder;

  const result = await employeeRepository.getEmployees(req.user!.organizationId, filters);

  return res.json({
    data: result.data,
    pagination: {
      total: result.total,
      page: pageNum,
      limit: pageSize,
      totalPages: Math.ceil(result.total / pageSize) || 1
    }
  });
});

organizationMetaEmployeeManagementRouter.get('/employees/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isHRAdmin = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(req.user!.role);
  const canViewSalary = isHRAdmin || req.user!.employeeId === req.params.id;

  const emp = await employeeRepository.getEmployeeById(req.user!.organizationId, req.params.id, canViewSalary);
  if (!emp) {
    return res.status(404).json({ error: 'Employee record not found' });
  }

  if (req.user!.role === 'EMPLOYEE' && req.user!.employeeId !== emp.id) {
    return res.status(403).json({ error: 'Access denied: You can only view your own employee profile' });
  }

  if (req.user!.role === 'MANAGER' && emp.managerId !== req.user!.employeeId && emp.id !== req.user!.employeeId) {
    return res.status(403).json({ error: 'Access denied: Managers can only view team member records' });
  }

  return res.json(emp);
});

organizationMetaEmployeeManagementRouter.post('/employees', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  const data = req.body;

  if (!data.firstName || !data.lastName || !data.email || !data.departmentId) {
    return res.status(400).json({ error: 'First Name, Last Name, Email, and Department are required' });
  }

  try {
    if (data.managerId) {
      const manager = await employeeRepository.getEmployeeById(req.user!.organizationId, data.managerId, false);
      if (!manager) {
        return res.status(400).json({ error: 'Invalid managerId provided' });
      }
    }

    const newEmployee = await employeeRepository.createEmployee(req.user!.organizationId, data);
    return res.status(201).json(newEmployee);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

organizationMetaEmployeeManagementRouter.patch('/employees/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isHRAdmin = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(req.user!.role);
  const isOwnRecord = req.user!.employeeId === req.params.id;

  if (!isHRAdmin && !isOwnRecord) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const protectedFields = ['organizationId', 'role', 'basicSalary', 'hra', 'allowances', 'managerId', 'status', 'departmentId', 'designationId'];
  if (!isHRAdmin) {
    const attemptedProtected = protectedFields.some(field => field in req.body);
    if (attemptedProtected) {
      return res.status(403).json({ error: 'You are not authorized to update protected fields' });
    }
  }

  try {
    if (req.body.managerId) {
      // Validate manager exists, is in same org, and is not the employee themselves
      if (req.body.managerId === req.params.id) {
        return res.status(400).json({ error: 'Employee cannot be their own manager' });
      }
      const manager = await employeeRepository.getEmployeeById(req.user!.organizationId, req.body.managerId, false);
      if (!manager) {
        return res.status(400).json({ error: 'Invalid managerId provided' });
      }
    }

    const updated = await employeeRepository.updateEmployee(req.user!.organizationId, req.params.id, req.body);
    return res.json(updated);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

organizationMetaEmployeeManagementRouter.delete('/employees/:id', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const emp = await employeeRepository.softDeleteEmployee(req.user!.organizationId, req.params.id);
    return res.json({ message: `Employee ${emp.employeeCode} soft deleted successfully`, employee: emp });
  } catch (e: any) {
    return res.status(404).json({ error: e.message });
  }
});

organizationMetaEmployeeManagementRouter.post('/employees/:id/restore', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const emp = await employeeRepository.restoreEmployee(req.user!.organizationId, req.params.id);
    return res.json({ message: `Employee ${emp.employeeCode} restored successfully`, employee: emp });
  } catch (e: any) {
    return res.status(404).json({ error: e.message });
  }
});

organizationMetaEmployeeManagementRouter.post('/employees/:id/photo', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isHR = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(req.user!.role);
  if (req.user!.employeeId !== req.params.id && !isHR) {
    return res.status(403).json({ error: 'Unauthorized to update this employee photo' });
  }

  if (!req.body.photoUrl) {
    return res.status(400).json({ error: 'Photo URL or base64 image string is required' });
  }

  const emp = await employeeRepository.updatePhoto(req.user!.organizationId, req.params.id, req.body.photoUrl);
  if (!emp) return res.status(404).json({ error: 'Employee record not found' });

  return res.json({ message: 'Profile photo updated successfully', profilePhoto: emp.profilePhoto });
});

