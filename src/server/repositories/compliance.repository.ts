import { query, queryOne } from '../db/client';

export class ComplianceRepository {
  private initialized = false;

  async initSchema() {
    if (this.initialized) return;
    try {
      await query(`
        ALTER TABLE statutory_rules 
        ADD COLUMN IF NOT EXISTS category VARCHAR(100),
        ADD COLUMN IF NOT EXISTS state VARCHAR(100),
        ADD COLUMN IF NOT EXISTS fixed_amount DECIMAL(12,2),
        ADD COLUMN IF NOT EXISTS effective_date DATE,
        ADD COLUMN IF NOT EXISTS expiry_date DATE,
        ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      `);

      await query(`
        ALTER TABLE compliance_calendar
        ADD COLUMN IF NOT EXISTS category VARCHAR(100),
        ADD COLUMN IF NOT EXISTS frequency VARCHAR(50),
        ADD COLUMN IF NOT EXISTS responsible_person VARCHAR(255),
        ADD COLUMN IF NOT EXISTS responsible_person_id UUID,
        ADD COLUMN IF NOT EXISTS notes TEXT,
        ADD COLUMN IF NOT EXISTS reminder_date DATE,
        ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS completed_by VARCHAR(255),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      `);
      this.initialized = true;
    } catch (err) {
      console.warn('PostgreSQL compliance schema migration error:', err);
    }
  }

