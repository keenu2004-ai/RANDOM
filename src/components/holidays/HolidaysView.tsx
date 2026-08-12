import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  List,
  Plus,
  Edit2,
  Trash2,
  Building2,
  Search,
  ChevronLeft,
  ChevronRight,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Holiday, Branch, Role } from '../../types/hrms';
import { hrmsApi } from '../../lib/api-client';

interface HolidaysViewProps {
  userRole: Role;
}

export const HolidaysView: React.FC<HolidaysViewProps> = ({ userRole }) => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // View state: 'list' | 'calendar'
  const [activeTab, setActiveTab] = useState<'list' | 'calendar'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('ALL');

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    type: 'NATIONAL' as 'NATIONAL' | 'FESTIVAL' | 'OPTIONAL',
    branchId: 'ALL',
    description: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirm Modal
  const [deletingHoliday, setDeletingHoliday] = useState<Holiday | null>(null);

  const isManagement = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(userRole);

  useEffect(() => {
    fetchData();
  }, [selectedBranchFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string> = {};
      if (selectedBranchFilter !== 'ALL') {
        params.branchId = selectedBranchFilter;
      }
      const [holidayData, metaData] = await Promise.all([
        hrmsApi.getHolidays(params),
        hrmsApi.getOrganizationMeta().catch(() => ({ branches: [] }))
      ]);

      setHolidays(holidayData);
      setBranches(metaData.branches || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch holidays data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingHoliday(null);
    setFormData({
      name: '',
      date: new Date().toISOString().split('T')[0],
      type: 'NATIONAL',
      branchId: 'ALL',
      description: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (h: Holiday) => {
    setEditingHoliday(h);
    setFormData({
      name: h.name,
      date: h.date,
      type: h.type,
      branchId: h.branchId || 'ALL',
      description: h.description || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.date) {
      setError('Holiday name and date are required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const payload = {
        name: formData.name,
        date: formData.date,
        type: formData.type,
        branchId: formData.branchId === 'ALL' ? undefined : formData.branchId,
        description: formData.description
      };

      if (editingHoliday) {
        await hrmsApi.updateHoliday(editingHoliday.id, payload);
        setSuccess(`Holiday '${formData.name}' updated successfully.`);
      } else {
        await hrmsApi.createHoliday(payload);
        setSuccess(`Holiday '${formData.name}' added successfully.`);
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to save holiday');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingHoliday) return;
    try {
      setSubmitting(true);
      setError(null);
      await hrmsApi.deleteHoliday(deletingHoliday.id);
      setSuccess(`Holiday '${deletingHoliday.name}' deleted successfully.`);
      setDeletingHoliday(null);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete holiday');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtering
  const filteredHolidays = holidays.filter(h => {
    const matchesSearch = h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.description && h.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  // Calendar Helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-11
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 (Sun) - 6 (Sat)
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const getTypeBadge = (type: Holiday['type']) => {
    switch (type) {
      case 'NATIONAL':
        return <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200">National</span>;
      case 'FESTIVAL':
        return <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">Festival</span>;
      case 'OPTIONAL':
        return <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-purple-50 text-purple-700 border border-purple-200">Optional</span>;
      default:
        return <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-slate-100 text-slate-700">General</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Holiday Management</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            View national, festival, and branch-specific holiday calendars for THEIAKSHI ENTERPRISE.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'list'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              List View
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'calendar'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Calendar View
            </button>
          </div>

          {/* Add Holiday Button */}
          {isManagement && (
            <button
              onClick={handleOpenAddModal}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Holiday
            </button>
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

      {/* Controls Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search holidays..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Building2 className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-600 shrink-0">Branch:</span>
          <select
            value={selectedBranchFilter}
            onChange={e => setSelectedBranchFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:border-blue-500"
          >
            <option value="ALL">All Branches (Organization-wide)</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name} ({b.city})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs font-bold text-slate-500">Loading Holiday Calendar...</p>
        </div>
      ) : activeTab === 'list' ? (
        /* LIST VIEW */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {filteredHolidays.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-bold text-slate-600">No holidays found</p>
              <p className="text-xs mt-1">Try selecting a different branch or adding a new holiday entry.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <th className="p-4">Date</th>
                    <th className="p-4">Holiday Name</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Applicable Scope</th>
                    <th className="p-4">Description</th>
                    {isManagement && <th className="p-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHolidays.map(h => {
                    const dateObj = new Date(h.date);
                    const formattedDate = dateObj.toLocaleDateString('en-IN', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    });

                    return (
                      <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 font-bold text-slate-900 whitespace-nowrap">
                          {formattedDate}
                        </td>
                        <td className="p-4 font-black text-slate-800">
                          {h.name}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          {getTypeBadge(h.type)}
                        </td>
                        <td className="p-4 text-slate-600 font-medium whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            {h.branchName || (h.branchId ? 'Branch Specific' : 'All Branches (Organization-wide)')}
                          </span>
                        </td>
                        <td className="p-4 text-slate-500 max-w-xs truncate">
                          {h.description || '-'}
                        </td>
                        {isManagement && (
                          <td className="p-4 text-right whitespace-nowrap space-x-2">
                            <button
                              onClick={() => handleOpenEditModal(h)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit Holiday"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeletingHoliday(h)}
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Holiday"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* CALENDAR VIEW */
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          {/* Calendar Header Navigation */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span>{monthNames[month]} {year}</span>
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className="p-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Today
              </button>
              <button
                onClick={nextMonth}
                className="p-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-500">
            <div className="p-2 bg-slate-50 rounded-lg text-red-500">Sun</div>
            <div className="p-2 bg-slate-50 rounded-lg">Mon</div>
            <div className="p-2 bg-slate-50 rounded-lg">Tue</div>
            <div className="p-2 bg-slate-50 rounded-lg">Wed</div>
            <div className="p-2 bg-slate-50 rounded-lg">Thu</div>
            <div className="p-2 bg-slate-50 rounded-lg">Fri</div>
            <div className="p-2 bg-slate-50 rounded-lg text-blue-500">Sat</div>

            {/* Empty boxes before day 1 */}
            {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-28 border border-slate-100/50 rounded-xl bg-slate-50/30"></div>
            ))}

            {/* Days in Month */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const dayHolidays = holidays.filter(h => h.date === dateStr);
              const isToday = new Date().toISOString().split('T')[0] === dateStr;

              return (
                <div
                  key={dateStr}
                  className={`h-28 border rounded-xl p-2 flex flex-col text-left transition-all ${
                    isToday ? 'border-blue-500 bg-blue-50/20 ring-1 ring-blue-500/20' : 'border-slate-100 hover:border-slate-200 bg-white'
                  }`}
                >
                  <span className={`text-xs font-bold ${isToday ? 'w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center -ml-0.5 -mt-0.5' : 'text-slate-700'}`}>
                    {dayNum}
                  </span>

                  <div className="mt-1 space-y-1 overflow-y-auto flex-1">
                    {dayHolidays.map(h => (
                      <div
                        key={h.id}
                        className="p-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-[10px] leading-tight font-bold"
                        title={`${h.name} (${h.type}) - ${h.branchName || 'All Branches'}`}
                      >
                        <div className="truncate">{h.name}</div>
                        <div className="text-[9px] text-blue-600 font-medium truncate mt-0.5">
                          {h.type}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add / Edit Holiday Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-black text-slate-900">
              {editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Holiday Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Independence Day"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-hidden focus:border-blue-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-hidden focus:border-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Holiday Type</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-hidden focus:border-blue-500 font-medium"
                  >
                    <option value="NATIONAL">National</option>
                    <option value="FESTIVAL">Festival</option>
                    <option value="OPTIONAL">Optional</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Applicable Scope / Branch</label>
                <select
                  value={formData.branchId}
                  onChange={e => setFormData({ ...formData, branchId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-hidden focus:border-blue-500 font-medium"
                >
                  <option value="ALL">All Branches (Organization-wide)</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.city})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Additional context or details..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-hidden focus:border-blue-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-xl transition-colors shadow-xs"
                >
                  {submitting ? 'Saving...' : editingHoliday ? 'Update' : 'Create Holiday'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingHoliday && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto border border-red-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Delete Holiday?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete <span className="font-bold text-slate-800">'{deletingHoliday.name}'</span>? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setDeletingHoliday(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-xs"
              >
                {submitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
