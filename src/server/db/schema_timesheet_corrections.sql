-- Phase 14: Timesheet Correction Requests
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

CREATE INDEX IF NOT EXISTS idx_ts_corr_req_org ON timesheet_correction_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_ts_corr_req_emp ON timesheet_correction_requests(employee_id);
