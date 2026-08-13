import { beginTransaction } from '../client.js';

async function migrate() {
  console.log('Running 006_phase2_leave_management migration...');
  const client = await beginTransaction();
  
  try {
    console.log('Adding organization_id to leave_requests and leave_balances...');
    await client.query(`
      ALTER TABLE leave_requests 
      ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    `);

    await client.query(`
      ALTER TABLE leave_balances 
      ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    `);

    // Backfill organization_id from employees
    await client.query(`
      UPDATE leave_requests lr
      SET organization_id = e.organization_id
      FROM employees e
      WHERE lr.employee_id = e.id AND lr.organization_id IS NULL;
    `);

    await client.query(`
      UPDATE leave_balances lb
      SET organization_id = e.organization_id
      FROM employees e
      WHERE lb.employee_id = e.id AND lb.organization_id IS NULL;
    `);

    console.log('Adding lifecycle fields to leave_types...');
    await client.query(`ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;`);
    await client.query(`ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE NULL;`);

    console.log('Creating overlapping leave request validation function & trigger...');
    await client.query(`
      CREATE OR REPLACE FUNCTION check_overlapping_leave_requests()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.status IN ('PENDING', 'APPROVED') THEN
          IF EXISTS (
            SELECT 1 FROM leave_requests
            WHERE employee_id = NEW.employee_id
              AND id != NEW.id
              AND status IN ('PENDING', 'APPROVED')
              AND start_date <= NEW.end_date
              AND end_date >= NEW.start_date
          ) THEN
            RAISE EXCEPTION 'OVERLAPPING_LEAVE_REQUEST: Employee already has a pending or approved leave request during this date interval.';
          END IF;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS enforce_no_overlapping_leaves ON leave_requests;
    `);

    await client.query(`
      CREATE TRIGGER enforce_no_overlapping_leaves
      BEFORE INSERT OR UPDATE OF start_date, end_date, status ON leave_requests
      FOR EACH ROW
      EXECUTE FUNCTION check_overlapping_leave_requests();
    `);

    await client.commit();
    console.log('Migration 006 completed successfully.');

  } catch (err) {
    await client.rollback();
    console.error('Migration 006 failed:', err);
    throw err;
  }
}

migrate().catch(console.error);
