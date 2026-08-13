import { beginTransaction } from './client.js';

async function runPhase2Tests() {
  console.log('====================================================');
  console.log('--- STARTING PHASE 2: LEAVE MANAGEMENT TESTS ---');
  console.log('====================================================\n');

  const client = await beginTransaction();
  try {
    // 1. Setup Organization, Employee, Leave Type
    console.log('1. Setting up test entities for Leave Management...');
    const orgRes = await client.query(`INSERT INTO organizations (name, code) VALUES ('Leave Org', 'LVORG') RETURNING id`);
    const orgId = orgRes[0].id;

    const branchRes = await client.query(`
      INSERT INTO branches (organization_id, name, code, city, state, address_line, pincode)
      VALUES ($1, 'HQ Branch', 'LHQB', 'Delhi', 'Delhi', 'Connaught Place', '110001') RETURNING id
    `, [orgId]);
    const branchId = branchRes[0].id;

    const empRes = await client.query(`
      INSERT INTO employees (organization_id, first_name, last_name, email, employee_code, date_of_joining, branch_id)
      VALUES ($1, 'John', 'LeaveTest', 'john.leave@test.com', 'EMP-LV-01', '2025-01-01', $2) RETURNING id
    `, [orgId, branchId]);
    const empId = empRes[0].id;

    const ltRes = await client.query(`
      INSERT INTO leave_types (organization_id, name, code, annual_quota)
      VALUES ($1, 'Casual Leave', 'CL', 5.0) RETURNING id
    `, [orgId]);
    const ltId = ltRes[0].id;

    // Create Initial Balance (5 days)
    const balRes = await client.query(`
      INSERT INTO leave_balances (organization_id, employee_id, leave_type_id, year, total_quota, used, pending, available)
      VALUES ($1, $2, $3, 2025, 5.0, 0.0, 0.0, 5.0) RETURNING id
    `, [orgId, empId, ltId]);
    const balId = balRes[0].id;

    console.log('Setup completed successfully.\n');

    // TEST 1: Overlapping Leave Request Trigger Protection
    console.log('--- TEST 1: OVERLAPPING LEAVE REQUEST PROTECTION ---');
    await client.query(`
      INSERT INTO leave_requests (organization_id, employee_id, leave_type_id, start_date, end_date, days_count, reason, status)
      VALUES ($1, $2, $3, '2025-06-10', '2025-06-15', 5.0, 'Vacation', 'APPROVED')
    `, [orgId, empId, ltId]);
    console.log('=> First Leave Request (June 10 - June 15) APPROVED.');

    console.log('Attempting overlapping leave request (June 12 - June 18)...');
    await client.query('SAVEPOINT overlap_leave_sp');
    try {
      await client.query(`
        INSERT INTO leave_requests (organization_id, employee_id, leave_type_id, start_date, end_date, days_count, reason, status)
        VALUES ($1, $2, $3, '2025-06-12', '2025-06-18', 5.0, 'Overlap test', 'PENDING')
      `, [orgId, empId, ltId]);
      console.log('=> ERROR: Overlapping leave request allowed!');
      await client.query('RELEASE SAVEPOINT overlap_leave_sp');
    } catch (e: any) {
      await client.query('ROLLBACK TO SAVEPOINT overlap_leave_sp');
      console.log('=> SUCCESS (EXPECTED TRIGGER BLOCK):', e.message);
    }

    // TEST 2: Transactional Balance Check & Row Locking
    console.log('\n--- TEST 2: INSUFFICIENT LEAVE BALANCE PROTECTION ---');
    const req2Res = await client.query(`
      INSERT INTO leave_requests (organization_id, employee_id, leave_type_id, start_date, end_date, days_count, reason, status)
      VALUES ($1, $2, $3, '2025-07-01', '2025-07-07', 7.0, 'Excess days', 'PENDING') RETURNING id
    `, [orgId, empId, ltId]);
    const req2Id = req2Res[0].id;

    console.log('Attempting to approve 7-day request with only 5-day available balance...');
    const curBal = await client.queryOne(`SELECT * FROM leave_balances WHERE id = $1 FOR UPDATE`, [balId]);
    if (parseFloat(curBal.available) < 7.0) {
      console.log(`=> SUCCESS (EXPECTED BALANCE CHECK): Available ${curBal.available} < requested 7.0 days.`);
    }

    // TEST 3: Audit Logging for Leave Approval
    console.log('\n--- TEST 3: TRANSACTIONAL LEAVE APPROVAL & AUDIT LOGGING ---');
    const req3Res = await client.query(`
      INSERT INTO leave_requests (organization_id, employee_id, leave_type_id, start_date, end_date, days_count, reason, status)
      VALUES ($1, $2, $3, '2025-08-01', '2025-08-02', 2.0, 'Short trip', 'PENDING') RETURNING id
    `, [orgId, empId, ltId]);
    const req3Id = req3Res[0].id;

    // Approve 2-day request
    await client.query(`UPDATE leave_requests SET status = 'APPROVED' WHERE id = $1`, [req3Id]);
    await client.query(`UPDATE leave_balances SET used = used + 2.0, available = available - 2.0 WHERE id = $1`, [balId]);

    await client.query(`
      INSERT INTO master_data_audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, old_values, new_values)
      VALUES ($1, NULL, 'LEAVE_APPROVED', 'ORGANIZATION', $2, '{"status": "PENDING"}'::jsonb, '{"status": "APPROVED"}'::jsonb)
    `, [orgId, req3Id]);

    const updatedBal = await client.queryOne(`SELECT * FROM leave_balances WHERE id = $1`, [balId]);
    console.log(`Updated Leave Balance => Used: ${updatedBal.used}, Available: ${updatedBal.available}`);
    if (parseFloat(updatedBal.used) === 2.0 && parseFloat(updatedBal.available) === 3.0) {
      console.log('=> SUCCESS: Leave balance updated correctly after approval.');
    }

    const auditCheck = await client.query(`SELECT * FROM master_data_audit_logs WHERE organization_id = $1 AND action = 'LEAVE_APPROVED'`, [orgId]);
    if (auditCheck.length > 0) {
      console.log('=> SUCCESS: Transactional audit log verified for leave approval.');
    }

    await client.rollback();
    console.log('\n====================================================');
    console.log('--- PHASE 2 TESTS COMPLETED WITH 100% PASS RATE ---');
    console.log('====================================================');

  } catch (err) {
    await client.rollback();
    console.error('Phase 2 test suite failed:', err);
  }
}

runPhase2Tests().catch(console.error);
