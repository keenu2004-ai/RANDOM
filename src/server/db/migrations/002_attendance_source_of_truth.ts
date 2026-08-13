import { query, exec, beginTransaction } from '../client.js';

async function migrate() {
  console.log('Starting Attendance Source-Of-Truth Migration...');
  const client = await beginTransaction();
  
  try {
    console.log('Step B: Adding organization_id to attendance_locations...');
    await client.query(`
      ALTER TABLE attendance_locations 
      ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT
    `);

    console.log('Step C & D: Backfilling organization_id from branches and verifying...');
    await client.query(`
      UPDATE attendance_locations al
      SET organization_id = b.organization_id
      FROM branches b
      WHERE al.branch_id = b.id AND al.organization_id IS NULL
    `);

    const missingOrgs = await client.query(`SELECT id FROM attendance_locations WHERE organization_id IS NULL`);
    if (missingOrgs.length > 0) {
      console.warn(`WARNING: ${missingOrgs.length} attendance_locations still have no organization_id!`);
    }

    console.log('Step E: Adding shifts.location_id with ON DELETE RESTRICT...');
    await client.query(`
      ALTER TABLE shifts 
      ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES attendance_locations(id) ON DELETE RESTRICT
    `);

    console.log('Step L: Adding context_snapshot to attendance...');
    await client.query(`
      ALTER TABLE attendance 
      ADD COLUMN IF NOT EXISTS context_snapshot JSONB
    `);

    console.log('Step H & I: Migrating existing employee shift assignments to employee_shifts...');
    // Create employee_shifts if not exists (it should exist based on 001_initial_schema.sql, but just in case)
    await client.query(`
      CREATE TABLE IF NOT EXISTS employee_shifts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
        effective_from DATE NOT NULL,
        effective_to DATE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add overlapping assignment protection (Exclusion constraint is best, but a unique index on active can work for simple cases)
    // For now, we will rely on application logic or trigger if GiST extension isn't available.

    // Backfill employee_shifts from employees.shift_id
    const employeesWithShifts = await client.query(`
      SELECT id, shift_id, date_of_joining FROM employees WHERE shift_id IS NOT NULL
    `);

    let migratedAssignments = 0;
    for (const emp of employeesWithShifts) {
      const existing = await client.query(`
        SELECT id FROM employee_shifts WHERE employee_id = $1 AND shift_id = $2
      `, [emp.id, emp.shift_id]);

      if (existing.length === 0) {
        await client.query(`
          INSERT INTO employee_shifts (employee_id, shift_id, effective_from)
          VALUES ($1, $2, CURRENT_DATE)
        `, [emp.id, emp.shift_id]);
        migratedAssignments++;
      }
    }

    console.log(`Migrated ${migratedAssignments} employee shift assignments.`);
    
    // Step J: Unresolved employees
    const unresolved = await client.query(`
      SELECT e.id, e.employee_code, e.first_name, e.last_name
      FROM employees e
      LEFT JOIN employee_shifts es ON e.id = es.employee_id
      WHERE es.id IS NULL
    `);
    
    console.log(`REPORT: ${unresolved.length} employees lack a shift assignment.`);
    if (unresolved.length > 0) {
      console.log('First 5 unresolved employees:', unresolved.slice(0, 5));
    }

    await client.commit();
    console.log('Migration committed successfully.');

  } catch (err) {
    await client.rollback();
    console.error('Migration failed and rolled back:', err);
    throw err;
  }
}

migrate().catch(console.error);
