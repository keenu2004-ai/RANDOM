import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  Filter,
  Plus,
  Mail,
  Phone,
  Building2,
  MapPin,
  CheckCircle,
  XCircle,
  User,
  Eye,
  Edit,
  DollarSign,
  Briefcase,
  LayoutGrid,
  List,
  Download,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  AlertCircle
} from 'lucide-react';
import { hrmsApi } from '../../lib/api-client';
import { Employee } from '../../types/hrms';
import { EmployeeFormModal } from './EmployeeFormModal';
import { EmployeeProfileView } from './EmployeeProfileView';

interface EmployeesViewProps {
  userRole: string;
}

export const EmployeesView: React.FC<EmployeesViewProps> = ({ userRole }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination State
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [viewMode, setViewMode] = useState<'TABLE' | 'GRID'>('TABLE');
  const [page, setPage] = useState(1);
  const [limit] = useState(15);

  // Meta options for filter dropdowns
  const [meta, setMeta] = useState<{
    branches: any[];
    departments: any[];
    designations: any[];
  }>({
    branches: [],
    departments: [],
    designations: []
  });

  // Selected state
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [search, departmentId, branchId, statusFilter, showDeleted, page]);

  const loadMeta = async () => {
    try {
      const data = await hrmsApi.getOrganizationMeta();
      setMeta({
        branches: data.branches || [],
        departments: data.departments || [],
        designations: data.designations || []
      });
    } catch (e) {
      console.warn('Failed to load org meta:', e);
    }
  };

  const loadEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string> = {
        page: page.toString(),
        limit: limit.toString()
      };
      if (search) params.search = search;
      if (departmentId) params.departmentId = departmentId;
      if (branchId) params.branchId = branchId;
      if (statusFilter) params.status = statusFilter;
      if (showDeleted) params.includeDeleted = 'true';

      const res = await hrmsApi.getEmployees(params);
      if (res && res.data) {
        setEmployees(res.data);
        setTotal(res.pagination?.total || res.data.length);
      } else if (res && Array.isArray(res.employees)) {
        setEmployees(res.employees);
        setTotal(res.total || res.employees.length);
      } else if (Array.isArray(res)) {
        setEmployees(res);
        setTotal(res.length);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load employee records');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingEmp(null);
    setFormModalOpen(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmp(emp);
    setFormModalOpen(true);
  };

  const handleToggleStatus = async (emp: Employee) => {
    const newStatus = emp.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await hrmsApi.updateEmployee(emp.id, { status: newStatus });
      loadEmployees();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleSoftDelete = async (emp: Employee) => {
    if (!window.confirm(`Are you sure you want to soft delete ${emp.firstName} ${emp.lastName} (${emp.employeeCode})?`)) return;
    try {
      await hrmsApi.deleteEmployee(emp.id);
      loadEmployees();
    } catch (err: any) {
      alert(err.message || 'Failed to soft delete employee');
    }
  };

  const handleRestore = async (emp: Employee) => {
    try {
      await hrmsApi.restoreEmployee(emp.id);
      loadEmployees();
    } catch (err: any) {
      alert(err.message || 'Failed to restore employee');
    }
  };

  const handleExportCSV = () => {
    if (employees.length === 0) return alert('No employee records to export');
    const headers = ['Employee Code', 'First Name', 'Last Name', 'Email', 'Phone', 'Department', 'Branch', 'Status', 'Gross Salary (₹)'];
    const rows = employees.map(e => [
      e.employeeCode,
      e.firstName,
      e.lastName,
      e.email,
      e.phone || '',
      meta.departments.find(d => d.id === e.departmentId)?.name || e.departmentId,
      meta.branches.find(b => b.id === e.branchId)?.name || e.branchId,
      e.status,
      (e.basicSalary + e.hra + e.allowances).toString()
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `THEIAKSHI_Workforce_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const canManage = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(userRole);

  // If a specific employee profile is opened
  if (selectedEmpId) {
    return (
      <EmployeeProfileView
        employeeId={selectedEmpId}
        userRole={userRole}
        onBack={() => setSelectedEmpId(null)}
        onEdit={(emp) => handleOpenEdit(emp)}
        onRefresh={loadEmployees}
      />
    );
  }

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div id="employees-view-root" className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            <span>Employee Directory</span>
          </h2>
          <p className="text-xs text-slate-500">
            THEIAKSHI ENTERPRISE Workforce Records • Salaries in INR (₹)
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            onClick={handleExportCSV}
            className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-xs transition-all flex items-center space-x-2"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Export Directory</span>
          </button>

          {canManage && (
            <button
              id="btn-add-employee"
              onClick={handleOpenAdd}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Employee</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, code, email, or phone..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Department Filter */}
          <select
            value={departmentId}
            onChange={e => { setDepartmentId(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-auto"
          >
            <option value="">All Departments</option>
            {meta.departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          {/* Branch Filter */}
          <select
            value={branchId}
            onChange={e => { setBranchId(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-auto"
          >
            <option value="">All Branches</option>
            {meta.branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-auto"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="PROBATION">PROBATION</option>
            <option value="TERMINATED">TERMINATED</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setViewMode('TABLE')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'TABLE' ? 'bg-white shadow-xs text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('GRID')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'GRID' ? 'bg-white shadow-xs text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Soft-Deleted Filter Toggle for Admin/HR */}
        {canManage && (
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
            <label className="inline-flex items-center space-x-2 text-slate-600 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={e => setShowDeleted(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
              />
              <span>Include Soft-Deleted Records</span>
            </label>

            <span className="text-[11px] font-bold text-slate-500">
              Showing {employees.length} of {total} employees
            </span>
          </div>
        )}
      </div>

      {/* Employee List Table or Grid View */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500 font-medium bg-white rounded-2xl border border-slate-200">
          Loading workforce registry records...
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      ) : employees.length === 0 ? (
        <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center space-y-2">
          <Users className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="font-bold text-slate-700 text-sm">No employee records found</div>
          <p className="text-xs text-slate-500">Try loosening your search filters or create a new employee.</p>
        </div>
      ) : viewMode === 'TABLE' ? (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Department & Branch</th>
                  <th className="px-4 py-3">Gross Salary (₹)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map(emp => {
                  const gross = (emp.basicSalary || 0) + (emp.hra || 0) + (emp.allowances || 0);
                  const isDeleted = !!emp.deletedAt;

                  return (
                    <tr
                      key={emp.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isDeleted ? 'bg-red-50/40' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          {emp.profilePhoto ? (
                            <img
                              src={emp.profilePhoto}
                              alt={emp.firstName}
                              className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-xs"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                              {emp.firstName[0]}
                              {emp.lastName[0]}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{emp.firstName} {emp.lastName}</span>
                              {isDeleted && (
                                <span className="text-[9px] bg-red-100 text-red-800 font-extrabold px-1.5 py-0.5 rounded uppercase">
                                  Deleted
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500">{emp.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-mono font-bold text-slate-700">
                        {emp.employeeCode}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        <div className="font-semibold text-slate-800">
                          {meta.departments.find(d => d.id === emp.departmentId)?.name || 'Department'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {meta.branches.find(b => b.id === emp.branchId)?.name || emp.workLocation}
                        </div>
                      </td>

                      <td className="px-4 py-3 font-bold text-slate-900">
                        ₹ {gross.toLocaleString('en-IN')}<span className="text-[10px] text-slate-400 font-normal">/mo</span>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            emp.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {emp.status}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => setSelectedEmpId(emp.id)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Full Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {canManage && (
                            <>
                              {isDeleted ? (
                                <button
                                  onClick={() => handleRestore(emp)}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                  title="Restore Employee"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleOpenEdit(emp)}
                                    className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                    title="Edit Employee"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>

                                  <button
                                    onClick={() => handleToggleStatus(emp)}
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      emp.status === 'ACTIVE'
                                        ? 'text-amber-600 hover:bg-amber-50'
                                        : 'text-emerald-600 hover:bg-emerald-50'
                                    }`}
                                    title={emp.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                                  >
                                    {emp.status === 'ACTIVE' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                  </button>

                                  <button
                                    onClick={() => handleSoftDelete(emp)}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Soft Delete Employee"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map(emp => {
            const gross = (emp.basicSalary || 0) + (emp.hra || 0) + (emp.allowances || 0);
            const isDeleted = !!emp.deletedAt;

            return (
              <div
                key={emp.id}
                className={`bg-white rounded-2xl border p-5 shadow-xs space-y-4 hover:shadow-md transition-all ${
                  isDeleted ? 'border-red-300 bg-red-50/20' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    {emp.profilePhoto ? (
                      <img
                        src={emp.profilePhoto}
                        alt={emp.firstName}
                        className="w-11 h-11 rounded-2xl object-cover border border-slate-200 shadow-xs"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white font-bold text-sm flex items-center justify-center uppercase shadow-xs">
                        {emp.firstName[0]}
                        {emp.lastName[0]}
                      </div>
                    )}
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">
                        {emp.firstName} {emp.lastName}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-mono">{emp.employeeCode}</p>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                      emp.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {emp.status}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Email:</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[180px]">{emp.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Department:</span>
                    <span className="font-semibold text-slate-800">
                      {meta.departments.find(d => d.id === emp.departmentId)?.name || 'Department'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Gross Salary:</span>
                    <span className="font-extrabold text-emerald-700">
                      ₹ {gross.toLocaleString('en-IN')}/mo
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setSelectedEmpId(emp.id)}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all text-center flex items-center justify-center space-x-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Profile</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 text-xs">
          <span className="text-slate-500 font-medium">
            Page <strong className="text-slate-900">{page}</strong> of <strong className="text-slate-900">{totalPages}</strong>
          </span>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-700 disabled:opacity-50 hover:bg-slate-50 font-bold flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-700 disabled:opacity-50 hover:bg-slate-50 font-bold flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Form Modal for Creating or Editing */}
      <EmployeeFormModal
        employee={editingEmp}
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        onSuccess={() => {
          loadEmployees();
        }}
      />
    </div>
  );
};
