import { beginTransaction } from '../client.js';

async function migrate() {
  console.log('Running 003_enforce_no_overlapping_shifts...');
  const client = await beginTransaction();
  
  try {
    await client.query(`
      CREATE OR REPLACE FUNCTION check_overlapping_employee_shifts()
      RETURNS trigger AS $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM employee_shifts 
          WHERE employee_id = NEW.employee_id 
          AND id != NEW.id 
          AND (effective_to IS NULL OR effective_to >= NEW.effective_from) 
          AND (NEW.effective_to IS NULL OR effective_from <= NEW.effective_to)
        ) THEN
          RAISE EXCEPTION 'Overlapping shift assignment for employee';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS enforce_no_overlapping_shifts ON employee_shifts;
    `);

    await client.query(`
      CREATE TRIGGER enforce_no_overlapping_shifts
      BEFORE INSERT OR UPDATE ON employee_shifts
      FOR EACH ROW
      EXECUTE FUNCTION check_overlapping_employee_shifts();
    `);

    await client.commit();
    console.log('Migration committed successfully.');

  } catch (err) {
    await client.rollback();
    console.error('Migration failed and rolled back:', err);
    throw err;
  }
}

migrate().catch(console.error);
