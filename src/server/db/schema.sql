-- THEIAKSHI ENTERPRISE HRMS - Database Schema
-- This file is loaded by initDatabase() on first run
-- It includes the core schema from migrations/001_initial_schema.sql

-- Enable pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Organizations
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
    timezone VARCHAR(100) DEFAULT 'Asia/Kolkata',
    office_latitude DECIMAL(10,8),
    office_longitude DECIMAL(11,8),
    allowed_geofence_radius_meters INTEGER DEFAULT 500,
    enforce_gps_check_in BOOLEAN DEFAULT TRUE,
    shift_start_time VARCHAR(20) DEFAULT '09:00',
    shift_end_time VARCHAR(20) DEFAULT '18:00',
    grace_period_minutes INTEGER DEFAULT 15,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Branches
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
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT unique_branch_code UNIQUE(organization_id, code)
);

-- Departments
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT unique_department_code UNIQUE(organization_id, code)
);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Designations
CREATE TABLE IF NOT EXISTS designations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    grade VARCHAR(50),
    level INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Users
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

-- Roles
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_role_name UNIQUE(organization_id, name)
);

-- Permissions
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_permission UNIQUE(module, action)
);

-- User Roles
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id)
);

-- Employees
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
    employment_type VARCHAR(50) DEFAULT 'FULL_TIME',
    status VARCHAR(50) DEFAULT 'ACTIVE',
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

-- Shifts
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
    location_id UUID REFERENCES attendance_locations(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Attendance Locations (must be before shifts due to FK)
CREATE TABLE IF NOT EXISTS attendance_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    radius_meters INTEGER DEFAULT 200,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Employee Shifts
CREATE TABLE IF NOT EXISTS employee_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Attendance
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    check_in TIMESTAMP WITH TIME ZONE,
    check_out TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'PRESENT',
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
    context_snapshot JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_employee_daily_attendance UNIQUE(employee_id, date)
);

-- Leave Types
CREATE TABLE IF NOT EXISTS leave_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL,
    annual_quota INTEGER NOT NULL DEFAULT 12,
    carry_forward_allowed BOOLEAN DEFAULT FALSE,
    requires_attachment BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_leave_type_code UNIQUE(organization_id, code)
);

-- Leave Balances
CREATE TABLE IF NOT EXISTS leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
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

-- Leave Requests
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
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

-- Holidays
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

-- Expense Categories
CREATE TABLE IF NOT EXISTS expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    max_limit_inr DECIMAL(12,2),
    requires_receipt BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    amount_inr DECIMAL(12,2) NOT NULL,
    expense_date DATE NOT NULL,
    description TEXT,
    receipt_url TEXT,
    receipt_name TEXT,
    receipt_id TEXT,
    status VARCHAR(50) DEFAULT 'SUBMITTED',
    reviewed_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    reimbursement_date DATE,
    approved_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejected_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    rejected_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    client_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Timesheets
CREATE TABLE IF NOT EXISTS timesheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    hours DECIMAL(4,2) NOT NULL,
    task_description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'SUBMITTED',
    submitted_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejected_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payroll Periods
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
    finalized_at TIMESTAMP WITH TIME ZONE,
    finalized_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Salary Structures
CREATE TABLE IF NOT EXISTS salary_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
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

-- Payroll Records
CREATE TABLE IF NOT EXISTS payroll_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
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
    paid_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payslips
CREATE TABLE IF NOT EXISTS payslips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_record_id UUID NOT NULL REFERENCES payroll_records(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    pdf_path TEXT,
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Statutory Rules
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

-- Compliance Calendar
CREATE TABLE IF NOT EXISTS compliance_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    statute_type VARCHAR(100) NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
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
    -- Legacy columns
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50),
    link VARCHAR(255)
);

-- Notification Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_org_recipient ON notifications(organization_id, recipient_employee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(organization_id, recipient_employee_id, is_read) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_idempotency ON notifications(organization_id, recipient_employee_id, notification_type, entity_type, entity_id);

-- Announcements
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

-- Helpdesk Categories
CREATE TABLE IF NOT EXISTS helpdesk_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Helpdesk Tickets
CREATE TABLE IF NOT EXISTS helpdesk_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    ticket_number VARCHAR(50) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category_id UUID REFERENCES helpdesk_categories(id) ON DELETE SET NULL,
    category VARCHAR(100),
    priority VARCHAR(20) DEFAULT 'MEDIUM',
    status VARCHAR(50) DEFAULT 'OPEN',
    assigned_to UUID REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT helpdesk_tickets_org_ticket_num UNIQUE (organization_id, ticket_number)
);

