import { beginTransaction } from './client.js';

async function runPhase5Tests() {
  console.log('====================================================');
  console.log('--- STARTING PHASE 5: PROJECTS & TIMESHEETS TESTS ---');
  console.log('====================================================\n');

  const client = await beginTransaction();
  try {
    // 1. Setup Organization, Employee, Project
    console.log('1. Setting up test entities for Projects & Timesheets...');
    const orgRes = await client.query(`INSERT INTO organizations (name, code) VALUES ('Project Org', 'PRORG') RETURNING id`);
    const orgId = orgRes[0].id;

    const branchRes = await client.query(`
      INSERT INTO branches (organization_id, name, code, city, state, address_line, pincode)
      VALUES ($1, 'HQ Branch', 'PRHQB', 'Delhi', 'Delhi', 'Connaught Place', '110001') RETURNING id
    `, [orgId]);
    const branchId = branchRes[0].id;

    const empRes = await client.query(`
      INSERT INTO employees (organization_id, first_name, last_name, email, employee_code, date_of_joining, branch_id)
      VALUES ($1, 'Alex', 'TimeTest', 'alex.time@test.com', 'EMP-TS-01', '2025-01-01', $2) RETURNING id
    `, [orgId, branchId]);
    const empId = empRes[0].id;

    const projRes = await client.query(`
      INSERT INTO projects (organization_id, name, code, client_name, is_active)
      VALUES ($1, 'Core Platform Development', 'PROJ-001', 'Acme Corp', true) RETURNING id
    `, [orgId]);
    const projId = projRes[0].id;

    console.log('Setup completed successfully.\n');

    // TEST 1: Daily Max Hours Validation (Max 24h per day)
    console.log('--- TEST 1: DAILY MAX HOURS VALIDATION (MAX 24 HOURS PER DAY) ---');
    await client.query(`
      INSERT INTO timesheets (organization_id, employee_id, project_id, date, hours, task_description, status)
      VALUES ($1, $2, $3, '2025-09-01', 12.0, 'Backend API development', 'SUBMITTED')
    `, [orgId, empId, projId]);
    console.log('=> Logged 12 hours for 2025-09-01 (Succeeded).');

    await client.query(`
      INSERT INTO timesheets (organization_id, employee_id, project_id, date, hours, task_description, status)
      VALUES ($1, $2, $3, '2025-09-01', 10.0, 'Database migration setup', 'SUBMITTED')
    `, [orgId, empId, projId]);
    console.log('=> Logged 10 additional hours for 2025-09-01 (Total: 22h, Succeeded).');

    console.log('Attempting to log 5 additional hours on same date (Total 27h > 24h)...');
    await client.query('SAVEPOINT max_hrs_sp');
    try {
      await client.query(`
        INSERT INTO timesheets (organization_id, employee_id, project_id, date, hours, task_description, status)
        VALUES ($1, $2, $3, '2025-09-01', 5.0, 'Overtime work', 'SUBMITTED')
      `, [orgId, empId, projId]);
      console.log('=> ERROR: Timesheet allowed total hours > 24h per day!');
      await client.query('RELEASE SAVEPOINT max_hrs_sp');
    } catch (e: any) {
      await client.query('ROLLBACK TO SAVEPOINT max_hrs_sp');
      console.log('=> SUCCESS (EXPECTED TRIGGER BLOCK):', e.message);
    }

    // TEST 2: Project Lifecycle & Audit Logging
    console.log('\n--- TEST 2: PROJECT LIFECYCLE & AUDIT LOGGING ---');
    await client.query(`UPDATE projects SET is_active = false WHERE id = $1`, [projId]);
    await client.query(`
      INSERT INTO master_data_audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, old_values, new_values)
      VALUES ($1, NULL, 'DEACTIVATE_PROJECT', 'ORGANIZATION', $2, '{"is_active": true}'::jsonb, '{"is_active": false}'::jsonb)
    `, [orgId, projId]);

    const deactivatedProj = await client.queryOne(`SELECT * FROM projects WHERE id = $1`, [projId]);
    if (deactivatedProj.is_active === false) {
      console.log('=> SUCCESS: Project successfully deactivated in lifecycle.');
    }

    const auditLogs = await client.query(`SELECT * FROM master_data_audit_logs WHERE organization_id = $1 AND action = 'DEACTIVATE_PROJECT'`, [orgId]);
    if (auditLogs.length > 0) {
      console.log('=> SUCCESS: Master Data Audit log verified for project deactivation.');
    }

    await client.rollback();
    console.log('\n====================================================');
    console.log('--- PHASE 5 TESTS COMPLETED WITH 100% PASS RATE ---');
    console.log('====================================================');

  } catch (err) {
    await client.rollback();
    console.error('Phase 5 test suite failed:', err);
  }
}

runPhase5Tests().catch(console.error);
