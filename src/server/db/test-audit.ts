import { query, exec, beginTransaction } from './client.js';

async function runTests() {
  console.log('--- STARTING POST-IMPLEMENTATION AUDIT TESTS ---');
  const client = await beginTransaction();
  try {
    // Setup test records
    console.log('1. Setting up test records (Org, Loc A, Loc B, Shift, Emp)...');
    
    // Org
    const orgRes = await client.query(`INSERT INTO organizations (name, code) VALUES ('Test Org', 'TSTORG') RETURNING id`);
    const orgId = orgRes[0].id;
    
    // Branch (for schema compatibility if needed)
    const branchRes = await client.query(`INSERT INTO branches (organization_id, name, code, city, state, address_line, pincode) VALUES ($1, 'Test Branch', 'TSTB', 'Test City', 'Test State', 'Test Address', '123456') RETURNING id`, [orgId]);
    const branchId = branchRes[0].id;

    // Location A & B
    const locARes = await client.query(`INSERT INTO attendance_locations (organization_id, branch_id, name, latitude, longitude, radius_meters) VALUES ($1, $2, 'Loc A', 28.1, 77.1, 100) RETURNING id`, [orgId, branchId]);
    const locA = locARes[0].id;
    const locBRes = await client.query(`INSERT INTO attendance_locations (organization_id, branch_id, name, latitude, longitude, radius_meters) VALUES ($1, $2, 'Loc B', 28.2, 77.2, 100) RETURNING id`, [orgId, branchId]);
    const locB = locBRes[0].id;
    
    // Shift
    const shiftRes = await client.query(`INSERT INTO shifts (organization_id, name, start_time, end_time, location_id) VALUES ($1, 'Morning Shift', '09:00', '18:00', $2) RETURNING id`, [orgId, locA]);
    const shiftId = shiftRes[0].id;

    // Employee & User
    const userRes = await client.query(`INSERT INTO users (organization_id, email, password_hash) VALUES ($1, 'test@test.com', 'hash') RETURNING id`, [orgId]);
    const userId = userRes[0].id;
    const empRes = await client.query(`INSERT INTO employees (organization_id, user_id, first_name, last_name, email, branch_id, employee_code, date_of_joining) VALUES ($1, $2, 'John', 'Doe', 'test@test.com', $3, 'EMP001', '2020-01-01') RETURNING id`, [orgId, userId, branchId]);
    const empId = empRes[0].id;

    // Employee Shift Assignment
    await client.query(`INSERT INTO employee_shifts (employee_id, shift_id, effective_from) VALUES ($1, $2, '2020-01-01')`, [empId, shiftId]);

    console.log('Setup complete.\\n');

    // TEST 1: CRITICAL PROPAGATION TEST
    console.log('--- TEST 1: CRITICAL PROPAGATION TEST ---');
    console.log('Checking in at Loc A (28.1, 77.1) while Shift is at Loc A...');
    try {
      await simulateCheckIn(client, orgId, empId, 28.1, 77.1);
      console.log('=> SUCCESS: Check-in at Loc A passed.');
    } catch(e) { console.log('=> FAIL:', e.message); }

    console.log('\\nChanging Shift.location_id to Loc B...');
    await client.query(`UPDATE shifts SET location_id = $1 WHERE id = $2`, [locB, shiftId]);
    
    console.log('Checking in at Loc A (28.1, 77.1) after Shift changed to Loc B...');
    try {
      await simulateCheckIn(client, orgId, empId, 28.1, 77.1);
      console.log('=> UNEXPECTED SUCCESS');
    } catch (e: any) {
      console.log('=> SUCCESS (EXPECTED FAIL):', e.message);
    }
    
    console.log('Checking in at Loc B (28.2, 77.2) after Shift changed to Loc B...');
    try {
      await simulateCheckIn(client, orgId, empId, 28.2, 77.2);
      console.log('=> SUCCESS: Check-in at Loc B passed automatically without employee update.');
    } catch (e: any) { console.log('=> FAIL:', e.message); }

    // TEST 2: COORDINATE PROPAGATION
    console.log('\\n--- TEST 2: COORDINATE PROPAGATION ---');
    console.log('Changing Loc B coordinates to (28.3, 77.3)...');
    await client.query(`UPDATE attendance_locations SET latitude = 28.3, longitude = 77.3 WHERE id = $1`, [locB]);
    
    console.log('Checking in at old Loc B coordinates (28.2, 77.2)...');
    try {
      await simulateCheckIn(client, orgId, empId, 28.2, 77.2);
      console.log('=> UNEXPECTED SUCCESS');
    } catch(e: any) { console.log('=> SUCCESS (EXPECTED FAIL):', e.message); }

    console.log('Checking in at new Loc B coordinates (28.3, 77.3)...');
    try {
      await simulateCheckIn(client, orgId, empId, 28.3, 77.3);
      console.log('=> SUCCESS: Check-in at new coordinates passed.');
    } catch(e: any) { console.log('=> FAIL:', e.message); }

    // TEST 3: RADIUS PROPAGATION
    console.log('\\n--- TEST 3: RADIUS PROPAGATION ---');
    // We are at 28.3, 77.3. Let's check in at 28.3005, 77.3 (approx 55 meters away)
    console.log('Checking in 55m away from Loc B (Radius = 100m)...');
    try {
      await simulateCheckIn(client, orgId, empId, 28.3005, 77.3);
      console.log('=> SUCCESS: Check-in within 100m passed.');
    } catch(e: any) { console.log('=> FAIL:', e.message); }

    console.log('Changing Loc B radius to 40m...');
    await client.query(`UPDATE attendance_locations SET radius_meters = 40 WHERE id = $1`, [locB]);
    
    console.log('Checking in 55m away from Loc B (Radius = 40m)...');
    try {
      await simulateCheckIn(client, orgId, empId, 28.3005, 77.3);
      console.log('=> UNEXPECTED SUCCESS');
    } catch(e: any) { console.log('=> SUCCESS (EXPECTED FAIL):', e.message); }

    // ROLLBACK AT THE END TO LEAVE NO TEST DATA
    await client.rollback();
    console.log('\\nAll tests executed. Test data rolled back safely.');
    
  } catch (err) {
    await client.rollback();
    console.error('Audit script failed:', err);
  }
}

