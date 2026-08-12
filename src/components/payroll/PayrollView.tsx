import React, { useEffect, useState } from 'react';
import {
  CircleDollarSign,
  Play,
  FileText,
  Download,
  Building,
  CheckCircle2,
  Calendar,
  Settings,
  User,
  ShieldCheck,
  Plus,
  RefreshCw,
  Search,
  Check,
  Printer,
  Info,
  DollarSign,
  CreditCard,
  Building2,
  Lock,
  Layers,
  Percent,
  Sliders,
  Edit2
} from 'lucide-react';
import { hrmsApi } from '../../lib/api-client';
import {
  PayrollPeriod,
  PayrollRecord,
  SalaryStructure,
  StatutoryRule,
  Employee
, AttendanceRegularizationRequest, TimesheetCorrectionRequest, LeaveCorrectionRequest, PayrollAdjustment } from '../../types/hrms';

interface PayrollViewProps {
  userRole: string;
}

export const PayrollView: React.FC<PayrollViewProps> = ({ userRole }) => {
  const isHRorAdmin = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(userRole);

  const [activeTab, setActiveTab] = useState<'overview' | 'structures' | 'statutory' | 'records'>('overview');
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [statutoryRules, setStatutoryRules] = useState<StatutoryRule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<PayrollRecord | null>(null);

  // Filters
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [editingStructure, setEditingStructure] = useState<Partial<SalaryStructure>>({
    employeeId: '',
    basicSalary: 60000,
    hra: 24000,
    specialAllowance: 16000,
    medicalAllowance: 2500,
    conveyanceAllowance: 2500,
    otherAllowances: 0,
    bonus: 0,
    incentives: 0,
    otherDeductions: 0
  });

  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<StatutoryRule>>({
    ruleName: '',
    category: 'PF',
    state: 'All India',
    ratePercentage: 12.0,
    fixedAmount: 200,
    thresholdAmount: 15000,
    description: ''
  });

  const [showNewPeriodModal, setShowNewPeriodModal] = useState(false);
  const [newPeriodMonth, setNewPeriodMonth] = useState<number>(new Date().getMonth() + 1);
  const [newPeriodYear, setNewPeriodYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    loadAllPayrollData();
  }, []);

  const loadAllPayrollData = async () => {
    try {
      setLoading(true);
      const [perRes, recRes, rulesRes] = await Promise.all([
        hrmsApi.getPayrollPeriods(),
        hrmsApi.getPayrollRecords(),
        hrmsApi.getStatutoryRules(),
      ]);

      setPeriods(perRes || []);
      setRecords(recRes || []);
      setStatutoryRules(rulesRes || []);

      if (isHRorAdmin) {
        const [structsRes, empRes] = await Promise.all([
          hrmsApi.getSalaryStructures(),
          hrmsApi.getEmployees(),
        ]);
        setStructures(structsRes || []);
        setEmployees(empRes?.data || empRes || []);
      }
    } catch (err: any) {
      console.error('Failed to load payroll data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Process Payroll for Current Month or Selected Period
  const handleProcessPayroll = async (month?: number, year?: number, periodId?: string) => {
    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();

    setProcessing(true);
    try {
      const res = await hrmsApi.processPayroll(targetMonth, targetYear, periodId);
      alert(res.message || 'Payroll processed successfully.');
      await loadAllPayrollData();
    } catch (err: any) {
      alert(err.message || 'Failed to process payroll');
    } finally {
      setProcessing(false);
    }
  };

  // Create New Payroll Period
  const handleCreatePeriod = async () => {
    try {
      const res = await hrmsApi.createPayrollPeriod({ month: newPeriodMonth, year: newPeriodYear });
      setShowNewPeriodModal(false);
      alert(`Created payroll period '${res.name}' successfully.`);
      await loadAllPayrollData();
    } catch (err: any) {
      alert(err.message || 'Failed to create payroll period');
    }
  };

  // Save Employee Salary Structure
  const handleSaveStructure = async () => {
    if (!editingStructure.employeeId) {
      alert('Please select an employee.');
      return;
    }

    try {
      await hrmsApi.saveSalaryStructure(editingStructure);
      setShowStructureModal(false);
      alert('Salary structure updated successfully.');
      await loadAllPayrollData();
    } catch (err: any) {
      alert(err.message || 'Failed to save salary structure.');
    }
  };

  // Save Statutory Rule
  const handleSaveStatutoryRule = async () => {
    try {
      if (editingRule.id) {
        await hrmsApi.updateStatutoryRule(editingRule.id, editingRule);
      } else {
        await hrmsApi.createStatutoryRule(editingRule);
      }
      setShowRuleModal(false);
      alert('Statutory compliance rule saved successfully.');
      await loadAllPayrollData();
    } catch (err: any) {
      alert(err.message || 'Failed to save statutory rule.');
    }
  };

  // Mark Payroll Record Paid
  const handleMarkPaid = async (id: string) => {
    try {
      await hrmsApi.markPayrollRecordPaid(id);
      await loadAllPayrollData();
    } catch (err: any) {
      alert(err.message || 'Failed to update payment status.');
    }
  };

  // Reprocess Individual Record
  const handleReprocessRecord = async (id: string) => {
    try {
      await hrmsApi.reprocessPayrollRecord(id);
      alert('Payroll record reprocessed successfully.');
      await loadAllPayrollData();
    } catch (err: any) {
      alert(err.message || 'Failed to reprocess record.');
    }
  };

  // Filtered Records
  const filteredRecords = records.filter(r => {
    const matchesPeriod = selectedPeriodId === 'ALL' || r.payrollPeriodId === selectedPeriodId;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      (r.employeeName && r.employeeName.toLowerCase().includes(searchLower)) ||
      (r.employeeCode && r.employeeCode.toLowerCase().includes(searchLower)) ||
      (r.departmentName && r.departmentName.toLowerCase().includes(searchLower));
    return matchesPeriod && matchesSearch;
  });

  return (
    <div id="payroll-view-root" className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <CircleDollarSign className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-black tracking-tight">Payroll Engine & Payslip System (₹ INR)</h2>
          </div>
          <p className="text-xs text-slate-300">
            Automated Indian statutory compliance engine for EPF, ESI, Professional Tax, and Income Tax TDS.
          </p>
        </div>

        {isHRorAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowNewPeriodModal(true)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>New Pay Period</span>
            </button>

            <button
              id="btn-process-current-payroll"
              onClick={() => handleProcessPayroll()}
              disabled={processing}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-2 disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{processing ? 'Processing Payroll...' : 'Process Current Month'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center space-x-1 border-b border-slate-200 pb-1 overflow-x-auto text-xs font-bold text-slate-600">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center space-x-2 whitespace-nowrap ${
            activeTab === 'overview' ? 'bg-blue-50 text-blue-700 font-black' : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Pay Periods & Processing</span>
        </button>

        {isHRorAdmin && (
          <button
            onClick={() => setActiveTab('structures')}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'structures' ? 'bg-blue-50 text-blue-700 font-black' : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Salary Structures ({structures.length})</span>
          </button>
        )}

        {isHRorAdmin && (
          <button
            onClick={() => setActiveTab('statutory')}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'statutory' ? 'bg-blue-50 text-blue-700 font-black' : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Statutory Rules & Tax Slabs</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('records')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center space-x-2 whitespace-nowrap ${
            activeTab === 'records' ? 'bg-blue-50 text-blue-700 font-black' : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Payslip Records ({records.length})</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & PAY PERIODS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Pay Periods</span>
              <div className="text-2xl font-black text-slate-900">{periods.length} Months</div>
              <p className="text-xs text-slate-500">Historical & current pay period snapshots</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Monthly Gross Payout</span>
              <div className="text-2xl font-black text-slate-900">
                ₹ {periods.reduce((acc, p) => acc + (p.totalGrossPayout || 0), 0).toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-slate-500">Includes Basic, HRA, and Allowances</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Net Disbursed</span>
              <div className="text-2xl font-black text-emerald-700">
                ₹ {periods.reduce((acc, p) => acc + (p.totalNetPayout || 0), 0).toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-emerald-600 font-semibold">After statutory EPF, ESI, PT, and TDS deductions</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">Monthly Payroll Cycles</h3>
              {isHRorAdmin && (
                <button
                  onClick={() => setShowNewPeriodModal(true)}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold rounded-lg transition-colors flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Pay Period</span>
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-100">
              {periods.map(p => (
                <div key={p.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-black text-base text-slate-900">{p.name}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        p.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                        p.status === 'LOCKED' ? 'bg-slate-200 text-slate-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {p.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Headcount: <strong className="text-slate-800">{p.totalEmployees} employees</strong> • Processed At: {p.processedAt ? new Date(p.processedAt).toLocaleString('en-IN') : 'Pending'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Gross Earnings</span>
                      <span className="font-bold text-slate-900 text-sm">₹ {p.totalGrossPayout.toLocaleString('en-IN')}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Net Payout</span>
                      <span className="font-black text-emerald-700 text-sm">₹ {p.totalNetPayout.toLocaleString('en-IN')}</span>
                    </div>

                    {isHRorAdmin && (
                      <button
                        onClick={() => handleProcessPayroll(p.month, p.year, p.id)}
                        disabled={processing || p.status === 'LOCKED'}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${processing ? 'animate-spin' : ''}`} />
                        <span>{p.status === 'COMPLETED' ? 'Reprocess Payroll' : 'Calculate & Run'}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SALARY STRUCTURES (ADMIN / HR) */}
      {activeTab === 'structures' && isHRorAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Employee Salary Structures</h3>
            <button
              onClick={() => {
                setEditingStructure({
                  employeeId: employees[0]?.id || '',
                  basicSalary: 60000,
                  hra: 24000,
                  specialAllowance: 16000,
                  medicalAllowance: 2500,
                  conveyanceAllowance: 2500,
                  otherAllowances: 0,
                  bonus: 0,
                  incentives: 0,
                  otherDeductions: 0
                });
                setShowStructureModal(true);
              }}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Assign / Update Structure</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Basic Salary</th>
                    <th className="px-4 py-3">HRA</th>
                    <th className="px-4 py-3">Allowances</th>
                    <th className="px-4 py-3">Gross Salary</th>
                    <th className="px-4 py-3">PF (12%)</th>
                    <th className="px-4 py-3">PT (₹200)</th>
                    <th className="px-4 py-3">TDS</th>
                    <th className="px-4 py-3">Net Take-Home</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {structures.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{s.employeeName || s.employeeId}</div>
                        <div className="text-[10px] text-slate-400">{s.employeeCode} • {s.departmentName}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">₹ {s.basicSalary.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-slate-700">₹ {s.hra.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-slate-700">
                        ₹ {((s.specialAllowance || 0) + (s.medicalAllowance || 0) + (s.conveyanceAllowance || 0) + (s.otherAllowances || 0)).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">₹ {s.grossSalary.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-slate-600">₹ {s.pfEmployee}</td>
                      <td className="px-4 py-3 text-slate-600">₹ {s.professionalTax}</td>
                      <td className="px-4 py-3 text-slate-600">₹ {s.tds}</td>
                      <td className="px-4 py-3 font-black text-emerald-700">₹ {s.netSalary.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setEditingStructure(s);
                            setShowStructureModal(true);
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Structure"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STATUTORY RULES & LEGAL COMPLIANCE RATES */}
      {activeTab === 'statutory' && isHRorAdmin && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-900 flex items-start space-x-2">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Configurable Statutory Compliance Notice:</strong> Statutory rates (PF %, ESI %, PT slabs, TDS brackets) are configurable by authorized administrators to align with regional state rules and organization tax policies. Do not assume automatic statutory compliance without verifying applicable state amendments.
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Configured Statutory & Tax Rules</h3>
            <button
              onClick={() => {
                setEditingRule({
                  ruleName: '',
                  category: 'PF',
                  state: 'All India',
                  ratePercentage: 12.0,
                  fixedAmount: 0,
                  thresholdAmount: 15000,
                  active: true,
                  description: ''
                });
                setShowRuleModal(true);
              }}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Statutory Rule</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {statutoryRules.map(rule => (
              <div key={rule.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-slate-900">{rule.ruleName}</span>
                    <span className="text-[10px] text-slate-400 block">{rule.category} • {rule.state}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${rule.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                    {rule.active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>

                <p className="text-xs text-slate-600">{rule.description}</p>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl">
                  <div>Rate Percentage: <strong className="text-slate-900">{rule.ratePercentage}%</strong></div>
                  <div>Threshold Limit: <strong className="text-slate-900">₹ {rule.thresholdAmount.toLocaleString('en-IN')}</strong></div>
                  {rule.fixedAmount !== undefined && (
                    <div>Fixed Deduct Amount: <strong className="text-slate-900">₹ {rule.fixedAmount}</strong></div>
                  )}
                  <div>Effective Date: <strong className="text-slate-900">{rule.effectiveDate}</strong></div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => {
                      setEditingRule(rule);
                      setShowRuleModal(true);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center space-x-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Rule Settings</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: PAYSLIP RECORDS */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <select
                value={selectedPeriodId}
                onChange={e => setSelectedPeriodId(e.target.value)}
                className="bg-white border border-slate-200 text-xs font-bold text-slate-700 px-3 py-2 rounded-xl"
              >
                <option value="ALL">All Pay Periods</option>
                {periods.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by name, code, dept..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 pl-9 pr-3 py-2 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 font-bold text-sm text-slate-900 flex items-center justify-between">
              <span>Monthly Payslip Statements</span>
              <span className="text-xs text-slate-400 font-normal">Showing {filteredRecords.length} records</span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading payslip records...</div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No payslips found for selected filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                    <tr>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Attendance</th>
                      <th className="px-4 py-3">Gross Earnings</th>
                      <th className="px-4 py-3">Total Deductions</th>
                      <th className="px-4 py-3">Net Salary</th>
                      <th className="px-4 py-3">Payment Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRecords.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{r.employeeName || r.employeeId}</div>
                          <div className="text-[10px] text-slate-400">{r.employeeCode} • {r.departmentName}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-800 font-semibold">{r.presentDays}/{r.workingDays} days</span>
                          {r.lossOfPayDays > 0 && (
                            <span className="block text-[10px] text-red-600 font-bold">({r.lossOfPayDays} LOP)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          ₹ {r.grossEarnings.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 font-semibold text-red-600">
                          ₹ {r.totalDeductions.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 font-black text-emerald-700">
                          ₹ {r.netSalary.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            r.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => setSelectedPayslip(r)}
                              className="px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-lg transition-colors flex items-center space-x-1"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>View Payslip</span>
                            </button>

                            {isHRorAdmin && r.status !== 'PAID' && (
                              <button
                                onClick={() => handleMarkPaid(r.id)}
                                className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold rounded-lg transition-colors flex items-center space-x-1"
                                title="Mark as Paid"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Mark Paid</span>
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
        </div>
      )}

      {/* MODAL: PAYSLIP STATEMENT VIEW & DOWNLOAD */}
      {selectedPayslip && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 my-8">
            {/* Payslip Header */}
            <div className="border-b border-slate-200 pb-4 flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <Building className="w-5 h-5 text-blue-600" />
                  <h3 className="font-black text-lg text-slate-900 tracking-tight">THEIAKSHI ENTERPRISE</h3>
                </div>
                <p className="text-xs text-slate-500">Official Monthly Salary Statement (₹ INR)</p>
              </div>

              <button
                onClick={() => setSelectedPayslip(null)}
                className="p-1 text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Employee Profile & Bank Details */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">EMPLOYEE NAME</span>
                <strong className="text-slate-900">{selectedPayslip.employeeName || selectedPayslip.employeeId}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">EMPLOYEE CODE</span>
                <strong className="text-slate-900">{selectedPayslip.employeeCode}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">DEPARTMENT</span>
                <strong className="text-slate-900">{selectedPayslip.departmentName}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">BANK ACCOUNT</span>
                <strong className="text-slate-900">{selectedPayslip.accountNumber} ({selectedPayslip.bankName})</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">PAN NUMBER</span>
                <strong className="text-slate-900">{selectedPayslip.panNumber}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">UAN / PF NO.</span>
                <strong className="text-slate-900">{selectedPayslip.uanNumber}</strong>
              </div>
            </div>

            {/* Attendance Days */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs bg-blue-50/50 p-3 rounded-xl border border-blue-100">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Working Days</span>
                <strong className="text-slate-900">{selectedPayslip.workingDays}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Present Days</span>
                <strong className="text-emerald-700">{selectedPayslip.presentDays}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Paid Leave</span>
                <strong className="text-blue-700">{selectedPayslip.paidLeaveDays}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Loss of Pay (LOP)</span>
                <strong className="text-red-600">{selectedPayslip.lossOfPayDays}</strong>
              </div>
            </div>

            {/* Earnings & Deductions Tables */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Earnings */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">EARNINGS BREAKDOWN</span>
                <div className="space-y-1.5 text-slate-700">
                  <div className="flex justify-between"><span>Basic Salary:</span><strong className="text-slate-900">₹ {selectedPayslip.basicSalary.toLocaleString('en-IN')}</strong></div>
                  <div className="flex justify-between"><span>House Rent Allowance (HRA):</span><strong className="text-slate-900">₹ {selectedPayslip.hra.toLocaleString('en-IN')}</strong></div>
                  <div className="flex justify-between"><span>Special Allowances:</span><strong className="text-slate-900">₹ {selectedPayslip.allowances.toLocaleString('en-IN')}</strong></div>
                  {selectedPayslip.bonus > 0 && <div className="flex justify-between"><span>Bonus:</span><strong className="text-slate-900">₹ {selectedPayslip.bonus.toLocaleString('en-IN')}</strong></div>}
                  {selectedPayslip.incentives > 0 && <div className="flex justify-between"><span>Incentives:</span><strong className="text-slate-900">₹ {selectedPayslip.incentives.toLocaleString('en-IN')}</strong></div>}
                  <div className="flex justify-between border-t border-slate-200 pt-2 font-black text-slate-900">
                    <span>Gross Earnings:</span>
                    <span>₹ {selectedPayslip.grossEarnings.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">STATUTORY DEDUCTIONS</span>
                <div className="space-y-1.5 text-slate-700">
                  <div className="flex justify-between"><span>Employees Provident Fund (EPF):</span><strong className="text-slate-900">₹ {selectedPayslip.pfDeduction.toLocaleString('en-IN')}</strong></div>
                  <div className="flex justify-between"><span>Employees State Insurance (ESI):</span><strong className="text-slate-900">₹ {selectedPayslip.esiDeduction.toLocaleString('en-IN')}</strong></div>
                  <div className="flex justify-between"><span>Professional Tax (PT):</span><strong className="text-slate-900">₹ {selectedPayslip.ptDeduction.toLocaleString('en-IN')}</strong></div>
                  <div className="flex justify-between"><span>Income Tax (TDS):</span><strong className="text-slate-900">₹ {selectedPayslip.tdsDeduction.toLocaleString('en-IN')}</strong></div>
                  {selectedPayslip.otherDeductions > 0 && <div className="flex justify-between"><span>Other Deductions:</span><strong className="text-slate-900">₹ {selectedPayslip.otherDeductions.toLocaleString('en-IN')}</strong></div>}
                  <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-red-600">
                    <span>Total Deductions:</span>
                    <span>₹ {selectedPayslip.totalDeductions.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Salary Summary */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
              <div>
                <span className="font-bold text-emerald-900 text-sm block">NET TAKE-HOME DISBURSED</span>
                <span className="text-[10px] text-emerald-700">Transferred via Direct Bank NEFT/RTGS</span>
              </div>
              <span className="font-black text-emerald-800 text-2xl">₹ {selectedPayslip.netSalary.toLocaleString('en-IN')}</span>
            </div>

            {/* Calculation Breakdown Note */}
            {selectedPayslip.calculationBreakdown && (
              <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <strong>Calculation Note:</strong> {selectedPayslip.calculationBreakdown.notes || 'Full attendance verified.'} Basic Daily Rate: ₹ {selectedPayslip.calculationBreakdown.dailyBasicRate}/day.
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <span className="text-[10px] text-slate-400">Computer generated payslip statement. No physical signature required.</span>
              <div className="flex space-x-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl flex items-center space-x-2 text-xs shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print / Export PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN / EDIT SALARY STRUCTURE */}
      {showStructureModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-base text-slate-900">Salary Structure Configurator</h3>
              <button onClick={() => setShowStructureModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Employee</label>
                <select
                  value={editingStructure.employeeId}
                  onChange={e => setEditingStructure({ ...editingStructure, employeeId: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-800"
                >
                  <option value="">Select Employee</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Basic Salary (₹)</label>
                  <input
                    type="number"
                    value={editingStructure.basicSalary || ''}
                    onChange={e => setEditingStructure({ ...editingStructure, basicSalary: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-xl p-2.5"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">HRA (₹)</label>
                  <input
                    type="number"
                    value={editingStructure.hra || ''}
                    onChange={e => setEditingStructure({ ...editingStructure, hra: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-xl p-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Special Allowance (₹)</label>
                  <input
                    type="number"
                    value={editingStructure.specialAllowance || ''}
                    onChange={e => setEditingStructure({ ...editingStructure, specialAllowance: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-xl p-2.5"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Medical Allowance (₹)</label>
                  <input
                    type="number"
                    value={editingStructure.medicalAllowance || 0}
                    onChange={e => setEditingStructure({ ...editingStructure, medicalAllowance: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-xl p-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Conveyance (₹)</label>
                  <input
                    type="number"
                    value={editingStructure.conveyanceAllowance || 0}
                    onChange={e => setEditingStructure({ ...editingStructure, conveyanceAllowance: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-xl p-2.5"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Other Allowances (₹)</label>
                  <input
                    type="number"
                    value={editingStructure.otherAllowances || 0}
                    onChange={e => setEditingStructure({ ...editingStructure, otherAllowances: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-xl p-2.5"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Estimated Gross Salary</span>
                <span className="text-base font-black text-slate-900">
                  ₹ {(
                    (editingStructure.basicSalary || 0) +
                    (editingStructure.hra || 0) +
                    (editingStructure.specialAllowance || 0) +
                    (editingStructure.medicalAllowance || 0) +
                    (editingStructure.conveyanceAllowance || 0) +
                    (editingStructure.otherAllowances || 0)
                  ).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
              <button onClick={() => setShowStructureModal(false)} className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl text-xs">
                Cancel
              </button>
              <button onClick={handleSaveStructure} className="px-4 py-2 font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs shadow-xs">
                Save Structure
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT STATUTORY RULE */}
      {showRuleModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-base text-slate-900">Statutory Rule Configurator</h3>
              <button onClick={() => setShowRuleModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Rule Name</label>
                <input
                  type="text"
                  value={editingRule.ruleName || ''}
                  onChange={e => setEditingRule({ ...editingRule, ruleName: e.target.value })}
                  placeholder="e.g. EPF Amendment 2026"
                  className="w-full border border-slate-200 rounded-xl p-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={editingRule.category}
                    onChange={e => setEditingRule({ ...editingRule, category: e.target.value as any })}
                    className="w-full border border-slate-200 rounded-xl p-2.5"
                  >
                    <option value="PF">PF (Provident Fund)</option>
                    <option value="ESI">ESI (State Insurance)</option>
                    <option value="PROFESSIONAL_TAX">Professional Tax</option>
                    <option value="TDS">Income Tax TDS</option>
                    <option value="OTHER">Other Statutory</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Rate Percentage (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingRule.ratePercentage || 0}
                    onChange={e => setEditingRule({ ...editingRule, ratePercentage: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-xl p-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Threshold Amount (₹)</label>
                  <input
                    type="number"
                    value={editingRule.thresholdAmount || 0}
                    onChange={e => setEditingRule({ ...editingRule, thresholdAmount: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-xl p-2.5"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Fixed Amount (₹)</label>
                  <input
                    type="number"
                    value={editingRule.fixedAmount || 0}
                    onChange={e => setEditingRule({ ...editingRule, fixedAmount: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-xl p-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description / Legal Reference</label>
                <textarea
                  value={editingRule.description || ''}
                  onChange={e => setEditingRule({ ...editingRule, description: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs h-20"
                ></textarea>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
              <button onClick={() => setShowRuleModal(false)} className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl text-xs">
                Cancel
              </button>
              <button onClick={handleSaveStatutoryRule} className="px-4 py-2 font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs shadow-xs">
                Save Statutory Rule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE PAY PERIOD */}
      {showNewPeriodModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-base text-slate-900">Create New Pay Period</h3>
              <button onClick={() => setShowNewPeriodModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Month</label>
                <select
                  value={newPeriodMonth}
                  onChange={e => setNewPeriodMonth(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-xl p-2.5 font-bold"
                >
                  <option value={1}>January</option>
                  <option value={2}>February</option>
                  <option value={3}>March</option>
                  <option value={4}>April</option>
                  <option value={5}>May</option>
                  <option value={6}>June</option>
                  <option value={7}>July</option>
                  <option value={8}>August</option>
                  <option value={9}>September</option>
                  <option value={10}>October</option>
                  <option value={11}>November</option>
                  <option value={12}>December</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Year</label>
                <input
                  type="number"
                  value={newPeriodYear}
                  onChange={e => setNewPeriodYear(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-xl p-2.5 font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
              <button onClick={() => setShowNewPeriodModal(false)} className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl text-xs">
                Cancel
              </button>
              <button onClick={handleCreatePeriod} className="px-4 py-2 font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs shadow-xs">
                Create Period
              </button>
            </div>
          </div>
        </div>
      )}
    
      {/* PHASE 14 INJECTIONS */}
      <div className="mt-8 p-4 bg-purple-50 border border-purple-200 rounded-xl">
        <h3 className="font-bold text-purple-900">Phase 14 Actions (PayrollAdjustment)</h3>
        <div className="flex flex-col space-y-4 mt-2">
          {!['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(userRole) && (
            <div className="flex flex-col space-y-2">
              <button onClick={async () => {
                try {
                  const reason = prompt('Enter reason for correction:');
                  if (!reason) return;
                  // Just a placeholder mock call waiting for backend
                  await hrmsApi.createPayrollAdjustment({ reason } as any);
                  alert('Requested successfully');
                  window.location.reload(); // Refresh local data
                } catch (e) {
                  alert('Error: ' + e);
                }
              }} className="px-4 py-2 bg-purple-600 text-white rounded w-max">
                Request Correction / Regularization
              </button>
            </div>
          )}
          {['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(userRole) && (
            <div className="flex flex-col space-y-2 border p-4 bg-white rounded">
              <h4 className="font-bold">Pending Approvals</h4>
              <div className="flex space-x-2">
                <button onClick={async () => {
                  try {
                    const reqs = await hrmsApi.getPayrollAdjustments();
                    console.log(reqs);
                    alert('Loaded ' + (reqs.data?.length || 0) + ' requests');
                  } catch(e) {
                    alert('Error: ' + e);
                  }
                }} className="px-4 py-2 bg-indigo-600 text-white rounded w-max">
                  Load Approvals Tab
                </button>
                <button onClick={async () => {
                  try {
                    const id = prompt('Enter ID to approve:');
                    if (!id) return;
                    await hrmsApi.approvePayrollAdjustment(id);
                    alert('Approved');
                    window.location.reload();
                  } catch(e) { alert('Error: ' + e); }
                }} className="px-4 py-2 bg-emerald-600 text-white rounded w-max">
                  Approve Request
                </button>
                <button onClick={async () => {
                  try {
                    const id = prompt('Enter ID to reject:');
                    if (!id) return;
                    const reason = prompt('Enter rejection reason:');
                    if (!reason) return;
                    await hrmsApi.rejectPayrollAdjustment(id, reason);
                    alert('Rejected');
                    window.location.reload();
                  } catch(e) { alert('Error: ' + e); }
                }} className="px-4 py-2 bg-red-600 text-white rounded w-max">
                  Reject Request
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
</div>
  );
};

