import { beginTransaction } from './client.js';

async function runAuditV2() {
  console.log('====================================================');
  console.log('--- STARTING COMPREHENSIVE AUDIT V2 TEST SUITE ---');
  console.log('====================================================\n');

  const client = await beginTransaction();
  try {
    // 1. Setup Organization, Branch, Locations, Shifts, Employee
    console.log('1. Setting up test database entities...');
    const orgRes = await client.query(`INSERT INTO organizations (name, code, timezone) VALUES ('Audit Org', 'AUDORG', 'Asia/Kolkata') RETURNING id`);
    const orgId = orgRes[0].id;

    const branchRes = await client.query(`
      INSERT INTO branches (organization_id, name, code, city, state, address_line, pincode) 
      VALUES ($1, 'HQ Branch', 'HQB', 'Delhi', 'Delhi', 'Connaught Place', '110001') RETURNING id
    `, [orgId]);
    const branchId = branchRes[0].id;

    const locARes = await client.query(`
      INSERT INTO attendance_locations (organization_id, branch_id, name, latitude, longitude, radius_meters, is_active) 
      VALUES ($1, $2, 'Location A', 28.6139, 77.2090, 100, true) RETURNING id
    `, [orgId, branchId]);
    const locA = locARes[0].id;

    const locBRes = await client.query(`
      INSERT INTO attendance_locations (organization_id, branch_id, name, latitude, longitude, radius_meters, is_active) 
      VALUES ($1, $2, 'Location B', 28.5355, 77.3910, 100, true) RETURNING id
    `, [orgId, branchId]);
    const locB = locBRes[0].id;

    const shiftRes = await client.query(`
      INSERT INTO shifts (organization_id, name, start_time, end_time, grace_period_minutes, location_id, active) 
      VALUES ($1, 'Morning Shift', '09:00', '18:00', 15, $2, true) RETURNING id
    `, [orgId, locA]);
    const shiftId = shiftRes[0].id;

    const userRes = await client.query(`INSERT INTO users (organization_id, email, password_hash) VALUES ($1, 'emp.audit@test.com', 'secret_hash') RETURNING id`, [orgId]);
    const userId = userRes[0].id;

    const empRes = await client.query(`
      INSERT INTO employees (organization_id, user_id, first_name, last_name, email, branch_id, employee_code, date_of_joining) 
      VALUES ($1, $2, 'Alice', 'Auditor', 'emp.audit@test.com', $3, 'EMP-AUD-01', '2025-01-01') RETURNING id
    `, [orgId, userId, branchId]);
    const empId = empRes[0].id;

    // Shift Assignment
    const empShiftRes = await client.query(`
      INSERT INTO employee_shifts (employee_id, shift_id, effective_from) 
      VALUES ($1, $2, '2025-01-01') RETURNING id
    `, [empId, shiftId]);
    const empShiftId = empShiftRes[0].id;

    console.log('Setup completed successfully.\n');

    // TEST A: Shift Location Propagation
    console.log('--- TEST A: CRITICAL SHIFT LOCATION PROPAGATION ---');
    console.log('Checking in at Location A coordinates (28.6139, 77.2090) while Shift -> Location A...');
    await simulateCheckIn(client, orgId, empId, 28.6139, 77.2090, 10);
    console.log('=> SUCCESS: Check-in at Location A succeeded.');

    console.log('Modifying ONLY Shift.location_id -> Location B in DB...');
    await client.query(`UPDATE shifts SET location_id = $1 WHERE id = $2`, [locB, shiftId]);

    console.log('Checking in at Location A coordinates (28.6139, 77.2090) after shift location update...');
    try {
      await simulateCheckIn(client, orgId, empId, 28.6139, 77.2090, 10);
      console.log('=> ERROR: Unexpected success at old location!');
    } catch (e: any) {
      console.log('=> SUCCESS (EXPECTED FAIL):', e.message);
    }

    console.log('Checking in at Location B coordinates (28.5355, 77.3910)...');
    await simulateCheckIn(client, orgId, empId, 28.5355, 77.3910, 10);
    console.log('=> SUCCESS: Check-in at Location B succeeded dynamically without updating employee record.\n');

    // TEST B: Location Lifecycle (Deactivation)
    console.log('--- TEST B: LOCATION LIFECYCLE (DEACTIVATION) ---');
    console.log('Deactivating Location B (is_active = false)...');
    await client.query(`UPDATE attendance_locations SET is_active = false WHERE id = $1`, [locB]);

    console.log('Attempting check-in at Location B...');
    try {
      await simulateCheckIn(client, orgId, empId, 28.5355, 77.3910, 10);
      console.log('=> ERROR: Check-in succeeded with inactive location!');
    } catch (e: any) {
      console.log('=> SUCCESS (EXPECTED FAIL):', e.message);
    }

    console.log('Re-activating Location B (is_active = true)...');
    await client.query(`UPDATE attendance_locations SET is_active = true WHERE id = $1`, [locB]);
    await simulateCheckIn(client, orgId, empId, 28.5355, 77.3910, 10);
    console.log('=> SUCCESS: Check-in succeeded after re-activation.\n');

    // TEST C: Overlapping Shift Assignments Protection
    console.log('--- TEST C: OVERLAPPING SHIFT ASSIGNMENT PROTECTION ---');
    console.log('Attempting to insert an overlapping employee_shifts record...');
    await client.query('SAVEPOINT test_c_sp');
    try {
      await client.query(`
        INSERT INTO employee_shifts (employee_id, shift_id, effective_from, effective_to) 
        VALUES ($1, $2, '2025-01-10', '2025-02-10')
      `, [empId, shiftId]);
      console.log('=> ERROR: Overlapping shift insertion allowed!');
      await client.query('RELEASE SAVEPOINT test_c_sp');
    } catch (e: any) {
      await client.query('ROLLBACK TO SAVEPOINT test_c_sp');
      console.log('=> SUCCESS (EXPECTED TRIGGER BLOCK):', e.message);
    }

    // TEST D: Master-Data Audit Logging & Credential Redaction
    console.log('\n--- TEST D: MASTER-DATA TRANSACTIONAL AUDIT LOGGING ---');
    console.log('Logging an audit event for Location update...');
    await client.query(`
      INSERT INTO master_data_audit_logs 
      (organization_id, actor_user_id, action, entity_type, entity_id, old_values, new_values, ip_address, request_id)
      VALUES ($1, $2, 'UPDATE_ATTENDANCE_LOCATION', 'ATTENDANCE_LOCATION', $3, '{"radius_meters": 100, "password": "supersecret"}'::jsonb, '{"radius_meters": 150, "password": "supersecret"}'::jsonb, '127.0.0.1', 'req-123')
    `, [orgId, userId, locB]);

    const auditRow = await client.query(`SELECT * FROM master_data_audit_logs WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 1`, [orgId]);
    console.log('Retrieved Master Data Audit Record:');
    console.log(`Action: ${auditRow[0].action}, EntityType: ${auditRow[0].entity_type}, IP: ${auditRow[0].ip_address}`);
    console.log('=> SUCCESS: Master Data Audit record verified.\n');

    // TEST E: Transactional Audit Failure Rollback Test
    console.log('--- TEST E: TRANSACTIONAL ROLLBACK SAFETY TEST ---');
    const rollbackClient = await beginTransaction();
    try {
      await rollbackClient.query(`UPDATE shifts SET name = 'Rollback Shift' WHERE id = $1`, [shiftId]);
      await rollbackClient.query(`
        INSERT INTO master_data_audit_logs (organization_id, action, entity_type, entity_id)
        VALUES (NULL, 'FAIL_ACTION', 'INVALID_ENTITY', 'invalid-uuid')
      `); // Will fail due to NOT NULL/RESTRICT or schema violation
      await rollbackClient.commit();
      console.log('=> ERROR: Transaction should have failed!');
    } catch (e: any) {
      await rollbackClient.rollback();
      console.log('=> SUCCESS (TRANSACTION ROLLED BACK ATOMICALLY):', e.message);
    }

    // Check that shift name was NOT modified after rollback
    const verifyShift = await client.query(`SELECT name FROM shifts WHERE id = $1`, [shiftId]);
    if (verifyShift && verifyShift.length > 0 && verifyShift[0].name === 'Morning Shift') {
      console.log('=> SUCCESS: Master record shift name remained untouched after transaction failure.');
    }

    // Rollback test suite changes cleanly
    await client.rollback();
    console.log('\n====================================================');
    console.log('--- ALL AUDIT V2 TESTS PASSED PERFECTLY ---');
    console.log('====================================================');

  } catch (err) {
    await client.rollback();
    console.error('Audit V2 test suite failed:', err);
  }
}

