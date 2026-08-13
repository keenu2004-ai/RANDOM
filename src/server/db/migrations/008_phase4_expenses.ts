import { beginTransaction } from '../client.js';

async function migrate() {
  console.log('Running 008_phase4_expenses migration...');
  const client = await beginTransaction();
  
  try {
    console.log('Adding organization_id to expenses and expense_receipts...');
    await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;`);
    await client.query(`ALTER TABLE expense_receipts ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;`);

    // Backfill organization_id from employees
    await client.query(`
      UPDATE expenses ex SET organization_id = e.organization_id FROM employees e WHERE ex.employee_id = e.id AND ex.organization_id IS NULL;
    `);
    await client.query(`
      UPDATE expense_receipts er SET organization_id = ex.organization_id FROM expenses ex WHERE er.expense_id = ex.id AND er.organization_id IS NULL;
    `);

    console.log('Adding approval and reimbursement columns to expenses...');
    await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE NULL;`);
    await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES employees(id) ON DELETE SET NULL;`);
    await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE NULL;`);
    await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES employees(id) ON DELETE SET NULL;`);
    await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL;`);
    await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS reimbursement_date DATE NULL;`);

    await client.commit();
    console.log('Migration 008 completed successfully.');

  } catch (err) {
    await client.rollback();
    console.error('Migration 008 failed:', err);
    throw err;
  }
}

migrate().catch(console.error);
