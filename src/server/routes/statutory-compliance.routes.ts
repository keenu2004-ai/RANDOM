import { Router, Request, Response, NextFunction } from 'express';
import { generateId, logAudit } from '../utils';
import { query } from '../db/client';
import { authenticateToken, requireRoles, AuthenticatedRequest, isManagerOrAdmin, isHRorAdmin } from '../auth';
import { complianceRepository } from '../repositories/compliance.repository';

export const statutoryComplianceRouter = Router();

const getRulesHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rules = await complianceRepository.getStatutoryRules(req.user!.organizationId);
    return res.json(rules);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

statutoryComplianceRouter.get('/compliance/rules', authenticateToken, getRulesHandler);
statutoryComplianceRouter.get('/statutory-rules', authenticateToken, getRulesHandler);

const createRuleHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ruleName, category, state, ratePercentage, fixedAmount, thresholdAmount, effectiveDate, expiryDate, active, description } = req.body;

    if (!ruleName || !category) {
      return res.status(400).json({ error: 'Rule name and category are required.' });
    }

    const newRule = {
      id: generateId(),
      ruleName: ruleName.trim(),
      category: category,
      state: state || 'All India',
      ratePercentage: Number(ratePercentage) || 0,
      fixedAmount: fixedAmount ? Number(fixedAmount) : undefined,
      thresholdAmount: Number(thresholdAmount) || 0,
      effectiveDate: effectiveDate || new Date().toISOString().split('T')[0],
      expiryDate: expiryDate || undefined,
      active: active !== undefined ? Boolean(active) : true,
      description: description || '',
      createdAt: new Date().toISOString()
    };

    const savedRule = await complianceRepository.createStatutoryRule(req.user!.organizationId, newRule);

    if (typeof logAudit === 'function') logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.employeeName || '', 'CREATE_STATUTORY_RULE', 'STATUTORY_RULE', savedRule.id, `Created statutory deduction rule '${savedRule.ruleName}'`);

    return res.status(201).json(savedRule);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

statutoryComplianceRouter.post('/statutory-rules', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), createRuleHandler);
statutoryComplianceRouter.post('/compliance/rules', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), createRuleHandler);

const updateRuleHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rule = await complianceRepository.getStatutoryRuleById(req.user!.organizationId, req.params.id);

    if (!rule) {
      return res.status(404).json({ error: 'Statutory rule not found.' });
    }

    const { ruleName, category, state, ratePercentage, fixedAmount, thresholdAmount, effectiveDate, expiryDate, active, description } = req.body;

    const updateData: any = {};
    if (ruleName !== undefined) updateData.ruleName = ruleName.trim();
    if (category !== undefined) updateData.category = category;
    if (state !== undefined) updateData.state = state;
    if (ratePercentage !== undefined) updateData.ratePercentage = Number(ratePercentage);
    if (fixedAmount !== undefined) updateData.fixedAmount = fixedAmount !== null ? Number(fixedAmount) : null;
    if (thresholdAmount !== undefined) updateData.thresholdAmount = Number(thresholdAmount);
    if (effectiveDate !== undefined) updateData.effectiveDate = effectiveDate;
    if (expiryDate !== undefined) updateData.expiryDate = expiryDate;
    if (active !== undefined) updateData.active = Boolean(active);
    if (description !== undefined) updateData.description = description;

    const updatedRule = await complianceRepository.updateStatutoryRule(req.user!.organizationId, req.params.id, updateData);

    if (typeof logAudit === 'function') logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.employeeName || '', 'UPDATE_STATUTORY_RULE', 'STATUTORY_RULE', updatedRule.id, `Updated statutory deduction rule '${updatedRule.ruleName}'`);

    return res.json(updatedRule);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

statutoryComplianceRouter.put('/statutory-rules/:id', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), updateRuleHandler);
statutoryComplianceRouter.put('/compliance/rules/:id', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), updateRuleHandler);

