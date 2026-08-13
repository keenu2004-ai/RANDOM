import { beginTransaction } from '../client.js';

async function migrate() {
  console.log('Running 007_phase3_salary_payroll_compliance migration...');
  const client = await beginTransaction();
  
  try {
    console.log('Adding organization_id to salary_structures, payroll_records, and payslips...');
    await client.query(`ALTER TABLE salary_structures ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;`);
    await client.query(`ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;`);
    await client.query(`ALTER TABLE payslips ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;`);

    // Backfill organization_id from employees
    await client.query(`
      UPDATE salary_structures ss SET organization_id = e.organization_id FROM employees e WHERE ss.employee_id = e.id AND ss.organization_id IS NULL;
    `);
    await client.query(`
      UPDATE payroll_records pr SET organization_id = e.organization_id FROM employees e WHERE pr.employee_id = e.id AND pr.organization_id IS NULL;
    `);
    await client.query(`
      UPDATE payslips ps SET organization_id = e.organization_id FROM employees e WHERE ps.employee_id = e.id AND ps.organization_id IS NULL;
    `);

    console.log('Adding calculation_snapshot JSONB to payroll_records and payslips...');
    await client.query(`ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS calculation_snapshot JSONB;`);
    await client.query(`ALTER TABLE payslips ADD COLUMN IF NOT EXISTS calculation_snapshot JSONB;`);

    console.log('Creating effective-dated employee_salary_structures table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS employee_salary_structures (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
          basic_salary DECIMAL(12,2) NOT NULL,
          hra DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          allowances DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          gross_salary DECIMAL(12,2) NOT NULL,
          pf_deduction DECIMAL(12,2) DEFAULT 0.00,
          esi_deduction DECIMAL(12,2) DEFAULT 0.00,
          pt_deduction DECIMAL(12,2) DEFAULT 0.00,
          tds_deduction DECIMAL(12,2) DEFAULT 0.00,
          net_salary DECIMAL(12,2) NOT NULL,
          effective_from DATE NOT NULL,
          effective_to DATE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Creating trigger for overlapping salary structures protection...');
    await client.query(`
      CREATE OR REPLACE FUNCTION check_overlapping_salary_structures()
      RETURNS trigger AS $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM employee_salary_structures
          WHERE employee_id = NEW.employee_id
            AND id != NEW.id
            AND (effective_to IS NULL OR effective_to >= NEW.effective_from)
            AND (NEW.effective_to IS NULL OR effective_from <= NEW.effective_to)
        ) THEN
          RAISE EXCEPTION 'OVERLAPPING_SALARY_STRUCTURE: Employee already has an active or effective salary structure during this date range.';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`DROP TRIGGER IF EXISTS enforce_no_overlapping_salaries ON employee_salary_structures;`);
    await client.query(`
      CREATE TRIGGER enforce_no_overlapping_salaries
      BEFORE INSERT OR UPDATE ON employee_salary_structures
      FOR EACH ROW
      EXECUTE FUNCTION check_overlapping_salary_structures();
    `);

    // Backfill employee_salary_structures from salary_structures or employees table
    const employeesWithSalary = await client.query(`
      SELECT id, organization_id, base_salary_inr, hra, allowances FROM employees WHERE base_salary_inr IS NOT NULL AND base_salary_inr > 0
    `);

    let backfilled = 0;
    for (const emp of employeesWithSalary) {
      const existing = await client.query(`SELECT id FROM employee_salary_structures WHERE employee_id = $1`, [emp.id]);
      if (existing.length === 0) {
        const basic = parseFloat(emp.base_salary_inr || '50000');
        const hra = parseFloat(emp.hra || '20000');
        const allowances = parseFloat(emp.allowances || '10000');
        const gross = basic + hra + allowances;
        const pf = Math.round(basic * 0.12);
        const esi = gross <= 21000 ? Math.round(gross * 0.0075) : 0;
        const pt = 200;
        const tds = Math.round(gross * 0.10);
        const net = gross - (pf + esi + pt + tds);

        await client.query(`
          INSERT INTO employee_salary_structures 
          (organization_id, employee_id, basic_salary, hra, allowances, gross_salary, pf_deduction, esi_deduction, pt_deduction, tds_deduction, net_salary, effective_from)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, '2025-01-01')
        `, [emp.organization_id, emp.id, basic, hra, allowances, gross, pf, esi, pt, tds, net]);
        backfilled++;
      }
    }
    console.log(`Backfilled ${backfilled} employee salary structures.`);

    await client.commit();
    console.log('Migration 007 completed successfully.');

  } catch (err) {
    await client.rollback();
    console.error('Migration 007 failed:', err);
    throw err;
  }
}

migrate().catch(console.error);
