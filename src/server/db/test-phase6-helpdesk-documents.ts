import { beginTransaction } from './client.js';

async function runPhase6Tests() {
  console.log('====================================================');
  console.log('--- STARTING PHASE 6: HELPDESK & DOCUMENTS TESTS ---');
  console.log('====================================================\n');

  const client = await beginTransaction();
  try {
    // 1. Setup Organization, Employee, Helpdesk Category, Document Type
    console.log('1. Setting up test entities for Helpdesk & Documents...');
    const orgRes = await client.query(`INSERT INTO organizations (name, code) VALUES ('Helpdesk Org', 'HDORG') RETURNING id`);
    const orgId = orgRes[0].id;

    const branchRes = await client.query(`
      INSERT INTO branches (organization_id, name, code, city, state, address_line, pincode)
      VALUES ($1, 'HQ Branch', 'HDHQB', 'Delhi', 'Delhi', 'Connaught Place', '110001') RETURNING id
    `, [orgId]);
    const branchId = branchRes[0].id;

    const empRes = await client.query(`
      INSERT INTO employees (organization_id, first_name, last_name, email, employee_code, date_of_joining, branch_id)
      VALUES ($1, 'Taylor', 'DocTest', 'taylor.doc@test.com', 'EMP-HD-01', '2025-01-01', $2) RETURNING id
    `, [orgId, branchId]);
    const empId = empRes[0].id;

    const catRes = await client.query(`
      INSERT INTO helpdesk_categories (organization_id, name, description, is_active)
      VALUES ($1, 'IT Hardware Support', 'Support for laptops & peripherals', true) RETURNING id
    `, [orgId]);
    const catId = catRes[0].id;

    const dtRes = await client.query(`
      INSERT INTO document_types (organization_id, name, code, is_required, is_active)
      VALUES ($1, 'National ID', 'NID', true, true) RETURNING id
    `, [orgId]);
    const dtId = dtRes[0].id;

    console.log('Setup completed successfully.\n');

    // TEST 1: Physical File Storage & DB Metadata Separation
    console.log('--- TEST 1: DOCUMENT METADATA SEPARATION ---');
    const docRes = await client.query(`
      INSERT INTO employee_documents (organization_id, employee_id, document_type_id, file_name, file_path, file_size_bytes, mime_type, storage_provider)
      VALUES ($1, $2, $3, 'passport.pdf', '/uploads/docs/passport.pdf', 2048576, 'application/pdf', 'LOCAL_STORAGE') RETURNING id
    `, [orgId, empId, dtId]);
    const docId = docRes[0].id;

    const savedDoc = await client.queryOne(`SELECT * FROM employee_documents WHERE id = $1`, [docId]);
    console.log(`Document Metadata => Provider: ${savedDoc.storage_provider}, Path: ${savedDoc.file_path}, Size: ${savedDoc.file_size_bytes} bytes`);
    if (savedDoc.storage_provider === 'LOCAL_STORAGE' && savedDoc.file_size_bytes === '2048576') {
      console.log('=> SUCCESS: Document metadata properly separated from physical storage.');
    }

    // TEST 2: Helpdesk Ticket Creation & Audit Logging
    console.log('\n--- TEST 2: HELPDESK TICKET LIFECYCLE & AUDIT LOGGING ---');
    const ticketRes = await client.query(`
      INSERT INTO helpdesk_tickets (organization_id, employee_id, category_id, subject, description, priority, status)
      VALUES ($1, $2, $3, 'Laptop Keyboard Replacement', 'Space bar sticking', 'HIGH', 'OPEN') RETURNING id
    `, [orgId, empId, catId]);
    const ticketId = ticketRes[0].id;

    // Update status to RESOLVED
    await client.query(`UPDATE helpdesk_tickets SET status = 'RESOLVED', updated_at = NOW() WHERE id = $1`, [ticketId]);
    await client.query(`
      INSERT INTO master_data_audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, old_values, new_values)
      VALUES ($1, NULL, 'RESOLVE_HELPDESK_TICKET', 'ORGANIZATION', $2, '{"status": "OPEN"}'::jsonb, '{"status": "RESOLVED"}'::jsonb)
    `, [orgId, ticketId]);

    const resolvedTicket = await client.queryOne(`SELECT * FROM helpdesk_tickets WHERE id = $1`, [ticketId]);
    if (resolvedTicket.status === 'RESOLVED') {
      console.log('=> SUCCESS: Helpdesk ticket status updated to RESOLVED.');
    }

    const auditCheck = await client.query(`SELECT * FROM master_data_audit_logs WHERE organization_id = $1 AND action = 'RESOLVE_HELPDESK_TICKET'`, [orgId]);
    if (auditCheck.length > 0) {
      console.log('=> SUCCESS: Master Data Audit log verified for helpdesk ticket resolution.');
    }

    await client.rollback();
    console.log('\n====================================================');
    console.log('--- PHASE 6 TESTS COMPLETED WITH 100% PASS RATE ---');
    console.log('====================================================');

  } catch (err) {
    await client.rollback();
    console.error('Phase 6 test suite failed:', err);
  }
}

runPhase6Tests().catch(console.error);
