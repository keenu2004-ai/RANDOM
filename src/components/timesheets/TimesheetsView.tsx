import React, { useEffect, useState, useMemo } from 'react';
import {
  Clock,
  Plus,
  CheckCircle2,
  XCircle,
  FileText,
  Calendar as CalendarIcon,
  FolderPlus,
  Send,
  Edit,
  Trash2,
  Search,
  Filter,
  Briefcase,
  User,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Building2,
  Users
} from 'lucide-react';
import { hrmsApi } from '../../lib/api-client';
import { Timesheet, Project, Employee , AttendanceRegularizationRequest, TimesheetCorrectionRequest, LeaveCorrectionRequest, PayrollAdjustment } from '../../types/hrms';

interface TimesheetsViewProps {
  userRole: string;
}

export const TimesheetsView: React.FC<TimesheetsViewProps> = ({ userRole }) => {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // View state
  const [viewMode, setViewMode] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [activeStatusTab, setActiveStatusTab] = useState<'ALL' | 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'>('ALL');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showLogModal, setShowLogModal] = useState(false);
  const [editingTs, setEditingTs] = useState<Timesheet | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [rejectingTs, setRejectingTs] = useState<Timesheet | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Log Form state
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [logProjectId, setLogProjectId] = useState('');
  const [logProjectName, setLogProjectName] = useState('');
  const [logTaskDesc, setLogTaskDesc] = useState('');
  const [logHours, setLogHours] = useState<number | ''>(8.0);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Project Form state
  const [projName, setProjName] = useState('');
  const [projCode, setProjCode] = useState('');
  const [projClient, setProjClient] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projStatus, setProjStatus] = useState<'ACTIVE' | 'COMPLETED' | 'ON_HOLD'>('ACTIVE');
  const [projAssignedEmpIds, setProjAssignedEmpIds] = useState<string[]>([]);

  // Correction States
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [corrTsId, setCorrTsId] = useState('');
  const [corrDate, setCorrDate] = useState('');
  const [corrHours, setCorrHours] = useState('');
  const [corrProjectId, setCorrProjectId] = useState('');
  const [corrReason, setCorrReason] = useState('');

  const [showApprovalsModal, setShowApprovalsModal] = useState(false);
  const [correctionReqs, setCorrectionReqs] = useState<any[]>([]);
  const [rejectingCorrId, setRejectingCorrId] = useState<string | null>(null);
  const [corrRejectReason, setCorrRejectReason] = useState('');

  const loadCorrections = async () => {
    try {
      const res = await hrmsApi.getTimesheetCorrections();
      setCorrectionReqs(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const isManagerOrAdmin = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(userRole);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tsData, projData, empData] = await Promise.all([
        hrmsApi.getTimesheets(),
        hrmsApi.getProjects(),
        isManagerOrAdmin ? hrmsApi.getEmployees() : Promise.resolve([])
      ]);
      setTimesheets(tsData);
      setProjects(projData);
      setEmployees(empData);

      if (projData.length > 0 && !logProjectId) {
        setLogProjectId(projData[0].id);
        setLogProjectName(projData[0].name);
      }
    } catch (err: any) {
      console.error('Failed to load timesheet data:', err);
    } finally {
      setLoading(false);
    }
  };

  const openNewLogModal = () => {
    setEditingTs(null);
    setLogDate(selectedDate);
    const activeProjects = projects.filter(p => p.status === 'ACTIVE');
    if (activeProjects.length > 0) {
      setLogProjectId(activeProjects[0].id);
      setLogProjectName(activeProjects[0].name);
    } else {
      setLogProjectId('');
      setLogProjectName('');
    }
    setLogTaskDesc('');
    setLogHours(8.0);
    setFormError('');
    setShowLogModal(true);
  };

  const openEditLogModal = (ts: Timesheet) => {
    setEditingTs(ts);
    setLogDate(ts.date);
    setLogProjectId(ts.projectId || '');
    setLogProjectName(ts.projectName);
    setLogTaskDesc(ts.taskDescription);
    setLogHours(ts.hours);
    setFormError('');
    setShowLogModal(true);
  };

  const handleSaveTimesheet = async (targetStatus: 'DRAFT' | 'SUBMITTED') => {
    setFormError('');
    if (!logDate) {
      setFormError('Please select a date.');
      return;
    }
    if (!logProjectId && !logProjectName.trim()) {
      setFormError('Please select or specify a project.');
      return;
    }
    if (!logTaskDesc.trim()) {
      setFormError('Please enter a task description.');
      return;
    }
    if (!logHours || Number(logHours) <= 0 || Number(logHours) > 24) {
      setFormError('Hours spent must be a positive number up to 24 hours per entry.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        date: logDate,
        projectId: logProjectId || undefined,
        projectName: logProjectName || 'General Work',
        taskDescription: logTaskDesc.trim(),
        hours: Number(logHours),
        status: targetStatus
      };

      if (editingTs) {
        await hrmsApi.updateTimesheet(editingTs.id, payload);
      } else {
        await hrmsApi.submitTimesheet(payload);
      }

      setShowLogModal(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save timesheet entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitDraft = async (id: string) => {
    try {
      await hrmsApi.submitDraftTimesheet(id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to submit timesheet');
    }
  };

  const handleDeleteDraft = async (id: string) => {
    if (!confirm('Are you sure you want to delete this draft timesheet entry?')) return;
    try {
      await hrmsApi.deleteTimesheet(id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete timesheet entry');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await hrmsApi.approveTimesheet(id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to approve timesheet');
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingTs) return;
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejecting the timesheet entry.');
      return;
    }

    try {
      await hrmsApi.rejectTimesheet(rejectingTs.id, rejectionReason.trim());
      setRejectingTs(null);
      setRejectionReason('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to reject timesheet entry');
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName.trim() || !projCode.trim()) return;

    try {
      await hrmsApi.createProject({
        name: projName.trim(),
        code: projCode.trim().toUpperCase(),
        clientName: projClient.trim() || undefined,
        description: projDesc.trim() || undefined,
        assignedEmployeeIds: projAssignedEmpIds,
        status: projStatus
      });
      setShowProjectModal(false);
      setProjName('');
      setProjCode('');
      setProjClient('');
      setProjDesc('');
      setProjAssignedEmpIds([]);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create project');
    }
  };

  // Helper date math for weekly / monthly views
  const currDateObj = useMemo(() => new Date(selectedDate), [selectedDate]);

  const getWeekRange = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diffToMon = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(d.setDate(diffToMon));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const monStr = monday.toISOString().split('T')[0];
    const sunStr = sunday.toISOString().split('T')[0];
    return { monday, sunday, monStr, sunStr };
  };

  const weekRange = useMemo(() => getWeekRange(selectedDate), [selectedDate]);

  // Generate 7 days of current week
  const weekDays = useMemo(() => {
    const days = [];
    const mon = new Date(weekRange.monday);
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      days.push({
        dateStr: d.toISOString().split('T')[0],
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate()
      });
    }
    return days;
  }, [weekRange]);

  // Filtered timesheets
  const filteredTimesheets = useMemo(() => {
    return timesheets.filter(t => {
      // View mode date filter
      if (viewMode === 'DAILY') {
        if (t.date !== selectedDate) return false;
      } else if (viewMode === 'WEEKLY') {
        if (t.date < weekRange.monStr || t.date > weekRange.sunStr) return false;
      } else if (viewMode === 'MONTHLY') {
        const tMonth = t.date.substring(0, 7); // YYYY-MM
        const selMonth = selectedDate.substring(0, 7);
        if (tMonth !== selMonth) return false;
      }

      // Status filter
      if (activeStatusTab !== 'ALL' && t.status !== activeStatusTab) {
        return false;
      }

      // Project filter
      if (selectedProjectId !== 'ALL' && t.projectId !== selectedProjectId) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchProj = t.projectName.toLowerCase().includes(q);
        const matchTask = t.taskDescription.toLowerCase().includes(q);
        const matchEmp = t.employeeName?.toLowerCase().includes(q);
        return matchProj || matchTask || matchEmp;
      }

      return true;
    });
  }, [timesheets, viewMode, selectedDate, weekRange, activeStatusTab, selectedProjectId, searchQuery]);

  // Metrics
  const totalHours = filteredTimesheets.reduce((acc, t) => acc + t.hours, 0);
  const approvedHours = filteredTimesheets.filter(t => t.status === 'APPROVED').reduce((acc, t) => acc + t.hours, 0);
  const pendingHours = filteredTimesheets.filter(t => t.status === 'SUBMITTED').reduce((acc, t) => acc + t.hours, 0);
  const draftHours = filteredTimesheets.filter(t => t.status === 'DRAFT').reduce((acc, t) => acc + t.hours, 0);

  // Daily totals map for weekly view
  const dailyTotalMap = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTimesheets.forEach(t => {
      map[t.date] = (map[t.date] || 0) + t.hours;
    });
    return map;
  }, [filteredTimesheets]);

  return (
    <div id="timesheets-view-root" className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Clock className="w-6 h-6 text-blue-600" />
            <span>Weekly Plan & Project Tracker</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Track weekly project task hours, manage project access, and process team time logs
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isManagerOrAdmin && (
            <button
              id="btn-manage-projects"
              onClick={() => setShowProjectModal(true)}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
            >
              <Briefcase className="w-4 h-4 text-slate-600" />
              <span>Projects ({projects.length})</span>
            </button>
          )}

          <button
            id="btn-log-hours"
            onClick={openNewLogModal}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Log Hours</span>
          </button>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Logged Hours</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-slate-900 mt-2">{totalHours.toFixed(1)} hrs</p>
          <span className="text-[11px] text-slate-400 mt-0.5 block">{filteredTimesheets.length} task entries</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700">Approved Hours</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-emerald-900 mt-2">{approvedHours.toFixed(1)} hrs</p>
          <span className="text-[11px] text-emerald-600 mt-0.5 block">
            {filteredTimesheets.filter(t => t.status === 'APPROVED').length} approved entries
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700">Pending Review</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-amber-900 mt-2">{pendingHours.toFixed(1)} hrs</p>
          <span className="text-[11px] text-amber-600 mt-0.5 block">
            {filteredTimesheets.filter(t => t.status === 'SUBMITTED').length} awaiting approval
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Draft Hours</span>
            <div className="p-2 bg-slate-100 text-slate-600 rounded-xl">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-slate-800 mt-2">{draftHours.toFixed(1)} hrs</p>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            {filteredTimesheets.filter(t => t.status === 'DRAFT').length} unsubmitted drafts
          </span>
        </div>
      </div>

      {/* Main View & Controls Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Navigation & Controls Bar */}
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* View Mode Selector (Daily, Weekly, Monthly) */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    viewMode === mode
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {mode === 'DAILY' ? 'Daily View' : mode === 'WEEKLY' ? 'Weekly View' : 'Monthly View'}
                </button>
              ))}
            </div>

            {/* Date Picker Controls */}
            <div className="flex items-center gap-2 text-xs">
              <label className="font-bold text-slate-700">Date Anchor:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
              />

              {viewMode === 'WEEKLY' && (
                <span className="text-xs font-bold text-slate-600 px-2 py-1 bg-slate-100 rounded-lg">
                  Mon {weekRange.monStr} – Sun {weekRange.sunStr}
                </span>
              )}
            </div>
          </div>

          {/* Sub Filters Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-slate-100">
            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
              {(['ALL', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setActiveStatusTab(status)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
                    activeStatusTab === status
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {/* Project Dropdown & Search */}
            <div className="flex items-center gap-2">
              <select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
              >
                <option value="ALL">All Projects</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>

              <div className="relative min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search task or employee..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Weekly Grid View Header when in WEEKLY mode */}
        {viewMode === 'WEEKLY' && (
          <div className="p-4 bg-slate-50/70 border-b border-slate-200">
            <h4 className="font-bold text-xs text-slate-700 mb-2">Weekly Daily Hours Breakdown</h4>
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map(d => {
                const totalOnDay = dailyTotalMap[d.dateStr] || 0;
                const isToday = d.dateStr === new Date().toISOString().split('T')[0];
                return (
                  <div
                    key={d.dateStr}
                    onClick={() => setSelectedDate(d.dateStr)}
                    className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${
                      d.dateStr === selectedDate
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : isToday
                        ? 'bg-blue-50 border-blue-200 text-blue-900'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold tracking-wider block opacity-80">{d.dayName}</span>
                    <span className="text-sm font-black block mt-0.5">{d.dayNum}</span>
                    <span className={`text-[10px] font-bold mt-1 block px-1.5 py-0.5 rounded ${
                      totalOnDay > 0
                        ? d.dateStr === selectedDate ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-800'
                        : 'text-slate-400'
                    }`}>
                      {totalOnDay > 0 ? `${totalOnDay}h` : '0h'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Timesheet List Table */}
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 font-medium">Loading timesheet records...</div>
        ) : filteredTimesheets.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No timesheet entries found matching the selected view mode, date, and filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Task Description</th>
                  <th className="px-4 py-3">Hours</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTimesheets.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-900">
                      <div>{t.employeeName || 'You'}</div>
                      <span className="text-[10px] text-slate-400 font-normal">{t.employeeCode || ''}</span>
                    </td>

                    <td className="px-4 py-3 text-slate-600 font-semibold">{t.date}</td>

                    <td className="px-4 py-3 font-bold text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>{t.projectName}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-slate-700 max-w-sm">
                      <p className="font-medium">{t.taskDescription}</p>
                      {t.rejectionReason && (
                        <div className="text-[10px] text-red-600 mt-1 flex items-center gap-1 font-semibold bg-red-50 p-1.5 rounded-lg border border-red-100">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>Rejection Reason: {t.rejectionReason}</span>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 font-black text-slate-900 text-sm">
                      {t.hours} hrs
                    </td>

                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                        t.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                        t.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                        t.status === 'SUBMITTED' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {t.status}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Draft actions */}
                        {t.status === 'DRAFT' && (
                          <>
                            <button
                              onClick={() => openEditLogModal(t)}
                              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Edit Draft"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleSubmitDraft(t.id)}
                              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] rounded-lg transition-colors flex items-center gap-1"
                              title="Submit for Review"
                            >
                              <Send className="w-3 h-3" />
                              <span>Submit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteDraft(t.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Draft"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {/* Manager review actions */}
                        {t.status === 'SUBMITTED' && isManagerOrAdmin && (
                          <>
                            <button
                              onClick={() => handleApprove(t.id)}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded-lg shadow-2xs transition-colors flex items-center gap-1"
                              title="Approve Entry"
                            >
                              <Check className="w-3 h-3" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => { setRejectingTs(t); setRejectionReason(''); }}
                              className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-[10px] rounded-lg transition-colors flex items-center gap-1"
                              title="Reject Entry"
                            >
                              <X className="w-3 h-3" />
                              <span>Reject</span>
                            </button>
                          </>
                        )}

                        {/* Rejected edit action */}
                        {t.status === 'REJECTED' && (
                          <button
                            onClick={() => openEditLogModal(t)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px] rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Edit & Resubmit</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Hours Modal */}
      {showLogModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <span>{editingTs ? 'Edit Timesheet Entry' : 'Log Project Hours'}</span>
              </h3>
              <button onClick={() => setShowLogModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={logDate}
                    onChange={e => setLogDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Hours Spent *</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="24"
                    required
                    placeholder="e.g. 8.0"
                    value={logHours}
                    onChange={e => setLogHours(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Project *</label>
                <select
                  value={logProjectId}
                  onChange={e => {
                    setLogProjectId(e.target.value);
                    const selected = projects.find(p => p.id === e.target.value);
                    if (selected) setLogProjectName(selected.name);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code}) {p.status !== 'ACTIVE' ? `[${p.status}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Task Description / Rationale *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detail the modules built, bug fixes, client calls, or design tasks completed..."
                  value={logTaskDesc}
                  onChange={e => setLogTaskDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSaveTimesheet('DRAFT')}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  Save Draft
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSaveTimesheet('SUBMITTED')}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Entry</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Projects Management Modal (Manager / HR / Admin) */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-600" />
                <span>Manage Projects & Client Work</span>
              </h3>
              <button onClick={() => setShowProjectModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Create Project Form */}
            <form onSubmit={handleCreateProject} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
              <h4 className="font-bold text-slate-800 text-xs">Add New Project</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Project Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. NextGen Client Portal"
                    value={projName}
                    onChange={e => setProjName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Project Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PORTAL_NX"
                    value={projCode}
                    onChange={e => setProjCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Client Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Corp Inc."
                    value={projClient}
                    onChange={e => setProjClient(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={projStatus}
                    onChange={e => setProjStatus(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="ON_HOLD">ON_HOLD</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Short project scope and objectives..."
                  value={projDesc}
                  onChange={e => setProjDesc(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-xs"
                >
                  Create Project
                </button>
              </div>
            </form>

            {/* Existing Projects List */}
            <div className="space-y-2">
              <h4 className="font-bold text-xs text-slate-800">Existing Projects ({projects.length})</h4>
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1 text-xs">
                {projects.map(p => (
                  <div key={p.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900">{p.name}</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 font-mono text-[10px] rounded font-bold">{p.code}</span>
                        <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                          p.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {p.status}
                        </span>
                      </div>
                      {p.clientName && <span className="text-[11px] text-slate-500 block mt-0.5">Client: {p.clientName}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-200 pt-3">
              <button
                onClick={() => setShowProjectModal(false)}
                className="px-4 py-2 font-bold bg-slate-900 hover:bg-slate-800 text-white text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectingTs && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <span>Reject Timesheet Entry</span>
            </h3>

            <p className="text-xs text-slate-600">
              State the reason for rejecting the {rejectingTs.hours} hrs timesheet entry for '{rejectingTs.projectName}' on {rejectingTs.date}:
            </p>

            <textarea
              rows={3}
              required
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="e.g. Hours exceeded allocated project task scope..."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium"
            ></textarea>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 text-xs">
              <button
                onClick={() => setRejectingTs(null)}
                className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-5 py-2 font-bold bg-red-600 hover:bg-red-500 text-white rounded-xl shadow-xs"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    
      {/* Correction Modals (Phase 14 Fix) */}
      <div className="mt-8 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
        <h3 className="font-bold text-slate-800 text-sm">Timesheet Corrections</h3>
        <div className="flex gap-2">
          {!isManagerOrAdmin && (
            <button
              onClick={() => {
                setCorrTsId(''); setCorrDate(''); setCorrHours(''); setCorrProjectId(''); setCorrReason('');
                setShowCorrectionModal(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
            >
              Request Timesheet Correction
            </button>
          )}
          {isManagerOrAdmin && (
            <button
              onClick={() => {
                loadCorrections();
                setShowApprovalsModal(true);
              }}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
            >
              View Correction Requests
            </button>
          )}
        </div>
      </div>

      {/* Correction Request Modal */}
      {showCorrectionModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <h3 className="font-bold text-base text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600" />
              <span>Request Correction</span>
            </h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!corrTsId || !corrReason) return alert('Timesheet ID and Reason are required');
              try {
                await hrmsApi.createTimesheetCorrection({
                  timesheet_id: corrTsId,
                  requested_date: corrDate || undefined,
                  requested_hours: corrHours ? Number(corrHours) : undefined,
                  requested_project_id: corrProjectId || undefined,
                  reason: corrReason
                } as any);
                setShowCorrectionModal(false);
                loadData();
              } catch (err: any) { alert(err.message || 'Error requesting correction'); }
            }} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Timesheet ID *</label>
                <input type="text" required value={corrTsId} onChange={e => setCorrTsId(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">New Date</label>
                  <input type="date" value={corrDate} onChange={e => setCorrDate(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border rounded-xl" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">New Hours</label>
                  <input type="number" step="0.25" min="0.25" max="24" value={corrHours} onChange={e => setCorrHours(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border rounded-xl" />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">New Project ID</label>
                <input type="text" value={corrProjectId} onChange={e => setCorrProjectId(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border rounded-xl" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason for Correction *</label>
                <textarea required rows={2} value={corrReason} onChange={e => setCorrReason(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border rounded-xl"></textarea>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setShowCorrectionModal(false)} className="px-4 py-2 font-semibold text-slate-600">Cancel</button>
                <button type="submit" className="px-5 py-2 font-bold bg-blue-600 text-white rounded-xl">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approvals Modal */}
      {showApprovalsModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 text-xs flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 shrink-0">
              <h3 className="font-bold text-base text-slate-900">Pending Corrections</h3>
              <button onClick={() => setShowApprovalsModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            
            <div className="overflow-y-auto flex-1 pr-2 space-y-3">
              {correctionReqs.filter((c: any) => c.status === 'PENDING').length === 0 && (
                <div className="text-center p-6 text-slate-500">No pending requests</div>
              )}
              {correctionReqs.filter((c: any) => c.status === 'PENDING').map((cr: any) => (
                <div key={cr.id} className="p-4 border rounded-xl bg-slate-50 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-bold text-slate-900">{cr.employeeName || 'Unknown'} <span className="font-normal text-slate-500">requested correction on timesheet</span> {cr.timesheetId}</p>
                    <div className="text-[11px] text-slate-600">
                      <div><span className="font-semibold">Reason:</span> {cr.reason}</div>
                      <div>
                        <span className="font-semibold">Changes:</span> 
                        {cr.requestedDate && ` Date: ${cr.oldDate} -> ${cr.requestedDate}`}
                        {cr.requestedHours !== null && cr.requestedHours !== undefined && ` Hours: ${cr.oldHours} -> ${cr.requestedHours}`}
                        {cr.requestedProjectId && ` Project: ${cr.oldProjectName} -> ${cr.requestedProjectName || cr.requestedProjectId}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={async () => {
                      if(!confirm('Approve this correction?')) return;
                      try { await hrmsApi.approveTimesheetCorrection(cr.id); loadCorrections(); loadData(); }
                      catch(e: any) { alert(e.message || 'Error'); }
                    }} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-500">Approve</button>
                    <button onClick={() => { setRejectingCorrId(cr.id); setCorrRejectReason(''); }} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg font-bold hover:bg-red-200">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reject Correction Modal */}
      {rejectingCorrId && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-xs">
            <h3 className="font-bold text-sm text-slate-900 border-b pb-2">Reject Request</h3>
            <textarea required rows={3} placeholder="Rejection reason..." value={corrRejectReason} onChange={e => setCorrRejectReason(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border rounded-xl"></textarea>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => setRejectingCorrId(null)} className="px-3 py-1.5 font-semibold text-slate-600">Cancel</button>
              <button onClick={async () => {
                if(!corrRejectReason) return alert('Reason required');
                try {
                  await hrmsApi.rejectTimesheetCorrection(rejectingCorrId, corrRejectReason);
                  setRejectingCorrId(null);
                  loadCorrections();
                  loadData();
                } catch(e: any) { alert(e.message || 'Error'); }
              }} className="px-4 py-1.5 bg-red-600 text-white font-bold rounded-xl">Reject</button>
            </div>
          </div>
        </div>
      )}
</div>
  );
};
