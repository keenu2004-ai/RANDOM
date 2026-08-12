/**
 * THEIAKSHI ENTERPRISE - HRMS Data Models & TypeScript Interfaces
 */

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'HR_MANAGER' | 'MANAGER' | 'EMPLOYEE';

export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
export type EmploymentStatus = 'ACTIVE' | 'INACTIVE' | 'PROBATION' | 'TERMINATED';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export type AttendanceStatus = 
  | 'PRESENT' 
  | 'ABSENT' 
  | 'LATE' 
  | 'HALF_DAY' 
  | 'ON_LEAVE' 
  | 'HOLIDAY' 
  | 'WEEK_OFF';

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type RegularizationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ExpenseStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REIMBURSED';
export type TimesheetStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type ComplianceStatus = 'PENDING' | 'IN_PROGRESS' | 'WAITING_APPROVAL' | 'COMPLETED' | 'OVERDUE';
export type ComplianceFrequency = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'ANNUALLY' | 'ONE_TIME';
export type DeductionCategory = 'PF' | 'ESI' | 'PROFESSIONAL_TAX' | 'TDS' | 'CUSTOM' | 'OTHER';

export interface StatutoryRule {
  id: string;
  ruleName: string;
  category: DeductionCategory;
  state: string;
  ratePercentage: number;
  fixedAmount?: number;
  thresholdAmount: number;
  effectiveDate: string;
  expiryDate?: string;
  active: boolean;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ComplianceTask {
  id: string;
  taskName: string;
  category: string; // e.g. "PF Return", "ESI Contribution", "TDS Filing"
  dueDate: string;
  frequency: ComplianceFrequency;
  responsiblePerson: string;
  responsiblePersonId?: string;
  status: ComplianceStatus;
  notes?: string;
  reminderDate?: string;
  completedAt?: string;
  completedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  organizationId: string;
  email: string;
  passwordHash: string;
  role: Role;
  isActive: boolean;
  employeeId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationSettings {
  id: string;
  orgName: string;
  companyCode: string;
  currency: string; // "₹ INR"
  taxId: string;
  address: string;
  city: string;
  state: string;
  country: string;
  officeLatitude: number;
  officeLongitude: number;
  allowedGeofenceRadiusMeters: number; // e.g. 500 meters
  enforceGpsCheckIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  headEmployeeId?: string;
  createdAt: string;
}

export interface Designation {
  id: string;
  title: string;
  departmentId: string;
  level: string;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  departmentId: string;
  leadEmployeeId?: string;
  createdAt: string;
}

export interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  profilePhoto?: string;
  dateOfBirth: string;
  gender: Gender;
  address: string;
  city: string;
  state: string;
  country: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  departmentId: string;
  designationId: string;
  branchId: string;
  teamId?: string;
  managerId?: string;
  joiningDate: string;
  employmentType: EmploymentType;
  status: EmploymentStatus;
  workLocation: string;
  shiftId: string;
  basicSalary: number; // in ₹ INR
  hra: number;
  allowances: number;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  panNumber: string;
  uanNumber: string;
  pfNumber: string;
  esiNumber: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  checkInTime?: string; // ISO String
  checkOutTime?: string; // ISO String
  checkInLat?: number;
  checkInLng?: number;
  checkOutLat?: number;
  checkOutLng?: number;
  checkInAddress?: string;
  checkOutAddress?: string;
  inGeofence?: boolean;
  breakStartTime?: string;
  totalBreakMinutes?: number;
  workingHours: number;
  status: AttendanceStatus;
  notes?: string;
  shiftId?: string;
  shiftName?: string;
  expectedStartTime?: string;
  expectedEndTime?: string;
  gracePeriodMinutes?: number;
  isLateArrival?: boolean;
  isEarlyDeparture?: boolean;
  createdAt: string;
  employeeName?: string;
  employeeCode?: string;
  departmentName?: string;
  branchName?: string;
}

export interface AttendanceRegularizationRequest {
  id: string;
  organizationId: string;
  employeeId: string;
  attendanceId?: string;
  date: string;
  requestedStatus: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  reason: string;
  status: RegularizationStatus;
  reviewedBy?: string;
  reviewReason?: string;
  createdAt: string;
  updatedAt: string;
  // Enriched fields
  employeeName?: string;
  employeeCode?: string;
  reviewedByName?: string;
}

export interface Shift {
  id: string;
  name: string;
  startTime: string; // e.g. "09:00"
  endTime: string; // e.g. "18:00"
  gracePeriodMinutes: number; // e.g. 15
  breakDurationMinutes: number; // e.g. 60
  workingHours: number; // e.g. 8.5
  weekOffs: string[]; // e.g. ["SATURDAY", "SUNDAY"]
  active: boolean;
}

export interface ShiftAssignmentHistory {
  id: string;
  employeeId: string;
  employeeName?: string;
  employeeCode?: string;
  shiftId: string;
  shiftName?: string;
  assignedBy: string;
  assignedByName?: string;
  assignedAt: string;
  reason?: string;
}

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  annualQuota: number;
  carryForwardAllowed: boolean;
  requiresAttachment: boolean;
  description: string;
}