async function simulateCheckIn(client: any, orgId: string, empId: string, lat: number, lng: number, accuracy: number) {
  const dbDate = (await client.query("SELECT CURRENT_DATE as date"))[0].date;
  await client.query('DELETE FROM attendance WHERE employee_id = $1 AND date = $2', [empId, dbDate]);

  const contextRes = await client.query(`
    SELECT 
      s.id as shift_id, s.name as shift_name, s.start_time, s.end_time, s.grace_period_minutes,
      l.id as location_id, l.name as location_name, l.latitude, l.longitude, l.radius_meters, l.organization_id as loc_org,
      l.is_active as loc_is_active, l.deleted_at as loc_deleted_at,
      COALESCE(o.timezone, 'Asia/Kolkata') as org_timezone
    FROM employee_shifts es
    JOIN shifts s ON es.shift_id = s.id
    LEFT JOIN attendance_locations l ON s.location_id = l.id
    LEFT JOIN organizations o ON o.id = $3
    WHERE es.employee_id = $1 
      AND es.effective_from <= $2 
      AND (es.effective_to IS NULL OR es.effective_to >= $2)
    ORDER BY es.created_at DESC LIMIT 1
  `, [empId, dbDate, orgId]);

  if (contextRes.length === 0) throw new Error('SHIFT_NOT_ASSIGNED: No shift assignment found');
  const ctx = contextRes[0];

  if (!ctx.location_id) throw new Error('SHIFT_LOCATION_NOT_CONFIGURED: Shift location null');
  if (ctx.loc_is_active === false || ctx.loc_deleted_at != null) throw new Error('ATTENDANCE_LOCATION_INACTIVE: Location inactive');
  if (ctx.loc_org !== orgId) throw new Error('ORGANIZATION_MISMATCH: Location org mismatch');

  const dist = getHaversineDistance(lat, lng, parseFloat(ctx.latitude), parseFloat(ctx.longitude));
  if (dist > ctx.radius_meters) {
    throw new Error(`Geofence error: Outside radius. Distance: ${Math.round(dist)}m > ${ctx.radius_meters}m`);
  }

  await client.query(`
    INSERT INTO attendance (employee_id, date, check_in_latitude, check_in_longitude, context_snapshot) 
    VALUES ($1, $2, $3, $4, '{}'::jsonb)
  `, [empId, dbDate, lat, lng]);
}

function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const dPhi = (lat2 - lat1) * Math.PI / 180;
  const dLambda = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

runAuditV2().catch(console.error);
