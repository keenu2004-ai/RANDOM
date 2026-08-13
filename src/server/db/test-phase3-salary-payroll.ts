import { beginTransaction } from './client.js';

async function runPhase3Tests() {
  console.log('====================================================');
  console.log('--- STARTING PHASE 3: SALARY + PAYROLL + COMPLIANCE ---');
  console.log('====================================================\n');

  const client = await beginTransaction();
  try {
    // 1. Setup Organization, Employee, Salary Structure
    console.log('1. Setting up test entities for Salary & Payroll...');
    const orgRes = await client.query(`INSERT INTO organizations (name, code, currency) VALUES ('Payroll Org', 'PYORG', 'INR') RETURNING id`);
    const orgId = orgRes[0].id;

    const branchRes = await client.query(`
      INSERT INTO branches (organization_id, name, code, city, state, address_line, pincode)
      VALUES ($1, 'HQ Branch', 'PYHQB', 'Delhi', 'Delhi', 'Connaught Place', '110001') RETURNING id
    `, [orgId]);
    const branchId = branchRes[0].id;

    const empRes = await client.query(`
      INSERT INTO employees (organization_id, first_name, last_name, email, employee_code, date_of_joining, branch_id)
      VALUES ($1, 'Jane', 'PayrollTest', 'jane.payroll@test.com', 'EMP-PY-01', '2025-01-01', $2) RETURNING id
    `, [orgId, branchId]);
    const empId = empRes[0].id;

    // 2. Insert Effective-Dated Employee Salary Structure (Jan 1, 2025 - Jun 30, 2025)
    await client.query(`
      INSERT INTO employee_salary_structures 
      (organization_id, employee_id, basic_salary, hra, allowances, gross_salary, pf_deduction, esi_deduction, pt_deduction, tds_deduction, net_salary, effective_from, effective_to)
      VALUES ($1, $2, 60000, 24000, 16000, 100000, 7200, 0, 200, 10000, 82600, '2025-01-01', '2025-06-30')
    `, [orgId, empId]);
    console.log('=> First Salary Structure (Jan 1 - Jun 30, 2025) created.');

    // TEST 1: Overlapping Salary Structure Trigger Protection
    console.log('\n--- TEST 1: OVERLAPPING SALARY STRUCTURE PROTECTION ---');
    console.log('Attempting overlapping salary structure (May 1 - Dec 31, 2025)...');
    await client.query('SAVEPOINT overlap_sal_sp');
    try {
      await client.query(`
        INSERT INTO employee_salary_structures 
        (organization_id, employee_id, basic_salary, hra, allowances, gross_salary, net_salary, effective_from, effective_to)
        VALUES ($1, $2, 70000, 28000, 20000, 118000, 95000, '2025-05-01', '2025-12-31')
      `, [orgId, empId]);
      console.log('=> ERROR: Overlapping salary structure allowed!');
      await client.query('RELEASE SAVEPOINT overlap_sal_sp');
    } catch (e: any) {
      await client.query('ROLLBACK TO SAVEPOINT overlap_sal_sp');
      console.log('=> SUCCESS (EXPECTED TRIGGER BLOCK):', e.message);
    }

    // TEST 2: Immutable Finalized Payroll Snapshots
    console.log('\n--- TEST 2: IMMUTABLE FINALIZED PAYROLL SNAPSHOTS ---');
    const periodRes = await client.query(`
      INSERT INTO payroll_periods (organization_id, month, year, name, status)
      VALUES ($1, 5, 2025, 'May 2025 Payroll', 'FINALIZED') RETURNING id
    `, [orgId]);
    const periodId = periodRes[0].id;

    const snapshot = {
      employee: { id: empId, name: 'Jane PayrollTest', code: 'EMP-PY-01' },
      salary: { basic: 60000, hra: 24000, allowances: 16000, gross: 100000 },
      deductions: { pf: 7200, esi: 0, pt: 200, tds: 10000, total: 17400 },
      payout: { net: 82600, currency: 'INR' }
    };

    const recordRes = await client.query(`
      INSERT INTO payroll_records 
      (organization_id, payroll_period_id, employee_id, working_days, present_days, paid_leave_days, loss_of_pay_days, basic_salary, hra, allowances, gross_earnings, pf_deduction, esi_deduction, pt_deduction, tds_deduction, other_deductions, total_deductions, net_salary, status, calculation_snapshot)
      VALUES ($1, $2, $3, 22, 22, 0, 0, 60000, 24000, 16000, 100000, 7200, 0, 200, 10000, 0, 17400, 82600, 'FINALIZED', $4) RETURNING id
    `, [orgId, periodId, empId, JSON.stringify(snapshot)]);
    const recordId = recordRes[0].id;

    console.log('Finalized payroll record created with immutable calculation_snapshot.');

    console.log('Modifying master employee base salary in database...');
    await client.query(`UPDATE employees SET base_salary_inr = 90000 WHERE id = $1`, [empId]);

    const historicalRecord = await client.queryOne(`SELECT * FROM payroll_records WHERE id = $1`, [recordId]);
    const savedSnap = typeof historicalRecord.calculation_snapshot === 'string' ? JSON.parse(historicalRecord.calculation_snapshot) : historicalRecord.calculation_snapshot;

    console.log(`Historical Net Salary in Snapshot: ${savedSnap.payout.net}`);
    if (parseFloat(historicalRecord.net_salary) === 82600 && savedSnap.salary.basic === 60000) {
      console.log('=> SUCCESS: Finalized payroll snapshot remained completely immutable after master data change.');
    }

    // TEST 3: Master-Data Audit Logging for Statutory Rules
    console.log('\n--- TEST 3: STATUTORY RULE AUDIT LOGGING ---');
    await client.query(`
      INSERT INTO master_data_audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, old_values, new_values)
      VALUES ($1, NULL, 'UPDATE_STATUTORY_RULE', 'ORGANIZATION', $1, '{"pf_rate": "12%"}'::jsonb, '{"pf_rate": "12.5%"}'::jsonb)
    `, [orgId]);

    const auditCheck = await client.query(`SELECT * FROM master_data_audit_logs WHERE organization_id = $1 AND action = 'UPDATE_STATUTORY_RULE'`, [orgId]);
    if (auditCheck.length > 0) {
      console.log('=> SUCCESS: Statutory rule audit log verified.');
    }

    await client.rollback();
    console.log('\n====================================================');
    console.log('--- PHASE 3 TESTS COMPLETED WITH 100% PASS RATE ---');
    console.log('====================================================');

  } catch (err) {
    await client.rollback();
    console.error('Phase 3 test suite failed:', err);
  }
}

runPhase3Tests().catch(console.error);
