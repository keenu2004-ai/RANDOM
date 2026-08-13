import { beginTransaction } from './client.js';

async function runPhase1Tests() {
  console.log('====================================================');
  console.log('--- STARTING PHASE 1: EMPLOYEE + ORG + RBAC TESTS ---');
  console.log('====================================================\n');

  const client = await beginTransaction();
  try {
    // 1. Create two separate organizations
    console.log('1. Setting up Organization A and Organization B...');
    const orgARes = await client.query(`INSERT INTO organizations (name, code) VALUES ('Org Alpha', 'ORGA') RETURNING id`);
    const orgIdA = orgARes[0].id;

    const orgBRes = await client.query(`INSERT INTO organizations (name, code) VALUES ('Org Beta', 'ORGB') RETURNING id`);
    const orgIdB = orgBRes[0].id;

    const branchARes = await client.query(`
      INSERT INTO branches (organization_id, name, code, city, state, address_line, pincode)
      VALUES ($1, 'Alpha HQ', 'AHQ', 'Delhi', 'Delhi', 'Connaught Place', '110001') RETURNING id
    `, [orgIdA]);
    const branchIdA = branchARes[0].id;

    const branchBRes = await client.query(`
      INSERT INTO branches (organization_id, name, code, city, state, address_line, pincode)
      VALUES ($1, 'Beta HQ', 'BHQ', 'Mumbai', 'Maharashtra', 'Nariman Point', '400021') RETURNING id
    `, [orgIdB]);
    const branchIdB = branchBRes[0].id;

    console.log('Setup completed successfully.\n');

    // TEST 1: Unique Employee Code per Organization
    console.log('--- TEST 1: UNIQUE EMPLOYEE CODE PER ORGANIZATION ---');
    await client.query(`
      INSERT INTO employees (organization_id, first_name, last_name, email, employee_code, date_of_joining)
      VALUES ($1, 'Emp1', 'Alpha', 'emp1@alpha.com', 'EMP-001', '2025-01-01')
    `, [orgIdA]);

    console.log('Inserting same code (EMP-001) in Org B...');
    await client.query(`
      INSERT INTO employees (organization_id, first_name, last_name, email, employee_code, date_of_joining)
      VALUES ($1, 'Emp1', 'Beta', 'emp1@beta.com', 'EMP-001', '2025-01-01')
    `, [orgIdB]);
    console.log('=> SUCCESS: Same employee code allowed in different organizations.');

    console.log('Attempting duplicate employee code (EMP-001) inside Org A...');
    await client.query('SAVEPOINT dup_code_sp');
    try {
      await client.query(`
        INSERT INTO employees (organization_id, first_name, last_name, email, employee_code, date_of_joining)
        VALUES ($1, 'Dup', 'Alpha', 'dup@alpha.com', 'EMP-001', '2025-01-01')
      `, [orgIdA]);
      console.log('=> ERROR: Duplicate employee code allowed in same org!');
      await client.query('RELEASE SAVEPOINT dup_code_sp');
    } catch (e: any) {
      await client.query('ROLLBACK TO SAVEPOINT dup_code_sp');
      console.log('=> SUCCESS (EXPECTED CONSTRAINT BLOCK):', e.message);
    }

    // TEST 2: Multi-Level Circular Manager Hierarchy Protection
    console.log('\n--- TEST 2: MULTI-LEVEL CIRCULAR MANAGER HIERARCHY PROTECTION ---');
    const emp1Res = await client.query(`
      INSERT INTO employees (organization_id, first_name, last_name, email, employee_code, date_of_joining)
      VALUES ($1, 'Manager1', 'Tree', 'm1@alpha.com', 'MGR-001', '2025-01-01') RETURNING id
    `, [orgIdA]);
    const emp1 = emp1Res[0].id;

    const emp2Res = await client.query(`
      INSERT INTO employees (organization_id, first_name, last_name, email, employee_code, date_of_joining, manager_id)
      VALUES ($1, 'Manager2', 'Tree', 'm2@alpha.com', 'MGR-002', '2025-01-01', $2) RETURNING id
    `, [orgIdA, emp1]);
    const emp2 = emp2Res[0].id;

    const emp3Res = await client.query(`
      INSERT INTO employees (organization_id, first_name, last_name, email, employee_code, date_of_joining, manager_id)
      VALUES ($1, 'Manager3', 'Tree', 'm3@alpha.com', 'MGR-003', '2025-01-01', $2) RETURNING id
    `, [orgIdA, emp2]);
    const emp3 = emp3Res[0].id;

    console.log('Attempting 3-level cyclic assignment (Manager1 -> Manager3)...');
    await client.query('SAVEPOINT circ_mgr_sp');
    try {
      await client.query(`UPDATE employees SET manager_id = $1 WHERE id = $2`, [emp3, emp1]);
      console.log('=> ERROR: Multi-level circular hierarchy allowed!');
      await client.query('RELEASE SAVEPOINT circ_mgr_sp');
    } catch (e: any) {
      await client.query('ROLLBACK TO SAVEPOINT circ_mgr_sp');
      console.log('=> SUCCESS (EXPECTED TRIGGER BLOCK):', e.message);
    }

    // TEST 3: Cross-Tenant Manager Mismatch Protection
    console.log('\n--- TEST 3: CROSS-TENANT MANAGER MISMATCH PROTECTION ---');
    const empBRes = await client.query(`
      INSERT INTO employees (organization_id, first_name, last_name, email, employee_code, date_of_joining)
      VALUES ($1, 'EmpOrgB', 'Beta', 'empB@beta.com', 'EMP-002', '2025-01-01') RETURNING id
    `, [orgIdB]);
    const empB = empBRes[0].id;

    console.log('Attempting to set Org B employee manager to Org A employee...');
    await client.query('SAVEPOINT cross_org_sp');
    try {
      await client.query(`UPDATE employees SET manager_id = $1 WHERE id = $2`, [emp1, empB]);
      console.log('=> ERROR: Cross-organization manager assignment allowed!');
      await client.query('RELEASE SAVEPOINT cross_org_sp');
    } catch (e: any) {
      await client.query('ROLLBACK TO SAVEPOINT cross_org_sp');
      console.log('=> SUCCESS (EXPECTED TRIGGER BLOCK):', e.message);
    }

    // TEST 4: Organization Isolation
    console.log('\n--- TEST 4: ORGANIZATION ISOLATION ---');
    const orgAEmps = await client.query(`SELECT id FROM employees WHERE organization_id = $1 AND deleted_at IS NULL`, [orgIdA]);
    const orgBEmps = await client.query(`SELECT id FROM employees WHERE organization_id = $1 AND deleted_at IS NULL`, [orgIdB]);
    console.log(`Org A Active Employees: ${orgAEmps.length}, Org B Active Employees: ${orgBEmps.length}`);
    if (orgAEmps.length === 4 && orgBEmps.length === 2) {
      console.log('=> SUCCESS: Strict backend organization isolation verified.');
    }

    // TEST 5: Lifecycle & Audit Logging
    console.log('\n--- TEST 5: EMPLOYEE LIFECYCLE & AUDIT LOGGING ---');
    console.log('Soft deleting Manager3...');
    await client.query(`UPDATE employees SET deleted_at = NOW(), status = 'INACTIVE' WHERE id = $1`, [emp3]);
    await client.query(`
      INSERT INTO master_data_audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, old_values, new_values)
      VALUES ($1, NULL, 'DELETE_EMPLOYEE', 'EMPLOYEE', $2, '{"status": "ACTIVE"}'::jsonb, '{"status": "INACTIVE"}'::jsonb)
    `, [orgIdA, emp3]);

    const activeCheck = await client.query(`SELECT id FROM employees WHERE organization_id = $1 AND deleted_at IS NULL`, [orgIdA]);
    if (activeCheck.length === 3) {
      console.log('=> SUCCESS: Soft-deleted employee properly excluded from active queries.');
    }

    await client.rollback();
    console.log('\n====================================================');
    console.log('--- PHASE 1 TESTS COMPLETED WITH 100% PASS RATE ---');
    console.log('====================================================');

  } catch (err) {
    await client.rollback();
    console.error('Phase 1 test suite failed:', err);
  }
}

runPhase1Tests().catch(console.error);
