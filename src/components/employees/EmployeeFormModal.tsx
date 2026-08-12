import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Briefcase,
  DollarSign,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Building2,
  ShieldAlert
} from 'lucide-react';
import { hrmsApi } from '../../lib/api-client';
import { Employee } from '../../types/hrms';

interface EmployeeFormModalProps {
  employee?: Employee | null; // Null if creating
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({
  employee,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'BASIC' | 'WORK' | 'FINANCIAL' | 'PERSONAL'>('BASIC');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Meta dropdown choices
  const [meta, setMeta] = useState<{
    branches: any[];
    departments: any[];
    designations: any[];
    shifts: any[];
    managers: any[];
  }>({
    branches: [],
    departments: [],
    designations: [],
    shifts: [],
    managers: []
  });

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    profilePhoto: '',
    dateOfBirth: '1995-05-15',
    gender: 'MALE',
    employeeCode: '',
    departmentId: '',
    designationId: '',
    branchId: '',
    managerId: '',
    shiftId: '',
    joiningDate: new Date().toISOString().split('T')[0],
    employmentType: 'FULL_TIME',
    status: 'ACTIVE',
    workLocation: 'Bengaluru HQ',
    role: 'EMPLOYEE',
    basicSalary: 60000,
    hra: 24000,
    allowances: 16000,
    bankName: 'HDFC Bank',
    accountNumber: '50100987654321',
    ifscCode: 'HDFC0001234',
    panNumber: 'ABCDE1234F',
    uanNumber: '100987654321',
    pfNumber: 'KA/BAN/0012345/000/00001',
    esiNumber: '31001234567890',
    address: '100 Feet Road, Indiranagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    emergencyContactName: 'Ramesh Kumar',
    emergencyContactPhone: '+91 98765 43210'
  });

  useEffect(() => {
    if (isOpen) {
      loadMeta();
      if (employee) {
        setFormData({
          firstName: employee.firstName || '',
          lastName: employee.lastName || '',
          email: employee.email || '',
          phone: employee.phone || '',
          profilePhoto: employee.profilePhoto || '',
          dateOfBirth: employee.dateOfBirth || '1995-05-15',
          gender: employee.gender || 'MALE',
          employeeCode: employee.employeeCode || '',
          departmentId: employee.departmentId || '',
          designationId: employee.designationId || '',
          branchId: employee.branchId || '',
          managerId: employee.managerId || '',
          shiftId: employee.shiftId || '',
          joiningDate: employee.joiningDate || new Date().toISOString().split('T')[0],
          employmentType: employee.employmentType || 'FULL_TIME',
          status: employee.status || 'ACTIVE',
          workLocation: employee.workLocation || 'Bengaluru HQ',
          role: 'EMPLOYEE',
          basicSalary: employee.basicSalary || 0,
          hra: employee.hra || 0,
          allowances: employee.allowances || 0,
          bankName: employee.bankName || 'HDFC Bank',
          accountNumber: employee.accountNumber || '',
          ifscCode: employee.ifscCode || '',
          panNumber: employee.panNumber || '',
          uanNumber: employee.uanNumber || '',
          pfNumber: employee.pfNumber || '',
          esiNumber: employee.esiNumber || '',
          address: employee.address || '',
          city: employee.city || 'Bengaluru',
          state: employee.state || 'Karnataka',
          country: employee.country || 'India',
          emergencyContactName: employee.emergencyContactName || '',
          emergencyContactPhone: employee.emergencyContactPhone || ''
        });
      } else {
        // Clear or default for new employee
        setFormData(prev => ({
          ...prev,
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          employeeCode: ''
        }));
      }
    }
  }, [isOpen, employee]);

