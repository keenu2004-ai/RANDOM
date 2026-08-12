import React, { useState, useEffect } from 'react';
import {
  Clock,
  Plus,
  Edit2,
  Power,
  Users,
  UserCheck,
  History,
  Building2,
  CheckCircle2,
  AlertCircle,
  Search,
  Check,
  Calendar,
  Layers
} from 'lucide-react';
import { Shift, ShiftAssignmentHistory, Employee, Department, Branch, Role } from '../../types/hrms';
import { hrmsApi } from '../../lib/api-client';

interface ShiftsViewProps {
  userRole: Role;
}

const ALL_WEEKDAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY'
];

export const ShiftsView: React.FC<ShiftsViewProps> = ({ userRole }) => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [history, setHistory] = useState<ShiftAssignmentHistory[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Tabs: 'shifts' | 'history'
  const [activeTab, setActiveTab] = useState<'shifts' | 'history'>('shifts');
  const [searchQuery, setSearchQuery] = useState('');

  // Shift Modal
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [shiftFormData, setShiftFormData] = useState({
    name: '',
    startTime: '09:00',
    endTime: '18:00',
    gracePeriodMinutes: 15,
    breakDurationMinutes: 60,
    workingHours: 8.0,
    weekOffs: ['SATURDAY', 'SUNDAY'] as string[],
    active: true
  });

  // Assign Single Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignFormData, setAssignFormData] = useState({
    employeeId: '',
    shiftId: '',
    reason: ''
  });

  // Bulk Assign Modal
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkFormData, setBulkFormData] = useState({
    shiftId: '',
    targetType: 'DEPARTMENT' as 'DEPARTMENT' | 'BRANCH' | 'SPECIFIC',
    departmentId: 'ALL',
    branchId: 'ALL',
    selectedEmployeeIds: [] as string[],
    reason: ''
  });

  const [submitting, setSubmitting] = useState(false);

  const isManagement = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(userRole);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [shiftsData, historyData, empData, metaData] = await Promise.all([
        hrmsApi.getShifts(),
        hrmsApi.getShiftAssignmentHistory().catch(() => []),
        hrmsApi.getEmployees(),
        hrmsApi.getOrganizationMeta().catch(() => ({ departments: [], branches: [] }))
      ]);

      setShifts(shiftsData);
      setHistory(historyData);
      setEmployees(empData.employees || empData);
      setDepartments(metaData.departments || []);
      setBranches(metaData.branches || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load shift management data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddShift = () => {
    setEditingShift(null);
    setShiftFormData({
      name: '',
      startTime: '09:00',
      endTime: '18:00',
      gracePeriodMinutes: 15,
      breakDurationMinutes: 60,
      workingHours: 8.0,
      weekOffs: ['SATURDAY', 'SUNDAY'],
      active: true
    });
    setIsShiftModalOpen(true);
  };

  const handleOpenEditShift = (s: Shift) => {
    setEditingShift(s);
    setShiftFormData({
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      gracePeriodMinutes: s.gracePeriodMinutes,
      breakDurationMinutes: s.breakDurationMinutes,
      workingHours: s.workingHours,
      weekOffs: s.weekOffs || ['SATURDAY', 'SUNDAY'],
      active: s.active
    });
    setIsShiftModalOpen(true);
  };

  const handleShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftFormData.name.trim() || !shiftFormData.startTime || !shiftFormData.endTime) {
      setError('Shift name, start time, and end time are required.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      if (editingShift) {
        await hrmsApi.updateShift(editingShift.id, shiftFormData);
        setSuccess(`Shift '${shiftFormData.name}' updated successfully.`);
      } else {
        await hrmsApi.createShift(shiftFormData);
        setSuccess(`Shift '${shiftFormData.name}' created successfully.`);
      }

      setIsShiftModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to save shift');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (shift: Shift) => {
    try {
      setError(null);
      setSuccess(null);
      await hrmsApi.toggleShiftStatus(shift.id, !shift.active);
      setSuccess(`Shift '${shift.name}' status changed to ${!shift.active ? 'ACTIVE' : 'INACTIVE'}.`);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle shift status');
    }
  };

  const handleSingleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignFormData.employeeId || !assignFormData.shiftId) {
      setError('Employee and Shift selection are required.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const res = await hrmsApi.assignShift(assignFormData);
      setSuccess(res.message || 'Shift assigned successfully.');
      setIsAssignModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to assign shift');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkFormData.shiftId) {
      setError('Shift selection is required for bulk assignment.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const payload: any = {
        shiftId: bulkFormData.shiftId,
        reason: bulkFormData.reason
      };

      if (bulkFormData.targetType === 'DEPARTMENT') {
        payload.departmentId = bulkFormData.departmentId;
      } else if (bulkFormData.targetType === 'BRANCH') {
        payload.branchId = bulkFormData.branchId;
      } else if (bulkFormData.targetType === 'SPECIFIC') {
        payload.employeeIds = bulkFormData.selectedEmployeeIds;
      }

      const res = await hrmsApi.bulkAssignShift(payload);
      setSuccess(res.message || `Bulk shift assignment completed.`);
      setIsBulkModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to execute bulk shift assignment');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleWeekOff = (day: string) => {
    setShiftFormData(prev => {
      const exists = prev.weekOffs.includes(day);
      const updated = exists
        ? prev.weekOffs.filter(d => d !== day)
        : [...prev.weekOffs, day];
      return { ...prev, weekOffs: updated };
    });
  };

  const toggleEmployeeSelection = (empId: string) => {
    setBulkFormData(prev => {
      const exists = prev.selectedEmployeeIds.includes(empId);
      const updated = exists
        ? prev.selectedEmployeeIds.filter(id => id !== empId)
        : [...prev.selectedEmployeeIds, empId];
      return { ...prev, selectedEmployeeIds: updated };
    });
  };

  const filteredShifts = shifts.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredHistory = history.filter(h =>
    (h.employeeName && h.employeeName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (h.employeeCode && h.employeeCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (h.shiftName && h.shiftName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Shift & Roster Management</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure work timings, grace periods, week-offs, and assign shifts to individual or bulk employee rosters.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isManagement && (
            <>
              <button
                onClick={() => {
                  setAssignFormData({ employeeId: '', shiftId: shifts[0]?.id || '', reason: '' });
                  setIsAssignModalOpen(true);
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-1.5"
              >
                <UserCheck className="w-3.5 h-3.5" />
                Assign Shift
              </button>

              <button
                onClick={() => {
                  setBulkFormData({
                    shiftId: shifts[0]?.id || '',
                    targetType: 'DEPARTMENT',
                    departmentId: 'ALL',
                    branchId: 'ALL',
                    selectedEmployeeIds: [],
                    reason: ''
                  });
                  setIsBulkModalOpen(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-1.5"
              >
                <Users className="w-3.5 h-3.5" />
                Bulk Assign
              </button>

              <button
                onClick={handleOpenAddShift}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Shift
              </button>
            </>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 text-red-700 text-xs font-medium">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto font-bold underline">Dismiss</button>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center gap-3 text-emerald-800 text-xs font-medium">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-auto font-bold underline">Dismiss</button>
        </div>
      )}

      {/* Sub Navigation Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('shifts')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'shifts'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Configured Shifts ({shifts.length})
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Assignment History
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder={activeTab === 'shifts' ? "Search shift names..." : "Search employee or shift..."}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
          />
        </div>
      </div>

      {/* Main Tab Content */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs font-bold text-slate-500">Loading Shifts Engine...</p>
        </div>
      ) : activeTab === 'shifts' ? (
        /* CONFIGURED SHIFTS GRID */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredShifts.map(s => {
            const assignedCount = employees.filter(e => e.shiftId === s.id).length;

            return (
              <div
                key={s.id}
                className={`bg-white rounded-2xl border p-5 shadow-xs transition-all relative flex flex-col justify-between ${
                  s.active ? 'border-slate-200 hover:border-blue-300' : 'border-slate-200 bg-slate-50/50 opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-black text-slate-900 text-sm">{s.name}</h3>
                    <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full border ${
                      s.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-200 text-slate-600 border-slate-300'
                    }`}>
                      {s.active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-700 font-bold">
                      <span className="text-slate-500 font-medium">Timing:</span>
                      <span className="text-blue-700">{s.startTime} - {s.endTime}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-500">Grace Period:</span>
                      <span className="font-semibold text-slate-800">{s.gracePeriodMinutes} mins</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-500">Break Duration:</span>
                      <span className="font-semibold text-slate-800">{s.breakDurationMinutes} mins</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-500">Working Hours:</span>
                      <span className="font-bold text-slate-900">{s.workingHours} hrs/day</span>
                    </div>
                  </div>

                  {/* Week-offs */}
                  <div className="mb-4">
                    <span className="text-[11px] font-bold text-slate-500 block mb-1.5">Configured Week-offs:</span>
                    <div className="flex flex-wrap gap-1">
                      {ALL_WEEKDAYS.map(day => {
                        const isOff = s.weekOffs?.includes(day);
                        return (
                          <span
                            key={day}
                            className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md border ${
                              isOff
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-slate-100 text-slate-400 border-slate-200'
                            }`}
                          >
                            {day.substring(0, 3)}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Footer stats & actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>{assignedCount} Employee{assignedCount === 1 ? '' : 's'}</span>
                  </div>

                  {isManagement && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleStatus(s)}
                        className={`p-1.5 rounded-lg border text-xs font-bold transition-colors ${
                          s.active
                            ? 'text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                            : 'text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                        }`}
                        title={s.active ? 'Deactivate Shift' : 'Activate Shift'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleOpenEditShift(s)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                        title="Edit Shift Details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ASSIGNMENT HISTORY TABLE */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {filteredHistory.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-bold text-slate-600">No shift assignment history records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <th className="p-4">Employee</th>
                    <th className="p-4">Assigned Shift</th>
                    <th className="p-4">Assigned By</th>
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">Reason / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.map(h => (
                    <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{h.employeeName || 'Employee'}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{h.employeeCode || '-'}</div>
                      </td>
                      <td className="p-4">
                        <span className="font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                          {h.shiftName || 'Shift'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-700 font-medium">
                        {h.assignedByName || 'System'}
                      </td>
                      <td className="p-4 text-slate-500 whitespace-nowrap">
                        {new Date(h.assignedAt).toLocaleString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="p-4 text-slate-600 max-w-xs truncate">
                        {h.reason || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT SHIFT MODAL */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-black text-slate-900">
              {editingShift ? 'Edit Shift Configuration' : 'Create New Work Shift'}
            </h3>

            <form onSubmit={handleShiftSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Shift Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Regular General Shift (9 AM - 6 PM)"
                  value={shiftFormData.name}
                  onChange={e => setShiftFormData({ ...shiftFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-hidden focus:border-blue-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Start Time (HH:MM) *</label>
                  <input
                    type="time"
                    required
                    value={shiftFormData.startTime}
                    onChange={e => setShiftFormData({ ...shiftFormData, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-hidden focus:border-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">End Time (HH:MM) *</label>
                  <input
                    type="time"
                    required
                    value={shiftFormData.endTime}
                    onChange={e => setShiftFormData({ ...shiftFormData, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-hidden focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Grace Period (mins)</label>
                  <input
                    type="number"
                    min="0"
                    value={shiftFormData.gracePeriodMinutes}
                    onChange={e => setShiftFormData({ ...shiftFormData, gracePeriodMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-hidden focus:border-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Break Duration (mins)</label>
                  <input
                    type="number"
                    min="0"
                    value={shiftFormData.breakDurationMinutes}
                    onChange={e => setShiftFormData({ ...shiftFormData, breakDurationMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-hidden focus:border-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Working Hours/Day</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    value={shiftFormData.workingHours}
                    onChange={e => setShiftFormData({ ...shiftFormData, workingHours: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-hidden focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              {/* Week-off Configuration */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Week-off Days</label>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_WEEKDAYS.map(day => {
                    const selected = shiftFormData.weekOffs.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleWeekOff(day)}
                        className={`px-3 py-1.5 rounded-xl border font-bold text-xs transition-all ${
                          selected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {day.substring(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsShiftModalOpen(false)}
                  className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-xl transition-colors shadow-xs"
                >
                  {submitting ? 'Saving...' : editingShift ? 'Update Shift' : 'Create Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SINGLE ASSIGNMENT MODAL */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-600" />
              <span>Assign Shift to Employee</span>
            </h3>

            <form onSubmit={handleSingleAssign} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Employee *</label>
                <select
                  required
                  value={assignFormData.employeeId}
                  onChange={e => setAssignFormData({ ...assignFormData, employeeId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-hidden focus:border-blue-500 font-medium"
                >
                  <option value="">-- Choose Employee --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Shift *</label>
                <select
                  required
                  value={assignFormData.shiftId}
                  onChange={e => setAssignFormData({ ...assignFormData, shiftId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-hidden focus:border-blue-500 font-medium"
                >
                  <option value="">-- Choose Shift --</option>
                  {shifts.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.startTime} - {s.endTime})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Project rotation / Night roster request"
                  value={assignFormData.reason}
                  onChange={e => setAssignFormData({ ...assignFormData, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-hidden focus:border-blue-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2 rounded-xl transition-colors shadow-xs"
                >
                  {submitting ? 'Assigning...' : 'Assign Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK ASSIGNMENT MODAL */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <span>Bulk Shift Roster Assignment</span>
            </h3>

            <form onSubmit={handleBulkAssign} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Shift to Apply *</label>
                <select
                  required
                  value={bulkFormData.shiftId}
                  onChange={e => setBulkFormData({ ...bulkFormData, shiftId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-hidden focus:border-blue-500 font-bold"
                >
                  <option value="">-- Select Shift --</option>
                  {shifts.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.startTime} - {s.endTime})
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Type */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Assign Target Group</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkFormData({ ...bulkFormData, targetType: 'DEPARTMENT' })}
                    className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all ${
                      bulkFormData.targetType === 'DEPARTMENT'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300 ring-1 ring-indigo-300'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    By Department
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkFormData({ ...bulkFormData, targetType: 'BRANCH' })}
                    className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all ${
                      bulkFormData.targetType === 'BRANCH'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300 ring-1 ring-indigo-300'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    By Branch
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkFormData({ ...bulkFormData, targetType: 'SPECIFIC' })}
                    className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all ${
                      bulkFormData.targetType === 'SPECIFIC'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300 ring-1 ring-indigo-300'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    Select Employees
                  </button>
                </div>
              </div>

              {/* Conditional Target Options */}
              {bulkFormData.targetType === 'DEPARTMENT' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Department</label>
                  <select
                    value={bulkFormData.departmentId}
                    onChange={e => setBulkFormData({ ...bulkFormData, departmentId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-hidden focus:border-blue-500 font-medium"
                  >
                    <option value="ALL">All Departments (Entire Organization)</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {bulkFormData.targetType === 'BRANCH' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Branch Location</label>
                  <select
                    value={bulkFormData.branchId}
                    onChange={e => setBulkFormData({ ...bulkFormData, branchId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-hidden focus:border-blue-500 font-medium"
                  >
                    <option value="ALL">All Branches (Organization-wide)</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.city})</option>
                    ))}
                  </select>
                </div>
              )}

              {bulkFormData.targetType === 'SPECIFIC' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Select Employees ({bulkFormData.selectedEmployeeIds.length} selected)
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 bg-slate-50">
                    {employees.map(emp => {
                      const selected = bulkFormData.selectedEmployeeIds.includes(emp.id);
                      return (
                        <div
                          key={emp.id}
                          onClick={() => toggleEmployeeSelection(emp.id)}
                          className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                            selected ? 'bg-indigo-100 text-indigo-900 font-bold' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <span>{emp.firstName} {emp.lastName} ({emp.employeeCode})</span>
                          {selected && <Check className="w-4 h-4 text-indigo-700" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason / Note for Bulk Update</label>
                <input
                  type="text"
                  placeholder="e.g. Q3 Shift Rotation Policy"
                  value={bulkFormData.reason}
                  onChange={e => setBulkFormData({ ...bulkFormData, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-hidden focus:border-blue-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-xl transition-colors shadow-xs"
                >
                  {submitting ? 'Processing...' : 'Apply Bulk Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