async function simulateCheckIn(client: any, orgId: any, empId: any, lat: any, lng: any) {
    const dbDate = (await client.query("SELECT CURRENT_DATE as date"))[0].date;
    // Cleanup any exact day collisions for test purpose
    await client.query('DELETE FROM attendance WHERE employee_id = $1 AND date = $2', [empId, dbDate]);

    const contextRes = await client.query(`
      SELECT 
        s.id as shift_id, s.name as shift_name, s.start_time, s.end_time, s.grace_period_minutes,
        l.id as location_id, l.name as location_name, l.latitude, l.longitude, l.radius_meters, l.organization_id as loc_org
      FROM employee_shifts es
      JOIN shifts s ON es.shift_id = s.id
      LEFT JOIN attendance_locations l ON s.location_id = l.id
      WHERE es.employee_id = $1 
        AND es.effective_from <= $2 
        AND (es.effective_to IS NULL OR es.effective_to >= $2)
      ORDER BY es.created_at DESC LIMIT 1
    `, [empId, dbDate]);

    if (contextRes.length === 0) throw new Error('SHIFT_NOT_ASSIGNED');
    const ctx = contextRes[0];
    if (!ctx.location_id) throw new Error('SHIFT_LOCATION_NOT_CONFIGURED');
    
    const dist = getHaversineDistance(lat, lng, parseFloat(ctx.latitude), parseFloat(ctx.longitude));
    if (dist > ctx.radius_meters) throw new Error(`Geofence error: Outside radius. Dist: ${Math.round(dist)}m > ${ctx.radius_meters}m`);
    
    await client.query(`INSERT INTO attendance (employee_id, date, check_in_latitude, check_in_longitude, context_snapshot) VALUES ($1, $2, $3, $4, '{}'::jsonb)`, [empId, dbDate, lat, lng]);
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

runTests().catch(console.error);
