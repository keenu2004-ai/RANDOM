import fs from 'fs';

const hrmsTs = `
export interface TimesheetCorrectionRequest {
  id: string;
  organizationId: string;
  timesheetId: string;
  employeeId: string;
  newDate: string;
  newHours: number;
  newProjectId?: string;
  newTaskDescription: string;
  reason: string;
  status: string;
  reviewedBy?: string;
  reviewReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollAdjustment {
  id: string;
  organizationId: string;
  employeeId: string;
  employeeName?: string;
  employeeCode?: string;
  payrollPeriodId?: string;
  type: string;
  amount: number;
  reason: string;
  status: string;
  requestedBy: string;
  requesterName?: string;
  approverName?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}
`;
fs.appendFileSync('src/types/hrms.ts', hrmsTs);
fs.unlinkSync('check-cols.ts');
fs.unlinkSync('src/server/db/migrate-phase-14.ts');
