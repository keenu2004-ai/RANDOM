import { Router, Request, Response, NextFunction } from 'express';
import { generateId } from '../utils';
import { authenticateToken, requireRoles, AuthenticatedRequest } from '../auth';
import { expenseRepository } from '../repositories/expense.repository';
import { query } from '../db/client';

export const expensesRouter = Router();

async function logAudit(orgId: string, userId: string, email: string, role: string, action: string, details: string) {
  try {
    await query(`INSERT INTO audit_logs (organization_id, user_id, user_email, user_role, action, module, details, created_at)
      VALUES ($1, $2, $3, $4, $5, 'EXPENSES', $6, NOW())`,
      [orgId, userId, email, role, action, details]
    );
  } catch (err) {
    console.error('Failed to write audit log', err);
  }
}

// Get Expenses list
expensesRouter.get('/expenses', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filters = {
      status: req.query.status as string,
      categoryId: req.query.categoryId as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as string,
    };
    const list = await expenseRepository.getAllExpenses(req.user!.organizationId, req.user!.role, req.user!.employeeId!, filters);
    return res.json(list);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get Expense Categories
expensesRouter.get('/expenses/categories', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  return res.json(await expenseRepository.getCategories(req.user!.organizationId));
});

// Create Expense Category (Admin / HR)
expensesRouter.post('/expenses/categories', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, code, maxLimit, requiresReceipt } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'Category Name and Code are required' });

    const newCat = { id: generateId(), name: name.trim(), code: code.trim().toUpperCase(), maxLimit: maxLimit ? Number(maxLimit) : undefined, requiresReceipt: Boolean(requiresReceipt) };
    await expenseRepository.createCategory(req.user!.organizationId, newCat.id, newCat.name, newCat.code, newCat.maxLimit, newCat.requiresReceipt);
    return res.status(201).json(newCat);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Upload Receipt Securely
