import { beginTransaction } from '../client.js';

async function migrate() {
  console.log('Running 005_phase1_employee_org_rbac migration...');
  const client = await beginTransaction();
  
  try {
    console.log('Adding is_active column to branches, departments, teams, designations...');
    await client.query(`ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;`);
    await client.query(`ALTER TABLE departments ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;`);
    await client.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;`);
    await client.query(`ALTER TABLE designations ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;`);
    await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;`);
    await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE NULL;`);

    console.log('Adding unique employee_code per organization constraint...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'unique_employee_code_per_org'
        ) THEN
          ALTER TABLE employees ADD CONSTRAINT unique_employee_code_per_org UNIQUE (organization_id, employee_code);
        END IF;
      END $$;
    `);

    console.log('Creating multi-level circular manager validation function & trigger...');
    await client.query(`
      CREATE OR REPLACE FUNCTION check_circular_manager()
      RETURNS trigger AS $$
      DECLARE
        curr_id UUID;
        visited_count INT := 0;
        max_depth INT := 100;
      BEGIN
        IF NEW.manager_id IS NULL THEN
          RETURN NEW;
        END IF;

        IF NEW.manager_id = NEW.id THEN
          RAISE EXCEPTION 'CIRCULAR_MANAGER_HIERARCHY: An employee cannot be their own manager.';
        END IF;

        curr_id := NEW.manager_id;
        WHILE curr_id IS NOT NULL LOOP
          IF curr_id = NEW.id THEN
            RAISE EXCEPTION 'CIRCULAR_MANAGER_HIERARCHY: Multi-level circular manager loop detected.';
          END IF;
          
          visited_count := visited_count + 1;
          IF visited_count > max_depth THEN
            RAISE EXCEPTION 'CIRCULAR_MANAGER_HIERARCHY: Maximum hierarchy depth exceeded or cyclic loop detected.';
          END IF;

          SELECT manager_id INTO curr_id FROM employees WHERE id = curr_id AND deleted_at IS NULL;
        END LOOP;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS enforce_no_circular_manager ON employees;
    `);

    await client.query(`
      CREATE TRIGGER enforce_no_circular_manager
      BEFORE INSERT OR UPDATE OF manager_id ON employees
      FOR EACH ROW
      EXECUTE FUNCTION check_circular_manager();
    `);

    console.log('Creating manager organization mismatch validation trigger...');
    await client.query(`
      CREATE OR REPLACE FUNCTION check_manager_org_match()
      RETURNS trigger AS $$
      DECLARE
        mgr_org_id UUID;
      BEGIN
        IF NEW.manager_id IS NULL THEN
          RETURN NEW;
        END IF;

        SELECT organization_id INTO mgr_org_id FROM employees WHERE id = NEW.manager_id;
        IF mgr_org_id IS NOT NULL AND mgr_org_id != NEW.organization_id THEN
          RAISE EXCEPTION 'ORGANIZATION_MISMATCH: Manager belongs to a different organization.';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS enforce_manager_org_match ON employees;
    `);

    await client.query(`
      CREATE TRIGGER enforce_manager_org_match
      BEFORE INSERT OR UPDATE OF manager_id, organization_id ON employees
      FOR EACH ROW
      EXECUTE FUNCTION check_manager_org_match();
    `);

    await client.commit();
    console.log('Migration 005 completed successfully.');

  } catch (err) {
    await client.rollback();
    console.error('Migration 005 failed:', err);
    throw err;
  }
}

migrate().catch(console.error);