  async getStatutoryRules(orgId: string): Promise<any[]> {
    await this.initSchema();
    const rows = await query(`SELECT * FROM statutory_rules WHERE organization_id = $1 ORDER BY created_at ASC`, [orgId]);
    return rows.map(r => ({
      id: r.id,
      organizationId: r.organization_id,
      ruleName: r.rule_name,
      category: r.category || 'General',
      state: r.state || 'All India',
      ratePercentage: r.percentage ? Number(r.percentage) : 0,
      fixedAmount: r.fixed_amount ? Number(r.fixed_amount) : undefined,
      thresholdAmount: r.threshold_limit_inr ? Number(r.threshold_limit_inr) : 0,
      effectiveDate: r.effective_date,
      expiryDate: r.expiry_date,
      active: r.active,
      description: r.description,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  async getStatutoryRuleById(orgId: string, id: string): Promise<any | null> {
    await this.initSchema();
    const row = await queryOne(`SELECT * FROM statutory_rules WHERE id = $1 AND organization_id = $2`, [id, orgId]);
    if (!row) return null;
    return {
      id: row.id,
      organizationId: row.organization_id,
      ruleName: row.rule_name,
      category: row.category || 'General',
      state: row.state || 'All India',
      ratePercentage: row.percentage ? Number(row.percentage) : 0,
      fixedAmount: row.fixed_amount ? Number(row.fixed_amount) : undefined,
      thresholdAmount: row.threshold_limit_inr ? Number(row.threshold_limit_inr) : 0,
      effectiveDate: row.effective_date,
      expiryDate: row.expiry_date,
      active: row.active,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async createStatutoryRule(orgId: string, rule: any): Promise<any> {
    await this.initSchema();
    await query(`
      INSERT INTO statutory_rules (
        id, organization_id, rule_name, category, state, percentage, fixed_amount, 
        threshold_limit_inr, effective_date, expiry_date, active, description, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13
      )
    `, [
      rule.id, orgId, rule.ruleName, rule.category, rule.state, rule.ratePercentage, rule.fixedAmount,
      rule.thresholdAmount, rule.effectiveDate, rule.expiryDate, rule.active, rule.description, rule.createdAt
    ]);
    return this.getStatutoryRuleById(orgId, rule.id);
  }

  async updateStatutoryRule(orgId: string, id: string, data: any): Promise<any> {
    await this.initSchema();
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.ruleName !== undefined) { updates.push(`rule_name = $${idx++}`); values.push(data.ruleName); }
    if (data.category !== undefined) { updates.push(`category = $${idx++}`); values.push(data.category); }
    if (data.state !== undefined) { updates.push(`state = $${idx++}`); values.push(data.state); }
    if (data.ratePercentage !== undefined) { updates.push(`percentage = $${idx++}`); values.push(data.ratePercentage); }
    if (data.fixedAmount !== undefined) { updates.push(`fixed_amount = $${idx++}`); values.push(data.fixedAmount); }
    if (data.thresholdAmount !== undefined) { updates.push(`threshold_limit_inr = $${idx++}`); values.push(data.thresholdAmount); }
    if (data.effectiveDate !== undefined) { updates.push(`effective_date = $${idx++}`); values.push(data.effectiveDate); }
    if (data.expiryDate !== undefined) { updates.push(`expiry_date = $${idx++}`); values.push(data.expiryDate); }
    if (data.active !== undefined) { updates.push(`active = $${idx++}`); values.push(data.active); }
    if (data.description !== undefined) { updates.push(`description = $${idx++}`); values.push(data.description); }

    updates.push(`updated_at = NOW()`);
    values.push(id, orgId);

    await query(`UPDATE statutory_rules SET ${updates.join(', ')} WHERE id = $${idx} AND organization_id = $${idx + 1}`, values);
    return this.getStatutoryRuleById(orgId, id);
  }

  async deleteStatutoryRule(orgId: string, id: string): Promise<void> {
    await query(`DELETE FROM statutory_rules WHERE id = $1 AND organization_id = $2`, [id, orgId]);
  }

  async getComplianceTasks(orgId: string): Promise<any[]> {
    await this.initSchema();
    const rows = await query(`SELECT * FROM compliance_calendar WHERE organization_id = $1 ORDER BY due_date ASC`, [orgId]);
    return rows.map(r => ({
      id: r.id,
      organizationId: r.organization_id,
      taskName: r.title,
      category: r.category,
      dueDate: r.due_date,
      frequency: r.frequency,
      responsiblePerson: r.responsible_person,
      responsiblePersonId: r.responsible_person_id,
      status: r.status,
      notes: r.notes,
      reminderDate: r.reminder_date,
      completedAt: r.completed_at,
      completedBy: r.completed_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  async getComplianceTaskById(orgId: string, id: string): Promise<any | null> {
    await this.initSchema();
    const row = await queryOne(`SELECT * FROM compliance_calendar WHERE id = $1 AND organization_id = $2`, [id, orgId]);
    if (!row) return null;
    return {
      id: row.id,
      organizationId: row.organization_id,
      taskName: row.title,
      category: row.category,
      dueDate: row.due_date,
      frequency: row.frequency,
      responsiblePerson: row.responsible_person,
      responsiblePersonId: row.responsible_person_id,
      status: row.status,
      notes: row.notes,
      reminderDate: row.reminder_date,
      completedAt: row.completed_at,
      completedBy: row.completed_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async createComplianceTask(orgId: string, task: any): Promise<any> {
    await this.initSchema();
    await query(`
      INSERT INTO compliance_calendar (
        id, organization_id, title, statute_type, due_date, status, category, frequency,
        responsible_person, responsible_person_id, notes, reminder_date, created_at, updated_at
      ) VALUES (
        $1, $2, $3, 'GENERAL', $4, $5, $6, $7, $8, $9, $10, $11, $12, $12
      )
    `, [
      task.id, orgId, task.taskName, task.dueDate, task.status, task.category, task.frequency,
      task.responsiblePerson, task.responsiblePersonId, task.notes, task.reminderDate, task.createdAt
    ]);
    return this.getComplianceTaskById(orgId, task.id);
  }

  async updateComplianceTask(orgId: string, id: string, data: any): Promise<any> {
    await this.initSchema();
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.taskName !== undefined) { updates.push(`title = $${idx++}`); values.push(data.taskName); }
    if (data.category !== undefined) { updates.push(`category = $${idx++}`); values.push(data.category); }
    if (data.dueDate !== undefined) { updates.push(`due_date = $${idx++}`); values.push(data.dueDate); }
    if (data.frequency !== undefined) { updates.push(`frequency = $${idx++}`); values.push(data.frequency); }
    if (data.responsiblePerson !== undefined) { updates.push(`responsible_person = $${idx++}`); values.push(data.responsiblePerson); }
    if (data.responsiblePersonId !== undefined) { updates.push(`responsible_person_id = $${idx++}`); values.push(data.responsiblePersonId); }
    if (data.status !== undefined) { updates.push(`status = $${idx++}`); values.push(data.status); }
    if (data.notes !== undefined) { updates.push(`notes = $${idx++}`); values.push(data.notes); }
    if (data.reminderDate !== undefined) { updates.push(`reminder_date = $${idx++}`); values.push(data.reminderDate); }
    if (data.completedAt !== undefined) { updates.push(`completed_at = $${idx++}`); values.push(data.completedAt); }
    if (data.completedBy !== undefined) { updates.push(`completed_by = $${idx++}`); values.push(data.completedBy); }

    updates.push(`updated_at = NOW()`);
    values.push(id, orgId);

    await query(`UPDATE compliance_calendar SET ${updates.join(', ')} WHERE id = $${idx} AND organization_id = $${idx + 1}`, values);
    return this.getComplianceTaskById(orgId, id);
  }

  async deleteComplianceTask(orgId: string, id: string): Promise<void> {
    await query(`DELETE FROM compliance_calendar WHERE id = $1 AND organization_id = $2`, [id, orgId]);
  }
}

export const complianceRepository = new ComplianceRepository();
