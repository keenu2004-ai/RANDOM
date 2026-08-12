import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  Filter,
  RefreshCw,
  Users,
  Calendar,
  Clock,
  DollarSign,
  Briefcase,
  Building2,
  TrendingUp,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { hrmsApi } from '../../lib/api-client';

type ReportCategory =
  | 'employee'
  | 'attendance'
  | 'leave'
  | 'expense'
  | 'timesheet'
  | 'payroll'
  | 'department'
  | 'headcount';

interface FilterState {
  startDate: string;
  endDate: string;
  branchId: string;
  departmentId: string;
  employeeId: string;
  status: string;
}

export const ReportsView: React.FC = () => {
  const [activeReport, setActiveReport] = useState<ReportCategory>('employee');
  const [filters, setFilters] = useState<FilterState>({
    startDate: '',
    endDate: '',
    branchId: 'ALL',
    departmentId: 'ALL',
    employeeId: 'ALL',
    status: 'ALL'
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    loadReportData();
  }, [activeReport]);

  const loadReportData = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {
        type: activeReport,
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.branchId !== 'ALL' && { branchId: filters.branchId }),
        ...(filters.departmentId !== 'ALL' && { departmentId: filters.departmentId }),
        ...(filters.employeeId !== 'ALL' && { employeeId: filters.employeeId }),
        ...(filters.status !== 'ALL' && { status: filters.status })
      };

      const result = await hrmsApi.getReportData(params);
      setData(result);
      setCurrentPage(1);
    } catch (err: any) {
      console.error('Failed to load report data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    loadReportData();
  };

  const handleResetFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      branchId: 'ALL',
      departmentId: 'ALL',
      employeeId: 'ALL',
      status: 'ALL'
    });
    setSearchQuery('');
    setTimeout(() => {
      loadReportData();
    }, 50);
  };

  const exportCsv = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {
        type: activeReport,
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.branchId !== 'ALL' && { branchId: filters.branchId }),
        ...(filters.departmentId !== 'ALL' && { departmentId: filters.departmentId }),
        ...(filters.employeeId !== 'ALL' && { employeeId: filters.employeeId }),
        ...(filters.status !== 'ALL' && { status: filters.status })
      };
      await hrmsApi.exportReport(params);
    } catch (err: any) {
      alert(err.message || 'Failed to export report');
    } finally {
      setLoading(false);
    }
  };

  // Status Filter Options per report category
  const getStatusOptions = () => {
    switch (activeReport) {
      case 'employee':
        return ['ACTIVE', 'INACTIVE', 'PROBATION', 'ON_LEAVE'];
      case 'attendance':
        return ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE', 'WEEK_OFF'];
      case 'leave':
      case 'expense':
      case 'timesheet':
        return ['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID'];
      case 'payroll':
        return ['PROCESSED', 'PAID', 'PENDING', 'LOCKED'];
      default:
        return [];
    }
  };

  const rows = data?.rows || [];
  const meta = data?.meta || { branches: [], departments: [], employees: [] };
  const summary = data?.summary || {};

  // Apply search filtering on client
  const filteredRows = rows.filter((row: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return Object.values(row).some(v => String(v || '').toLowerCase().includes(q));
  });

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const reportTabs: { id: ReportCategory; label: string; icon: any; desc: string }[] = [
    { id: 'employee', label: 'Employee Master', icon: Users, desc: 'Complete employee roster details' },
    { id: 'attendance', label: 'Attendance Logs', icon: Calendar, desc: 'GPS check-in & working hours' },
    { id: 'leave', label: 'Leave Analytics', icon: Clock, desc: 'Leave requests, usage & balances' },
    { id: 'expense', label: 'Expense Claims', icon: DollarSign, desc: 'Reimbursement claims & status' },
    { id: 'timesheet', label: 'Timesheets', icon: Briefcase, desc: 'Project hours logged & approval' },
    { id: 'payroll', label: 'Payroll Summary', icon: TrendingUp, desc: 'Gross payout, statutory deductions & net' },
    { id: 'department', label: 'Departments', icon: Building2, desc: 'Departmental staff & cost distribution' },
    { id: 'headcount', label: 'Headcount & Branch', icon: BarChart3, desc: 'Branch-wise workforce breakdown' }
  ];

  return (
    <div id="reports-view-root" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Analytics & Statutory Reports</h2>
          <p className="text-xs text-slate-500">Comprehensive HR, attendance, payroll, and workforce analytics with CSV export</p>
        </div>

        <button
          onClick={exportCsv}
          disabled={loading || !data?.rows?.length}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-2"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export CSV / Excel</span>
        </button>
      </div>

      {/* Report Categories Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {reportTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeReport === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReport(tab.id)}
              className={`p-3 rounded-2xl border text-left transition-all ${
                isActive
                  ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-4 h-4 mb-1.5 ${isActive ? 'text-white' : 'text-blue-600'}`} />
              <div className="font-black text-xs leading-tight">{tab.label}</div>
            </button>
          );
        })}
      </div>

      {/* Filter Control Bar */}
      <form onSubmit={handleApplyFilters} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
            <Filter className="w-4 h-4 text-blue-600" />
            <span>Filter Parameters ({activeReport.toUpperCase()})</span>
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center space-x-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset Filters</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={e => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={e => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Branch</label>
            <select
              value={filters.branchId}
              onChange={e => setFilters({ ...filters, branchId: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            >
              <option value="ALL">All Branches</option>
              {meta.branches?.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Department</label>
            <select
              value={filters.departmentId}
              onChange={e => setFilters({ ...filters, departmentId: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            >
              <option value="ALL">All Departments</option>
              {meta.departments?.map((d: any) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Employee</label>
            <select
              value={filters.employeeId}
              onChange={e => setFilters({ ...filters, employeeId: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            >
              <option value="ALL">All Employees</option>
              {meta.employees?.map((emp: any) => (
                <option key={emp.id} value={emp.id}>{emp.code} - {emp.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={e => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            >
              <option value="ALL">All Statuses</option>
              {getStatusOptions().map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-xs transition-all flex items-center space-x-1.5"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Apply Filters</span>
          </button>
        </div>
      </form>

      {/* Summary KPI Cards */}
      {summary && Object.keys(summary).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(summary).map(([key, value]: [string, any]) => {
            const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            const isCurrency = key.toLowerCase().includes('payroll') || key.toLowerCase().includes('amount') || key.toLowerCase().includes('gross') || key.toLowerCase().includes('net') || key.toLowerCase().includes('cost') || key.toLowerCase().includes('deduction');
            return (
              <div key={key} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-xs text-slate-500 font-medium mb-1">{formattedKey}</div>
                <div className="text-lg font-black text-slate-900 tracking-tight">
                  {isCurrency ? `₹${Number(value || 0).toLocaleString('en-IN')}` : String(value)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search in generated records..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div className="text-xs text-slate-500 font-semibold">
            Showing {filteredRows.length} record(s)
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            <span>Generating report datasets...</span>
          </div>
        ) : paginatedRows.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No matching records found for the selected filter parameters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  {Object.keys(paginatedRows[0]).filter(k => k !== 'id').map(key => (
                    <th key={key} className="px-4 py-3 whitespace-nowrap">
                      {key.replace(/([A-Z])/g, ' $1')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {paginatedRows.map((row: any, idx: number) => (
                  <tr key={row.id || idx} className="hover:bg-slate-50/80 transition-colors">
                    {Object.entries(row).filter(([k]) => k !== 'id').map(([key, val]: [string, any], cIdx: number) => {
                      const isAmount = key.toLowerCase().includes('salary') || key.toLowerCase().includes('gross') || key.toLowerCase().includes('amount') || key.toLowerCase().includes('cost') || key.toLowerCase().includes('payroll') || key.toLowerCase().includes('deduction') || key.toLowerCase().includes('hra') || key.toLowerCase().includes('allowance');
                      const isStatus = key.toLowerCase() === 'status';

                      return (
                        <td key={cIdx} className="px-4 py-3 whitespace-nowrap">
                          {isStatus ? (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ['ACTIVE', 'PRESENT', 'APPROVED', 'PAID', 'COMPLETED'].includes(String(val))
                                ? 'bg-emerald-100 text-emerald-800'
                                : ['PENDING', 'SUBMITTED', 'PROBATION'].includes(String(val))
                                ? 'bg-amber-100 text-amber-800'
                                : ['LATE', 'HALF_DAY'].includes(String(val))
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {String(val)}
                            </span>
                          ) : isAmount && typeof val === 'number' ? (
                            <span className="font-mono font-semibold">₹{val.toLocaleString('en-IN')}</span>
                          ) : (
                            <span>{String(val ?? '-')}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div>
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex space-x-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg font-bold"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg font-bold"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
