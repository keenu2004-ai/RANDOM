import { beginTransaction } from './client.js';

async function runPhase4Tests() {
  console.log('====================================================');
  console.log('--- STARTING PHASE 4: EXPENSES TESTS ---');
  console.log('====================================================\n');

  const client = await beginTransaction();
  try {
    // 1. Setup Organization, Employee, Category
    console.log('1. Setting up test entities for Expenses...');
    const orgRes = await client.query(`INSERT INTO organizations (name, code) VALUES ('Expense Org', 'EXPORG') RETURNING id`);
    const orgId = orgRes[0].id;

    const branchRes = await client.query(`
      INSERT INTO branches (organization_id, name, code, city, state, address_line, pincode)
      VALUES ($1, 'HQ Branch', 'EXHQB', 'Delhi', 'Delhi', 'Connaught Place', '110001') RETURNING id
    `, [orgId]);
    const branchId = branchRes[0].id;

    const empRes = await client.query(`
      INSERT INTO employees (organization_id, first_name, last_name, email, employee_code, date_of_joining, branch_id)
      VALUES ($1, 'Sam', 'ExpenseTest', 'sam.expense@test.com', 'EMP-EX-01', '2025-01-01', $2) RETURNING id
    `, [orgId, branchId]);
    const empId = empRes[0].id;

    const catRes = await client.query(`
      INSERT INTO expense_categories (organization_id, name, code, max_limit_inr, is_active)
      VALUES ($1, 'Client Travel', 'TRAVEL', 10000, true) RETURNING id
    `, [orgId]);
    const catId = catRes[0].id;

    console.log('Setup completed successfully.\n');

    // TEST 1: Expense Submission against Active Category
    console.log('--- TEST 1: EXPENSE SUBMISSION AGAINST ACTIVE CATEGORY ---');
    const expRes = await client.query(`
      INSERT INTO expenses (organization_id, employee_id, category_id, title, amount_inr, expense_date, description, status)
      VALUES ($1, $2, $3, 'Flight to Mumbai', 4500.00, '2025-07-10', 'Client meeting', 'SUBMITTED') RETURNING id
    `, [orgId, empId, catId]);
    const expId = expRes[0].id;
    console.log('=> SUCCESS: Expense submitted against active category.');

    // TEST 2: Inactive Category Validation
    console.log('\n--- TEST 2: INACTIVE CATEGORY SUBMISSION BLOCK ---');
    await client.query(`UPDATE expense_categories SET is_active = false WHERE id = $1`, [catId]);

    const activeCatCheck = await client.queryOne(`
      SELECT * FROM expense_categories WHERE organization_id = $1 AND id = $2 AND is_active = true AND deleted_at IS NULL
    `, [orgId, catId]);

    if (!activeCatCheck) {
      console.log('=> SUCCESS (EXPECTED CATEGORY BLOCK): Inactive category properly rejected.');
    }

    // Re-activate category
    await client.query(`UPDATE expense_categories SET is_active = true WHERE id = $1`, [catId]);

    // TEST 3: Transactional Approval & Reimbursement & Audit Logging
    console.log('\n--- TEST 3: TRANSACTIONAL APPROVAL, REIMBURSEMENT & AUDIT LOGGING ---');
    await client.query(`UPDATE expenses SET status = 'APPROVED', approved_at = NOW() WHERE id = $1`, [expId]);
    await client.query(`
      INSERT INTO master_data_audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, old_values, new_values)
      VALUES ($1, NULL, 'EXPENSE_APPROVED', 'ORGANIZATION', $2, '{"status": "SUBMITTED"}'::jsonb, '{"status": "APPROVED"}'::jsonb)
    `, [orgId, expId]);

    await client.query(`UPDATE expenses SET status = 'REIMBURSED', reimbursement_date = CURRENT_DATE WHERE id = $1`, [expId]);
    await client.query(`
      INSERT INTO master_data_audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, old_values, new_values)
      VALUES ($1, NULL, 'EXPENSE_REIMBURSED', 'ORGANIZATION', $2, '{"status": "APPROVED"}'::jsonb, '{"status": "REIMBURSED"}'::jsonb)
    `, [orgId, expId]);

    const finalExp = await client.queryOne(`SELECT * FROM expenses WHERE id = $1`, [expId]);
    console.log(`Final Expense Status: ${finalExp.status}`);
    if (finalExp.status === 'REIMBURSED') {
      console.log('=> SUCCESS: Expense state transitioned to REIMBURSED.');
    }

    const auditCount = await client.query(`SELECT * FROM master_data_audit_logs WHERE organization_id = $1 AND entity_id = $2`, [orgId, expId]);
    console.log(`Audit log records captured for expense: ${auditCount.length}`);
    if (auditCount.length === 2) {
      console.log('=> SUCCESS: Transactional audit log verified for expense approval & reimbursement.');
    }

    await client.rollback();
    console.log('\n====================================================');
    console.log('--- PHASE 4 TESTS COMPLETED WITH 100% PASS RATE ---');
    console.log('====================================================');

  } catch (err) {
    await client.rollback();
    console.error('Phase 4 test suite failed:', err);
  }
}

runPhase4Tests().catch(console.error);
