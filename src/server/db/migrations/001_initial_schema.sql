-- THEIAKSHI ENTERPRISE HRMS - PostgreSQL Schema DDL
-- Enables pgcrypto extension for UUID generation if needed

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    currency_symbol VARCHAR(5) NOT NULL DEFAULT '₹',
    registration_number VARCHAR(100),
    tax_id_pan VARCHAR(50),
    website VARCHAR(255),
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    address_line TEXT NOT NULL,
    pincode VARCHAR(20) NOT NULL,
    is_headquarters BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT unique_branch_code UNIQUE(organization_id, code)
);

CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT unique_department_code UNIQUE(organization_id, code)
);

CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS designations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    grade VARCHAR(50),
    level INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    reset_token_hash VARCHAR(255),
    reset_token_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL, -- SUPER_ADMIN, ADMIN, HR_MANAGER, MANAGER, EMPLOYEE
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_role_name UNIQUE(organization_id, name)
);

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_permission UNIQUE(module, action)
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    employee_code VARCHAR(50) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    gender VARCHAR(20),
    date_of_birth DATE,
    date_of_joining DATE NOT NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    designation_id UUID REFERENCES designations(id) ON DELETE SET NULL,
    employment_type VARCHAR(50) DEFAULT 'FULL_TIME', -- FULL_TIME, CONTRACT, INTERN
    status VARCHAR(50) DEFAULT 'ACTIVE', -- ACTIVE, ON_LEAVE, TERMINATED
    pan_number VARCHAR(20),
    aadhaar_number VARCHAR(20),
    bank_account_number VARCHAR(50),
    bank_ifsc VARCHAR(20),
    base_salary_inr DECIMAL(12,2) DEFAULT 0.00,
    shift_id UUID,
    manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    profile_photo TEXT,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    work_location VARCHAR(100),
    hra DECIMAL(12,2) DEFAULT 0.00,
    allowances DECIMAL(12,2) DEFAULT 0.00,
    bank_name VARCHAR(100),
    uan_number VARCHAR(50),
    pf_number VARCHAR(50),
    esi_number VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT unique_org_emp_code UNIQUE(organization_id, employee_code),
    CONSTRAINT unique_org_email UNIQUE(organization_id, email)
);

CREATE TABLE IF NOT EXISTS employee_managers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    manager_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_emp_mgr UNIQUE(employee_id, manager_id)
);

CREATE TABLE IF NOT EXISTS employee_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL, -- ID_PROOF, SALARY_SLIP, CONTRACT, DEGREE
    file_path TEXT NOT NULL,
    file_type VARCHAR(50),
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    start_time VARCHAR(20) NOT NULL,
    end_time VARCHAR(20) NOT NULL,
    grace_period_minutes INTEGER DEFAULT 15,
    break_duration_minutes INTEGER DEFAULT 60,
    working_hours DECIMAL(4,2) DEFAULT 8.0,
    week_offs TEXT DEFAULT '["SATURDAY", "SUNDAY"]',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shift_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    employee_name VARCHAR(255),
    employee_code VARCHAR(100),
    shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE,
    shift_name VARCHAR(100),
    assigned_by VARCHAR(255),
    assigned_by_name VARCHAR(255),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reason TEXT
);

CREATE TABLE IF NOT EXISTS employee_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    radius_meters INTEGER DEFAULT 200,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    check_in TIMESTAMP WITH TIME ZONE,
    check_out TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'PRESENT', -- PRESENT, LATE, ABSENT, HALF_DAY, ON_LEAVE
    work_hours DECIMAL(4,2) DEFAULT 0.0,
    check_in_ip VARCHAR(50),
    check_in_location TEXT,
    check_in_latitude DECIMAL(10,8),
    check_in_longitude DECIMAL(11,8),
    check_in_accuracy DECIMAL(8,2),
    check_out_latitude DECIMAL(10,8),
    check_out_longitude DECIMAL(11,8),
    check_out_accuracy DECIMAL(8,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_employee_daily_attendance UNIQUE(employee_id, date)
);

CREATE TABLE IF NOT EXISTS leave_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL,
    annual_quota INTEGER NOT NULL DEFAULT 12,
    carry_forward_allowed BOOLEAN DEFAULT FALSE,
    requires_attachment BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_leave_type_code UNIQUE(organization_id, code)
);

