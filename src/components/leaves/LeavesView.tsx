import React, { useEffect, useState } from 'react';
import {
  CalendarDays,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Check,
  X,
  FileText,
  AlertCircle,
  Building2,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Paperclip,
  Users,
  Settings,
  Search,
  Briefcase,
  Ban,
  Calendar as CalendarIcon
} from 'lucide-react';
import { hrmsApi } from '../../lib/api-client';
import { LeaveRequest, LeaveBalance, LeaveType, Holiday, LeaveCorrectionRequest } from '../../types/hrms';

interface LeavesViewProps {
  userRole: string;
}

export const LeavesView: React.FC<LeavesViewProps> = ({ userRole }) => {
  const [activeTab, setActiveTab] = useState<'MY_LEAVES' | 'APPROVALS' | 'CALENDAR' | 'POLICIES' | 'CORRECTIONS'>('MY_LEAVES');

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [corrections, setCorrections] = useState<LeaveCorrectionRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination & Sorting
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<string>('DESC');
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Modals
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRejectCorrectionModal, setShowRejectCorrectionModal] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedCorrectionId, setSelectedCorrectionId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  
  // Correction Form State
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [requestToCorrect, setRequestToCorrect] = useState<LeaveRequest | null>(null);
  const [corrStartDate, setCorrStartDate] = useState('');
  const [corrEndDate, setCorrEndDate] = useState('');
  const [corrIsHalfDay, setCorrIsHalfDay] = useState(false);
  const [corrReason, setCorrReason] = useState('');
  const [corrFormError, setCorrFormError] = useState<string | null>(null);
  const [corrSubmitting, setCorrSubmitting] = useState(false);

  // Apply Leave Form State
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [reason, setReason] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Custom Leave Type Form State
  const [typeName, setTypeName] = useState('');
  const [typeCode, setTypeCode] = useState('');
  const [typeQuota, setTypeQuota] = useState('10');
  const [typeCarryForward, setTypeCarryForward] = useState(false);
  const [typeAttachment, setTypeAttachment] = useState(false);
  const [typeDesc, setTypeDesc] = useState('');
  const [typeFormError, setTypeFormError] = useState<string | null>(null);

  // Calendar State
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calendarData, setCalendarData] = useState<{ leaves: LeaveRequest[]; holidays: Holiday[] }>({ leaves: [], holidays: [] });
  const [calLoading, setCalLoading] = useState(false);

  const isManagerOrAdmin = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(userRole);
  const isAdminOrHR = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(userRole);

  useEffect(() => {
    fetchLeaves();
  }, [activeTab, page, limit, sortBy, sortOrder, statusFilter, typeFilter]);

  useEffect(() => {
    if (activeTab === 'CALENDAR') {
      loadCalendarData(calMonth, calYear);
    }
  }, [calMonth, calYear, activeTab]);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      
      const queryParams: Record<string, string> = {
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder
      };
      if (statusFilter !== 'ALL') queryParams.status = statusFilter;
      if (typeFilter !== 'ALL') queryParams.leaveTypeId = typeFilter;
      if (searchQuery) queryParams.search = searchQuery;

      const [reqRes, balRes, typesRes, corrRes] = await Promise.all([
        hrmsApi.getLeaves(queryParams),
        hrmsApi.getLeaveBalances(),
        hrmsApi.getLeaveTypes(),
        activeTab === 'CORRECTIONS' ? hrmsApi.getLeaveCorrections(queryParams) : Promise.resolve({ data: [], pagination: { total: 0, totalPages: 1, page: 1, limit: 10 } } as any)
      ]);
      
      // Adapt to backend returning { data, pagination: { total, page, limit, totalPages } }
      if (Array.isArray(reqRes)) {
        setRequests(reqRes);
      } else {
        setRequests(reqRes.data || []);
        if (reqRes.pagination && activeTab !== 'CORRECTIONS') {
          setTotalRecords(reqRes.pagination.total);
          setTotalPages(reqRes.pagination.totalPages);
          setPage(reqRes.pagination.page || 1);
        }
      }
      
      if (activeTab === 'CORRECTIONS') {
        if (Array.isArray(corrRes)) {
          setCorrections(corrRes);
        } else {
          setCorrections(corrRes.data || []);
          if (corrRes.pagination) {
            setTotalRecords(corrRes.pagination.total);
            setTotalPages(corrRes.pagination.totalPages);
            setPage(corrRes.pagination.page || 1);
          }
        }
      }
      
      setBalances(balRes);
      setLeaveTypes(typesRes);

      if (typesRes.length > 0 && !leaveTypeId) {
        setLeaveTypeId(typesRes[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to load leave records');
    } finally {
      setLoading(false);
    }
  };

  const loadCalendarData = async (m: number, y: number) => {
    try {
      setCalLoading(true);
      const res = await hrmsApi.getLeaveCalendar(m, y);
      setCalendarData({
        leaves: res.leaves || [],
        holidays: res.holidays || []
      });
    } catch (err: any) {
      console.error('Failed to load leave calendar:', err);
    } finally {
      setCalLoading(false);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      await hrmsApi.applyLeave({
        leaveTypeId,
        startDate,
        endDate,
        isHalfDay,
        reason,
        attachmentUrl: attachmentUrl.trim() || undefined
      });
      setShowApplyModal(false);
      setReason('');
      setAttachmentUrl('');
      fetchLeaves();
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this pending leave request?')) return;
    try {
      await hrmsApi.cancelLeave(id);
      fetchLeaves();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel leave request');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await hrmsApi.approveLeave(id, 'Approved by Manager/HR');
      fetchLeaves();
    } catch (err: any) {
      alert(err.message || 'Failed to approve leave request');
    }
  };

  const openRejectModal = (id: string) => {
    setSelectedRequestId(id);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequestId) return;
    try {
      await hrmsApi.rejectLeave(selectedRequestId, rejectionReason.trim() || 'Rejected by Manager/HR');
      setShowRejectModal(false);
      setSelectedRequestId(null);
      fetchLeaves();
    } catch (err: any) {
      alert(err.message || 'Failed to reject leave request');
    }
  };

  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault();
    setTypeFormError(null);
    try {
      await hrmsApi.createLeaveType({
        name: typeName,
        code: typeCode,
        annualQuota: Number(typeQuota),
        carryForwardAllowed: typeCarryForward,
        requiresAttachment: typeAttachment,
        description: typeDesc
      });
      setShowTypeModal(false);
      setTypeName('');
      setTypeCode('');
      setTypeQuota('10');
      setTypeDesc('');
      fetchLeaves();
    } catch (err: any) {
      setTypeFormError(err.message || 'Failed to create leave type');
    }
  };

  const openCorrectionModal = (req: LeaveRequest) => {
    setRequestToCorrect(req);
    setCorrStartDate(req.startDate);
    setCorrEndDate(req.endDate);
    setCorrIsHalfDay(req.isHalfDay || false);
    setCorrReason('');
    setCorrFormError(null);
    setShowCorrectionModal(true);
  };

  const handleApplyCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestToCorrect) return;
    setCorrFormError(null);
    setCorrSubmitting(true);
    try {
      await hrmsApi.createLeaveCorrection({
        leaveRequestId: requestToCorrect.id,
        newStartDate: corrStartDate,
        newEndDate: corrEndDate,
        newIsHalfDay: corrIsHalfDay,
        reason: corrReason
      });
      setShowCorrectionModal(false);
      setRequestToCorrect(null);
      fetchLeaves();
    } catch (err: any) {
      setCorrFormError(err.message || 'Failed to submit correction');
    } finally {
      setCorrSubmitting(false);
    }
  };

  const handleApproveCorrection = async (id: string) => {
    try {
      await hrmsApi.approveLeaveCorrection(id);
      fetchLeaves();
    } catch (err: any) {
      alert(err.message || 'Failed to approve correction');
    }
  };

  const openRejectCorrectionModal = (id: string) => {
    setSelectedCorrectionId(id);
    setRejectionReason('');
    setShowRejectCorrectionModal(true);
  };

  const handleConfirmRejectCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCorrectionId) return;
    try {
      await hrmsApi.rejectLeaveCorrection(selectedCorrectionId, rejectionReason.trim() || 'Rejected');
      setShowRejectCorrectionModal(false);
      setSelectedCorrectionId(null);
      fetchLeaves();
    } catch (err: any) {
      alert(err.message || 'Failed to reject correction');
    }
  };

  // Selected leave type balance display
  const selectedBalance = balances.find(b => b.leaveTypeId === leaveTypeId);
  const selectedLeaveTypeObj = leaveTypes.find(lt => lt.id === leaveTypeId);

  // Since pagination is server-side now, we can just use requests directly
  const filteredRequests = requests;

  const pendingApprovalsCount = requests.filter(r => r.status === 'PENDING').length;

  return (
    <div id="leaves-view-root" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <CalendarDays className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Leave Management</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">Manage balances, submit leave applications, review requests & view team availability</p>
        </div>

        <div className="flex items-center space-x-3">
          {isAdminOrHR && (
            <button
              id="btn-add-leave-type"
              onClick={() => setShowTypeModal(true)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all flex items-center space-x-2 border border-slate-200"
            >
              <Settings className="w-4 h-4 text-slate-600" />
              <span>Configure Categories</span>
            </button>
          )}

          <button
            id="btn-apply-leave"
            onClick={() => {
              setFormError(null);
              setShowApplyModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Apply For Leave</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-xl px-4 pt-2 shadow-xs space-x-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('MY_LEAVES')}
          className={`pb-3 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap ${
            activeTab === 'MY_LEAVES' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>My Leave Requests</span>
        </button>

        {isManagerOrAdmin && (
          <button
            onClick={() => setActiveTab('APPROVALS')}
            className={`pb-3 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'APPROVALS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Team Approvals</span>
            {pendingApprovalsCount > 0 && (
              <span className="ml-1 bg-amber-500 text-white px-2 py-0.5 rounded-full text-[10px] font-black">
                {pendingApprovalsCount}
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => setActiveTab('CALENDAR')}
          className={`pb-3 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap ${
            activeTab === 'CALENDAR' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <CalendarIcon className="w-4 h-4" />
          <span>Leave Calendar</span>
        </button>

        {isAdminOrHR && (
          <button
            onClick={() => setActiveTab('POLICIES')}
            className={`pb-3 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'POLICIES' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Categories & Quotas</span>
          </button>
        )}

        <button
          onClick={() => {
            setActiveTab('CORRECTIONS');
            setPage(1);
          }}
          className={`pb-3 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap ${
            activeTab === 'CORRECTIONS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Corrections</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* TAB 1: MY LEAVES & BALANCES */}
      {activeTab === 'MY_LEAVES' && (
        <div className="space-y-6">
          {/* Quota Summary Cards */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Annual Leave Quotas & Balances</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {leaveTypes.map(lt => {
                const bal = balances.find(b => b.leaveTypeId === lt.id);
                const avail = bal ? bal.available : lt.annualQuota;
                const used = bal ? bal.used : 0;

                return (
                  <div key={lt.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                          {lt.code}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">Quota: {lt.annualQuota}</span>
                      </div>
                      <h4 className="font-bold text-xs text-slate-800 mt-2 truncate" title={lt.name}>{lt.name}</h4>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-baseline justify-between">
                      <div>
                        <span className="text-2xl font-black text-slate-900">{avail}</span>
                        <span className="text-[10px] text-slate-400 ml-1 font-semibold">avail</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">{used} used</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-3 w-full sm:w-auto overflow-x-auto">
              <div className="flex items-center space-x-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500">Filter:</span>
              </div>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl font-medium focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl font-medium focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                {leaveTypes.map(lt => (
                  <option key={lt.id} value={lt.id}>{lt.name} ({lt.code})</option>
                ))}
              </select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search reason or details..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchLeaves()}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl focus:outline-none"
              />
            </div>
          </div>

          {/* Request Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-bold text-xs text-slate-900 flex items-center justify-between">
              <span>My Leave History</span>
              <span className="text-slate-400 font-normal text-[11px]">{filteredRequests.length} record(s)</span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading leave requests...</div>
            ) : filteredRequests.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <CalendarDays className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold text-slate-500">No leave requests found</p>
                <button
                  onClick={() => setShowApplyModal(true)}
                  className="text-xs font-bold text-blue-600 hover:underline"
                >
                  Submit a new request
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                    <tr>
                      <th className="px-4 py-3">Dates</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Days</th>
                      <th className="px-4 py-3 max-w-xs">Reason</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRequests.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                          {r.startDate} <span className="text-slate-400 font-normal">to</span> {r.endDate}
                        </td>

                        <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-mono text-[11px] mr-1.5">
                            {r.leaveTypeCode || 'LEAVE'}
                          </span>
                          {r.leaveTypeName}
                        </td>

                        <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                          {r.daysCount} {r.isHalfDay ? '(Half Day)' : 'Day(s)'}
                        </td>

                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={r.reason}>
                          {r.reason}
                          {r.attachmentUrl && (
                            <a
                              href={r.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-2 text-blue-600 hover:underline inline-flex items-center space-x-1"
                            >
                              <Paperclip className="w-3 h-3" />
                              <span className="text-[10px]">Doc</span>
                            </a>
                          )}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider inline-flex items-center space-x-1 ${
                            r.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                            r.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                            r.status === 'CANCELLED' ? 'bg-slate-100 text-slate-600' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {r.status === 'APPROVED' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                            {r.status === 'REJECTED' && <XCircle className="w-3 h-3 mr-1" />}
                            {r.status === 'PENDING' && <Clock className="w-3 h-3 mr-1" />}
                            <span>{r.status}</span>
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                          {r.status === 'PENDING' && (
                            <button
                              onClick={() => handleCancelRequest(r.id)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-all"
                              title="Cancel Pending Request"
                            >
                              Cancel
                            </button>
                          )}
                          {r.status === 'APPROVED' && (
                            <button
                              onClick={() => openCorrectionModal(r)}
                              className="px-2.5 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-[11px] font-bold transition-all"
                              title="Request Correction"
                            >
                              Correct
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!loading && filteredRequests.length > 0 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Showing {requests.length} of {totalRecords} records (Page {page} of {totalPages})
                </span>
                <div className="flex space-x-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TEAM APPROVALS */}
      {activeTab === 'APPROVALS' && isManagerOrAdmin && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <span className="text-xs font-semibold text-slate-500">Status:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search employee or code..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchLeaves()}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl focus:outline-none"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-bold text-xs text-slate-900 flex items-center justify-between">
              <span>Team Leave Applications</span>
              <span className="text-slate-400 font-normal text-[11px]">{filteredRequests.length} record(s)</span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading team requests...</div>
            ) : filteredRequests.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500 font-medium">
                No leave requests requiring approval match your filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                    <tr>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Dates & Days</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 max-w-xs">Reason</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Review Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRequests.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{r.employeeName}</div>
                          <div className="text-[10px] text-slate-400">{r.employeeCode} • {r.departmentName}</div>
                        </td>

                        <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                          <div>{r.startDate} to {r.endDate}</div>
                          <div className="text-[10px] text-slate-500">{r.daysCount} {r.isHalfDay ? '(Half Day)' : 'Day(s)'}</div>
                        </td>

                        <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-mono text-[10px] mr-1">
                            {r.leaveTypeCode}
                          </span>
                          {r.leaveTypeName}
                        </td>

                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={r.reason}>
                          {r.reason}
                          {r.attachmentUrl && (
                            <a
                              href={r.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-2 text-blue-600 hover:underline inline-flex items-center space-x-1"
                            >
                              <Paperclip className="w-3 h-3" />
                              <span className="text-[10px]">Doc</span>
                            </a>
                          )}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                            r.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                            r.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {r.status}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                          {r.status === 'PENDING' ? (
                            <>
                              <button
                                onClick={() => handleApprove(r.id)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold shadow-xs transition-all inline-flex items-center space-x-1"
                                title="Approve Leave Request"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => openRejectModal(r.id)}
                                className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-[11px] font-bold transition-all inline-flex items-center space-x-1 border border-red-200"
                                title="Reject Leave Request"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              Reviewed: {r.reviewReason || 'Completed'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!loading && filteredRequests.length > 0 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Showing {requests.length} of {totalRecords} records (Page {page} of {totalPages})
                </span>
                <div className="flex space-x-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: LEAVE CALENDAR */}
      {activeTab === 'CALENDAR' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  if (calMonth === 1) {
                    setCalMonth(12);
                    setCalYear(calYear - 1);
                  } else {
                    setCalMonth(calMonth - 1);
                  }
                }}
                className="p-2 hover:bg-slate-100 rounded-xl transition-all"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>

              <span className="font-black text-sm text-slate-900 min-w-[140px] text-center">
                {new Date(calYear, calMonth - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>

              <button
                onClick={() => {
                  if (calMonth === 12) {
                    setCalMonth(1);
                    setCalYear(calYear + 1);
                  } else {
                    setCalMonth(calMonth + 1);
                  }
                }}
                className="p-2 hover:bg-slate-100 rounded-xl transition-all"
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            <button
              onClick={() => {
                setCalMonth(new Date().getMonth() + 1);
                setCalYear(new Date().getFullYear());
              }}
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              Today
            </button>
          </div>

          {/* Monthly Calendar View */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 overflow-x-auto">
            {calLoading ? (
              <div className="p-12 text-center text-xs text-slate-500">Loading leave calendar...</div>
            ) : (
              <div className="min-w-[700px]">
                {/* Days of week */}
                <div className="grid grid-cols-7 text-center font-bold text-[11px] uppercase text-slate-400 pb-3 border-b border-slate-100">
                  <div>Sun</div>
                  <div>Mon</div>
                  <div>Tue</div>
                  <div>Wed</div>
                  <div>Thu</div>
                  <div>Fri</div>
                  <div>Sat</div>
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-1 mt-2 text-xs">
                  {(() => {
                    const daysInMonth = new Date(calYear, calMonth, 0).getDate();
                    const firstDayOfWeek = new Date(calYear, calMonth - 1, 1).getDay();
                    const cells = [];

                    // Empty cells before start
                    for (let i = 0; i < firstDayOfWeek; i++) {
                      cells.push(<div key={`empty-${i}`} className="h-28 bg-slate-50/50 rounded-xl border border-transparent"></div>);
                    }

                    // Month days
                    for (let d = 1; d <= daysInMonth; d++) {
                      const dayStr = `${calYear}-${calMonth < 10 ? '0' + calMonth : calMonth}-${d < 10 ? '0' + d : d}`;
                      const isToday = new Date().toISOString().split('T')[0] === dayStr;

                      // Find leaves for this date
                      const dayLeaves = calendarData.leaves.filter(l => dayStr >= l.startDate && dayStr <= l.endDate);
                      const dayHolidays = calendarData.holidays.filter(h => h.date === dayStr);

                      cells.push(
                        <div
                          key={d}
                          className={`h-28 p-2 rounded-xl border transition-all flex flex-col justify-between ${
                            isToday ? 'bg-blue-50/40 border-blue-300' : 'bg-white border-slate-100 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-bold ${isToday ? 'bg-blue-600 text-white px-2 py-0.5 rounded-full' : 'text-slate-700'}`}>
                              {d}
                            </span>
                          </div>

                          <div className="space-y-1 overflow-y-auto max-h-20 scrollbar-none">
                            {dayHolidays.map(h => (
                              <div key={h.id} className="p-1 bg-purple-100 text-purple-900 rounded text-[9px] font-bold truncate" title={h.name}>
                                🌴 {h.name}
                              </div>
                            ))}

                            {dayLeaves.map(l => (
                              <div
                                key={l.id}
                                className={`p-1 rounded text-[9px] font-bold truncate ${
                                  l.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'
                                }`}
                                title={`${l.employeeName} (${l.leaveTypeName}): ${l.reason}`}
                              >
                                {l.employeeName} ({l.leaveTypeCode})
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    return cells;
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: LEAVE POLICIES & TYPES */}
      {activeTab === 'POLICIES' && isAdminOrHR && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Organization Leave Categories & Quotas</h3>
                <p className="text-xs text-slate-500">Configure default leave types, annual quotas, and carry-forward permissions</p>
              </div>

              <button
                onClick={() => setShowTypeModal(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Leave Category</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {leaveTypes.map(lt => (
                <div key={lt.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-black text-[10px] rounded">
                      {lt.code}
                    </span>
                    <span className="text-xs font-bold text-slate-900">{lt.annualQuota} Days / Year</span>
                  </div>

                  <h4 className="font-bold text-xs text-slate-900">{lt.name}</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{lt.description || 'No description provided.'}</p>

                  <div className="pt-2 border-t border-slate-200/80 flex items-center space-x-3 text-[10px] text-slate-600 font-semibold">
                    <span>Carry Forward: {lt.carryForwardAllowed ? 'Yes' : 'No'}</span>
                    <span>•</span>
                    <span>Doc Required: {lt.requiresAttachment ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: CORRECTIONS */}
      {activeTab === 'CORRECTIONS' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <span className="text-xs font-semibold text-slate-500">Status:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-bold text-xs text-slate-900 flex items-center justify-between">
              <span>Leave Corrections</span>
              <span className="text-slate-400 font-normal text-[11px]">{corrections.length} record(s)</span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading corrections...</div>
            ) : corrections.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500 font-medium">
                No leave correction requests found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                    <tr>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Old Dates</th>
                      <th className="px-4 py-3">New Dates</th>
                      <th className="px-4 py-3 max-w-xs">Reason</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {corrections.map((c: any) => (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{c.employeeName}</div>
                          <div className="text-[10px] text-slate-400">{c.leaveTypeName}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 line-through">
                          {c.oldStartDate} to {c.oldEndDate}
                        </td>
                        <td className="px-4 py-3 font-semibold text-emerald-700">
                          {c.newStartDate} to {c.newEndDate}
                          {c.newIsHalfDay && <span className="ml-1 text-[10px]">(Half)</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={c.reason}>
                          {c.reason}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                            c.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                            c.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                          {c.status === 'PENDING' && isManagerOrAdmin && (
                            <>
                              <button
                                onClick={() => handleApproveCorrection(c.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition-all"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => openRejectCorrectionModal(c.id)}
                                className="px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-lg text-[11px] font-bold transition-all"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!loading && corrections.length > 0 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Showing {corrections.length} of {totalRecords} records (Page {page} of {totalPages})
                </span>
                <div className="flex space-x-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* APPLY LEAVE MODAL */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Apply For Leave</h3>
              <button onClick={() => setShowApplyModal(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleApply} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Leave Category</label>
                <select
                  value={leaveTypeId}
                  onChange={e => setLeaveTypeId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {leaveTypes.map(lt => (
                    <option key={lt.id} value={lt.id}>
                      {lt.name} ({lt.code}) — {lt.annualQuota} Days Quota
                    </option>
                  ))}
                </select>

                {selectedBalance && selectedLeaveTypeObj?.code !== 'LOP' && (
                  <p className="mt-1 text-[11px] text-slate-500 font-medium">
                    Available Balance: <span className="font-bold text-emerald-600">{selectedBalance.available} Days</span> (Used: {selectedBalance.used} Days)
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="half-day"
                  checked={isHalfDay}
                  onChange={e => setIsHalfDay(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="half-day" className="font-semibold text-slate-700 cursor-pointer">
                  Request as Half-Day (0.5 Days)
                </label>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason for Absence</label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Provide clear explanation for leave application..."
                ></textarea>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Attachment / Supporting Document URL {selectedLeaveTypeObj?.requiresAttachment && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/medical_note.pdf"
                  value={attachmentUrl}
                  onChange={e => setAttachmentUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CUSTOM LEAVE TYPE MODAL */}
      {showTypeModal && isAdminOrHR && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Create Custom Leave Category</h3>
              <button onClick={() => setShowTypeModal(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {typeFormError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{typeFormError}</span>
              </div>
            )}

            <form onSubmit={handleCreateType} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maternity Leave, Paternity Leave"
                  value={typeName}
                  onChange={e => setTypeName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ML, PL"
                    value={typeCode}
                    onChange={e => setTypeCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Annual Quota (Days)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={typeQuota}
                    onChange={e => setTypeQuota(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="carry-forward"
                    checked={typeCarryForward}
                    onChange={e => setTypeCarryForward(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <label htmlFor="carry-forward" className="font-semibold text-slate-700 cursor-pointer">
                    Allow Carry Forward to Next Year
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="requires-attachment"
                    checked={typeAttachment}
                    onChange={e => setTypeAttachment(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <label htmlFor="requires-attachment" className="font-semibold text-slate-700 cursor-pointer">
                    Require Supporting Document Attachment
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={typeDesc}
                  onChange={e => setTypeDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  placeholder="Brief description of eligibility..."
                ></textarea>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTypeModal(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-3">Reject Leave Application</h3>
            <form onSubmit={handleConfirmReject} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason for Rejection <span className="text-red-500">*</span></label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Explain why this request is being rejected..."
                ></textarea>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold bg-red-600 hover:bg-red-500 text-white rounded-xl shadow-xs"
                >
                  Reject Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECT CORRECTION MODAL */}
      {showRejectCorrectionModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-3">Reject Leave Correction</h3>
            <form onSubmit={handleConfirmRejectCorrection} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason for Rejection <span className="text-red-500">*</span></label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Explain why this correction is being rejected..."
                ></textarea>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRejectCorrectionModal(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold bg-red-600 hover:bg-red-500 text-white rounded-xl shadow-xs"
                >
                  Reject Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REQUEST CORRECTION MODAL */}
      {showCorrectionModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Request Leave Correction</h3>
              <button onClick={() => setShowCorrectionModal(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {corrFormError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{corrFormError}</span>
              </div>
            )}

            <form onSubmit={handleApplyCorrection} className="space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-500">
                <p><strong>Original Dates:</strong> {requestToCorrect?.startDate} to {requestToCorrect?.endDate}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">New Start Date</label>
                  <input
                    type="date"
                    required
                    value={corrStartDate}
                    onChange={e => setCorrStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">New End Date</label>
                  <input
                    type="date"
                    required
                    value={corrEndDate}
                    onChange={e => setCorrEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="corr-half-day"
                  checked={corrIsHalfDay}
                  onChange={e => setCorrIsHalfDay(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="corr-half-day" className="font-semibold text-slate-700 cursor-pointer">
                  Request as Half-Day
                </label>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason for Correction</label>
                <textarea
                  required
                  rows={3}
                  value={corrReason}
                  onChange={e => setCorrReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Explain why you are modifying this approved leave..."
                ></textarea>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCorrectionModal(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={corrSubmitting}
                  className="px-5 py-2 font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs disabled:opacity-50"
                >
                  {corrSubmitting ? 'Submitting...' : 'Submit Correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
