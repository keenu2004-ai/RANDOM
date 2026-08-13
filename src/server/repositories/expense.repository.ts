import { query, queryOne, beginTransaction } from '../db/client';
import { notificationService } from '../services/notification.service';
import { logMasterDataChangeTx } from '../utils/audit-logger';

export class ExpenseRepository {
  // Paginated list with org isolation + role scoping
  async getAllExpenses(orgId: string, role: string, empId: string, filters: {
    status?: string;
    categoryId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    // Whitelist sort columns
    const SORT_WHITELIST: Record<string, string> = {
      expenseDate: 'e.expense_date',
      amount: 'e.amount_inr',
      createdAt: 'e.created_at',
      status: 'e.status',
    };
    const sortCol = SORT_WHITELIST[filters.sortBy || 'createdAt'] || 'e.created_at';
    const sortDir = filters.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const offset = (page - 1) * limit;

    let where = 'WHERE e.organization_id = $1';
    const params: any[] = [orgId];
    let idx = 2;

    if (role === 'EMPLOYEE') {
      where += ` AND e.employee_id = $${idx++}`;
      params.push(empId);
    } else if (role === 'MANAGER') {
      where += ` AND e.employee_id IN (SELECT id FROM employees WHERE organization_id = $1 AND (manager_id = $${idx} OR id = $${idx}))`;
      params.push(empId);
      idx++;
    }
    if (filters.status) { where += ` AND e.status = $${idx++}`; params.push(filters.status); }
    if (filters.categoryId) { where += ` AND e.category_id = $${idx++}`; params.push(filters.categoryId); }
    if (filters.startDate) { where += ` AND e.expense_date >= $${idx++}`; params.push(filters.startDate); }
    if (filters.endDate) { where += ` AND e.expense_date <= $${idx++}`; params.push(filters.endDate); }

    const countSql = `SELECT COUNT(*) as total FROM expenses e ${where}`;
    const countRes = await queryOne<any>(countSql, params);
    const total = parseInt(countRes?.total || '0');

    const dataSql = `
      SELECT e.*, emp.first_name, emp.last_name, emp.employee_code,
             d.name as department_name, c.name as category_name, c.code as category_code, c.max_limit_inr
      FROM expenses e
      LEFT JOIN employees emp ON e.employee_id = emp.id
      LEFT JOIN departments d ON emp.department_id = d.id
      LEFT JOIN expense_categories c ON e.category_id = c.id
      ${where}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, offset);

    const rows = await query(dataSql, params);
    const data = rows.map(r => ({
      id: r.id, employeeId: r.employee_id, categoryId: r.category_id,
      amount: parseFloat(r.amount_inr), expenseDate: r.expense_date,
      description: r.description, title: r.title,
      receiptUrl: r.receipt_url, receiptName: r.receipt_name, receiptId: r.receipt_id,
      status: r.status, rejectionReason: r.rejection_reason,
      reimbursementDate: r.reimbursement_date, approvedBy: r.approved_by,
      approvedAt: r.approved_at, rejectedBy: r.rejected_by, rejectedAt: r.rejected_at,
      createdAt: r.created_at, updatedAt: r.updated_at,
      employeeName: r.first_name ? `${r.first_name} ${r.last_name}` : 'Unknown',
      employeeCode: r.employee_code, departmentName: r.department_name,
      categoryName: r.category_name, categoryCode: r.category_code, maxLimitInr: r.max_limit_inr
    }));

    return { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getCategories(organizationId: string) {
    const res = await query(`SELECT * FROM expense_categories WHERE organization_id = $1 ORDER BY name`, [organizationId]);
    return res.map(r => ({ id: r.id, name: r.name, code: r.code, maxLimitInr: r.max_limit_inr, requiresReceipt: r.requires_receipt }));
  }

  async createCategory(organizationId: string, id: string, name: string, code: string, maxLimitInr: number | undefined, requiresReceipt: boolean) {
    await query(`INSERT INTO expense_categories (id, organization_id, name, code, max_limit_inr, requires_receipt) VALUES ($1, $2, $3, $4, $5, $6)`, [id, organizationId, name, code, maxLimitInr || null, requiresReceipt]);
  }

  async saveReceipt(organizationId: string, id: string, fileName: string, mimeType: string, sizeBytes: number, dataBase64: string, uploadedBy: string, uploadedAt: string) {
    await query(`INSERT INTO receipts (id, organization_id, file_name, mime_type, size_bytes, data_base64, uploaded_by, uploaded_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [id, organizationId, fileName, mimeType, sizeBytes, dataBase64, uploadedBy, uploadedAt]);
  }

  async getReceipt(organizationId: string, id: string) {
    const res = await queryOne<any>(`SELECT * FROM receipts WHERE organization_id = $1 AND id = $2`, [organizationId, id]);
    return res ? { id: res.id, fileName: res.file_name, mimeType: res.mime_type, dataBase64: res.data_base64, uploadedBy: res.uploaded_by } : null;
  }

  async getExpenseByReceipt(organizationId: string, receiptId: string) {
    const res = await queryOne<any>(`SELECT * FROM expenses WHERE organization_id = $1 AND (receipt_id = $2 OR receipt_url = $3)`, [organizationId, receiptId, `/api/expenses/receipts/${receiptId}`]);
    return res ? { employeeId: res.employee_id } : null;
  }

  async getExpense(organizationId: string, id: string) {
    const res = await queryOne<any>(`
      SELECT e.*, emp.first_name, emp.last_name, emp.employee_code, emp.manager_id
      FROM expenses e
      JOIN employees emp ON e.employee_id = emp.id
      WHERE e.organization_id = $1 AND e.id = $2
    `, [organizationId, id]);
    if (!res) return null;
    return {
      id: res.id, employeeId: res.employee_id, managerIdOfEmployee: res.manager_id,
      categoryId: res.category_id, amount: parseFloat(res.amount_inr), expenseDate: res.expense_date,
      description: res.description, title: res.title,
      receiptUrl: res.receipt_url, receiptName: res.receipt_name, receiptId: res.receipt_id,
      status: res.status, rejectionReason: res.rejection_reason, reimbursementDate: res.reimbursement_date,
      approvedBy: res.approved_by, rejectedBy: res.rejected_by,
      createdAt: res.created_at
    };
  }

  async getCategory(organizationId: string, id: string) {
    const res = await queryOne<any>(`SELECT * FROM expense_categories WHERE organization_id = $1 AND id = $2`, [organizationId, id]);
    return res ? { id: res.id, name: res.name, code: res.code, maxLimitInr: res.max_limit_inr, requiresReceipt: res.requires_receipt } : null;
  }

  async createExpense(organizationId: string, exp: any) {
    const client = await beginTransaction();
    try {
      const cat = await client.queryOne<any>(`
        SELECT * FROM expense_categories 
        WHERE organization_id = $1 AND id = $2 AND is_active = true AND deleted_at IS NULL
      `, [organizationId, exp.categoryId]);

      if (!cat) {
        throw new Error('EXPENSE_CATEGORY_INACTIVE: The selected expense category is inactive, deleted, or invalid.');
      }

      const res = await client.queryOne<any>(`
        INSERT INTO expenses (id, organization_id, employee_id, category_id, title, amount_inr, expense_date, description, receipt_url, receipt_name, receipt_id, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        RETURNING *
      `, [exp.id, organizationId, exp.employeeId, exp.categoryId, exp.title || exp.description?.substring(0, 100) || 'Expense', exp.amount, exp.expenseDate, exp.description, exp.receiptUrl || null, exp.receiptName || null, exp.receiptId || null, exp.status]);

      await notificationService.notifyManager(organizationId, exp.employeeId, {
        notificationType: 'EXPENSE_SUBMITTED',
        title: 'Expense Submitted',
        message: 'A new expense has been submitted for approval.',
        entityType: 'EXPENSE',
        entityId: exp.id,
        priority: 'NORMAL'
      }, client);

      await logMasterDataChangeTx(client, {
        organizationId,
        action: 'EXPENSE_SUBMITTED',
        entityType: 'ORGANIZATION' as any,
        entityId: exp.id,
        oldValues: null,
        newValues: res
      });

      await client.commit();
      return res;
    } catch (err) {
      await client.rollback();
      throw err;
    }
  }

  async updateExpense(organizationId: string, exp: any) {
    await query(`
      UPDATE expenses SET category_id=$1, amount_inr=$2, expense_date=$3, description=$4,
      title=$5, receipt_url=$6, receipt_name=$7, receipt_id=$8, status=$9, updated_at=NOW()
      WHERE organization_id=$10 AND id=$11
    `, [exp.categoryId, exp.amount, exp.expenseDate, exp.description, exp.title || exp.description?.substring(0,100), exp.receiptUrl || null, exp.receiptName || null, exp.receiptId || null, exp.status, organizationId, exp.id]);
  }

  async deleteExpense(organizationId: string, id: string) {
    await query(`DELETE FROM expenses WHERE organization_id=$1 AND id=$2`, [organizationId, id]);
  }

  // Transactional approve with FOR UPDATE locking
  async approveExpense(orgId: string, expId: string, reviewerId: string) {
    const client = await beginTransaction();
    try {
      const exp = await client.queryOne(`SELECT * FROM expenses WHERE organization_id=$1 AND id=$2 FOR UPDATE`, [orgId, expId]);
      if (!exp) { await client.rollback(); return null; }
      if (exp.status !== 'SUBMITTED') { await client.rollback(); throw new Error(`Expense is not in SUBMITTED state (current: ${exp.status})`); }

      const updated = await client.queryOne(`
        UPDATE expenses SET status='APPROVED', approved_by=$1, approved_at=NOW(), updated_at=NOW()
        WHERE organization_id=$2 AND id=$3 AND status='SUBMITTED'
        RETURNING *
      `, [reviewerId, orgId, expId]);

      if (!updated) { await client.rollback(); throw new Error('Expense was already processed by another request'); }
      
      await notificationService.createNotification({
        organizationId: orgId,
        recipientEmployeeId: exp.employee_id,
        notificationType: 'EXPENSE_APPROVED',
        title: 'Expense APPROVED',
        message: 'Your expense has been approved',
        entityType: 'EXPENSE',
        entityId: expId,
        priority: 'HIGH'
      }, client);

      await logMasterDataChangeTx(client, {
        organizationId: orgId,
        actorUserId: reviewerId,
        action: 'EXPENSE_APPROVED',
        entityType: 'ORGANIZATION' as any,
        entityId: expId,
        oldValues: exp,
        newValues: updated
      });

      await client.commit();
      return updated;
    } catch (err) {
      await client.rollback();
      throw err;
    }
  }

  // Transactional reject with FOR UPDATE locking
  async rejectExpense(orgId: string, expId: string, reviewerId: string, rejectionReason: string) {
    const client = await beginTransaction();
    try {
      const exp = await client.queryOne(`SELECT * FROM expenses WHERE organization_id=$1 AND id=$2 FOR UPDATE`, [orgId, expId]);
      if (!exp) { await client.rollback(); return null; }
      if (exp.status !== 'SUBMITTED') { await client.rollback(); throw new Error(`Expense is not in SUBMITTED state (current: ${exp.status})`); }

      const updated = await client.queryOne(`
        UPDATE expenses SET status='REJECTED', rejected_by=$1, rejected_at=NOW(), rejection_reason=$2, updated_at=NOW()
        WHERE organization_id=$3 AND id=$4 AND status='SUBMITTED'
        RETURNING *
      `, [reviewerId, rejectionReason, orgId, expId]);

      if (!updated) { await client.rollback(); throw new Error('Expense was already processed by another request'); }
      
      await notificationService.createNotification({
        organizationId: orgId,
        recipientEmployeeId: exp.employee_id,
        notificationType: 'EXPENSE_REJECTED',
        title: 'Expense REJECTED',
        message: 'Your expense has been rejected',
        entityType: 'EXPENSE',
        entityId: expId,
        priority: 'HIGH'
      }, client);

      await logMasterDataChangeTx(client, {
        organizationId: orgId,
        actorUserId: reviewerId,
        action: 'EXPENSE_REJECTED',
        entityType: 'ORGANIZATION' as any,
        entityId: expId,
        oldValues: exp,
        newValues: updated
      });

      await client.commit();
      return updated;
    } catch (err) {
      await client.rollback();
      throw err;
    }
  }

  async reimburseExpense(orgId: string, expId: string) {
    const client = await beginTransaction();
    try {
      const exp = await client.queryOne(`SELECT * FROM expenses WHERE organization_id=$1 AND id=$2 FOR UPDATE`, [orgId, expId]);
      if (!exp) { await client.rollback(); return null; }
      if (exp.status !== 'APPROVED') { await client.rollback(); throw new Error('Only APPROVED expenses can be reimbursed'); }

      const updated = await client.queryOne(`
        UPDATE expenses SET status='REIMBURSED', reimbursement_date=CURRENT_DATE, updated_at=NOW()
        WHERE organization_id=$1 AND id=$2 AND status='APPROVED'
        RETURNING *
      `, [orgId, expId]);
      if (!updated) { await client.rollback(); throw new Error('Expense was already reimbursed'); }

      await logMasterDataChangeTx(client, {
        organizationId: orgId,
        action: 'EXPENSE_REIMBURSED',
        entityType: 'ORGANIZATION' as any,
        entityId: expId,
        oldValues: exp,
        newValues: updated
      });

      await client.commit();
      return updated;
    } catch (err) {
      await client.rollback();
      throw err;
    }
  }
}
export const expenseRepository = new ExpenseRepository();