CREATE TABLE IF NOT EXISTS leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    total_quota DECIMAL(5,2) NOT NULL DEFAULT 12.00,
    used DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    pending DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    available DECIMAL(5,2) NOT NULL DEFAULT 12.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_emp_leave_year UNIQUE(employee_id, leave_type_id, year)
);

CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
    start_date VARCHAR(20) NOT NULL,
    end_date VARCHAR(20) NOT NULL,
    days_count DECIMAL(5,2) NOT NULL,
    is_half_day BOOLEAN DEFAULT FALSE,
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    reviewed_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    review_reason TEXT,
    attachment_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    date VARCHAR(20) NOT NULL,
    type VARCHAR(50) DEFAULT 'NATIONAL',
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    max_limit_inr DECIMAL(12,2),
    requires_receipt BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    amount_inr DECIMAL(12,2) NOT NULL,
    expense_date DATE NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'SUBMITTED', -- SUBMITTED, APPROVED, REJECTED, PAID
    reviewed_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expense_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    client_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS timesheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    hours DECIMAL(4,2) NOT NULL,
    task_description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'SUBMITTED', -- DRAFT, SUBMITTED, APPROVED, REJECTED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payroll_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'DRAFT',
    total_employees INTEGER DEFAULT 0,
    total_gross_payout DECIMAL(12,2) DEFAULT 0.00,
    total_net_payout DECIMAL(12,2) DEFAULT 0.00,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS salary_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    basic_salary DECIMAL(12,2) NOT NULL,
    hra DECIMAL(12,2) NOT NULL,
    special_allowance DECIMAL(12,2) NOT NULL,
    medical_allowance DECIMAL(12,2) DEFAULT 0.00,
    conveyance_allowance DECIMAL(12,2) DEFAULT 0.00,
    other_allowances DECIMAL(12,2) DEFAULT 0.00,
    bonus DECIMAL(12,2) DEFAULT 0.00,
    incentives DECIMAL(12,2) DEFAULT 0.00,
    pf_employee DECIMAL(12,2) NOT NULL,
    pf_employer DECIMAL(12,2) NOT NULL,
    esi_employee DECIMAL(12,2) NOT NULL,
    esi_employer DECIMAL(12,2) NOT NULL,
    professional_tax DECIMAL(12,2) NOT NULL,
    tds DECIMAL(12,2) NOT NULL,
    other_deductions DECIMAL(12,2) DEFAULT 0.00,
    gross_salary DECIMAL(12,2) NOT NULL,
    net_salary DECIMAL(12,2) NOT NULL,
    effective_date DATE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payroll_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_period_id UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    working_days INTEGER NOT NULL,
    present_days DECIMAL(4,2) NOT NULL,
    paid_leave_days DECIMAL(4,2) NOT NULL,
    loss_of_pay_days DECIMAL(4,2) NOT NULL,
    basic_salary DECIMAL(12,2) NOT NULL,
    hra DECIMAL(12,2) NOT NULL,
    allowances DECIMAL(12,2) NOT NULL,
    bonus DECIMAL(12,2) DEFAULT 0.00,
    incentives DECIMAL(12,2) DEFAULT 0.00,
    gross_earnings DECIMAL(12,2) NOT NULL,
    pf_deduction DECIMAL(12,2) NOT NULL,
    esi_deduction DECIMAL(12,2) NOT NULL,
    pt_deduction DECIMAL(12,2) NOT NULL,
    tds_deduction DECIMAL(12,2) NOT NULL,
    other_deductions DECIMAL(12,2) NOT NULL,
    total_deductions DECIMAL(12,2) NOT NULL,
    net_salary DECIMAL(12,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'PROCESSED',
    calculation_breakdown JSONB,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payslips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_record_id UUID NOT NULL REFERENCES payroll_records(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    pdf_path TEXT,
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS statutory_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    rule_name VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL,
    state VARCHAR(100) DEFAULT 'All India',
    rate_percentage DECIMAL(5,2),
    fixed_amount DECIMAL(12,2),
    threshold_amount DECIMAL(12,2),
    effective_date DATE,
    active BOOLEAN DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compliance_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    statute_type VARCHAR(100) NOT NULL, -- PF_FILING, ESI_DEPOSIT, TDS_RETURNS
    due_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, COMPLIED, OVERDUE
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    recipient_employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    actor_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    notification_type VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
    entity_type VARCHAR(50),
    entity_id UUID,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    action_url VARCHAR(255),
    metadata JSONB,
    priority VARCHAR(20) DEFAULT 'NORMAL',
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Legacy support
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50),
    link VARCHAR(255)
);