expensesRouter.post('/expenses/upload-receipt', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fileName, mimeType, fileData } = req.body;
    if (!fileData || !fileName || !mimeType) return res.status(400).json({ error: 'File data, file name, and MIME type are required.' });

    const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
    const sizeBytes = Math.ceil((base64Data.length * 3) / 4);
    const receiptId = generateId();

    await expenseRepository.saveReceipt(req.user!.organizationId, receiptId, fileName.trim(), mimeType, sizeBytes, base64Data, req.user!.userId, new Date().toISOString());

    const receiptUrl = `/api/expenses/receipts/${receiptId}`;
    return res.status(201).json({ receiptId, receiptUrl, fileName, mimeType, sizeBytes });
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Securely Serve Receipt File
expensesRouter.get('/expenses/receipts/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const receipt = await expenseRepository.getReceipt(req.user!.organizationId, req.params.id);
    if (!receipt) return res.status(404).json({ error: 'Receipt file not found.' });

    const exp = await expenseRepository.getExpenseByReceipt(req.user!.organizationId, receipt.id);
    const isUploader = receipt.uploadedBy === req.user!.userId;
    const isOwner = exp && exp.employeeId === req.user!.employeeId;
    const isHRAdmin = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(req.user!.role);

    if (!isUploader && !isOwner && !isHRAdmin) return res.status(403).json({ error: 'Access Denied: You are not authorized to view this receipt.' });

    const buffer = Buffer.from(receipt.dataBase64, 'base64');
    res.setHeader('Content-Type', receipt.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${receipt.fileName}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create Expense Claim (Draft or Submit)
expensesRouter.post('/expenses', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { categoryId, amount, expenseDate, description, receiptUrl, receiptName, receiptId, status } = req.body;
    
    if (!categoryId || !amount || !expenseDate || !description) return res.status(400).json({ error: 'Category, Amount (₹), Date, and Description are required.' });
    
    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number.' });
    }

    const targetStatus = status === 'DRAFT' ? 'DRAFT' : 'SUBMITTED';
    const category = await expenseRepository.getCategory(req.user!.organizationId, categoryId);
    if (!category) return res.status(400).json({ error: 'Invalid category ID.' });

    if (targetStatus === 'SUBMITTED' && category.requiresReceipt && !receiptUrl && !receiptId) {
      return res.status(400).json({ error: `Receipt upload is required for the '${category.name}' category.` });
    }

    const newExpense = {
      id: generateId(), employeeId: req.user!.employeeId!, categoryId, amount: parsedAmount, expenseDate, description: description.trim(),
      receiptUrl: receiptUrl || (receiptId ? `/api/expenses/receipts/${receiptId}` : undefined), receiptName, receiptId, status: targetStatus
    };

    const result = await expenseRepository.createExpense(req.user!.organizationId, newExpense);
    await logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.role, 'CREATE_EXPENSE', `Expense created: ${newExpense.id}`);
    
    return res.status(201).json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update / Edit Expense Claim (Draft or Resubmit)
expensesRouter.put('/expenses/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const exp = await expenseRepository.getExpense(req.user!.organizationId, req.params.id);
    if (!exp) return res.status(404).json({ error: 'Expense claim not found.' });

    if (exp.employeeId !== req.user!.employeeId && !['SUPER_ADMIN', 'ADMIN'].includes(req.user!.role)) return res.status(403).json({ error: 'Access Denied: You can only edit your own expense claims.' });
    if (!['DRAFT', 'REJECTED'].includes(exp.status) && !['SUPER_ADMIN', 'ADMIN'].includes(req.user!.role)) return res.status(400).json({ error: `Cannot edit an expense claim with status '${exp.status}'. Only DRAFT or REJECTED claims can be edited.` });

    const { categoryId, amount, expenseDate, description, receiptUrl, receiptName, receiptId, status } = req.body;
    if (categoryId) exp.categoryId = categoryId;
    if (amount) {
      const parsedAmount = Number(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) return res.status(400).json({ error: 'Amount must be a positive number.' });
      exp.amount = parsedAmount;
    }
    if (expenseDate) exp.expenseDate = expenseDate;
    if (description) exp.description = description.trim();
    if (receiptUrl !== undefined) exp.receiptUrl = receiptUrl;
    if (receiptName !== undefined) exp.receiptName = receiptName;
    if (receiptId !== undefined) exp.receiptId = receiptId;

    const newStatus = status === 'DRAFT' ? 'DRAFT' : 'SUBMITTED';
    const category = await expenseRepository.getCategory(req.user!.organizationId, exp.categoryId);
    if (newStatus === 'SUBMITTED' && category?.requiresReceipt && !exp.receiptUrl && !exp.receiptId) return res.status(400).json({ error: `Receipt upload is required for the '${category.name}' category.` });

    exp.status = newStatus;
    await expenseRepository.updateExpense(req.user!.organizationId, exp);
    return res.json(exp);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Explicit Submit Draft Expense
expensesRouter.post('/expenses/:id/submit', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const exp = await expenseRepository.getExpense(req.user!.organizationId, req.params.id);
    if (!exp) return res.status(404).json({ error: 'Expense claim not found.' });
    if (exp.employeeId !== req.user!.employeeId) return res.status(403).json({ error: 'Access Denied: You can only submit your own expense claims.' });
    if (exp.status !== 'DRAFT') return res.status(400).json({ error: `Only draft claims can be submitted. Current status: '${exp.status}'.` });

    const category = await expenseRepository.getCategory(req.user!.organizationId, exp.categoryId);
    if (category?.requiresReceipt && !exp.receiptUrl && !exp.receiptId) return res.status(400).json({ error: `Receipt upload is required for the '${category.name}' category.` });

    exp.status = 'SUBMITTED';
    await expenseRepository.updateExpense(req.user!.organizationId, exp);
    return res.json(exp);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Delete Draft Expense Claim
expensesRouter.delete('/expenses/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const exp = await expenseRepository.getExpense(req.user!.organizationId, req.params.id);
    if (!exp) return res.status(404).json({ error: 'Expense claim not found.' });

    if (exp.employeeId !== req.user!.employeeId && !['SUPER_ADMIN', 'ADMIN'].includes(req.user!.role)) return res.status(403).json({ error: 'Access Denied: You can only delete your own draft expense claims.' });
    if (exp.status !== 'DRAFT' && !['SUPER_ADMIN', 'ADMIN'].includes(req.user!.role)) return res.status(400).json({ error: `Cannot delete expense claim with status '${exp.status}'. Only DRAFT claims can be deleted.` });

    await expenseRepository.deleteExpense(req.user!.organizationId, req.params.id);
    return res.json({ message: 'Expense claim deleted successfully.', id: req.params.id });
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Approve Expense Claim (Manager / HR / Admin)
expensesRouter.patch('/expenses/:id/approve', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const exp = await expenseRepository.getExpense(req.user!.organizationId, req.params.id);
    if (!exp) return res.status(404).json({ error: 'Expense claim not found.' });

    if (req.user!.employeeId === exp.employeeId) {
      return res.status(403).json({ error: 'You cannot approve your own expense claim.' });
    }

    if (req.user!.role === 'MANAGER' && exp.managerIdOfEmployee !== req.user!.employeeId) {
      return res.status(403).json({ error: 'Access Denied: You are not the manager of this employee.' });
    }

    if (exp.status !== 'SUBMITTED') {
      return res.status(409).json({ error: `Only SUBMITTED expenses can be approved. Current status: ${exp.status}` });
    }

    const reviewerId = req.user!.employeeId || req.user!.userId;
    const updated = await expenseRepository.approveExpense(req.user!.organizationId, req.params.id, reviewerId);
    if (!updated) {
       return res.status(500).json({ error: 'Failed to approve expense or already processed.' });
    }

    await logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.role, 'APPROVE_EXPENSE', `Expense approved: ${req.params.id}`);
    
    return res.json(updated);
  } catch (error: any) {
    if (error.message && error.message.includes('not in SUBMITTED state')) return res.status(409).json({ error: error.message });
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Reject Expense Claim (Manager / HR / Admin)
expensesRouter.patch('/expenses/:id/reject', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const exp = await expenseRepository.getExpense(req.user!.organizationId, req.params.id);
    if (!exp) return res.status(404).json({ error: 'Expense claim not found.' });

    if (req.user!.employeeId === exp.employeeId) {
      return res.status(403).json({ error: 'You cannot reject your own expense claim.' });
    }

    if (req.user!.role === 'MANAGER' && exp.managerIdOfEmployee !== req.user!.employeeId) {
      return res.status(403).json({ error: 'Access Denied: You are not the manager of this employee.' });
    }

    if (exp.status !== 'SUBMITTED') {
      return res.status(409).json({ error: `Only SUBMITTED expenses can be rejected. Current status: ${exp.status}` });
    }

    const { rejectionReason } = req.body;
    if (!rejectionReason || !rejectionReason.trim()) return res.status(400).json({ error: 'Rejection reason is required.' });

    const reviewerId = req.user!.employeeId || req.user!.userId;
    const updated = await expenseRepository.rejectExpense(req.user!.organizationId, req.params.id, reviewerId, rejectionReason.trim());
    if (!updated) {
       return res.status(500).json({ error: 'Failed to reject expense or already processed.' });
    }
    
    await logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.role, 'REJECT_EXPENSE', `Expense rejected: ${req.params.id}`);

    return res.json(updated);
  } catch (error: any) {
    if (error.message && error.message.includes('not in SUBMITTED state')) return res.status(409).json({ error: error.message });
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Reimburse Expense Claim (Authorized Finance / HR / Admin)
expensesRouter.patch('/expenses/:id/reimburse', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const exp = await expenseRepository.getExpense(req.user!.organizationId, req.params.id);
    if (!exp) return res.status(404).json({ error: 'Expense claim not found.' });
    
    if (exp.status !== 'APPROVED') {
        return res.status(409).json({ error: `Only APPROVED claims can be reimbursed. Current status: '${exp.status}'.` });
    }

    const updated = await expenseRepository.reimburseExpense(req.user!.organizationId, req.params.id);
    if (!updated) {
       return res.status(500).json({ error: 'Failed to reimburse expense or already processed.' });
    }
    
    await logAudit(req.user!.organizationId, req.user!.userId, req.user!.email, req.user!.role, 'REIMBURSE_EXPENSE', `Expense reimbursed: ${req.params.id}`);

    return res.json(updated);
  } catch (error: any) {
    if (error.message && error.message.includes('Only APPROVED expenses')) return res.status(409).json({ error: error.message });
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});