export interface LeaveBalance {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  totalQuota: number;
  used: number;
  pending: number;
  available: number;
  year: number;
  leaveTypeName?: string;
  leaveTypeCode?: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  isHalfDay: boolean;
  reason: string;
  attachmentUrl?: string;
  status: LeaveStatus;
  reviewedBy?: string;
  reviewReason?: string;
  createdAt: string;
  employeeName?: string;
  employeeCode?: string;
  departmentName?: string;
  leaveTypeName?: string;
  leaveTypeCode?: string;
}

export interface LeaveCorrectionRequest {
  id: string;
  leaveRequestId: string;
  employeeId: string;
  employeeName?: string;
  leaveTypeName?: string;
  oldStartDate: string;
  oldEndDate: string;
  oldIsHalfDay: boolean;
  oldDaysCount: number;
  newStartDate: string;
  newEndDate: string;
  newIsHalfDay: boolean;
  reason: string;
  status: LeaveStatus;
  reviewedBy?: string;
  reviewReason?: string;
  createdAt: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
  type: 'NATIONAL' | 'FESTIVAL' | 'OPTIONAL';
  branchId?: string; // Optional for branch specific
  branchName?: string;
  description?: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  code: string;
  maxLimit?: number;
  requiresReceipt: boolean;
}

export interface Expense {
  id: string;
  employeeId: string;
  categoryId: string;
  amount: number; // ₹ INR
  expenseDate: string;
  description: string;
  receiptUrl?: string;
  receiptName?: string;
  receiptId?: string;
  status: ExpenseStatus;
  reviewedBy?: string;
  rejectionReason?: string;
  reimbursementDate?: string;
  createdAt: string;
  // Enriched display fields
  employeeName?: string;
  employeeCode?: string;
  departmentName?: string;
  categoryName?: string;
  categoryCode?: string;
  reviewedByName?: string;
}

export interface ReceiptFile {
  id: string;
  expenseId?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataBase64: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  clientName?: string;
  description?: string;
  assignedEmployeeIds?: string[]; // If empty or undefined, open to all employees
  status: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD';
  createdAt: string;
}

export interface Timesheet {
  id: string;
  employeeId: string;
  projectId?: string;
  projectName: string;
  date: string;
  taskDescription: string;
  hours: number;
  status: TimesheetStatus;
  reviewedBy?: string;
  rejectionReason?: string;
  createdAt: string;
  // Enriched display fields
  employeeName?: string;
  employeeCode?: string;
  departmentName?: string;
  reviewedByName?: string;
}

export interface SalaryStructure {
  id: string;
  employeeId: string;
  employeeName?: string;
  employeeCode?: string;
  departmentName?: string;
  basicSalary: number;
  hra: number;
  specialAllowance: number;
  medicalAllowance?: number;
  conveyanceAllowance?: number;
  otherAllowances?: number;
  bonus?: number;
  incentives?: number;
  pfEmployee: number;
  pfEmployer?: number;
  esiEmployee: number;
  esiEmployer?: number;
  professionalTax: number;
  tds: number;
  otherDeductions?: number;
  grossSalary: number;
  netSalary: number;
  effectiveDate?: string;
  updatedAt?: string;
}