-- Notification indexes for Phase 11
CREATE INDEX IF NOT EXISTS idx_notifications_org_recipient ON notifications(organization_id, recipient_employee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(organization_id, recipient_employee_id, is_read) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_idempotency ON notifications(organization_id, recipient_employee_id, notification_type, entity_type, entity_id);

CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'GENERAL',
    priority VARCHAR(20) DEFAULT 'NORMAL',
    status VARCHAR(50) DEFAULT 'PUBLISHED',
    audience VARCHAR(50) DEFAULT 'ALL',
    target_id VARCHAR(50),
    target_name VARCHAR(255),
    publish_date VARCHAR(20),
    published_at TIMESTAMP WITH TIME ZONE,
    expiry_date VARCHAR(20),
    expires_at TIMESTAMP WITH TIME ZONE,
    attachment_name VARCHAR(255),
    attachment_url TEXT,
    author_name VARCHAR(255),
    created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS helpdesk_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS helpdesk_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    ticket_number VARCHAR(50) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category_id UUID REFERENCES helpdesk_categories(id) ON DELETE SET NULL,
    category VARCHAR(100), -- fallback for legacy
    priority VARCHAR(20) DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, URGENT
    status VARCHAR(50) DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, WAITING_FOR_EMPLOYEE, RESOLVED, CLOSED, CANCELLED
    assigned_to UUID REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(organization_id, ticket_number)
);

CREATE TABLE IF NOT EXISTS ticket_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ticket_id UUID NOT NULL REFERENCES helpdesk_tickets(id) ON DELETE CASCADE,
    author_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    comment TEXT NOT NULL,
    attachment_name VARCHAR(255),
    attachment_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Legacy table (to be migrated)