  const loadMeta = async () => {
    try {
      const data = await hrmsApi.getOrganizationMeta();
      setMeta(data);
      // Auto-set default IDs if creating
      if (!employee) {
        setFormData(prev => ({
          ...prev,
          departmentId: prev.departmentId || data.departments[0]?.id || '',
          designationId: prev.designationId || data.designations[0]?.id || '',
          branchId: prev.branchId || data.branches[0]?.id || '',
          shiftId: prev.shiftId || data.shifts[0]?.id || ''
        }));
      }
    } catch (err: any) {
      console.warn('Failed to load org meta:', err.message);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim()) {
        throw new Error('First Name, Last Name, and Official Email are required fields');
      }

      if (employee) {
        await hrmsApi.updateEmployee(employee.id, formData);
      } else {
        await hrmsApi.createEmployee(formData);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const grossSalary = Number(formData.basicSalary) + Number(formData.hra) + Number(formData.allowances);

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-xs">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">
                {employee ? `Edit Employee Profile — ${employee.employeeCode}` : 'Create New Employee Record'}
              </h3>
              <p className="text-xs text-slate-400">
                THEIAKSHI ENTERPRISE • Enterprise Workforce Registry
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-6 pt-3 space-x-1 text-xs font-bold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('BASIC')}
            className={`px-4 py-2.5 rounded-t-xl border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'BASIC'
                ? 'border-blue-600 text-blue-600 bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <User className="w-4 h-4" />
            <span>1. Basic Information</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('WORK')}
            className={`px-4 py-2.5 rounded-t-xl border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'WORK'
                ? 'border-blue-600 text-blue-600 bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>2. Work & Role</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('FINANCIAL')}
            className={`px-4 py-2.5 rounded-t-xl border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'FINANCIAL'
                ? 'border-blue-600 text-blue-600 bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>3. Salary & Bank (₹)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PERSONAL')}
            className={`px-4 py-2.5 rounded-t-xl border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'PERSONAL'
                ? 'border-blue-600 text-blue-600 bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>4. Address & Emergency</span>
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: BASIC INFORMATION */}
          {activeTab === 'BASIC' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Ananya"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Sharma"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Official Email Address *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., ananya.sharma@theiakshi.com"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={e => setFormData({ ...formData, gender: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Profile Photo URL</label>
                <input
                  type="url"
                  value={formData.profilePhoto}
                  onChange={e => setFormData({ ...formData, profilePhoto: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://images.unsplash.com/photo-..."
                />
              </div>
            </div>
          )}

          {/* TAB 2: WORK & LOCATION */}
          {activeTab === 'WORK' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Employee Code</label>
                  <input
                    type="text"
                    value={formData.employeeCode}
                    onChange={e => setFormData({ ...formData, employeeCode: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Auto-generated if empty (e.g., TE-1005)"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department *</label>
                  <select
                    required
                    value={formData.departmentId}
                    onChange={e => setFormData({ ...formData, departmentId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Department</option>
                    {meta.departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Designation</label>
                  <select
                    value={formData.designationId}
                    onChange={e => setFormData({ ...formData, designationId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Designation</option>
                    {meta.designations.map(d => (
                      <option key={d.id} value={d.id}>{d.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Branch Location</label>
                  <select
                    value={formData.branchId}
                    onChange={e => setFormData({ ...formData, branchId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Branch</option>
                    {meta.branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.city})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Reporting Manager</label>
                  <select
                    value={formData.managerId}
                    onChange={e => setFormData({ ...formData, managerId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">None (Top Level Manager)</option>
                    {meta.managers.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Work Shift</label>
                  <select
                    value={formData.shiftId}
                    onChange={e => setFormData({ ...formData, shiftId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {meta.shifts.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.startTime} - {s.endTime})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Joining Date</label>
                  <input
                    type="date"
                    value={formData.joiningDate}
                    onChange={e => setFormData({ ...formData, joiningDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Employment Type</label>
                  <select
                    value={formData.employmentType}
                    onChange={e => setFormData({ ...formData, employmentType: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="FULL_TIME">Full-Time Regular</option>
                    <option value="CONTRACT">Contractor</option>
                    <option value="INTERN">Intern</option>
                    <option value="PART_TIME">Part-Time</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="PROBATION">PROBATION</option>
                    <option value="TERMINATED">TERMINATED</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FINANCIAL & BANK DETAILS */}
          {activeTab === 'FINANCIAL' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-900 rounded-2xl text-white flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Estimated Monthly Gross</span>
                  <div className="text-xl font-black text-emerald-400">
                    ₹ {grossSalary.toLocaleString('en-IN')}<span className="text-xs text-slate-400 font-normal"> / month</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Estimated CTC</span>
                  <div className="text-sm font-bold text-white">
                    ₹ {(grossSalary * 12).toLocaleString('en-IN')}<span className="text-xs text-slate-400 font-normal"> / year</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Basic Salary (₹)</label>
                  <input
                    type="number"
                    value={formData.basicSalary}
                    onChange={e => setFormData({ ...formData, basicSalary: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">House Rent Allowance (HRA) (₹)</label>
                  <input
                    type="number"
                    value={formData.hra}
                    onChange={e => setFormData({ ...formData, hra: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Special Allowances (₹)</label>
                  <input
                    type="number"
                    value={formData.allowances}
                    onChange={e => setFormData({ ...formData, allowances: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="HDFC Bank"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={formData.accountNumber}
                    onChange={e => setFormData({ ...formData, accountNumber: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="501009876543"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={formData.ifscCode}
                    onChange={e => setFormData({ ...formData, ifscCode: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="HDFC0001234"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">PAN Card Number</label>
                  <input
                    type="text"
                    value={formData.panNumber}
                    onChange={e => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                    placeholder="ABCDE1234F"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">UAN Number (PF)</label>
                  <input
                    type="text"
                    value={formData.uanNumber}
                    onChange={e => setFormData({ ...formData, uanNumber: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="100987654321"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ADDRESS & EMERGENCY */}
          {activeTab === 'PERSONAL' && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Residential Address</label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Street Address, Apartment/Suite"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={e => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={e => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 mt-2">
                <h4 className="font-extrabold text-slate-900 text-xs mb-3 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  Emergency Contact Contact Info
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Emergency Contact Person Name</label>
                    <input
                      type="text"
                      value={formData.emergencyContactName}
                      onChange={e => setFormData({ ...formData, emergencyContactName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Ramesh Kumar"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Emergency Contact Phone</label>
                    <input
                      type="text"
                      value={formData.emergencyContactPhone}
                      onChange={e => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-bold text-slate-600 hover:text-slate-900 text-xs"
          >
            Cancel
          </button>

          <div className="flex items-center space-x-2">
            {activeTab !== 'BASIC' && (
              <button
                type="button"
                onClick={() => {
                  if (activeTab === 'WORK') setActiveTab('BASIC');
                  if (activeTab === 'FINANCIAL') setActiveTab('WORK');
                  if (activeTab === 'PERSONAL') setActiveTab('FINANCIAL');
                }}
                className="px-4 py-2 border border-slate-300 font-bold text-slate-700 rounded-xl hover:bg-slate-100 text-xs transition-all"
              >
                Previous Step
              </button>
            )}

            {activeTab !== 'PERSONAL' ? (
              <button
                type="button"
                onClick={() => {
                  if (activeTab === 'BASIC') setActiveTab('WORK');
                  if (activeTab === 'WORK') setActiveTab('FINANCIAL');
                  if (activeTab === 'FINANCIAL') setActiveTab('PERSONAL');
                }}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 font-bold text-white rounded-xl text-xs shadow-xs transition-all"
              >
                Next Step →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 font-bold text-white rounded-xl text-xs shadow-xs transition-all flex items-center space-x-2"
              >
                {loading ? <span>Saving...</span> : <span>{employee ? 'Save Profile Changes' : 'Create Employee Record'}</span>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
