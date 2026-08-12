import React, { useEffect, useState } from 'react';
import {
  User,
  X,
  Mail,
  Phone,
  Building2,
  MapPin,
  Calendar,
  Briefcase,
  DollarSign,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ShieldCheck,
  Edit,
  ArrowLeft,
  Camera,
  Trash2,
  RefreshCw,
  Folder,
  History,
  CreditCard,
  Building
} from 'lucide-react';

import { DocumentsView } from '../documents/DocumentsView';
import { hrmsApi } from '../../lib/api-client';
import { Employee } from '../../types/hrms';

interface EmployeeProfileViewProps {
  employeeId: string;
  userRole: string;
  onBack: () => void;
  onEdit: (emp: Employee) => void;
  onRefresh: () => void;
}

export const EmployeeProfileView: React.FC<EmployeeProfileViewProps> = ({
  employeeId,
  userRole,
  onBack,
  onEdit,
  onRefresh
}) => {
  const [employee, setEmployee] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    | 'OVERVIEW'
    | 'PERSONAL'
    | 'EMPLOYMENT'
    | 'ATTENDANCE'
    | 'LEAVE'
    | 'EXPENSES'
    | 'TIMESHEETS'
    | 'DOCUMENTS'
    | 'PAYROLL'
    | 'ACTIVITY'
  >('OVERVIEW');

  // Photo upload modal state
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [photoLoading, setPhotoLoading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [employeeId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await hrmsApi.getEmployee(employeeId);
      setEmployee(data);
      if (data.profilePhoto) setPhotoUrlInput(data.profilePhoto);
    } catch (err: any) {
      setError(err.message || 'Failed to load employee profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoUrlInput.trim()) return;
    try {
      setPhotoLoading(true);
      await hrmsApi.uploadEmployeePhoto(employeeId, photoUrlInput.trim());
      setShowPhotoModal(false);
      loadProfile();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update photo');
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!window.confirm(`Are you sure you want to soft delete employee ${employee.employeeCode}?`)) return;
    try {
      await hrmsApi.deleteEmployee(employeeId);
      alert(`Employee ${employee.employeeCode} has been soft-deleted.`);
      onRefresh();
      onBack();
    } catch (err: any) {
      alert(err.message || 'Failed to soft delete employee');
    }
  };

  const handleRestore = async () => {
    try {
      await hrmsApi.restoreEmployee(employeeId);
      alert(`Employee ${employee.employeeCode} has been restored successfully.`);
      loadProfile();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to restore employee');
    }
  };

  const canManage = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(userRole);

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-slate-500 font-medium">
        Loading employee profile details...
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-2xl text-center space-y-4">
        <AlertCircle className="w-8 h-8 text-red-600 mx-auto" />
        <h3 className="font-extrabold text-sm text-red-900">Unable to load employee profile</h3>
        <p className="text-xs text-red-700">{error || 'Record not found or authorization denied.'}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800"
        >
          Return to Directory
        </button>
      </div>
    );
  }

  const grossMonthly = (employee.basicSalary || 0) + (employee.hra || 0) + (employee.allowances || 0);

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3.5 py-2 rounded-xl shadow-xs transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Directory</span>
        </button>

        <div className="flex items-center space-x-2">
          {canManage && (
            <>
              {employee.deletedAt ? (
                <button
                  onClick={handleRestore}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Restore Employee</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => onEdit(employee)}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 transition-all"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </button>

                  <button
                    onClick={handleSoftDelete}
                    className="px-3.5 py-2 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Soft Delete</span>
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Hero Profile Header Banner */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        {employee.deletedAt && (
          <div className="mb-4 p-2.5 bg-red-950/80 border border-red-800 rounded-xl text-red-200 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span>THIS RECORD IS SOFT-DELETED (Inactivated)</span>
          </div>
        )}

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center space-x-4">
            <div className="relative group">
              {employee.profilePhoto ? (
                <img
                  src={employee.profilePhoto}
                  alt={`${employee.firstName} ${employee.lastName}`}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-700 shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-2xl flex items-center justify-center border-2 border-slate-700 shadow-lg uppercase">
                  {employee.firstName[0]}
                  {employee.lastName[0]}
                </div>
              )}

              <button
                onClick={() => setShowPhotoModal(true)}
                className="absolute -bottom-1 -right-1 bg-blue-600 hover:bg-blue-500 text-white p-1.5 rounded-lg shadow-md transition-all"
                title="Update Profile Photo"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-black tracking-tight text-white">
                  {employee.firstName} {employee.lastName}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                    employee.status === 'ACTIVE'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {employee.status}
                </span>
              </div>

              <p className="text-xs text-blue-400 font-bold flex items-center gap-2">
                <span>{employee.designationName || 'Team Member'}</span>
                <span>•</span>
                <span className="text-slate-300 font-mono">{employee.employeeCode}</span>
              </p>

              <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  {employee.email}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  {employee.phone || 'No phone'}
                </span>
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  {employee.departmentName}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  {employee.workLocation}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 min-w-[200px] text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gross Compensation</span>
            <div className="text-lg font-black text-emerald-400">
              ₹ {grossMonthly.toLocaleString('en-IN')}<span className="text-xs text-slate-400 font-normal"> /mo</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Joined {employee.joiningDate || 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Comprehensive Profile Navigation Bar */}
      <div className="flex items-center space-x-1 border-b border-slate-200 bg-white p-1 rounded-2xl shadow-xs overflow-x-auto text-xs font-bold">
        {[
          { id: 'OVERVIEW', label: 'Overview', icon: User },
          { id: 'PERSONAL', label: 'Personal Info', icon: FileText },
          { id: 'EMPLOYMENT', label: 'Employment', icon: Briefcase },
          { id: 'ATTENDANCE', label: 'Attendance', icon: Clock },
          { id: 'LEAVE', label: 'Leave', icon: Calendar },
          { id: 'EXPENSES', label: 'Expenses', icon: CreditCard },
          { id: 'TIMESHEETS', label: 'Timesheets', icon: Clock },
          { id: 'DOCUMENTS', label: 'Documents', icon: Folder },
          { id: 'PAYROLL', label: 'Payroll & Compensation', icon: DollarSign },
          { id: 'ACTIVITY', label: 'Activity Log', icon: History }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Profile Tab Contents */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs min-h-[350px]">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'OVERVIEW' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
            <div className="md:col-span-2 space-y-6">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  Primary Profile Snapshot
                </h4>
                <div className="grid grid-cols-2 gap-4 text-slate-600">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Official Name</span>
                    <strong className="text-slate-900 text-sm">{employee.firstName} {employee.lastName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Employee ID Code</span>
                    <strong className="text-slate-900 text-sm font-mono">{employee.employeeCode}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Department</span>
                    <strong className="text-slate-900">{employee.departmentName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Designation</span>
                    <strong className="text-slate-900">{employee.designationName}</strong>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  Reporting & Organizational Structure
                </h4>
                <div className="grid grid-cols-2 gap-4 text-slate-600">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Reporting Manager</span>
                    <strong className="text-slate-900">{employee.managerName || 'Direct Executive'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Branch Office</span>
                    <strong className="text-slate-900">{employee.branchName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Work Shift</span>
                    <strong className="text-slate-900">{employee.shiftName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Employment Type</span>
                    <strong className="text-slate-900">{employee.employmentType}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-slate-900 rounded-2xl p-5 text-white space-y-3">
                <h4 className="font-extrabold text-xs text-white uppercase tracking-wider">Salary & Compensation</h4>
                <div className="space-y-2 border-t border-slate-800 pt-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Basic Pay</span>
                    <span className="font-bold">₹ {(employee.basicSalary || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">HRA</span>
                    <span className="font-bold">₹ {(employee.hra || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Special Allowances</span>
                    <span className="font-bold">₹ {(employee.allowances || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-2 text-emerald-400 font-black text-sm">
                    <span>Gross Monthly</span>
                    <span>₹ {grossMonthly.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-2">
                <h4 className="font-bold text-slate-900 text-xs">Emergency Contact</h4>
                <div className="text-slate-700 font-semibold">{employee.emergencyContactName || 'N/A'}</div>
                <div className="text-slate-500 font-mono text-[11px]">{employee.emergencyContactPhone || 'N/A'}</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PERSONAL INFORMATION */}
        {activeTab === 'PERSONAL' && (
          <div className="space-y-6 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <h4 className="font-extrabold text-slate-900 text-xs">Personal Details</h4>
                <div className="space-y-2 text-slate-600">
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>Full Name:</span>
                    <strong className="text-slate-900">{employee.firstName} {employee.lastName}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>Date of Birth:</span>
                    <strong className="text-slate-900">{employee.dateOfBirth || 'N/A'}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>Gender:</span>
                    <strong className="text-slate-900">{employee.gender || 'N/A'}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>Official Email:</span>
                    <strong className="text-slate-900">{employee.email}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>Phone Number:</span>
                    <strong className="text-slate-900">{employee.phone || 'N/A'}</strong>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <h4 className="font-extrabold text-slate-900 text-xs">Address & Location</h4>
                <div className="space-y-2 text-slate-600">
                  <div className="py-1 border-b border-slate-200/60">
                    <span className="block text-slate-400 text-[10px]">Street Address:</span>
                    <strong className="text-slate-900">{employee.address || 'N/A'}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>City:</span>
                    <strong className="text-slate-900">{employee.city || 'Bengaluru'}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>State:</span>
                    <strong className="text-slate-900">{employee.state || 'Karnataka'}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>Country:</span>
                    <strong className="text-slate-900">{employee.country || 'India'}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
              <h4 className="font-extrabold text-slate-900 text-xs">Statutory Identification Cards</h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-slate-600">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">PAN Card Number</span>
                  <strong className="text-slate-900 font-mono text-sm">{employee.panNumber || 'N/A'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">UAN (PF Number)</span>
                  <strong className="text-slate-900 font-mono text-sm">{employee.uanNumber || 'N/A'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">PF Number</span>
                  <strong className="text-slate-900 font-mono text-sm">{employee.pfNumber || 'N/A'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">ESI Number</span>
                  <strong className="text-slate-900 font-mono text-sm">{employee.esiNumber || 'N/A'}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: EMPLOYMENT */}
        {activeTab === 'EMPLOYMENT' && (
          <div className="space-y-6 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <h4 className="font-extrabold text-slate-900 text-xs">Job Profile & Role</h4>
                <div className="space-y-2 text-slate-600">
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>Employee Code:</span>
                    <strong className="text-slate-900 font-mono">{employee.employeeCode}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>Department:</span>
                    <strong className="text-slate-900">{employee.departmentName}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>Designation:</span>
                    <strong className="text-slate-900">{employee.designationName}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>Joining Date:</span>
                    <strong className="text-slate-900">{employee.joiningDate}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>Employment Type:</span>
                    <strong className="text-slate-900">{employee.employmentType}</strong>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <h4 className="font-extrabold text-slate-900 text-xs">Shift & Office Location</h4>
                <div className="space-y-2 text-slate-600">
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>Work Location:</span>
                    <strong className="text-slate-900">{employee.workLocation}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>Branch Name:</span>
                    <strong className="text-slate-900">{employee.branchName}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>Work Shift:</span>
                    <strong className="text-slate-900">{employee.shiftName}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>Employment Status:</span>
                    <strong className="text-emerald-700 font-bold">{employee.status}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ATTENDANCE */}
        {activeTab === 'ATTENDANCE' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h4 className="font-extrabold text-slate-900 text-xs">Attendance History</h4>
              <span className="text-slate-500 text-[11px]">Enforced GPS Geofenced Check-ins</span>
            </div>
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <Clock className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="font-bold text-slate-700">No attendance logs found for this period</div>
              <p className="text-slate-500 text-[11px]">Attendance records will automatically register when employee checks in via mobile or web GPS terminal.</p>
            </div>
          </div>
        )}

        {/* TAB 5: LEAVE */}
        {activeTab === 'LEAVE' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h4 className="font-extrabold text-slate-900 text-xs">Leave Allocations & History</h4>
              <span className="text-slate-500 text-[11px]">Annual Quota Calendar Year 2026</span>
            </div>
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="font-bold text-slate-700">No leave requests logged yet</div>
              <p className="text-slate-500 text-[11px]">Leave applications submitted by this employee will be listed here for approval.</p>
            </div>
          </div>
        )}

        {/* TAB 6: EXPENSES */}
        {activeTab === 'EXPENSES' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h4 className="font-extrabold text-slate-900 text-xs">Expense Claims (₹ INR)</h4>
            </div>
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <CreditCard className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="font-bold text-slate-700">No reimbursement claims filed</div>
              <p className="text-slate-500 text-[11px]">Travel, lodging, and client expenses submitted by employee will be tracked here.</p>
            </div>
          </div>
        )}

        {/* TAB 7: TIMESHEETS */}
        {activeTab === 'TIMESHEETS' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h4 className="font-extrabold text-slate-900 text-xs">Weekly & Monthly Timesheets</h4>
            </div>
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <Clock className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="font-bold text-slate-700">No timesheets submitted</div>
              <p className="text-slate-500 text-[11px]">Project hour allocations and billable timesheet submissions will appear here.</p>
            </div>
          </div>
        )}

        {/* TAB 8: DOCUMENTS */}
        {activeTab === 'DOCUMENTS' && (
          <div className="space-y-4 text-xs">
            <DocumentsView 
              userRole={userRole} 
              currentEmployeeId={employee.id} 
            />
          </div>
        )}

        {/* TAB 9: PAYROLL */}
        {activeTab === 'PAYROLL' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h4 className="font-extrabold text-slate-900 text-xs">Salary Structure & Payslip Generation (₹ INR)</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Earnings Breakup</h5>
                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span>Basic Salary</span>
                    <strong className="text-slate-900">₹ {(employee.basicSalary || 0).toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span>HRA (House Rent Allowance)</span>
                    <strong className="text-slate-900">₹ {(employee.hra || 0).toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span>Special Allowances</span>
                    <strong className="text-slate-900">₹ {(employee.allowances || 0).toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="flex justify-between py-2 text-emerald-700 font-extrabold text-sm">
                    <span>Total Gross Monthly Pay</span>
                    <span>₹ {grossMonthly.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Bank Details for Direct Deposit</h5>
                <div className="space-y-2 text-slate-600">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span>Bank Name:</span>
                    <strong className="text-slate-900">{employee.bankName || 'N/A'}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span>Account Number:</span>
                    <strong className="text-slate-900 font-mono">{employee.accountNumber || 'N/A'}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span>IFSC Code:</span>
                    <strong className="text-slate-900 font-mono">{employee.ifscCode || 'N/A'}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 10: ACTIVITY LOG */}
        {activeTab === 'ACTIVITY' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h4 className="font-extrabold text-slate-900 text-xs">Profile Audit Trail</h4>
            </div>
            <div className="space-y-2">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Record Created</div>
                  <div className="text-[11px] text-slate-500">Employee profile added to THEIAKSHI ENTERPRISE system.</div>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">{employee.createdAt?.slice(0, 10) || '2026-08-11'}</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Profile Verified</div>
                  <div className="text-[11px] text-slate-500 font-medium">Bank details and PAN verification synchronized.</div>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">{employee.updatedAt?.slice(0, 10) || '2026-08-11'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Photo Upload Modal */}
      {showPhotoModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-600" />
                <span>Update Profile Photo</span>
              </h3>
              <button
                onClick={() => setShowPhotoModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdatePhoto} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Photo Image URL</label>
                <input
                  type="url"
                  required
                  value={photoUrlInput}
                  onChange={e => setPhotoUrlInput(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {photoUrlInput && (
                <div className="text-center pt-2">
                  <span className="text-[10px] text-slate-400 block mb-1">Image Preview:</span>
                  <img
                    src={photoUrlInput}
                    alt="Preview"
                    className="w-20 h-20 rounded-2xl object-cover mx-auto border border-slate-300 shadow-xs"
                    onError={e => {
                      (e.target as any).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
                    }}
                  />
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowPhotoModal(false)}
                  className="px-3 py-1.5 font-bold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={photoLoading}
                  className="px-4 py-1.5 font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-xs"
                >
                  {photoLoading ? 'Saving...' : 'Update Photo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