statutoryComplianceRouter.patch('/statutory-rules/:id/toggle', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rule = await complianceRepository.getStatutoryRuleById(req.user!.organizationId, req.params.id);

    if (!rule) {
      return res.status(404).json({ error: 'Statutory rule not found.' });
    }

    const active = req.body.active !== undefined ? Boolean(req.body.active) : !rule.active;
    const updatedRule = await complianceRepository.updateStatutoryRule(req.user!.organizationId, req.params.id, { active });

    return res.json(updatedRule);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

statutoryComplianceRouter.delete('/statutory-rules/:id', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rule = await complianceRepository.getStatutoryRuleById(req.user!.organizationId, req.params.id);

    if (!rule) {
      return res.status(404).json({ error: 'Statutory rule not found.' });
    }

    await complianceRepository.deleteStatutoryRule(req.user!.organizationId, req.params.id);

    if (typeof logAudit === 'function') logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.employeeName || '', 'DELETE_STATUTORY_RULE', 'STATUTORY_RULE', rule.id, `Deleted statutory deduction rule '${rule.ruleName}'`);

    return res.json({ message: 'Statutory rule deleted successfully', id: rule.id });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Compliance Calendar Tasks
const getTasksHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tasks = await complianceRepository.getComplianceTasks(req.user!.organizationId);
    return res.json(tasks);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

statutoryComplianceRouter.get('/compliance/calendar', authenticateToken, getTasksHandler);
statutoryComplianceRouter.get('/compliance/tasks', authenticateToken, getTasksHandler);

statutoryComplianceRouter.post('/compliance/calendar', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskName, category, dueDate, frequency, responsiblePerson, responsiblePersonId, status, notes, reminderDate } = req.body;

    if (!taskName || !dueDate) {
      return res.status(400).json({ error: 'Compliance task name and due date are required.' });
    }

    const newTask = {
      id: generateId(),
      taskName: taskName.trim(),
      category: category || 'General Compliance',
      dueDate,
      frequency: frequency || 'MONTHLY',
      responsiblePerson: responsiblePerson || 'HR Manager',
      responsiblePersonId: responsiblePersonId || undefined,
      status: status || 'PENDING',
      notes: notes || '',
      reminderDate: reminderDate || undefined,
      createdAt: new Date().toISOString()
    };

    const savedTask = await complianceRepository.createComplianceTask(req.user!.organizationId, newTask);

    if (typeof logAudit === 'function') logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.employeeName || '', 'CREATE_COMPLIANCE_TASK', 'COMPLIANCE_TASK', savedTask.id, `Created compliance item '${savedTask.taskName}' due on ${savedTask.dueDate}`);

    return res.status(201).json(savedTask);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

statutoryComplianceRouter.put('/compliance/calendar/:id', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const task = await complianceRepository.getComplianceTaskById(req.user!.organizationId, req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Compliance task not found.' });
    }

    const { taskName, category, dueDate, frequency, responsiblePerson, responsiblePersonId, status, notes, reminderDate } = req.body;

    const updateData: any = {};
    if (taskName !== undefined) updateData.taskName = taskName.trim();
    if (category !== undefined) updateData.category = category;
    if (dueDate !== undefined) updateData.dueDate = dueDate;
    if (frequency !== undefined) updateData.frequency = frequency;
    if (responsiblePerson !== undefined) updateData.responsiblePerson = responsiblePerson;
    if (responsiblePersonId !== undefined) updateData.responsiblePersonId = responsiblePersonId;
    if (notes !== undefined) updateData.notes = notes;
    if (reminderDate !== undefined) updateData.reminderDate = reminderDate;

    if (status !== undefined) {
      updateData.status = status;
      if (status === 'COMPLETED' && !task.completedAt) {
        updateData.completedAt = new Date().toISOString();
        updateData.completedBy = req.user!.employeeName || req.user!.email;
      }
    }

    const updatedTask = await complianceRepository.updateComplianceTask(req.user!.organizationId, req.params.id, updateData);

    if (typeof logAudit === 'function') logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.employeeName || '', 'UPDATE_COMPLIANCE_TASK', 'COMPLIANCE_TASK', task.id, `Updated compliance task '${updatedTask.taskName}'`);

    return res.json(updatedTask);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

statutoryComplianceRouter.patch('/compliance/calendar/:id/status', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const task = await complianceRepository.getComplianceTaskById(req.user!.organizationId, req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Compliance task not found.' });
    }

    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status is required.' });
    }

    const updateData: any = { status };
    if (status === 'COMPLETED') {
      updateData.completedAt = new Date().toISOString();
      updateData.completedBy = req.user!.employeeName || req.user!.email;
    }

    const updatedTask = await complianceRepository.updateComplianceTask(req.user!.organizationId, req.params.id, updateData);

    if (typeof logAudit === 'function') logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.employeeName || '', 'UPDATE_COMPLIANCE_STATUS', 'COMPLIANCE_TASK', task.id, `Changed status of '${task.taskName}' to ${status}`);

    return res.json(updatedTask);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

statutoryComplianceRouter.delete('/compliance/calendar/:id', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const task = await complianceRepository.getComplianceTaskById(req.user!.organizationId, req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Compliance task not found.' });
    }

    await complianceRepository.deleteComplianceTask(req.user!.organizationId, req.params.id);

    if (typeof logAudit === 'function') logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.employeeName || '', 'DELETE_COMPLIANCE_TASK', 'COMPLIANCE_TASK', task.id, `Deleted compliance task '${task.taskName}'`);

    return res.json({ message: 'Compliance task deleted successfully', id: task.id });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});