-- Ticket Comments
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

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    user_name VARCHAR(255),
    user_role VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    module VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    ip_address VARCHAR(50),
    details TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Employee Documents
CREATE TABLE IF NOT EXISTS employee_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    file_path TEXT NOT NULL,
    file_type VARCHAR(50),
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Document Types
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

-- Documents
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    document_type_id UUID REFERENCES document_types(id) ON DELETE SET NULL,
    document_name VARCHAR(255) NOT NULL,
    description TEXT,
    expiry_date DATE,
    status VARCHAR(50) DEFAULT 'UPLOADED',
    verification_status VARCHAR(50) DEFAULT 'PENDING',
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Document Versions
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

-- Receipts
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

-- Salary Structure History
CREATE TABLE IF NOT EXISTS salary_structure_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    salary_structure_id UUID REFERENCES salary_structures(id) ON DELETE SET NULL,
    snapshot JSONB NOT NULL,
    effective_from DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Phase 14: Correction Request Tables
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

CREATE TABLE IF NOT EXISTS timesheet_correction_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    timesheet_id UUID NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
    new_date DATE NOT NULL,
    new_hours DECIMAL(4,2) NOT NULL,
    new_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    new_task_description TEXT NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    reviewed_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    review_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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

-- Phase 15: Device Tokens for Push Notifications
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

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_employees_org ON employees(organization_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_leave_req_emp ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_expenses_emp ON expenses(employee_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_emp ON timesheets(employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_org_id ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_emp_id ON documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_salary_structures_employee ON salary_structures(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_structures_org ON salary_structures(organization_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_org ON payroll_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_period ON payroll_records(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_employee ON payroll_records(employee_id);

-- Foreign key for employee shift
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_employee_shift') THEN
        ALTER TABLE employees ADD CONSTRAINT fk_employee_shift FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Helpdesk Indexes
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_org_emp ON helpdesk_tickets(organization_id, employee_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_status ON helpdesk_tickets(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_created ON helpdesk_tickets(organization_id, created_at DESC) WHERE deleted_at IS NULL;

-- Announcements Indexes
CREATE INDEX IF NOT EXISTS idx_announcements_org_status ON announcements(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_announcements_published ON announcements(organization_id, published_at DESC) WHERE deleted_at IS NULL;

-- Leave Correction Request Indexes
CREATE INDEX IF NOT EXISTS idx_leave_corr_req_org ON leave_correction_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_leave_corr_req_emp ON leave_correction_requests(employee_id);

-- Attendance Regularization Indexes
CREATE INDEX IF NOT EXISTS idx_att_reg_org ON attendance_regularization_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_att_reg_emp ON attendance_regularization_requests(employee_id);

-- Timesheet Correction Request Indexes
CREATE INDEX IF NOT EXISTS idx_ts_corr_req_org ON timesheet_correction_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_ts_corr_req_emp ON timesheet_correction_requests(employee_id);

-- Payroll Adjustment Indexes
CREATE INDEX IF NOT EXISTS idx_payroll_adj_org ON payroll_adjustments(organization_id);
CREATE INDEX IF NOT EXISTS idx_payroll_adj_emp ON payroll_adjustments(employee_id);

-- Device Tokens Indexes
CREATE INDEX IF NOT EXISTS idx_device_tokens_org ON device_tokens(organization_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_emp ON device_tokens(employee_id);

-- Expenses Indexes
CREATE INDEX IF NOT EXISTS idx_expenses_org ON expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

-- Timesheets Indexes
CREATE INDEX IF NOT EXISTS idx_timesheets_org ON timesheets(organization_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_status ON timesheets(status);
CREATE INDEX IF NOT EXISTS idx_timesheets_date ON timesheets(date);

-- Sequence for Ticket Numbers
CREATE SEQUENCE IF NOT EXISTS helpdesk_ticket_seq START 1;