/**
 * THEIAKSHI ENTERPRISE - Frontend API Client
 */

import { Expense, ExpenseCategory, Project, Timesheet, SalaryStructure, PayrollPeriod, PayrollRecord, StatutoryRule, ComplianceTask, ComplianceStatus, Document, Notification, HelpdeskTicket, TicketComment, Announcement, PaginatedResponse, AuditLog, AttendanceRegularizationRequest, TimesheetCorrectionRequest, LeaveCorrectionRequest, PayrollAdjustment } from '../types/hrms';

const TOKEN_KEY = 'theiakshi_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: any = {
    ...(options.headers || {}),
  };
  
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }


  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Use VITE_API_URL from environment variables for absolute URLs in production/development,
  // falling back to relative paths for local development if not set.
  // @ts-ignore
  const baseUrl = import.meta.env.VITE_API_URL || '/api';
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/me') {
      removeStoredToken();
      window.location.href = '/';
    }
    // 403 just throws the error below for components to handle
    throw new Error(data.error || `HTTP error ${response.status}`);
  }

  return data as T;
}

export const hrmsApi = {
  // Auth
  login: (email: string, password: string) =>
    apiFetch<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: async () => {
    try {
      await apiFetch<{ message: string }>('/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore API logout errors if token is already stale
    } finally {
      removeStoredToken();
    }
  },

  getMe: () => apiFetch<{ user: any }>('/auth/me'),

  forgotPassword: (email: string) =>
    apiFetch<{ message: string; resetToken?: string; _testOnlyToken?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (data: { email: string; newPassword: string; token?: string }) =>
    apiFetch<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    apiFetch<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Dashboard
  getStats: () => apiFetch<any>('/dashboard/stats'),
  getCharts: () => apiFetch<any>('/dashboard/charts'),

  // Organization Meta
  getOrganizationMeta: () => apiFetch<any>('/organization/meta'),
  createDepartment: (data: any) => 
    apiFetch<any>('/organization/departments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateDepartment: (id: string, data: any) =>
    apiFetch<any>(`/organization/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteDepartment: (id: string) =>
    apiFetch<any>(`/organization/departments/${id}`, { method: 'DELETE' }),

  // Branches
  createBranch: (data: any) =>
    apiFetch<any>('/organization/branches', { method: 'POST', body: JSON.stringify(data) }),
  updateBranch: (id: string, data: any) =>
    apiFetch<any>(`/organization/branches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBranch: (id: string) =>
    apiFetch<any>(`/organization/branches/${id}`, { method: 'DELETE' }),

  // Designations
  createDesignation: (data: any) =>
    apiFetch<any>('/organization/designations', { method: 'POST', body: JSON.stringify(data) }),
  updateDesignation: (id: string, data: any) =>
    apiFetch<any>(`/organization/designations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDesignation: (id: string) =>
    apiFetch<any>(`/organization/designations/${id}`, { method: 'DELETE' }),

  // Teams
  createTeam: (data: any) =>
    apiFetch<any>('/organization/teams', { method: 'POST', body: JSON.stringify(data) }),
  updateTeam: (id: string, data: any) =>
    apiFetch<any>(`/organization/teams/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTeam: (id: string) =>
    apiFetch<any>(`/organization/teams/${id}`, { method: 'DELETE' }),

  // Attendance Locations
  getAttendanceLocations: () => apiFetch<any[]>('/attendance-locations'),
  createAttendanceLocation: (data: any) =>
    apiFetch<any>('/attendance-locations', { method: 'POST', body: JSON.stringify(data) }),
  updateAttendanceLocation: (id: string, data: any) =>
    apiFetch<any>(`/attendance-locations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAttendanceLocation: (id: string) =>
    apiFetch<any>(`/attendance-locations/${id}`, { method: 'DELETE' }),

  // Leave Types (update + deactivate)
  updateLeaveType: (id: string, data: any) =>
    apiFetch<any>(`/leaves/types/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLeaveType: (id: string) =>
    apiFetch<any>(`/leaves/types/${id}`, { method: 'DELETE' }),

  // Expense Categories (update + deactivate)
  updateExpenseCategory: (id: string, data: any) =>
    apiFetch<any>(`/expenses/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExpenseCategory: (id: string) =>
    apiFetch<any>(`/expenses/categories/${id}`, { method: 'DELETE' }),

  // Employees
  getEmployees: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<any>(`/employees${query}`);
  },
  getEmployee: (id: string) => apiFetch<any>(`/employees/${id}`),
  createEmployee: (data: any) =>
    apiFetch<any>('/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateEmployee: (id: string, data: any) =>
    apiFetch<any>(`/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteEmployee: (id: string) =>
    apiFetch<any>(`/employees/${id}`, {
      method: 'DELETE',
    }),
  restoreEmployee: (id: string) =>
    apiFetch<any>(`/employees/${id}/restore`, {
      method: 'POST',
    }),
  uploadEmployeePhoto: (id: string, photoUrl: string) =>
    apiFetch<any>(`/employees/${id}/photo`, {
      method: 'POST',
      body: JSON.stringify({ photoUrl }),
    }),

  // Attendance
  getAttendance: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<any>(`/attendance${query}`);
  },
  getTodayAttendance: () => apiFetch<any>('/attendance/today'),
  getAttendanceStats: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<any>(`/attendance/stats${query}`);
  },
  checkIn: (data: { latitude: number; longitude: number; accuracy?: number; address?: string }) =>
    apiFetch<any>('/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  checkOut: (data: { latitude: number; longitude: number; accuracy?: number; address?: string }) =>
    apiFetch<any>('/attendance/check-out', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  startBreak: () =>
    apiFetch<any>('/attendance/break/start', {
      method: 'POST',
    }),
  endBreak: () =>
    apiFetch<any>('/attendance/break/end', {
      method: 'POST',
    }),
  submitManualAttendance: (data: {
    employeeId: string;
    date: string;
    status: string;
    checkInTime?: string;
    checkOutTime?: string;
    notes?: string;
  }) =>
    apiFetch<any>('/attendance/manual-correction', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getAttendanceSettings: () => apiFetch<any>('/settings/attendance'),
  updateAttendanceSettings: (data: any) =>
    apiFetch<any>('/settings/attendance', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  createRegularizationRequest: (data: Partial<AttendanceRegularizationRequest>) =>
    apiFetch<AttendanceRegularizationRequest>('/attendance/regularization', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getRegularizationRequests: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<PaginatedResponse<AttendanceRegularizationRequest>>(`/attendance/regularization${query}`);
  },
  approveRegularizationRequest: (id: string) =>
    apiFetch<AttendanceRegularizationRequest>(`/attendance/regularization/${id}/approve`, {
      method: 'PATCH',
    }),
  rejectRegularizationRequest: (id: string, reason: string) =>
    apiFetch<AttendanceRegularizationRequest>(`/attendance/regularization/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),

  // Leaves
  getLeaves: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<any>(`/leaves${q}`);
  },
  getLeaveTypes: () => apiFetch<any[]>('/leaves/types'),
  createLeaveType: (data: any) =>
    apiFetch<any>('/leaves/types', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getLeaveBalances: (employeeId?: string, year?: number) => {
    const params = new URLSearchParams();
    if (employeeId) params.append('employeeId', employeeId);
    if (year) params.append('year', year.toString());
    const q = params.toString() ? `?${params.toString()}` : '';
    return apiFetch<any[]>(`/leaves/balances${q}`);
  },
  applyLeave: (data: any) =>
    apiFetch<any>('/leaves/apply', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  cancelLeave: (id: string) =>
    apiFetch<any>(`/leaves/${id}/cancel`, {
      method: 'PATCH',
    }),
  approveLeave: (id: string, reviewReason?: string) =>
    apiFetch<any>(`/leaves/${id}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({ reviewReason }),
    }),
  rejectLeave: (id: string, reviewReason?: string) =>
    apiFetch<any>(`/leaves/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reviewReason }),
    }),
  getLeaveCalendar: (month?: number, year?: number) => {
    const params = new URLSearchParams();
    if (month) params.append('month', month.toString());
    if (year) params.append('year', year.toString());
    const q = params.toString() ? `?${params.toString()}` : '';
    return apiFetch<any>(`/leaves/calendar${q}`);
  },
  createLeaveCorrection: (data: any) =>
    apiFetch<LeaveCorrectionRequest>('/leaves/corrections', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getLeaveCorrections: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<PaginatedResponse<LeaveCorrectionRequest>>(`/leaves/corrections${q}`);
  },
  approveLeaveCorrection: (id: string) =>
    apiFetch<any>(`/leaves/corrections/${id}/approve`, { method: 'PATCH' }),
  rejectLeaveCorrection: (id: string, reason?: string) =>
    apiFetch<any>(`/leaves/corrections/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),

  // Expenses
  getExpenses: () => apiFetch<Expense[]>('/expenses'),
  getExpenseCategories: () => apiFetch<ExpenseCategory[]>('/expenses/categories'),
  createExpenseCategory: (data: Partial<ExpenseCategory>) =>
    apiFetch<ExpenseCategory>('/expenses/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  uploadReceipt: (fileName: string, mimeType: string, fileData: string) =>
    apiFetch<{ receiptId: string; receiptUrl: string; fileName: string; mimeType: string; sizeBytes: number }>('/expenses/upload-receipt', {
      method: 'POST',
      body: JSON.stringify({ fileName, mimeType, fileData }),
    }),
  createExpense: (data: Partial<Expense>) =>
    apiFetch<Expense>('/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateExpense: (id: string, data: Partial<Expense>) =>
    apiFetch<Expense>(`/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  submitDraftExpense: (id: string) =>
    apiFetch<Expense>(`/expenses/${id}/submit`, { method: 'POST' }),
  deleteExpense: (id: string) =>
    apiFetch<{ message: string; id: string }>(`/expenses/${id}`, { method: 'DELETE' }),
  approveExpense: (id: string) =>
    apiFetch<Expense>(`/expenses/${id}/approve`, { method: 'PATCH' }),
  rejectExpense: (id: string, rejectionReason: string) =>
    apiFetch<Expense>(`/expenses/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ rejectionReason }),
    }),
  reimburseExpense: (id: string) =>
    apiFetch<Expense>(`/expenses/${id}/reimburse`, { method: 'PATCH' }),

  // Projects
  getProjects: () => apiFetch<Project[]>('/projects'),
  createProject: (data: Partial<Project>) =>
    apiFetch<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateProject: (id: string, data: Partial<Project>) =>
    apiFetch<Project>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Timesheets
  getTimesheets: (params?: { date?: string; startDate?: string; endDate?: string; status?: string; employeeId?: string }) => {
    let url = '/timesheets';
    if (params) {
      const q = new URLSearchParams();
      if (params.date) q.append('date', params.date);
      if (params.startDate) q.append('startDate', params.startDate);
      if (params.endDate) q.append('endDate', params.endDate);
      if (params.status) q.append('status', params.status);
      if (params.employeeId) q.append('employeeId', params.employeeId);
      const str = q.toString();
      if (str) url += `?${str}`;
    }
    return apiFetch<Timesheet[]>(url);
  },
  submitTimesheet: (data: Partial<Timesheet>) =>
    apiFetch<Timesheet>('/timesheets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTimesheet: (id: string, data: Partial<Timesheet>) =>
    apiFetch<Timesheet>(`/timesheets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  submitDraftTimesheet: (id: string) =>
    apiFetch<Timesheet>(`/timesheets/${id}/submit`, { method: 'POST' }),
  deleteTimesheet: (id: string) =>
    apiFetch<{ message: string; id: string }>(`/timesheets/${id}`, { method: 'DELETE' }),
  approveTimesheet: (id: string) =>
    apiFetch<Timesheet>(`/timesheets/${id}/approve`, { method: 'PATCH' }),
  rejectTimesheet: (id: string, rejectionReason: string) =>
    apiFetch<Timesheet>(`/timesheets/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ rejectionReason }),
    }),

  // Payroll & Salary Structures
  getSalaryStructures: () => apiFetch<SalaryStructure[]>('/salary-structures'),
  getSalaryStructure: (employeeId: string) => apiFetch<SalaryStructure>(`/salary-structures/${employeeId}`),
  saveSalaryStructure: (data: Partial<SalaryStructure>) =>
    apiFetch<SalaryStructure>('/salary-structures', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getPayrollPeriods: () => apiFetch<PayrollPeriod[]>('/payroll/periods'),
  createPayrollPeriod: (data: { month: number; year: number; name?: string }) =>
    apiFetch<PayrollPeriod>('/payroll/periods', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getPayrollRecords: (params?: { periodId?: string; employeeId?: string; status?: string }) => {
    let url = '/payroll/records';
    if (params) {
      const q = new URLSearchParams();
      if (params.periodId) q.append('periodId', params.periodId);
      if (params.employeeId) q.append('employeeId', params.employeeId);
      if (params.status) q.append('status', params.status);
      const str = q.toString();
      if (str) url += `?${str}`;
    }
    return apiFetch<PayrollRecord[]>(url);
  },
  getPayrollRecord: (id: string) => apiFetch<PayrollRecord>(`/payroll/records/${id}`),
  processPayroll: (month?: number, year?: number, periodId?: string) =>
    apiFetch<{ message: string; period: PayrollPeriod; recordsCount: number }>('/payroll/process', {
      method: 'POST',
      body: JSON.stringify({ month, year, periodId }),
    }),
  reprocessPayrollRecord: (id: string) =>
    apiFetch<PayrollRecord>(`/payroll/records/${id}/reprocess`, { method: 'POST' }),
  markPayrollRecordPaid: (id: string) =>
    apiFetch<PayrollRecord>(`/payroll/records/${id}/pay`, { method: 'PATCH' }),

  // Statutory Rules & Compliance
  getStatutoryRules: () => apiFetch<StatutoryRule[]>('/statutory-rules'),
  createStatutoryRule: (data: Partial<StatutoryRule>) =>
    apiFetch<StatutoryRule>('/statutory-rules', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateStatutoryRule: (id: string, data: Partial<StatutoryRule>) =>
    apiFetch<StatutoryRule>(`/statutory-rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  toggleStatutoryRule: (id: string, active: boolean) =>
    apiFetch<StatutoryRule>(`/statutory-rules/${id}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    }),
  deleteStatutoryRule: (id: string) =>
    apiFetch<{ message: string; id: string }>(`/statutory-rules/${id}`, {
      method: 'DELETE',
    }),

  // Compliance Calendar
  getComplianceTasks: () => apiFetch<ComplianceTask[]>('/compliance/calendar'),
  createComplianceTask: (data: Partial<ComplianceTask>) =>
    apiFetch<ComplianceTask>('/compliance/calendar', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateComplianceTask: (id: string, data: Partial<ComplianceTask>) =>
    apiFetch<ComplianceTask>(`/compliance/calendar/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  updateComplianceTaskStatus: (id: string, status: ComplianceStatus) =>
    apiFetch<ComplianceTask>(`/compliance/calendar/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  deleteComplianceTask: (id: string) =>
    apiFetch<{ message: string; id: string }>(`/compliance/calendar/${id}`, {
      method: 'DELETE',
    }),

  // Documents
  getDocuments: (params?: { category?: string; employeeId?: string; search?: string; status?: string; page?: number; limit?: number }) => {
    let url = '/documents';
    if (params) {
      const q = new URLSearchParams();
      if (params.category && params.category !== 'ALL') q.append('category', params.category);
      if (params.employeeId && params.employeeId !== 'ALL') q.append('employeeId', params.employeeId);
      if (params.status && params.status !== 'ALL') q.append('status', params.status);
      if (params.search) q.append('search', params.search);
      if (params.page) q.append('page', params.page.toString());
      if (params.limit) q.append('limit', params.limit.toString());
      const str = q.toString();
      if (str) url += `?${str}`;
    }
    return apiFetch<{ data: Document[]; pagination: any }>(url);
  },
  getDocument: (id: string) => apiFetch<Document>(`/documents/${id}`),
  uploadDocument: (data: FormData) =>
    apiFetch<Document>('/documents', {
      method: 'POST',
      body: data,
    }),
  uploadDocumentVersion: (id: string, data: FormData) =>
    apiFetch<Document>(`/documents/${id}/versions`, {
      method: 'POST',
      body: data,
    }),
  verifyDocument: (id: string) =>
    apiFetch<Document>(`/documents/${id}/verify`, { method: 'PATCH' }),
  rejectDocument: (id: string, reason: string) =>
    apiFetch<Document>(`/documents/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),
  deleteDocument: (id: string) =>
    apiFetch<{ message: string; id: string }>(`/documents/${id}`, {
      method: 'DELETE',
    }),


  // Notifications & Announcements
  getUnreadNotificationCount: () =>
    apiFetch<{ count: number }>('/notifications/unread-count'),
  getNotifications: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<PaginatedResponse<Notification>>(`/notifications${query}`);
  },
  markNotificationRead: (id: string) =>
    apiFetch<Notification>(`/notifications/${id}/mark-read`, { method: 'PATCH' }),
  markNotificationsRead: () =>
    apiFetch<{ message: string }>('/notifications/mark-read', { method: 'PATCH' }),
  deleteNotification: (id: string) =>
    apiFetch<{ message: string; id: string }>(`/notifications/${id}`, { method: 'DELETE' }),
  clearReadNotifications: () =>
    apiFetch<{ message: string }>('/notifications/read', { method: 'DELETE' }),
  triggerReminders: () =>
    apiFetch<{ message: string; newNotificationsCount: number }>('/notifications/trigger-reminders', { method: 'POST' }),
  getAnnouncements: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<PaginatedResponse<Announcement>>(`/announcements${query}`);
  },
  getAnnouncement: (id: string) => apiFetch<Announcement>(`/announcements/${id}`),
  createAnnouncement: (data: Partial<Announcement>) =>
    apiFetch<Announcement>('/announcements', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateAnnouncement: (id: string, data: Partial<Announcement>) =>
    apiFetch<Announcement>(`/announcements/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  publishAnnouncement: (id: string) =>
    apiFetch<Announcement>(`/announcements/${id}/publish`, { method: 'POST' }),
  archiveAnnouncement: (id: string) =>
    apiFetch<Announcement>(`/announcements/${id}/archive`, { method: 'POST' }),
  deleteAnnouncement: (id: string) =>
    apiFetch<{ message: string; id: string }>(`/announcements/${id}`, { method: 'DELETE' }),

  // Helpdesk
  getTickets: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<PaginatedResponse<HelpdeskTicket>>(`/helpdesk/tickets${query}`);
  },
  getTicket: (id: string) => apiFetch<HelpdeskTicket>(`/helpdesk/tickets/${id}`),
  getTicketComments: (id: string) => apiFetch<TicketComment[]>(`/helpdesk/tickets/${id}/comments`),
  createTicket: (data: {
    subject: string;
    category_id?: string;
    category?: string;
    description: string;
    priority?: string;
    attachment_name?: string;
    attachment_url?: string;
  }) =>
    apiFetch<HelpdeskTicket>('/helpdesk/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTicket: (id: string, data: Partial<HelpdeskTicket>) =>
    apiFetch<HelpdeskTicket>(`/helpdesk/tickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  assignTicket: (id: string, assignedTo: string) =>
    apiFetch<HelpdeskTicket>(`/helpdesk/tickets/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ assignedTo }),
    }),
  changeTicketStatus: (ticketId: string, status: string) =>
    apiFetch<HelpdeskTicket>(`/helpdesk/tickets/${ticketId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  addTicketComment: (ticketId: string, comment: string, attachment_name?: string, attachment_url?: string) =>
    apiFetch<TicketComment>(`/helpdesk/tickets/${ticketId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment, attachment_name, attachment_url }),
    }),
  deleteTicket: (id: string) =>
    apiFetch<{ message: string; id: string }>(`/helpdesk/tickets/${id}`, { method: 'DELETE' }),

  // Holidays
  getHolidays: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<any[]>(`/holidays${query}`);
  },
  createHoliday: (data: any) =>
    apiFetch<any>('/holidays', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateHoliday: (id: string, data: any) =>
    apiFetch<any>(`/holidays/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteHoliday: (id: string) =>
    apiFetch<any>(`/holidays/${id}`, { method: 'DELETE' }),

  // Shifts
  getShifts: () => apiFetch<any[]>('/shifts'),
  createShift: (data: any) =>
    apiFetch<any>('/shifts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateShift: (id: string, data: any) =>
    apiFetch<any>(`/shifts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  toggleShiftStatus: (id: string, active: boolean) =>
    apiFetch<any>(`/shifts/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    }),
  assignShift: (data: { employeeId: string; shiftId: string; reason?: string }) =>
    apiFetch<any>('/shifts/assign', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  bulkAssignShift: (data: { shiftId: string; employeeIds?: string[]; departmentId?: string; branchId?: string; reason?: string }) =>
    apiFetch<any>('/shifts/bulk-assign', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getShiftAssignmentHistory: () => apiFetch<any[]>('/shifts/history'),

  // Audit, Reports, Users & Settings
  getAuditLogs: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<PaginatedResponse<AuditLog>>(`/audit-logs${query}`);
  },
  getReportData: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<any>(`/reports/data${query}`);
  },
  getDashboardMetrics: () => apiFetch<any>('/dashboard/stats'),
  getEmployeeReport: (params?: Record<string, string>) => hrmsApi.getReportData({ ...params, type: 'employee' }),
  getAttendanceReport: (params?: Record<string, string>) => hrmsApi.getReportData({ ...params, type: 'attendance' }),
  getLeaveReport: (params?: Record<string, string>) => hrmsApi.getReportData({ ...params, type: 'leave' }),
  getExpenseReport: (params?: Record<string, string>) => hrmsApi.getReportData({ ...params, type: 'expense' }),
  getTimesheetReport: (params?: Record<string, string>) => hrmsApi.getReportData({ ...params, type: 'timesheet' }),
  getPayrollReport: (params?: Record<string, string>) => hrmsApi.getReportData({ ...params, type: 'payroll' }),
  getDocumentComplianceReport: (params?: Record<string, string>) => hrmsApi.getReportData({ ...params, type: 'document' }),
  getHelpdeskReport: (params?: Record<string, string>) => hrmsApi.getReportData({ ...params, type: 'helpdesk' }),
  exportReport: async (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    const token = getStoredToken();
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(`/api/reports/export${query}`, { headers });
    if (!response.ok) throw new Error('Failed to export report');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const type = params?.type || 'report';
    link.setAttribute('download', `THEIAKSHI_${type}_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
  getUsers: () => apiFetch<any[]>('/users'),
  updateUserRole: (userId: string, role: string) =>
    apiFetch<any>(`/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  getOrgSettings: () => apiFetch<any>('/settings/organization'),
  updateOrgSettings: (data: any) =>
    apiFetch<any>('/settings/organization', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  resetDatabase: () => apiFetch<any>('/system/reset-db', { method: 'POST' }),

  createAttendanceRegularization: (data: Partial<AttendanceRegularizationRequest>) =>
    apiFetch<AttendanceRegularizationRequest>('/attendance/regularization', { method: 'POST', body: JSON.stringify(data) }),
  getAttendanceRegularizations: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<PaginatedResponse<AttendanceRegularizationRequest>>(`/attendance/regularization${query}`);
  },
  approveAttendanceRegularization: (id: string) =>
    apiFetch<any>(`/attendance/regularization/${id}/approve`, { method: 'PATCH' }),
  rejectAttendanceRegularization: (id: string, reason: string) =>
    apiFetch<any>(`/attendance/regularization/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }),

  createTimesheetCorrection: (data: Partial<TimesheetCorrectionRequest>) =>
    apiFetch<TimesheetCorrectionRequest>(`/timesheets/corrections`, { method: 'POST', body: JSON.stringify(data) }),
  getTimesheetCorrections: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<PaginatedResponse<TimesheetCorrectionRequest>>(`/timesheets/corrections${query}`);
  },
  approveTimesheetCorrection: (id: string) =>
    apiFetch<any>(`/timesheets/corrections/${id}/approve`, { method: 'PATCH' }),
  rejectTimesheetCorrection: (id: string, reason: string) =>
    apiFetch<any>(`/timesheets/corrections/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }),

  createPayrollAdjustment: (data: Partial<PayrollAdjustment>) =>
    apiFetch<PayrollAdjustment>('/payroll/adjustments', { method: 'POST', body: JSON.stringify(data) }),
  getPayrollAdjustments: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<PaginatedResponse<PayrollAdjustment>>(`/payroll/adjustments${query}`);
  },
  approvePayrollAdjustment: (id: string) =>
    apiFetch<any>(`/payroll/adjustments/${id}/approve`, { method: 'PATCH' }),
  rejectPayrollAdjustment: (id: string, reason: string) =>
    apiFetch<any>(`/payroll/adjustments/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }),


};
