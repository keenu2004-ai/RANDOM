import { query, queryOne, initDatabase } from './client.js';
import bcrypt from 'bcryptjs';

export async function runSeed() {
  await initDatabase();

  console.log('Starting seed process for THEIAKSHI ENTERPRISE...');

  // 1. Organization Check / Insert
  let org = await queryOne(`SELECT * FROM organizations WHERE code = 'THEIAKSHI'`);
  if (!org) {
    const orgs = await query(`
      INSERT INTO organizations (name, code, currency, currency_symbol, registration_number, tax_id_pan, website)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      'THEIAKSHI ENTERPRISE',
      'THEIAKSHI',
      'INR',
      '₹',
      'CIN-U72200KA2026PTC10982',
      'AAACT1234F',
      'https://theiakshi.enterprise'
    ]);
    org = orgs[0];
  }

  const orgId = org.id;

  // 2. Branches
  let branchBglr = await queryOne(`SELECT * FROM branches WHERE organization_id = $1 AND code = 'BLR-HQ'`, [orgId]);
  if (!branchBglr) {
    const branches = await query(`
      INSERT INTO branches (organization_id, name, code, city, state, country, address_line, pincode, is_headquarters)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      orgId,
      'Bengaluru Headquarters',
      'BLR-HQ',
      'Bengaluru',
      'Karnataka',
      'India',
      '100 Feet Road, Indiranagar',
      '560038',
      true
    ]);
    branchBglr = branches[0];
  }

  let branchMumb = await queryOne(`SELECT * FROM branches WHERE organization_id = $1 AND code = 'BOM-REG'`, [orgId]);
  if (!branchMumb) {
    const branches = await query(`
      INSERT INTO branches (organization_id, name, code, city, state, country, address_line, pincode, is_headquarters)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      orgId,
      'Mumbai Regional Office',
      'BOM-REG',
      'Mumbai',
      'Maharashtra',
      'India',
      'Bandra Kurla Complex',
      '400051',
      false
    ]);
    branchMumb = branches[0];
  }

  // 3. Departments
  const deptData = [
    { name: 'Executive Management', code: 'EXEC', desc: 'Leadership and Corporate Strategy' },
    { name: 'Engineering & Technology', code: 'ENG', desc: 'Software Product Development & Cloud IT' },
    { name: 'Human Resources', code: 'HR', desc: 'Talent Acquisition, Payroll, Compliance & HR Ops' },
    { name: 'Finance & Accounts', code: 'FIN', desc: 'Financial Planning, Taxes and Disbursements' },
    { name: 'Operations & Sales', code: 'OPS', desc: 'Client Engagements, Business Ops & Sales' }
  ];

  const depts: Record<string, any> = {};
  for (const d of deptData) {
    let dept = await queryOne(`SELECT * FROM departments WHERE organization_id = $1 AND code = $2`, [orgId, d.code]);
    if (!dept) {
      const res = await query(`
        INSERT INTO departments (organization_id, branch_id, name, code, description)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [orgId, branchBglr.id, d.name, d.code, d.desc]);
      dept = res[0];
    }
    depts[d.code] = dept;
  }

  // 4. Designations
  const desigData = [
    { title: 'Chief Executive Officer', grade: 'E10', level: 10, dept: 'EXEC' },
    { title: 'Chief Technology Officer', grade: 'E9', level: 9, dept: 'ENG' },
    { title: 'Head of Human Resources', grade: 'E8', level: 8, dept: 'HR' },
    { title: 'Engineering Manager', grade: 'E7', level: 7, dept: 'ENG' },
    { title: 'Senior Software Engineer', grade: 'E5', level: 5, dept: 'ENG' },
    { title: 'Payroll & HR Specialist', grade: 'E4', level: 4, dept: 'HR' },
    { title: 'Associate Software Engineer', grade: 'E2', level: 2, dept: 'ENG' }
  ];

  const desigs: Record<string, any> = {};
  for (const des of desigData) {
    let d = await queryOne(`SELECT * FROM designations WHERE organization_id = $1 AND title = $2`, [orgId, des.title]);
    if (!d) {
      const res = await query(`
        INSERT INTO designations (organization_id, title, grade, level)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [orgId, des.title, des.grade, des.level]);
      d = res[0];
    }
    desigs[des.title] = d;
  }

  // 5. Roles
  const rolesList = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'];
  const roles: Record<string, any> = {};
  for (const rName of rolesList) {
    let r = await queryOne(`SELECT * FROM roles WHERE organization_id = $1 AND name = $2`, [orgId, rName]);
    if (!r) {
      const res = await query(`
        INSERT INTO roles (organization_id, name, description)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [orgId, rName, `Role for ${rName} in THEIAKSHI ENTERPRISE`]);
      r = res[0];
    }
    roles[rName] = r;
  }

  // 6. Users and Employees Seed Data
  const defaultPasswordHash = await bcrypt.hash('Password123!', 10);

  const usersData = [
    {
      email: 'admin@theiakshi.com',
      role: 'SUPER_ADMIN',
      empCode: 'EMP001',
      firstName: 'Vikramaditya',
      lastName: 'Rao',
      deptCode: 'EXEC',
      desigTitle: 'Chief Executive Officer',
      salary: 350000.00,
      phone: '+91 98765 43210'
    },
    {
      email: 'hr@theiakshi.com',
      role: 'HR_MANAGER',
      empCode: 'EMP002',
      firstName: 'Ananya',
      lastName: 'Sharma',
      deptCode: 'HR',
      desigTitle: 'Head of Human Resources',
      salary: 180000.00,
      phone: '+91 98765 43211'
    },
    {
      email: 'manager@theiakshi.com',
      role: 'MANAGER',
      empCode: 'EMP003',
      firstName: 'Rajesh',
      lastName: 'Kumar',
      deptCode: 'ENG',
      desigTitle: 'Engineering Manager',
      salary: 220000.00,
      phone: '+91 98765 43212'
    },
    {
      email: 'employee@theiakshi.com',
      role: 'EMPLOYEE',
      empCode: 'EMP004',
      firstName: 'Priya',
      lastName: 'Nair',
      deptCode: 'ENG',
      desigTitle: 'Senior Software Engineer',
      salary: 120000.00,
      phone: '+91 98765 43213'
    }
  ];

  const createdEmployees: Record<string, any> = {};

  for (const uData of usersData) {
    let usr = await queryOne(`SELECT * FROM users WHERE organization_id = $1 AND email = $2`, [orgId, uData.email]);
    if (!usr) {
      const uRes = await query(`
        INSERT INTO users (organization_id, email, password_hash, is_active)
        VALUES ($1, $2, $3, true)
        RETURNING *
      `, [orgId, uData.email, defaultPasswordHash]);
      usr = uRes[0];

      // User Role Assignment
      await query(`
        INSERT INTO user_roles (user_id, role_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [usr.id, roles[uData.role].id]);
    }

    let emp = await queryOne(`SELECT * FROM employees WHERE organization_id = $1 AND email = $2`, [orgId, uData.email]);
    if (!emp) {
      const eRes = await query(`
        INSERT INTO employees (
          organization_id, user_id, employee_code, first_name, last_name, email, phone, gender,
          date_of_joining, branch_id, department_id, designation_id, base_salary_inr, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `, [
        orgId,
        usr.id,
        uData.empCode,
        uData.firstName,
        uData.lastName,
        uData.email,
        uData.phone,
        'FEMALE',
        '2024-01-15',
        branchBglr.id,
        depts[uData.deptCode]?.id,
        desigs[uData.desigTitle]?.id,
        uData.salary,
        'ACTIVE'
      ]);
      emp = eRes[0];
    }
    createdEmployees[uData.email] = emp;
  }

  // Set Manager link for Employee (Priya Nair reports to Rajesh Kumar)
  if (createdEmployees['employee@theiakshi.com'] && createdEmployees['manager@theiakshi.com']) {
    await query(`
      INSERT INTO employee_managers (employee_id, manager_id, is_primary)
      VALUES ($1, $2, true)
      ON CONFLICT DO NOTHING
    `, [
      createdEmployees['employee@theiakshi.com'].id,
      createdEmployees['manager@theiakshi.com'].id
    ]);
  }

  // 7. Shifts
  const shiftGen = await queryOne(`SELECT * FROM shifts WHERE organization_id = $1 AND name = 'General Shift'`, [orgId]);
  if (!shiftGen) {
    await query(`
      INSERT INTO shifts (organization_id, name, start_time, end_time, grace_minutes, half_day_hours, full_day_hours)
      VALUES ($1, 'General Shift', '09:00:00', '18:00:00', 15, 4.0, 8.0)
    `, [orgId]);
  }

  // 8. Leave Types
  const leaveTypesData = [
    { name: 'Casual Leave', code: 'CL', days: 12 },
    { name: 'Sick Leave', code: 'SL', days: 12 },
    { name: 'Privilege Leave', code: 'PL', days: 18 },
    { name: 'Maternity Leave', code: 'ML', days: 180 }
  ];

  for (const lt of leaveTypesData) {
    const existingLt = await queryOne(`SELECT * FROM leave_types WHERE organization_id = $1 AND code = $2`, [orgId, lt.code]);
    if (!existingLt) {
      await query(`
        INSERT INTO leave_types (organization_id, name, code, days_per_year, requires_approval)
        VALUES ($1, $2, $3, $4, true)
      `, [orgId, lt.name, lt.code, lt.days]);
    }
  }

  // 9. Expense Categories
  const expenseCatData = [
    { name: 'Travel & Conveyance', code: 'TRAVEL', limit: 25000.00 },
    { name: 'Client Entertainment & Meals', code: 'MEALS', limit: 10000.00 },
    { name: 'Office Supplies & Stationeries', code: 'SUPPLIES', limit: 15000.00 },
    { name: 'Software Subscriptions & Tools', code: 'SOFTWARE', limit: 50000.00 },
    { name: 'Internet & Mobile Reimbursements', code: 'INTERNET', limit: 3000.00 }
  ];

  for (const ec of expenseCatData) {
    const existingEc = await queryOne(`SELECT * FROM expense_categories WHERE organization_id = $1 AND code = $2`, [orgId, ec.code]);
    if (!existingEc) {
      await query(`
        INSERT INTO expense_categories (organization_id, name, code, max_limit_inr, requires_receipt)
        VALUES ($1, $2, $3, $4, true)
      `, [orgId, ec.name, ec.code, ec.limit]);
    }
  }

  // 10. Statutory Rules (India HRMS Standards)
  const statRulesData = [
    { name: 'Employees Provident Fund (EPF)', pct: 12.00, desc: '12% of Basic Salary contributed to EPFO' },
    { name: 'Employees State Insurance (ESI)', pct: 0.75, desc: '0.75% for Gross Salary under ₹21,000/month' },
    { name: 'Professional Tax (PT - Karnataka)', pct: 0.00, limit: 200.00, desc: 'Flat ₹200/month for salary above ₹15,000' },
    { name: 'Tax Deducted at Source (TDS)', pct: 10.00, desc: 'Income tax withholding as per New Tax Regime slabs' }
  ];

  for (const sr of statRulesData) {
    const existingSr = await queryOne(`SELECT * FROM statutory_rules WHERE organization_id = $1 AND rule_name = $2`, [orgId, sr.name]);
    if (!existingSr) {
      await query(`
        INSERT INTO statutory_rules (organization_id, rule_name, percentage, threshold_limit_inr, description)
        VALUES ($1, $2, $3, $4, $5)
      `, [orgId, sr.name, sr.pct, sr.limit || 0, sr.desc]);
    }
  }

  // 11. Holidays (2026 India)
  const holidaysData = [
    { title: 'Republic Day', date: '2026-01-26' },
    { title: 'May Day / Labor Day', date: '2026-05-01' },
    { title: 'Independence Day', date: '2026-08-15' },
    { title: 'Gandhi Jayanti', date: '2026-10-02' },
    { title: 'Karnataka Rajyotsava', date: '2026-11-01' },
    { title: 'Diwali / Deepavali', date: '2026-11-08' }
  ];

  for (const h of holidaysData) {
    const existingH = await queryOne(`SELECT * FROM holidays WHERE organization_id = $1 AND date = $2`, [orgId, h.date]);
    if (!existingH) {
      await query(`
        INSERT INTO holidays (organization_id, title, date, is_mandatory)
        VALUES ($1, $2, $3, true)
      `, [orgId, h.title, h.date]);
    }
  }

  // 12. Compliance Tasks
  const compTasksData = [
    { title: 'Monthly EPF Return Filing & E-Challan Deposit', statute: 'PF_FILING', due: '2026-08-15' },
    { title: 'ESI Contribution Payment Submission', statute: 'ESI_DEPOSIT', due: '2026-08-15' },
    { title: 'Professional Tax (PT) Remittance', statute: 'PT_DEPOSIT', due: '2026-08-20' },
    { title: 'Quarterly TDS Return Filing (Form 24Q)', statute: 'TDS_RETURNS', due: '2026-09-30' }
  ];

  for (const ct of compTasksData) {
    const existingCt = await queryOne(`SELECT * FROM compliance_calendar WHERE organization_id = $1 AND title = $2`, [orgId, ct.title]);
    if (!existingCt) {
      await query(`
        INSERT INTO compliance_calendar (organization_id, title, statute_type, due_date, status)
        VALUES ($1, $2, $3, $4, 'PENDING')
      `, [orgId, ct.title, ct.statute, ct.due]);
    }
  }

  console.log('Seed completed successfully for THEIAKSHI ENTERPRISE!');
  return { status: 'SUCCESS', organization: org };
}
