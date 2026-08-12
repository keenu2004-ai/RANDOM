import React, { useEffect, useState } from 'react';
import {
  HelpCircle,
  Plus,
  Send,
  Paperclip,
  CheckCircle2,
  Clock,
  UserCheck,
  AlertCircle,
  Search,
  Filter,
  FileText,
  X,
  Lock,
  Tag,
  MessageSquare
} from 'lucide-react';
import { hrmsApi } from '../../lib/api-client';
import { HelpdeskTicket, TicketComment, TicketStatus, TicketPriority, Employee } from '../../types/hrms';

interface HelpdeskViewProps {
  userRole?: string;
}

export const HelpdeskView: React.FC<HelpdeskViewProps> = ({ userRole = 'EMPLOYEE' }) => {
  const [tickets, setTickets] = useState<HelpdeskTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<HelpdeskTicket | null>(null);
  const [messages, setMessages] = useState<TicketComment[]>([]);
  const [totalTickets, setTotalTickets] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 10;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  // New Message State
  const [newMessage, setNewMessage] = useState('');
  const [msgAttachmentName, setMsgAttachmentName] = useState('');
  const [msgAttachmentUrl, setMsgAttachmentUrl] = useState('');
  const [showMsgAttachModal, setShowMsgAttachModal] = useState(false);

  // New Ticket Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<'PAYROLL' | 'ATTENDANCE' | 'IT_SUPPORT' | 'HR_POLICY' | 'GENERAL'>('PAYROLL');
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [description, setDescription] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');

  const isAdminOrHr = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(userRole);

  useEffect(() => {
    loadData();
  }, [page, statusFilter, priorityFilter, categoryFilter, searchQuery]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params: any = { page: page.toString(), limit: limit.toString() };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (priorityFilter !== 'ALL') params.priority = priorityFilter;
      if (categoryFilter !== 'ALL') params.category = categoryFilter;
      if (searchQuery.trim()) params.search = searchQuery;

      const [ticketsRes, empData] = await Promise.all([
        hrmsApi.getTickets(params),
        isAdminOrHr ? hrmsApi.getEmployees().catch(() => []) : Promise.resolve([])
      ]);
      
      const fetchedTickets = ticketsRes.data || [];
      setTickets(fetchedTickets);
      setTotalTickets(ticketsRes.pagination?.total || 0);
      setEmployees(empData);

      if (fetchedTickets.length > 0) {
        if (!selectedTicket) {
          selectTicket(fetchedTickets[0]);
        } else {
          // Keep selected ticket updated
          const updatedSelected = fetchedTickets.find(t => t.id === selectedTicket.id);
          if (updatedSelected) {
            setSelectedTicket(updatedSelected);
          }
        }
      } else {
        setSelectedTicket(null);
        setMessages([]);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectTicket = async (ticket: HelpdeskTicket) => {
    setSelectedTicket(ticket);
    try {
      const msgs = await hrmsApi.getTicketComments(ticket.id);
      setMessages(msgs);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !newMessage.trim()) return;

    try {
      await hrmsApi.addTicketComment(
        selectedTicket.id,
        newMessage,
        msgAttachmentName || undefined,
        msgAttachmentUrl || undefined
      );
      setNewMessage('');
      setMsgAttachmentName('');
      setMsgAttachmentUrl('');
      setShowMsgAttachModal(false);

      // Refresh messages and ticket list
      const updatedMsgs = await hrmsApi.getTicketComments(selectedTicket.id);
      setMessages(updatedMsgs);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to send response');
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;

    try {
      const created = await hrmsApi.createTicket({
        subject,
        category,
        description,
        priority,
        attachment_name: attachmentName || undefined,
        attachment_url: attachmentUrl || undefined
      });

      setShowCreateModal(false);
      setSubject('');
      setDescription('');
      setAttachmentName('');
      setAttachmentUrl('');
      setPriority('MEDIUM');
      setCategory('PAYROLL');

      await loadData();
      if (created) selectTicket(created);
      alert('Support ticket created successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to create ticket');
    }
  };

  const handleUpdateStatus = async (status: TicketStatus | string) => {
    if (!selectedTicket) return;
    try {
      const updated = await hrmsApi.changeTicketStatus(selectedTicket.id, status);
      setSelectedTicket(updated);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update ticket status');
    }
  };

  const handleAssignTicket = async (assignedTo: string) => {
    if (!selectedTicket) return;
    try {
      const updated = await hrmsApi.assignTicket(selectedTicket.id, assignedTo);
      setSelectedTicket(updated);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to assign ticket');
    }
  };

  // Filtered tickets (handled by backend)
  const filteredTickets = tickets;

  // Ticket stats
  const totalCount = totalTickets;
  const openCount = '--';
  const inProgressCount = '--';
  const resolvedCount = '--';

  const getPriorityBadge = (p: TicketPriority) => {
    switch (p) {
      case 'URGENT':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-100 text-rose-800 border border-rose-200 uppercase">URGENT</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800 border border-amber-200 uppercase">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-800 border border-blue-200 uppercase">MEDIUM</span>;
      case 'LOW':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase">LOW</span>;
    }
  };

  const getStatusBadge = (s: TicketStatus) => {
    switch (s) {
      case 'OPEN':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-800 uppercase">OPEN</span>;
      case 'IN_PROGRESS':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800 uppercase">IN PROGRESS</span>;
      case 'WAITING':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-100 text-purple-800 uppercase">WAITING</span>;
      case 'RESOLVED':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800 uppercase">RESOLVED</span>;
      case 'CLOSED':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-200 text-slate-700 uppercase">CLOSED</span>;
    }
  };

  return (
    <div id="helpdesk-view-root" className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">HR & IT Helpdesk Support</h2>
          <p className="text-xs text-slate-500">
            Submit support tickets for payroll, leave corrections, IT issues, and HR policies
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center space-x-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Support Ticket</span>
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Total Tickets</div>
            <div className="text-lg font-black text-slate-900">{totalCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Open Tickets</div>
            <div className="text-lg font-black text-slate-900">{openCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500">In Progress / Waiting</div>
            <div className="text-lg font-black text-slate-900">{inProgressCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Resolved / Closed</div>
            <div className="text-lg font-black text-slate-900">{resolvedCount}</div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[620px]">
        {/* Left Column: Search, Filters & Ticket List (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
          {/* Search & Filters Bar */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search ticket #, subject, or employee..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-200 rounded-md font-medium text-slate-700"
              >
                <option value="ALL">Status: All</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="WAITING">Waiting</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>

              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-200 rounded-md font-medium text-slate-700"
              >
                <option value="ALL">Category: All</option>
                <option value="PAYROLL">Payroll</option>
                <option value="ATTENDANCE">Attendance</option>
                <option value="IT_SUPPORT">IT Support</option>
                <option value="HR_POLICY">HR Policy</option>
                <option value="GENERAL">General</option>
              </select>

              <select
                value={priorityFilter}
                onChange={e => setPriorityFilter(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-200 rounded-md font-medium text-slate-700"
              >
                <option value="ALL">Priority: All</option>
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>

          {/* Ticket List Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredTickets.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No support tickets found matching your criteria
              </div>
            ) : (
              filteredTickets.map(t => (
                <button
                  key={t.id}
                  onClick={() => selectTicket(t)}
                  className={`w-full p-3.5 text-left transition-all hover:bg-slate-50 flex flex-col space-y-1.5 ${
                    selectedTicket?.id === t.id ? 'bg-emerald-50/70 border-l-4 border-emerald-600' : ''
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                    <span className="font-mono text-emerald-700">{t.ticket_number || t.id.substring(0,8)}</span>
                    <div className="flex items-center space-x-1.5">
                      {getPriorityBadge(t.priority)}
                      {getStatusBadge(t.status as TicketStatus)}
                    </div>
                  </div>

                  <div className="text-xs font-semibold text-slate-800 line-clamp-1">{t.subject}</div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                    <span>{t.employee_name || 'Employee'}</span>
                    <span>{new Date(t.updated_at || t.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                  </div>
                </button>
              ))
            )}
          </div>
          {/* Pagination Controls */}
          <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Total: {totalTickets}</span>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 bg-white border border-slate-200 rounded disabled:opacity-50"
              >
                Prev
              </button>
              <span className="font-bold">{page}</span>
              <button 
                onClick={() => setPage(p => p + 1)}
                disabled={tickets.length < limit}
                className="px-2 py-1 bg-white border border-slate-200 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Ticket Conversation Thread (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col overflow-hidden">
          {selectedTicket ? (
            <>
              {/* Ticket Header & Metadata */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-xs text-emerald-700">{selectedTicket.ticket_number || selectedTicket.id.substring(0,8)}</span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs font-bold px-2 py-0.5 bg-slate-200/80 text-slate-700 rounded-md">
                        {(selectedTicket.category || 'GENERAL').replace('_', ' ')}
                      </span>
                    </div>
                    <h3 className="font-extrabold text-sm text-slate-900 mt-1">{selectedTicket.subject}</h3>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {getPriorityBadge(selectedTicket.priority)}
                    {getStatusBadge(selectedTicket.status)}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Raised By</span>
                    <span className="font-semibold text-slate-800">{selectedTicket.employee_name || 'Employee'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Assigned To</span>
                    <span className="font-semibold text-slate-800">{selectedTicket.assigned_to_name || 'Unassigned'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Created On</span>
                    <span className="font-semibold text-slate-800">
                      {new Date(selectedTicket.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Admin Controls Toolbar */}
                {isAdminOrHr && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-bold text-slate-700">Status:</span>
                      <select
                        value={selectedTicket.status}
                        onChange={e => handleUpdateStatus(e.target.value as TicketStatus)}
                        className="px-2.5 py-1 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="OPEN">OPEN</option>
                        <option value="IN_PROGRESS">IN PROGRESS</option>
                        <option value="WAITING">WAITING</option>
                        <option value="RESOLVED">RESOLVED</option>
                        <option value="CLOSED">CLOSED</option>
                      </select>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-bold text-slate-700">Assign:</span>
                      <select
                        value={selectedTicket.assigned_to || ''}
                        onChange={e => handleAssignTicket(e.target.value)}
                        className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 max-w-[150px] truncate"
                      >
                        <option value="">-- Unassigned --</option>
                        {employees.map(e => (
                          <option key={e.id} value={e.id}>
                            {e.firstName} {e.lastName} ({e.designation || 'Staff'})
                          </option>
                        ))}
                      </select>

                      {selectedTicket.status !== 'CLOSED' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus('CLOSED')}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] rounded-lg transition-colors flex items-center space-x-1"
                        >
                          <Lock className="w-3 h-3" />
                          <span>Close</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Messages Conversation Log */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
                {messages.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">Loading conversation thread...</div>
                ) : (
                  messages.map(m => {
                    const isStaff = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(m.author_role || 'EMPLOYEE');
                    return (
                      <div
                        key={m.id}
                        className={`p-3.5 rounded-2xl text-xs space-y-1.5 shadow-2xs border ${
                          isStaff ? 'bg-emerald-50/60 border-emerald-200 ml-4' : 'bg-white border-slate-200 mr-4'
                        }`}
                      >
                        <div className="flex justify-between items-center text-[11px]">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-slate-900">{m.author_name || 'Unknown'}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                isStaff ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {m.author_role || 'EMPLOYEE'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {new Date(m.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                            {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <p className="text-slate-800 leading-relaxed whitespace-pre-line">{m.comment}</p>

                        {m.attachment_name && (
                          <div className="pt-1">
                            <a
                              href={m.attachment_url || '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-[11px] font-semibold text-emerald-700 hover:bg-slate-50"
                            >
                              <Paperclip className="w-3.5 h-3.5" />
                              <span className="truncate max-w-[200px]">{m.attachment_name}</span>
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Message Reply Input Box */}
              {selectedTicket.status === 'CLOSED' ? (
                <div className="p-3 bg-slate-100 border-t border-slate-200 text-center text-xs text-slate-500 font-medium">
                  This ticket is CLOSED. Re-open status above to reply.
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 space-y-2">
                  {msgAttachmentName && (
                    <div className="flex items-center justify-between px-2.5 py-1 bg-slate-100 rounded-md text-[11px] text-slate-700 font-medium">
                      <div className="flex items-center space-x-1.5 truncate">
                        <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                        <span className="truncate">{msgAttachmentName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMsgAttachmentName('');
                          setMsgAttachmentUrl('');
                        }}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowMsgAttachModal(true)}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                      title="Attach File"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>

                    <input
                      type="text"
                      required
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      placeholder="Type your reply or progress response..."
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />

                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center space-x-1.5 shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 p-8 text-center text-slate-400 space-y-2">
              <MessageSquare className="w-10 h-10 text-slate-300" />
              <p className="text-xs font-medium">Select a ticket from the left panel to inspect messages & updates</p>
            </div>
          )}
        </div>
      </div>

      {/* Attachment Modal for Messages */}
      {showMsgAttachModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Attach Document / File</h3>
              <button onClick={() => setShowMsgAttachModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">File Name</label>
                <input
                  type="text"
                  placeholder="e.g. salary_slip_may.pdf"
                  value={msgAttachmentName}
                  onChange={e => setMsgAttachmentName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">File URL / Storage Link</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={msgAttachmentUrl}
                  onChange={e => setMsgAttachmentUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMsgAttachModal(false)}
                  className="px-3 py-1.5 font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setShowMsgAttachModal(false)}
                  className="px-4 py-1.5 font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
                >
                  Attach File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Ticket Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-black text-base text-slate-900">Raise New Support Ticket</h3>
                <p className="text-xs text-slate-500">Provide details so HR & IT can address your request promptly</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Subject / Headline *</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  placeholder="e.g. May 2026 Overtime Compensation Calculation Inquiry"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category *</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
                  >
                    <option value="PAYROLL">Payroll & Salary Query</option>
                    <option value="ATTENDANCE">Attendance & Leave Regularization</option>
                    <option value="IT_SUPPORT">IT Hardware / Access / Systems</option>
                    <option value="HR_POLICY">HR Policy & Benefits Clarification</option>
                    <option value="GENERAL">General Support Inquiry</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Priority Level *</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as TicketPriority)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
                  >
                    <option value="LOW">Low - General Inquiry</option>
                    <option value="MEDIUM">Medium - Standard Request</option>
                    <option value="HIGH">High - Important issue</option>
                    <option value="URGENT">Urgent - Critical blocker</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Detailed Description *</label>
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  placeholder="Describe your query or problem in detail..."
                ></textarea>
              </div>

              <div className="border border-dashed border-slate-300 p-3 rounded-xl bg-slate-50/50 space-y-2">
                <span className="block font-bold text-slate-700">Optional Attachment (Screenshot/Slip)</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="File Name (e.g. proof.pdf)"
                    value={attachmentName}
                    onChange={e => setAttachmentName(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs"
                  />
                  <input
                    type="text"
                    placeholder="URL or Attachment Path"
                    value={attachmentUrl}
                    onChange={e => setAttachmentUrl(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-xs"
                >
                  Create Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