CREATE TABLE IF NOT EXISTS helpdesk_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES helpdesk_tickets(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    user_role VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    module VARCHAR(100) NOT NULL,
    ip_address VARCHAR(50),
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- CREATE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_employees_org ON employees(organization_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_leave_req_emp ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_expenses_emp ON expenses(employee_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_emp ON timesheets(employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id);
ALTER TABLE employees ADD CONSTRAINT fk_employee_shift FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL;

-- Phase 7 Expense schema fixes
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_name TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_id TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS reimbursement_date DATE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    size_bytes INTEGER,
    data_base64 TEXT,
    uploaded_by TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expenses_org ON expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_employee ON expenses(employee_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

-- Phase 8 Timesheet schema fixes
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_timesheets_org ON timesheets(organization_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_status ON timesheets(status);
CREATE INDEX IF NOT EXISTS idx_timesheets_date ON timesheets(date);

-- Phase 8 Database Cleanup: Backfill timesheets.organization_id from employee's organization
-- This is idempotent: WHERE organization_id IS NULL makes it a no-op after first run
UPDATE timesheets t
SET organization_id = e.organization_id
FROM employees e
WHERE t.employee_id = e.id
  AND t.organization_id IS NULL;

-- After backfill, enforce NOT NULL constraint on timesheets.organization_id
-- Safe to re-run: PostgreSQL silently accepts this if constraint already exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'timesheets'
      AND column_name = 'organization_id'
      AND is_nullable = 'YES'
  ) AND NOT EXISTS (
    SELECT 1 FROM timesheets WHERE organization_id IS NULL
  ) THEN
    EXECUTE 'ALTER TABLE timesheets ALTER COLUMN organization_id SET NOT NULL';
  END IF;
END$$;

-- Verify: this index now covers a NOT NULL column (re-declared as IF NOT EXISTS is safe)
CREATE INDEX IF NOT EXISTS idx_timesheets_org ON timesheets(organization_id);

-- Phase 9 Payroll schema fixes
-- Add organization_id to salary_structures (was missing, only scoped via employee join)
ALTER TABLE salary_structures ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to payroll_records (was missing, only scoped via payroll_period join)
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add paid_by to payroll_records
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add finalized_at and finalized_by to payroll_periods for audit trail
ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS finalized_by TEXT;


-- Phase 10 Document Management Schema

CREATE TABLE IF NOT EXISTS document_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  requires_expiry BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  document_type_id UUID REFERENCES document_types(id) ON DELETE SET NULL,
  document_name VARCHAR(255) NOT NULL,
  description TEXT,
  expiry_date DATE,
  status VARCHAR(50) DEFAULT 'UPLOADED', -- UPLOADED, PENDING_VERIFICATION, VERIFIED, REJECTED
  verification_status VARCHAR(50) DEFAULT 'PENDING',
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  original_file_name VARCHAR(255) NOT NULL,
  storage_key TEXT NOT NULL,
  mime_type VARCHAR(255),
  file_extension VARCHAR(50),
  file_size BIGINT,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (document_id, version_number)
);

-- Indexes for Phase 10
CREATE INDEX IF NOT EXISTS idx_documents_org_id ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_emp_id ON documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON documents(deleted_at);
CREATE INDEX IF NOT EXISTS idx_document_versions_doc_id ON document_versions(document_id);


-- Backfill salary_structures.organization_id from employee (idempotent)
UPDATE salary_structures ss
SET organization_id = e.organization_id
FROM employees e
WHERE ss.employee_id = e.id
  AND ss.organization_id IS NULL;

-- Backfill payroll_records.organization_id from payroll_period (idempotent)
UPDATE payroll_records pr
SET organization_id = pp.organization_id
FROM payroll_periods pp
WHERE pr.payroll_period_id = pp.id
  AND pr.organization_id IS NULL;

-- Salary structure version history: keeps immutable snapshots on every save
CREATE TABLE IF NOT EXISTS salary_structure_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    salary_structure_id UUID REFERENCES salary_structures(id) ON DELETE SET NULL,
    snapshot JSONB NOT NULL,
    effective_from DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint: one salary_structure record per employee per org (upsert safe)
CREATE UNIQUE INDEX IF NOT EXISTS idx_salary_structures_employee ON salary_structures(employee_id);

-- Indexes for payroll performance
CREATE INDEX IF NOT EXISTS idx_salary_structures_org ON salary_structures(organization_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_org ON payroll_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_period ON payroll_records(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_employee ON payroll_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_status ON payroll_records(status);
CREATE INDEX IF NOT EXISTS idx_salary_history_employee ON salary_structure_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_history_org ON salary_structure_history(organization_id);

-- ---------------------------------------------------------
-- Phase 12 Migrations
-- ---------------------------------------------------------

-- Announcements
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'GENERAL';
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'NORMAL';
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PUBLISHED';
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Helpdesk Tickets
ALTER TABLE helpdesk_tickets ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE helpdesk_tickets ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE helpdesk_tickets ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES helpdesk_categories(id) ON DELETE SET NULL;
ALTER TABLE helpdesk_tickets ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE helpdesk_tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE helpdesk_tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE helpdesk_tickets ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE helpdesk_tickets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE helpdesk_tickets DROP CONSTRAINT IF EXISTS helpdesk_tickets_ticket_number_key; -- Removing global unique constraint

-- Helpdesk Indexes
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_org_emp ON helpdesk_tickets(organization_id, employee_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_status ON helpdesk_tickets(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_created ON helpdesk_tickets(organization_id, created_at DESC) WHERE deleted_at IS NULL;

-- Announcements Indexes
CREATE INDEX IF NOT EXISTS idx_announcements_org_status ON announcements(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_announcements_published ON announcements(organization_id, published_at DESC) WHERE deleted_at IS NULL;

-- Backfill organization_id for helpdesk_tickets
UPDATE helpdesk_tickets ht
SET organization_id = e.organization_id
FROM employees e
WHERE ht.employee_id = e.id
  AND ht.organization_id IS NULL;

-- Enforce NOT NULL on organization_id for helpdesk_tickets (guarded)
ALTER TABLE helpdesk_tickets ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE helpdesk_tickets ALTER COLUMN description SET DEFAULT '';
UPDATE helpdesk_tickets SET description = subject WHERE description IS NULL OR description = '';
ALTER TABLE helpdesk_tickets ALTER COLUMN description DROP DEFAULT;
ALTER TABLE helpdesk_tickets ALTER COLUMN description SET NOT NULL;
ALTER TABLE helpdesk_tickets ADD CONSTRAINT helpdesk_tickets_org_ticket_num UNIQUE (organization_id, ticket_number);

-- Migrate any existing data from legacy helpdesk_messages table to ticket_comments safely
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'helpdesk_messages') THEN
    INSERT INTO ticket_comments (id, ticket_id, author_employee_id, comment, created_at, organization_id)
    SELECT hm.id, hm.ticket_id, hm.sender_id, hm.message, hm.created_at, ht.organization_id
    FROM helpdesk_messages hm
    JOIN helpdesk_tickets ht ON hm.ticket_id = ht.id
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Sequence for Ticket Numbers
CREATE SEQUENCE IF NOT EXISTS helpdesk_ticket_seq START 1;

-- Phase 14: Leave Correction Requests
CREATE TABLE IF NOT EXISTS leave_correction_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_request_id UUID NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
    new_start_date VARCHAR(20) NOT NULL,
    new_end_date VARCHAR(20) NOT NULL,
    new_is_half_day BOOLEAN DEFAULT FALSE,
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    reviewed_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    review_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leave_corr_req_org ON leave_correction_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_leave_corr_req_emp ON leave_correction_requests(employee_id);

CREATE TABLE IF NOT EXISTS attendance_regularization_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    attendance_id UUID REFERENCES attendance(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    requested_status VARCHAR(50) NOT NULL,
    check_in_time TIMESTAMP WITH TIME ZONE,
    check_out_time TIMESTAMP WITH TIME ZONE,
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    reviewed_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    review_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_att_reg_org ON attendance_regularization_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_att_reg_emp ON attendance_regularization_requests(employee_id);

- -   P h a s e   1 4 :   T i m e s h e e t   C o r r e c t i o n   R e q u e s t s 
 
 C R E A T E   T A B L E   I F   N O T   E X I S T S   t i m e s h e e t _ c o r r e c t i o n _ r e q u e s t s   ( 
 
         i d   U U I D   P R I M A R Y   K E Y   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) , 
 
         o r g a n i z a t i o n _ i d   U U I D   N O T   N U L L   R E F E R E N C E S   o r g a n i z a t i o n s ( i d )   O N   D E L E T E   C A S C A D E , 
 
         e m p l o y e e _ i d   U U I D   N O T   N U L L   R E F E R E N C E S   e m p l o y e e s ( i d )   O N   D E L E T E   C A S C A D E , 
 
         t i m e s h e e t _ i d   U U I D   N O T   N U L L   R E F E R E N C E S   t i m e s h e e t s ( i d )   O N   D E L E T E   C A S C A D E , 
 
         n e w _ d a t e   D A T E   N O T   N U L L , 
 
         n e w _ h o u r s   D E C I M A L ( 4 , 2 )   N O T   N U L L , 
 
         n e w _ p r o j e c t _ i d   U U I D   R E F E R E N C E S   p r o j e c t s ( i d )   O N   D E L E T E   S E T   N U L L , 
 
         n e w _ t a s k _ d e s c r i p t i o n   T E X T   N O T   N U L L , 
 
         r e a s o n   T E X T   N O T   N U L L , 
 
         s t a t u s   V A R C H A R ( 5 0 )   N O T   N U L L   D E F A U L T   ' P E N D I N G ' , 
 
         r e v i e w e d _ b y   U U I D   R E F E R E N C E S   e m p l o y e e s ( i d )   O N   D E L E T E   S E T   N U L L , 
 
         r e v i e w _ r e a s o n   T E X T , 
 
         c r e a t e d _ a t   T I M E S T A M P   W I T H   T I M E   Z O N E   D E F A U L T   C U R R E N T _ T I M E S T A M P , 
 
         u p d a t e d _ a t   T I M E S T A M P   W I T H   T I M E   Z O N E   D E F A U L T   C U R R E N T _ T I M E S T A M P 
 
 ) ; 
 
 
 
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ t s _ c o r r _ r e q _ o r g   O N   t i m e s h e e t _ c o r r e c t i o n _ r e q u e s t s ( o r g a n i z a t i o n _ i d ) ; 
 
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ t s _ c o r r _ r e q _ e m p   O N   t i m e s h e e t _ c o r r e c t i o n _ r e q u e s t s ( e m p l o y e e _ i d ) ; 
 
 
-- Phase 14: Payroll Adjustments
CREATE TABLE IF NOT EXISTS payroll_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    payroll_period_id UUID REFERENCES payroll_periods(id) ON DELETE SET NULL,
    type VARCHAR(100) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    requested_by UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    approved_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payroll_adj_org ON payroll_adjustments(organization_id);
CREATE INDEX IF NOT EXISTS idx_payroll_adj_emp ON payroll_adjustments(employee_id);

-- Phase 15: Mobile App Push Notifications
CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform VARCHAR(50) NOT NULL,
    app_version VARCHAR(50),
    device_id VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_device_token UNIQUE(employee_id, token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_org ON device_tokens(organization_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_emp ON device_tokens(employee_id);
