import { beginTransaction } from '../client.js';

async function migrate() {
  console.log('Running 009_phase5_projects_timesheets migration...');
  const client = await beginTransaction();
  
  try {
    console.log('Adding organization_id to timesheets...');
    await client.query(`ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;`);

    // Backfill organization_id from employees
    await client.query(`
      UPDATE timesheets ts SET organization_id = e.organization_id FROM employees e WHERE ts.employee_id = e.id AND ts.organization_id IS NULL;
    `);

    console.log('Adding lifecycle fields to projects...');
    await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;`);
    await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE NULL;`);

    console.log('Creating project_members table if missing...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'MEMBER',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_project_member UNIQUE(project_id, employee_id)
      );
    `);

    console.log('Creating max daily hours validation function & trigger for timesheets...');
    await client.query(`
      CREATE OR REPLACE FUNCTION check_daily_timesheet_hours()
      RETURNS trigger AS $$
      DECLARE
        total_hrs DECIMAL(4,2);
      BEGIN
        SELECT COALESCE(SUM(hours), 0) INTO total_hrs
        FROM timesheets
        WHERE employee_id = NEW.employee_id
          AND date = NEW.date
          AND id != NEW.id;

        IF (total_hrs + NEW.hours) > 24.0 THEN
          RAISE EXCEPTION 'EXCEEDS_MAX_DAILY_HOURS: Total logged timesheet hours for an employee on a single date cannot exceed 24 hours (attempted % hours).', (total_hrs + NEW.hours);
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`DROP TRIGGER IF EXISTS enforce_max_daily_timesheet_hours ON timesheets;`);
    await client.query(`
      CREATE TRIGGER enforce_max_daily_timesheet_hours
      BEFORE INSERT OR UPDATE OF hours, date ON timesheets
      FOR EACH ROW
      EXECUTE FUNCTION check_daily_timesheet_hours();
    `);

    await client.commit();
    console.log('Migration 009 completed successfully.');

  } catch (err) {
    await client.rollback();
    console.error('Migration 009 failed:', err);
    throw err;
  }
}

migrate().catch(console.error);