export interface PayrollPeriod {
  id: string;
  month: number; // 1-12
  year: number;
  name: string; // e.g. "August 2026"
  status: 'DRAFT' | 'PROCESSING' | 'COMPLETED' | 'LOCKED';
  totalEmployees: number;
  totalGrossPayout: number;
  totalNetPayout: number;
  processedAt?: string;
}

export interface PayrollCalculationBreakdown {
  dailyBasicRate: number;
  lopDeductionAmount: number;
  statutoryRatesApplied: {
    pfRatePercentage: number;
    esiRatePercentage: number;
    ptFixedAmount: number;
    tdsRatePercentage: number;
  };
  earningsBreakdown: Array<{ name: string; amount: number }>;
  deductionsBreakdown: Array<{ name: string; amount: number }>;
  notes?: string;
}

export interface PayrollRecord {
  id: string;
  payrollPeriodId: string;
  employeeId: string;
  // Employee Profile Snapshot at time of payroll run
  employeeName?: string;
  employeeCode?: string;
  departmentName?: string;
  designationName?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  panNumber?: string;
  uanNumber?: string;
  pfNumber?: string;
  esiNumber?: string;
  // Days
  workingDays: number;
  presentDays: number;
  paidLeaveDays: number;
  lossOfPayDays: number;
  // Earnings
  basicSalary: number;
  hra: number;
  allowances: number;
  bonus: number;
  incentives?: number;
  grossEarnings: number;
  // Deductions
  pfDeduction: number;
  esiDeduction: number;
  ptDeduction: number;
  tdsDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  // Take-home
  netSalary: number;
  status: 'PENDING' | 'PROCESSED' | 'PAID';
  paidAt?: string;
  calculationBreakdown?: PayrollCalculationBreakdown;
  createdAt: string;
}

export type DocumentCategory =
  | 'RESUME'
  | 'OFFER_LETTER'
  | 'JOINING_LETTER'
  | 'CERTIFICATES'
  | 'IDENTITY_DOCUMENTS'
  | 'CONTRACT'
  | 'PAYSLIP'
  | 'POLICY'
  | 'OTHER';

export interface Document {
  id: string;
  employeeId?: string; // empty if organization wide
  employeeName?: string;
  employeeCode?: string;
  departmentName?: string;
  title: string;
  category: DocumentCategory;
  fileUrl: string;
  fileName: string;
  fileType?: string;
  fileSize: string;
  fileSizeBytes?: number;
  uploadedBy: string;
  uploadedByUserId?: string;
  confidential?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Notification {
  id: string;
  organization_id: string;
  recipient_employee_id: string;
  actor_employee_id?: string;
  notification_type: string;
  entity_type?: string;
  entity_id?: string;
  title: string;
  message: string;
  action_url?: string;
  metadata?: any;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  is_read: boolean;
  read_at?: string;
  expires_at?: string;
  deleted_at?: string;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface Announcement {
  id: string;
  organization_id: string;
  title: string;
  content: string;
  category: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  audience: 'ALL' | 'DEPARTMENT' | 'BRANCH' | 'MANAGERS_ONLY';
  target_id?: string;
  target_name?: string;
  publish_date?: string;
  published_at?: string;
  expiry_date?: string;
  expires_at?: string;
  attachment_name?: string;
  attachment_url?: string;
  author_name?: string;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
}

export interface HelpdeskCategory {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
}

export interface HelpdeskTicket {
  id: string;
  organization_id: string;
  employee_id: string;
  employee_name?: string;
  ticket_number: string;
  category_id?: string;
  category?: string; // fallback
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus | 'WAITING_FOR_EMPLOYEE' | 'CANCELLED';
  assigned_to?: string;
  assigned_to_name?: string;
  resolved_at?: string;
  closed_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface TicketComment {
  id: string;
  organization_id: string;
  ticket_id: string;
  author_employee_id: string;
  author_name?: string;
  author_role?: Role;
  comment: string;
  attachment_name?: string;
  attachment_url?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface AuditLog {
  id: string;
  organizationId: string;
  userId: string;
  userEmail: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
  metadata?: string;
  timestamp: string;
}



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
