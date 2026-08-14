import { query, queryOne } from './client';
import bcrypt from 'bcryptjs';

export async function initializeDatabaseBaseline() {
  console.log('[BASELINE INIT] Starting idempotent database master data initialization...');

  try {
    // 1. Organization Baseline
    const orgRes = await queryOne(`
      INSERT INTO organizations (name, code, currency, currency_symbol, website, timezone)
      VALUES ('Theiakshi Enterprise', 'THEIAKSHI', 'INR', '₹', 'theiakshi.com', 'Asia/Kolkata')
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, currency = EXCLUDED.currency, currency_symbol = EXCLUDED.currency_symbol
      RETURNING id
    `);
    const orgId = orgRes.id;
    console.log('[BASELINE INIT] Organization verified:', orgId);

    // 2. Roles Baseline
    const canonicalRoles = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'];
    const roleMap: Record<string, string> = {};
    for (const rName of canonicalRoles) {
      const r = await queryOne(`
        INSERT INTO roles (organization_id, name, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (organization_id, name) DO UPDATE SET description = EXCLUDED.description
        RETURNING id
      `, [orgId, rName, `${rName} Role for ${orgId}`]);
      roleMap[rName] = r.id;
    }
    console.log('[BASELINE INIT] Roles verified:', Object.keys(roleMap).length);

    // 3. Permissions Baseline
    const modules = [
      'DASHBOARD', 'EMPLOYEES', 'ATTENDANCE', 'LEAVE', 'HOLIDAYS', 'SHIFTS', 
      'EXPENSES', 'WEEKLY_PLAN', 'PROJECTS', 'PAYROLL', 'COMPLIANCE', 'DOCUMENTS', 
      'ANNOUNCEMENTS', 'HELPDESK', 'NOTIFICATIONS', 'REPORTS', 'SETTINGS', 'USER_MANAGEMENT', 'ROLE_MANAGEMENT'
    ];
    const actions = ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'EXPORT', 'MANAGE'];
    
    for (const m of modules) {
      for (const a of actions) {
        await query(`
          INSERT INTO permissions (module, action, description)
          VALUES ($1, $2, $3)
          ON CONFLICT (module, action) DO NOTHING
        `, [m, a, `Permission to ${a} ${m}`]);
      }
    }
    console.log('[BASELINE INIT] Permissions verified.');

    // 4. Default Users
    const defaultPassword = await bcrypt.hash('Admin@123', 10);
    const empPassword = await bcrypt.hash('Emp@123', 10);

    const adminUser = await queryOne(`
      INSERT INTO users (organization_id, email, password_hash, is_active)
      VALUES ($1, 'admin@theiakshi.com', $2, true)
      ON CONFLICT (email) DO UPDATE SET is_active = true
      RETURNING id
    `, [orgId, defaultPassword]);
    await query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [adminUser.id, roleMap['ADMIN']]);

    const hrUser = await queryOne(`
      INSERT INTO users (organization_id, email, password_hash, is_active)
      VALUES ($1, 'hr@theiakshi.com', $2, true)
      ON CONFLICT (email) DO UPDATE SET is_active = true
      RETURNING id
    `, [orgId, defaultPassword]);
    await query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [hrUser.id, roleMap['HR_MANAGER']]);

    const empUser = await queryOne(`
      INSERT INTO users (organization_id, email, password_hash, is_active)
      VALUES ($1, 'employee@theiakshi.com', $2, true)
      ON CONFLICT (email) DO UPDATE SET is_active = true
      RETURNING id
    `, [orgId, empPassword]);
    await query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [empUser.id, roleMap['EMPLOYEE']]);

    console.log('[BASELINE INIT] Base Users verified.');

    // 5. Branches Baseline
    const branch = await queryOne(`
      INSERT INTO branches (organization_id, name, code, city, state, country, address_line, pincode, is_headquarters, is_active)
      VALUES ($1, 'Theiakshi Enterprise Headquarters', 'THEIAKSHI-HQ', 'Ghaziabad', 'Uttar Pradesh', 'India', 'Corporate Tower, Tech Park', '201001', true, true)
      ON CONFLICT (organization_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [orgId]);
    const branchId = branch.id;

    // 6. Departments Baseline
    const depts = [
      { name: 'HR', code: 'DEPT-HR' },
      { name: 'Engineering', code: 'DEPT-ENG' },
      { name: 'Sales', code: 'DEPT-SALES' },
      { name: 'Finance', code: 'DEPT-FIN' },
      { name: 'Operations', code: 'DEPT-OPS' },
      { name: 'IT', code: 'DEPT-IT' },
      { name: 'Administration', code: 'DEPT-ADMIN' }
    ];
    const deptMap: Record<string, string> = {};
    for (const d of depts) {
      const dep = await queryOne(`
        INSERT INTO departments (organization_id, branch_id, name, code, is_active)
        VALUES ($1, $2, $3, $4, true)
        ON CONFLICT (organization_id, code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `, [orgId, branchId, d.name, d.code]);
      deptMap[d.name] = dep.id;
    }

    // 7. Designations Baseline
    const desigs = [
      { title: 'HR Manager', level: 3 },
      { title: 'Software Engineer', level: 2 },
      { title: 'Sales Executive', level: 1 },
      { title: 'Finance Executive', level: 1 },
      { title: 'Operations Manager', level: 3 },
      { title: 'IT Administrator', level: 2 },
      { title: 'System Administrator', level: 4 }
    ];
    const desigMap: Record<string, string> = {};
    for (const ds of desigs) {
      let existing = await queryOne(`SELECT id FROM designations WHERE organization_id = $1 AND title = $2`, [orgId, ds.title]);
      if (!existing) {
        existing = await queryOne(`
          INSERT INTO designations (organization_id, title, level, is_active)
          VALUES ($1, $2, $3, true)
          RETURNING id
        `, [orgId, ds.title, ds.level]);
      }
      desigMap[ds.title] = existing.id;
    }

    // 8. Teams Baseline
    const teams = [
      { name: 'HR Operations', code: 'TEAM-HROP', dept: 'HR' },
      { name: 'Engineering Team', code: 'TEAM-ENG', dept: 'Engineering' },
      { name: 'Sales Team', code: 'TEAM-SALES', dept: 'Sales' },
      { name: 'Finance Team', code: 'TEAM-FIN', dept: 'Finance' },
      { name: 'Operations Team', code: 'TEAM-OPS', dept: 'Operations' },
      { name: 'IT Support', code: 'TEAM-IT', dept: 'IT' },
      { name: 'Administration Team', code: 'TEAM-ADM', dept: 'Administration' }
    ];
    for (const tm of teams) {
      const dId = deptMap[tm.dept];
      let existingTm = await queryOne(`SELECT id FROM teams WHERE department_id = $1 AND code = $2`, [dId, tm.code]);
      if (!existingTm) {
        await query(`
          INSERT INTO teams (department_id, name, code)
          VALUES ($1, $2, $3)
        `, [dId, tm.name, tm.code]);
      }
    }

    // 9. Location & Shifts Baseline
    let loc = await queryOne(`SELECT id FROM attendance_locations WHERE organization_id = $1 AND name = $2`, [orgId, 'Headquarters Office']);
    if (!loc) {
      loc = await queryOne(`
        INSERT INTO attendance_locations (organization_id, branch_id, name, latitude, longitude, radius_meters, is_active)
        VALUES ($1, $2, 'Headquarters Office', 28.6209, 77.1363, 500, true)
        RETURNING id
      `, [orgId, branchId]);
    }
    const locId = loc.id;

    let shiftGen = await queryOne(`SELECT id FROM shifts WHERE organization_id = $1 AND name = $2`, [orgId, 'GENERAL']);
    if (!shiftGen) {
      shiftGen = await queryOne(`
        INSERT INTO shifts (organization_id, location_id, name, start_time, end_time, grace_period_minutes, break_duration_minutes, working_hours, active)
        VALUES ($1, $2, 'GENERAL', '09:30', '18:30', 15, 60, 8.0, true)
        RETURNING id
      `, [orgId, locId]);
    }
    const shiftId = shiftGen.id;

    // 10. Baseline Employees
    const emp001 = await queryOne(`
      INSERT INTO employees (organization_id, user_id, employee_code, first_name, last_name, email, date_of_joining, branch_id, department_id, designation_id, shift_id, status)
      VALUES ($1, $2, 'EMP-001', 'HR', 'Manager', 'hr@theiakshi.com', '2026-01-01', $3, $4, $5, $6, 'ACTIVE')
      ON CONFLICT (organization_id, employee_code) DO UPDATE SET user_id = EXCLUDED.user_id, status = 'ACTIVE'
      RETURNING id
    `, [orgId, hrUser.id, branchId, deptMap['HR'], desigMap['HR Manager'], shiftId]);

    const emp002 = await queryOne(`
      INSERT INTO employees (organization_id, user_id, employee_code, first_name, last_name, email, date_of_joining, branch_id, department_id, designation_id, shift_id, status)
      VALUES ($1, $2, 'EMP-002', 'Test', 'Employee', 'employee@theiakshi.com', '2026-01-01', $3, $4, $5, $6, 'ACTIVE')
      ON CONFLICT (organization_id, employee_code) DO UPDATE SET user_id = EXCLUDED.user_id, status = 'ACTIVE'
      RETURNING id
    `, [orgId, empUser.id, branchId, deptMap['Engineering'], desigMap['Software Engineer'], shiftId]);

    console.log('[BASELINE INIT] Baseline Employees EMP-001 and EMP-002 linked.');

    // 11. Leave Types & Balances
    const leaveTypes = [
      { name: 'Casual Leave', code: 'CASUAL', quota: 12 },
      { name: 'Sick Leave', code: 'SICK', quota: 12 },
      { name: 'Earned Leave', code: 'EARNED', quota: 15 },
      { name: 'Optional Leave', code: 'OPTIONAL', quota: 3 }
    ];

    const currentYear = new Date().getFullYear();
    const activeEmps = [emp001.id, emp002.id];

    for (const lt of leaveTypes) {
      let ltRec = await queryOne(`SELECT id FROM leave_types WHERE organization_id = $1 AND code = $2`, [orgId, lt.code]);
      if (!ltRec) {
        ltRec = await queryOne(`
          INSERT INTO leave_types (organization_id, name, code, annual_quota)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `, [orgId, lt.name, lt.code, lt.quota]);
      }
      
      for (const eId of activeEmps) {
        await query(`
          INSERT INTO leave_balances (organization_id, employee_id, leave_type_id, year, total_allocated, used, pending)
          VALUES ($1, $2, $3, $4, $5, 0, 0)
          ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING
        `, [orgId, eId, ltRec.id, currentYear, lt.quota]);
      }
    }

    // 12. Expense Categories
    const expCategories = ['Travel', 'Food', 'Accommodation', 'Office Supplies', 'Internet / Communication', 'Medical', 'Other'];
    for (const catName of expCategories) {
      let existingCat = await queryOne(`SELECT id FROM expense_categories WHERE organization_id = $1 AND name = $2`, [orgId, catName]);
      if (!existingCat) {
        await query(`
          INSERT INTO expense_categories (organization_id, name)
          VALUES ($1, $2)
        `, [orgId, catName]);
      }
    }

    // 13. Baseline Projects
    const projects = [
      { name: 'Internal Operations', code: 'PROJ-INT' },
      { name: 'HRMS Development', code: 'PROJ-HRMS' },
      { name: 'Website Development', code: 'PROJ-WEB' },
      { name: 'Sales Operations', code: 'PROJ-SALES' }
    ];
    for (const prj of projects) {
      let existingPrj = await queryOne(`SELECT id FROM projects WHERE organization_id = $1 AND code = $2`, [orgId, prj.code]);
      if (!existingPrj) {
        await query(`
          INSERT INTO projects (organization_id, name, code, status)
          VALUES ($1, $2, $3, 'ACTIVE')
        `, [orgId, prj.name, prj.code]);
      }
    }

    // 14. Baseline Document Types
    const docTypes = ['Resume', 'Aadhaar', 'PAN', 'Offer Letter', 'Joining Letter', 'Experience Letter', 'Educational Certificate', 'Bank Proof', 'Other'];
    for (const dt of docTypes) {
      let existingDt = await queryOne(`SELECT id FROM document_types WHERE organization_id = $1 AND name = $2`, [orgId, dt]);
      if (!existingDt) {
        await query(`
          INSERT INTO document_types (organization_id, name)
          VALUES ($1, $2)
        `, [orgId, dt]);
      }
    }

    // 15. Holidays
    const holidays = [
      { name: 'Republic Day', date: `${currentYear}-01-26`, type: 'NATIONAL' },
      { name: 'Independence Day', date: `${currentYear}-08-15`, type: 'NATIONAL' },
      { name: 'Gandhi Jayanti', date: `${currentYear}-10-02`, type: 'NATIONAL' }
    ];
    for (const h of holidays) {
      let existingH = await queryOne(`SELECT id FROM holidays WHERE organization_id = $1 AND date = $2`, [orgId, h.date]);
      if (!existingH) {
        await query(`
          INSERT INTO holidays (organization_id, name, date, type)
          VALUES ($1, $2, $3, $4)
        `, [orgId, h.name, h.date, h.type]);
      }
    }

    console.log('[BASELINE INIT] Complete production database baseline initialization finished successfully.');
  } catch (err: any) {
    console.error('[BASELINE INIT] Failed to initialize baseline:', err?.message || err);
  }
}
