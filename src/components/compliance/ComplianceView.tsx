import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Scale,
  Calendar as CalendarIcon,
  List,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Edit3,
  Trash2,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  Info,
  UserCheck,
  Bell,
  FileText,
  Check,
  X,
  HelpCircle
} from 'lucide-react';
import { hrmsApi } from '../../lib/api-client';
import { StatutoryRule, ComplianceTask, DeductionCategory, ComplianceFrequency, ComplianceStatus, Employee } from '../../types/hrms';

interface ComplianceViewProps {
  userRole?: string;
}

export const ComplianceView: React.FC<ComplianceViewProps> = ({ userRole = 'EMPLOYEE' }) => {
  const isAdminOrHr = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(userRole);

  // Main Tab State: 'STATUTORY_DEDUCTIONS' | 'COMPLIANCE_CALENDAR'
  const [activeMainTab, setActiveMainTab] = useState<'STATUTORY_DEDUCTIONS' | 'COMPLIANCE_CALENDAR'>('STATUTORY_DEDUCTIONS');

  // Data States
  const [rules, setRules] = useState<StatutoryRule[]>([]);
  const [tasks, setTasks] = useState<ComplianceTask[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // ----------------------------------------------------
  // STATUTORY DEDUCTIONS STATE
  // ----------------------------------------------------
  const [ruleSearch, setRuleSearch] = useState('');
  const [ruleCategoryFilter, setRuleCategoryFilter] = useState<string>('ALL');
  const [ruleStateFilter, setRuleStateFilter] = useState<string>('ALL');

  // Rule Modal State
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<StatutoryRule | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleCategory, setRuleCategory] = useState<DeductionCategory>('PF');
  const [ruleState, setRuleState] = useState('All India');
  const [ruleRate, setRuleRate] = useState<number | ''>(12);
  const [ruleFixed, setRuleFixed] = useState<number | ''>('');
  const [ruleThreshold, setRuleThreshold] = useState<number | ''>(15000);
  const [ruleEffectiveDate, setRuleEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [ruleExpiryDate, setRuleExpiryDate] = useState('');
  const [ruleActive, setRuleActive] = useState(true);
  const [ruleDescription, setRuleDescription] = useState('');

  // ----------------------------------------------------
  // COMPLIANCE CALENDAR STATE
  // ----------------------------------------------------
  // Views: 'CALENDAR' | 'LIST' | 'UPCOMING' | 'COMPLETED' | 'OVERDUE'
  const [calendarSubView, setCalendarSubView] = useState<'CALENDAR' | 'LIST' | 'UPCOMING' | 'COMPLETED' | 'OVERDUE'>('CALENDAR');
  const [taskSearch, setTaskSearch] = useState('');
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<string>('ALL');
  const [taskFrequencyFilter, setTaskFrequencyFilter] = useState<string>('ALL');

  // Interactive Calendar Month Navigation
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());

  // Task Modal State
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<ComplianceTask | null>(null);
  const [taskName, setTaskName] = useState('');
  const [taskCategory, setTaskCategory] = useState('PF Return');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskFrequency, setTaskFrequency] = useState<ComplianceFrequency>('MONTHLY');
  const [taskResponsible, setTaskResponsible] = useState('HR Manager');
  const [taskResponsibleId, setTaskResponsibleId] = useState('');
  const [taskStatus, setTaskStatus] = useState<ComplianceStatus>('PENDING');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskReminderDate, setTaskReminderDate] = useState('');

  // Load Initial Data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rData, tData, empData] = await Promise.all([
        hrmsApi.getStatutoryRules(),
        hrmsApi.getComplianceTasks(),
        hrmsApi.getEmployees().catch(() => [])
      ]);
      setRules(rData || []);
      setTasks(tData || []);
      setEmployees(empData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // HANDLERS: STATUTORY RULES
  // ----------------------------------------------------
  const handleOpenRuleModal = (rule?: StatutoryRule) => {
    if (rule) {
      setEditingRule(rule);
      setRuleName(rule.ruleName);
      setRuleCategory(rule.category);
      setRuleState(rule.state);
      setRuleRate(rule.ratePercentage);
      setRuleFixed(rule.fixedAmount !== undefined ? rule.fixedAmount : '');
      setRuleThreshold(rule.thresholdAmount);
      setRuleEffectiveDate(rule.effectiveDate);
      setRuleExpiryDate(rule.expiryDate || '');
      setRuleActive(rule.active);
      setRuleDescription(rule.description || '');
    } else {
      setEditingRule(null);
      setRuleName('');
      setRuleCategory('PF');
      setRuleState('All India');
      setRuleRate(12);
      setRuleFixed('');
      setRuleThreshold(15000);
      setRuleEffectiveDate(new Date().toISOString().split('T')[0]);
      setRuleExpiryDate('');
      setRuleActive(true);
      setRuleDescription('');
    }
    setShowRuleModal(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;

    try {
      const payload: Partial<StatutoryRule> = {
        ruleName,
        category: ruleCategory,
        state: ruleState,
        ratePercentage: Number(ruleRate) || 0,
        fixedAmount: ruleFixed !== '' ? Number(ruleFixed) : undefined,
        thresholdAmount: Number(ruleThreshold) || 0,
        effectiveDate: ruleEffectiveDate,
        expiryDate: ruleExpiryDate || undefined,
        active: ruleActive,
        description: ruleDescription
      };

      if (editingRule) {
        const updated = await hrmsApi.updateStatutoryRule(editingRule.id, payload);
        setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
      } else {
        const created = await hrmsApi.createStatutoryRule(payload);
        setRules(prev => [...prev, created]);
      }

      setShowRuleModal(false);
      alert(`Statutory rule ${editingRule ? 'updated' : 'created'} successfully!`);
    } catch (err: any) {
      alert(err.message || 'Failed to save statutory rule');
    }
  };

  const handleToggleRuleActive = async (id: string, currentActive: boolean) => {
    try {
      const updated = await hrmsApi.toggleStatutoryRule(id, !currentActive);
      setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
    } catch (err: any) {
      alert(err.message || 'Failed to toggle rule active status');
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this statutory deduction rule?')) return;
    try {
      await hrmsApi.deleteStatutoryRule(id);
      setRules(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete rule');
    }
  };

  // Filtered Rules
  const filteredRules = rules.filter(r => {
    if (ruleCategoryFilter !== 'ALL' && r.category !== ruleCategoryFilter) return false;
    if (ruleStateFilter !== 'ALL' && r.state !== ruleStateFilter) return false;
    if (ruleSearch.trim()) {
      const q = ruleSearch.toLowerCase();
      const matchName = r.ruleName.toLowerCase().includes(q);
      const matchDesc = (r.description || '').toLowerCase().includes(q);
      const matchState = r.state.toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchState) return false;
    }
    return true;
  });

  // ----------------------------------------------------
  // HANDLERS: COMPLIANCE CALENDAR
  // ----------------------------------------------------
  const handleOpenTaskModal = (task?: ComplianceTask) => {
    if (task) {
      setEditingTask(task);
      setTaskName(task.taskName);
      setTaskCategory(task.category);
      setTaskDueDate(task.dueDate);
      setTaskFrequency(task.frequency);
      setTaskResponsible(task.responsiblePerson);
      setTaskResponsibleId(task.responsiblePersonId || '');
      setTaskStatus(task.status);
      setTaskNotes(task.notes || '');
      setTaskReminderDate(task.reminderDate || '');
    } else {
      setEditingTask(null);
      setTaskName('');
      setTaskCategory('PF Return');
      setTaskDueDate(new Date().toISOString().split('T')[0]);
      setTaskFrequency('MONTHLY');
      setTaskResponsible('HR Manager');
      setTaskResponsibleId('');
      setTaskStatus('PENDING');
      setTaskNotes('');
      setTaskReminderDate('');
    }
    setShowTaskModal(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim() || !taskDueDate) return;

    try {
      const payload: Partial<ComplianceTask> = {
        taskName,
        category: taskCategory,
        dueDate: taskDueDate,
        frequency: taskFrequency,
        responsiblePerson: taskResponsible,
        responsiblePersonId: taskResponsibleId || undefined,
        status: taskStatus,
        notes: taskNotes,
        reminderDate: taskReminderDate || undefined
      };

      if (editingTask) {
        const updated = await hrmsApi.updateComplianceTask(editingTask.id, payload);
        setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
      } else {
        const created = await hrmsApi.createComplianceTask(payload);
        setTasks(prev => [...prev, created]);
      }

      setShowTaskModal(false);
      alert(`Compliance task ${editingTask ? 'updated' : 'created'} successfully!`);
    } catch (err: any) {
      alert(err.message || 'Failed to save compliance task');
    }
  };

  const handleUpdateTaskStatus = async (id: string, newStatus: ComplianceStatus) => {
    try {
      const updated = await hrmsApi.updateComplianceTaskStatus(id, newStatus);
      setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    } catch (err: any) {
      alert(err.message || 'Failed to update task status');
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Are you sure you want to delete this compliance item?')) return;
    try {
      await hrmsApi.deleteComplianceTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete task');
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  // Filtered Tasks
  const filteredTasks = tasks.filter(t => {
    if (taskCategoryFilter !== 'ALL' && t.category !== taskCategoryFilter) return false;
    if (taskFrequencyFilter !== 'ALL' && t.frequency !== taskFrequencyFilter) return false;

    // View specific filtering
    if (calendarSubView === 'UPCOMING') {
      if (t.status === 'COMPLETED' || t.dueDate < todayStr) return false;
    } else if (calendarSubView === 'COMPLETED') {
      if (t.status !== 'COMPLETED') return false;
    } else if (calendarSubView === 'OVERDUE') {
      if (t.status === 'COMPLETED' || t.dueDate >= todayStr) return false;
    }

    if (taskSearch.trim()) {
      const q = taskSearch.toLowerCase();
      const matchName = t.taskName.toLowerCase().includes(q);
      const matchCat = t.category.toLowerCase().includes(q);
      const matchResp = t.responsiblePerson.toLowerCase().includes(q);
      if (!matchName && !matchCat && !matchResp) return false;
    }
    return true;
  });

  // Calendar Stats
  const totalTasksCount = tasks.length;
  const overdueTasksCount = tasks.filter(t => t.status !== 'COMPLETED' && t.dueDate < todayStr).length;
  const upcomingTasksCount = tasks.filter(t => t.status !== 'COMPLETED' && t.dueDate >= todayStr).length;
  const completedTasksCount = tasks.filter(t => t.status === 'COMPLETED').length;

  // ----------------------------------------------------
  // INTERACTIVE CALENDAR GRID GENERATION
  // ----------------------------------------------------
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth(); // 0-indexed

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun
  const totalDaysInMonth = lastDayOfMonth.getDate();

  const prevMonthDays = new Date(year, month, 0).getDate();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const calendarGridCells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

  // Previous month padding
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const prevM = month === 0 ? 11 : month - 1;
    const prevY = month === 0 ? year - 1 : year;
    const dStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    calendarGridCells.push({ dateStr: dStr, dayNum: day, isCurrentMonth: false });
  }

  // Current month days
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    calendarGridCells.push({ dateStr: dStr, dayNum: day, isCurrentMonth: true });
  }

  // Next month padding (to complete 35 or 42 grid cells)
  const remainingCells = (calendarGridCells.length > 35 ? 42 : 35) - calendarGridCells.length;
  for (let day = 1; day <= remainingCells; day++) {
    const nextM = month === 11 ? 0 : month + 1;
    const nextY = month === 11 ? year + 1 : year;
    const dStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    calendarGridCells.push({ dateStr: dStr, dayNum: day, isCurrentMonth: false });
  }

  const getStatusBadge = (s: ComplianceStatus, dueDate: string) => {
    const isOverdue = s !== 'COMPLETED' && dueDate < todayStr;
    if (s === 'COMPLETED') {
      return <span className="px-2 py-0.5 text-[10px] font-extrabold rounded bg-emerald-100 text-emerald-800">COMPLETED</span>;
    }
    if (isOverdue || s === 'OVERDUE') {
      return <span className="px-2 py-0.5 text-[10px] font-extrabold rounded bg-rose-100 text-rose-800 border border-rose-200">OVERDUE</span>;
    }
    if (s === 'IN_PROGRESS') {
      return <span className="px-2 py-0.5 text-[10px] font-extrabold rounded bg-amber-100 text-amber-800">IN PROGRESS</span>;
    }
    if (s === 'WAITING_APPROVAL') {
      return <span className="px-2 py-0.5 text-[10px] font-extrabold rounded bg-purple-100 text-purple-800">WAITING APPROVAL</span>;
    }
    return <span className="px-2 py-0.5 text-[10px] font-extrabold rounded bg-blue-100 text-blue-800">PENDING</span>;
  };

  const getCategoryBadge = (cat: DeductionCategory) => {
    switch (cat) {
      case 'PF':
        return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-blue-100 text-blue-800">EPF</span>;
      case 'ESI':
        return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-emerald-100 text-emerald-800">ESIC</span>;
      case 'PROFESSIONAL_TAX':
        return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-purple-100 text-purple-800">PROF TAX</span>;
      case 'TDS':
        return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-amber-100 text-amber-800">TDS</span>;
      case 'CUSTOM':
        return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-sky-100 text-sky-800">CUSTOM</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-slate-100 text-slate-700">OTHER</span>;
    }
  };

  return (
    <div id="compliance-view-root" className="space-y-6">
      {/* Top Banner & Main Section Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Statutory Rules & Compliance</h2>
          <p className="text-xs text-slate-500">
            Configurable payroll statutory deductions & statutory filing compliance calendar
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 self-start md:self-auto">
          <button
            onClick={() => setActiveMainTab('STATUTORY_DEDUCTIONS')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-2 ${
              activeMainTab === 'STATUTORY_DEDUCTIONS'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Statutory Deductions</span>
          </button>

          <button
            onClick={() => setActiveMainTab('COMPLIANCE_CALENDAR')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-2 ${
              activeMainTab === 'COMPLIANCE_CALENDAR'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>Compliance Calendar</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 1: STATUTORY DEDUCTIONS                           */}
      {/* ========================================================= */}
      {activeMainTab === 'STATUTORY_DEDUCTIONS' && (
        <div className="space-y-6">
          {/* Header Action & Stats */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-black text-slate-900">Configurable Statutory Parameters</div>
                <div className="text-xs text-slate-500">PF, ESI, Professional Tax, TDS, and custom wage component rules</div>
              </div>
            </div>

            {isAdminOrHr && (
              <button
                onClick={() => handleOpenRuleModal()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center space-x-2 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Add Deduction Rule</span>
              </button>
            )}
          </div>

          {/* Search & Filters */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search rule name, state, or description..."
                value={ruleSearch}
                onChange={e => setRuleSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <select
                value={ruleCategoryFilter}
                onChange={e => setRuleCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
              >
                <option value="ALL">Category: All</option>
                <option value="PF">PF (Provident Fund)</option>
                <option value="ESI">ESI (State Insurance)</option>
                <option value="PROFESSIONAL_TAX">Professional Tax</option>
                <option value="TDS">TDS (Income Tax)</option>
                <option value="CUSTOM">Custom Deductions</option>
              </select>

              <select
                value={ruleStateFilter}
                onChange={e => setRuleStateFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
              >
                <option value="ALL">State: All Jurisdictions</option>
                <option value="All India">All India</option>
                <option value="Maharashtra">Maharashtra</option>
                <option value="Karnataka">Karnataka</option>
                <option value="Tamil Nadu">Tamil Nadu</option>
                <option value="Delhi">Delhi</option>
                <option value="West Bengal">West Bengal</option>
                <option value="Gujarat">Gujarat</option>
              </select>
            </div>
          </div>

          {/* Rules Grid */}
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
              Loading statutory deduction parameters...
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="p-12 text-center space-y-2 bg-white rounded-2xl border border-slate-200">
              <Scale className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="font-bold text-sm text-slate-700">No statutory rules found</div>
              <p className="text-xs text-slate-400">Configure Provident Fund, ESI, and Tax rules for automated salary calculations</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRules.map(r => (
                <div
                  key={r.id}
                  className={`bg-white rounded-2xl p-5 border shadow-2xs space-y-3 transition-all ${
                    r.active ? 'border-slate-200' : 'border-slate-200 opacity-60 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        {getCategoryBadge(r.category)}
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{r.state}</span>
                      </div>
                      <h3 className="font-extrabold text-sm text-slate-900 line-clamp-1">{r.ruleName}</h3>
                    </div>

                    {isAdminOrHr && (
                      <button
                        onClick={() => handleToggleRuleActive(r.id, r.active)}
                        className={`text-xs font-bold px-2 py-1 rounded-lg transition-colors flex items-center space-x-1 ${
                          r.active
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                        title="Toggle Active/Inactive"
                      >
                        {r.active ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-slate-500" />}
                        <span>{r.active ? 'Active' : 'Inactive'}</span>
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 min-h-[32px]">{r.description || 'No specific description provided'}</p>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-semibold">Deduction Rate:</span>
                      <span className="font-black text-slate-900">
                        {r.ratePercentage > 0 ? `${r.ratePercentage}%` : r.fixedAmount ? `₹ ${r.fixedAmount.toLocaleString('en-IN')}` : '0%'}
                      </span>
                    </div>

                    {r.fixedAmount !== undefined && r.fixedAmount > 0 && r.ratePercentage > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-semibold">Fixed Amount:</span>
                        <span className="font-bold text-slate-800">₹ {r.fixedAmount.toLocaleString('en-IN')}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-semibold">Salary Threshold:</span>
                      <span className="font-bold text-slate-800">
                        {r.thresholdAmount > 0 ? `₹ ${r.thresholdAmount.toLocaleString('en-IN')}` : 'No Minimum'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium pt-1 border-t border-slate-100">
                    <div>
                      Effective: <span className="font-bold text-slate-700">{r.effectiveDate}</span>
                      {r.expiryDate && <span> • Exp: {r.expiryDate}</span>}
                    </div>

                    {isAdminOrHr && (
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleOpenRuleModal(r)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg transition-colors"
                          title="Edit Rule"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRule(r.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 2: COMPLIANCE CALENDAR                            */}
      {/* ========================================================= */}
      {activeMainTab === 'COMPLIANCE_CALENDAR' && (
        <div className="space-y-6">
          {/* Calendar Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-500">Total Filings</div>
                <div className="text-lg font-black text-slate-900">{totalTasksCount}</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-500">Overdue Filings</div>
                <div className="text-lg font-black text-rose-700">{overdueTasksCount}</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-500">Upcoming / Pending</div>
                <div className="text-lg font-black text-slate-900">{upcomingTasksCount}</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-500">Completed Filings</div>
                <div className="text-lg font-black text-slate-900">{completedTasksCount}</div>
              </div>
            </div>
          </div>

          {/* Views Toolbar & Controls */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row items-center justify-between gap-4">
            {/* View Filter Pills: Calendar | List | Upcoming | Completed | Overdue */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 w-full lg:w-auto">
              <button
                onClick={() => setCalendarSubView('CALENDAR')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 ${
                  calendarSubView === 'CALENDAR' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Calendar Grid</span>
              </button>

              <button
                onClick={() => setCalendarSubView('LIST')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 ${
                  calendarSubView === 'LIST' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>List View</span>
              </button>

              <button
                onClick={() => setCalendarSubView('UPCOMING')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 ${
                  calendarSubView === 'UPCOMING' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Upcoming</span>
              </button>

              <button
                onClick={() => setCalendarSubView('COMPLETED')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 ${
                  calendarSubView === 'COMPLETED' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Completed</span>
              </button>

              <button
                onClick={() => setCalendarSubView('OVERDUE')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 ${
                  calendarSubView === 'OVERDUE' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Overdue ({overdueTasksCount})</span>
              </button>
            </div>

            {/* Right Action & Search */}
            <div className="flex items-center space-x-2 w-full lg:w-auto justify-between lg:justify-end">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search filing name..."
                  value={taskSearch}
                  onChange={e => setTaskSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48 sm:w-60"
                />
              </div>

              {isAdminOrHr && (
                <button
                  onClick={() => handleOpenTaskModal()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all flex items-center space-x-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Compliance Task</span>
                </button>
              )}
            </div>
          </div>

          {/* CALENDAR SUB-VIEW 1: INTERACTIVE MONTH GRID */}
          {calendarSubView === 'CALENDAR' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden space-y-3 p-5">
              {/* Month Navigation Controls */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    {monthNames[month]} {year}
                  </h3>
                  <button
                    onClick={() => setCurrentCalendarDate(new Date())}
                    className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                  >
                    Today
                  </button>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setCurrentCalendarDate(new Date(year, month - 1, 1))}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                    title="Previous Month"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentCalendarDate(new Date(year, month + 1, 1))}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                    title="Next Month"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 gap-1 text-center font-extrabold text-[11px] text-slate-500 uppercase py-1 border-b border-slate-100">
                <div>Sun</div>
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
              </div>

              {/* Calendar Grid Cells */}
              <div className="grid grid-cols-7 gap-1">
                {calendarGridCells.map((cell, idx) => {
                  const cellTasks = tasks.filter(t => t.dueDate === cell.dateStr);
                  const isToday = cell.dateStr === todayStr;

                  return (
                    <div
                      key={idx}
                      className={`min-h-[90px] p-1.5 border rounded-xl flex flex-col justify-between transition-all ${
                        !cell.isCurrentMonth
                          ? 'bg-slate-50/40 border-slate-100 text-slate-300'
                          : isToday
                          ? 'bg-emerald-50/50 border-emerald-300 ring-2 ring-emerald-400'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className={isToday ? 'text-emerald-800 font-extrabold' : cell.isCurrentMonth ? 'text-slate-800' : 'text-slate-300'}>
                          {cell.dayNum}
                        </span>
                        {cellTasks.length > 0 && (
                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                            {cellTasks.length}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 overflow-y-auto max-h-[60px] my-1">
                        {cellTasks.map(t => {
                          const isDone = t.status === 'COMPLETED';
                          const isTaskOverdue = !isDone && t.dueDate < todayStr;
                          return (
                            <div
                              key={t.id}
                              onClick={() => isAdminOrHr && handleOpenTaskModal(t)}
                              className={`p-1 rounded text-[10px] font-bold truncate cursor-pointer transition-transform hover:scale-[1.02] ${
                                isDone
                                  ? 'bg-emerald-100 text-emerald-900 line-through opacity-80'
                                  : isTaskOverdue
                                  ? 'bg-rose-100 text-rose-900 border border-rose-300 font-black'
                                  : 'bg-blue-100 text-blue-900'
                              }`}
                              title={`${t.taskName} (${t.responsiblePerson})`}
                            >
                              {t.taskName}
                            </div>
                          );
                        })}
                      </div>

                      {isAdminOrHr && cell.isCurrentMonth && (
                        <button
                          onClick={() => {
                            setTaskDueDate(cell.dateStr);
                            handleOpenTaskModal();
                          }}
                          className="opacity-0 hover:opacity-100 focus:opacity-100 text-[10px] text-slate-400 hover:text-emerald-600 text-center w-full transition-opacity"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CALENDAR SUB-VIEWS 2, 3, 4, 5: TABULAR LIST VIEWS */}
          {calendarSubView !== 'CALENDAR' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase">
                      <th className="p-3.5">Compliance Item</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5">Due Date</th>
                      <th className="p-3.5">Frequency</th>
                      <th className="p-3.5">Responsible Person</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredTasks.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          No compliance items found matching view criteria
                        </td>
                      </tr>
                    ) : (
                      filteredTasks.map(t => (
                        <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3.5">
                            <div className="font-extrabold text-slate-900">{t.taskName}</div>
                            {t.notes && <div className="text-[11px] text-slate-500 line-clamp-1">{t.notes}</div>}
                            {t.reminderDate && (
                              <div className="text-[10px] text-amber-700 flex items-center space-x-1 mt-0.5">
                                <Bell className="w-3 h-3" />
                                <span>Reminder set for {t.reminderDate}</span>
                              </div>
                            )}
                          </td>

                          <td className="p-3.5 font-semibold text-slate-700">{t.category}</td>

                          <td className="p-3.5 font-bold font-mono text-slate-900">
                            {t.dueDate}
                          </td>

                          <td className="p-3.5">
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-700 uppercase">
                              {t.frequency}
                            </span>
                          </td>

                          <td className="p-3.5 text-slate-800 font-medium">
                            {t.responsiblePerson}
                          </td>

                          <td className="p-3.5">
                            <div className="flex items-center space-x-1.5">
                              {getStatusBadge(t.status, t.dueDate)}

                              {/* Quick status change dropdown */}
                              {isAdminOrHr && (
                                <select
                                  value={t.status}
                                  onChange={e => handleUpdateTaskStatus(t.id, e.target.value as ComplianceStatus)}
                                  className="px-1.5 py-0.5 text-[10px] font-bold bg-white border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500"
                                >
                                  <option value="PENDING">PENDING</option>
                                  <option value="IN_PROGRESS">IN PROGRESS</option>
                                  <option value="WAITING_APPROVAL">WAITING APPROVAL</option>
                                  <option value="COMPLETED">COMPLETED</option>
                                  <option value="OVERDUE">OVERDUE</option>
                                </select>
                              )}
                            </div>
                            {t.completedAt && (
                              <div className="text-[10px] text-emerald-700 mt-0.5">
                                Completed: {new Date(t.completedAt).toLocaleDateString()} {t.completedBy ? `by ${t.completedBy}` : ''}
                              </div>
                            )}
                          </td>

                          <td className="p-3.5 text-right">
                            {isAdminOrHr && (
                              <div className="flex items-center justify-end space-x-1">
                                <button
                                  onClick={() => handleOpenTaskModal(t)}
                                  className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg transition-colors"
                                  title="Edit Task"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTask(t.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                                  title="Delete Task"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD / EDIT STATUTORY RULE                           */}
      {/* ========================================================= */}
      {showRuleModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-black text-base text-slate-900">
                  {editingRule ? 'Edit Statutory Rule' : 'Configure New Statutory Deduction'}
                </h3>
                <p className="text-xs text-slate-500">Define customizable legal parameters for payroll engine calculations</p>
              </div>
              <button onClick={() => setShowRuleModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Rule Name *</label>
                <input
                  type="text"
                  required
                  value={ruleName}
                  onChange={e => setRuleName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  placeholder="e.g. EPF Employee Contribution 12%"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category *</label>
                  <select
                    value={ruleCategory}
                    onChange={e => setRuleCategory(e.target.value as DeductionCategory)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="PF">EPF (Provident Fund)</option>
                    <option value="ESI">ESIC (Employee State Insurance)</option>
                    <option value="PROFESSIONAL_TAX">Professional Tax (PT)</option>
                    <option value="TDS">TDS (Tax Deducted at Source)</option>
                    <option value="CUSTOM">Custom Deduction</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">State / Jurisdiction *</label>
                  <select
                    value={ruleState}
                    onChange={e => setRuleState(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="All India">All India (Central)</option>
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Karnataka">Karnataka</option>
                    <option value="Tamil Nadu">Tamil Nadu</option>
                    <option value="Delhi">Delhi</option>
                    <option value="West Bengal">West Bengal</option>
                    <option value="Gujarat">Gujarat</option>
                    <option value="Telangana">Telangana</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ruleRate}
                    onChange={e => setRuleRate(e.target.value !== '' ? parseFloat(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    placeholder="12"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Fixed Amount (₹)</label>
                  <input
                    type="number"
                    value={ruleFixed}
                    onChange={e => setRuleFixed(e.target.value !== '' ? parseFloat(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    placeholder="e.g. 200"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Salary Threshold (₹)</label>
                  <input
                    type="number"
                    value={ruleThreshold}
                    onChange={e => setRuleThreshold(e.target.value !== '' ? parseFloat(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    placeholder="15000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Effective Date *</label>
                  <input
                    type="date"
                    required
                    value={ruleEffectiveDate}
                    onChange={e => setRuleEffectiveDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expiry Date (Optional)</label>
                  <input
                    type="date"
                    value={ruleExpiryDate}
                    onChange={e => setRuleExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description / Legal Reference</label>
                <textarea
                  rows={2}
                  value={ruleDescription}
                  onChange={e => setRuleDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  placeholder="e.g. EPF & MP Act 1952 standard deduction calculation guidelines..."
                ></textarea>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="ruleActiveCheck"
                  checked={ruleActive}
                  onChange={e => setRuleActive(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <label htmlFor="ruleActiveCheck" className="font-bold text-slate-800">
                  Enable and activate this statutory rule in payroll engine
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-xs"
                >
                  Save Statutory Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD / EDIT COMPLIANCE TASK                          */}
      {/* ========================================================= */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-black text-base text-slate-900">
                  {editingTask ? 'Edit Compliance Item' : 'Add Compliance Calendar Task'}
                </h3>
                <p className="text-xs text-slate-500">Track statutory return filings and legal due dates</p>
              </div>
              <button onClick={() => setShowTaskModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Compliance Name *</label>
                <input
                  type="text"
                  required
                  value={taskName}
                  onChange={e => setTaskName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  placeholder="e.g. Monthly EPF ECR Filing & Payment"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category *</label>
                  <input
                    type="text"
                    required
                    value={taskCategory}
                    onChange={e => setTaskCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    placeholder="e.g. PF Return, ESI, TDS, GST"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Frequency *</label>
                  <select
                    value={taskFrequency}
                    onChange={e => setTaskFrequency(e.target.value as ComplianceFrequency)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="HALF_YEARLY">Half-Yearly</option>
                    <option value="ANNUALLY">Annually</option>
                    <option value="ONE_TIME">One-Time</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={taskDueDate}
                    onChange={e => setTaskDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Reminder Date (Optional)</label>
                  <input
                    type="date"
                    value={taskReminderDate}
                    onChange={e => setTaskReminderDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Responsible Person *</label>
                  <select
                    value={taskResponsibleId}
                    onChange={e => {
                      const id = e.target.value;
                      setTaskResponsibleId(id);
                      const emp = employees.find(emp => emp.id === id);
                      if (emp) {
                        setTaskResponsible(`${emp.firstName} ${emp.lastName}`);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="">-- Choose Employee / HR --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.designation || 'Staff'})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Or custom title (e.g. Chief Accountant)"
                    value={taskResponsible}
                    onChange={e => setTaskResponsible(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs mt-1"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Initial Status *</label>
                  <select
                    value={taskStatus}
                    onChange={e => setTaskStatus(e.target.value as ComplianceStatus)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="IN_PROGRESS">IN PROGRESS</option>
                    <option value="WAITING_APPROVAL">WAITING APPROVAL</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="OVERDUE">OVERDUE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Notes & Filing Requirements</label>
                <textarea
                  rows={3}
                  value={taskNotes}
                  onChange={e => setTaskNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  placeholder="e.g. Generate ECR file from payroll module, upload on EPFO unified portal..."
                ></textarea>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-xs"
                >
                  Save Compliance Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
