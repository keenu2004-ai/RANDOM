import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  Sparkles,
  Search,
  Calendar,
  DollarSign,
  Clock,
  UserCheck,
  CreditCard,
  LifeBuoy,
  Megaphone,
  ExternalLink,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { Notification } from '../../types/hrms';
import { hrmsApi } from '../../lib/api-client';

interface NotificationsViewProps {
  userRole?: string;
  onNavigateTab?: (tab: string) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({ onNavigateTab }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [triggeringReminders, setTriggeringReminders] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await hrmsApi.getNotifications({ page: currentPage.toString(), limit: '20' });
      setNotifications(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalCount(res.pagination?.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // Polling every 60s
    return () => clearInterval(interval);
  }, [currentPage]);

  const handleMarkAllRead = async () => {
    try {
      await hrmsApi.markNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setActionSuccess('All notifications marked as read.');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to mark notifications as read.');
    }
  };

  const handleMarkSingleRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await hrmsApi.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err: any) {
      setError(err.message || 'Failed to mark notification as read.');
    }
  };

  const handleDeleteSingle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await hrmsApi.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete notification.');
    }
  };

  const handleClearRead = async () => {
    try {
      await hrmsApi.clearReadNotifications();
      setNotifications(prev => prev.filter(n => !n.is_read));
      setActionSuccess('Cleared read notifications.');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to clear read notifications.');
    }
  };

  const handleTriggerReminders = async () => {
    try {
      setTriggeringReminders(true);
      const res = await hrmsApi.triggerReminders();
      setActionSuccess(res.message);
      await fetchNotifications();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to run reminder engine.');
    } finally {
      setTriggeringReminders(false);
    }
  };

  const handleNavigate = (action_url?: string) => {
    if (!action_url || !onNavigateTab) return;
    const cleanTab = action_url.replace('/', '').trim();
    if (cleanTab) {
      onNavigateTab(cleanTab);
    }
  };

  // Filtered list
  const filteredNotifications = notifications.filter(n => {
    if (unreadOnly && n.is_read) return false;
    if (filterType !== 'ALL' && n.notification_type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q);
    }
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'LEAVE':
        return <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
      case 'EXPENSE':
        return <DollarSign className="w-5 h-5 text-teal-600 dark:text-teal-400" />;
      case 'TIMESHEET':
        return <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'ATTENDANCE':
        return <UserCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
      case 'PAYROLL':
        return <CreditCard className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
      case 'HELPDESK':
        return <LifeBuoy className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
      case 'ANNOUNCEMENT':
        return <Megaphone className="w-5 h-5 text-rose-600 dark:text-rose-400" />;
      default:
        return <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400" />;
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'LEAVE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
      case 'EXPENSE':
        return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800';
      case 'TIMESHEET':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
      case 'ATTENDANCE':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
      case 'PAYROLL':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800';
      case 'HELPDESK':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800';
      case 'ANNOUNCEMENT':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 3600));
      const diffDays = Math.floor(diffMs / (1000 * 3600 * 24));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notification Center</h1>
                {unreadCount > 0 && (
                  <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-500 text-white rounded-full">
                    {unreadCount} Unread
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time updates for leaves, expenses, timesheets, payroll, helpdesk, and announcements.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleTriggerReminders}
              disabled={triggeringReminders}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors"
              title="Run automated attendance reminders, birthday wishes, and holiday alerts"
            >
              <Sparkles className={`w-4 h-4 ${triggeringReminders ? 'animate-spin' : ''}`} />
              <span>{triggeringReminders ? 'Checking Engine...' : 'Run Reminders'}</span>
            </button>

            <button
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 rounded-lg disabled:opacity-50 transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark All Read</span>
            </button>

            <button
              onClick={handleClearRead}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Read</span>
            </button>

            <button
              onClick={fetchNotifications}
              className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
              title="Refresh notifications"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Action Success or Error Banner */}
        {actionSuccess && (
          <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-lg text-sm flex items-center space-x-2">
            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}
        {error && (
          <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-lg text-sm flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Metric Cards Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Received</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{notifications.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Unread</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{unreadCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Leaves & Expenses</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {notifications.filter(n => n.notification_type === 'LEAVE' || n.notification_type === 'EXPENSE').length}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Payroll & Helpdesk</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
            {notifications.filter(n => n.notification_type === 'PAYROLL' || n.notification_type === 'HELPDESK').length}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Unread Toggle */}
          <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
            <label className="flex items-center space-x-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={e => setUnreadOnly(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700"
              />
              <span className="font-medium">Show Unread Only ({unreadCount})</span>
            </label>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs no-scrollbar">
          {[
            { id: 'ALL', label: 'All Modules' },
            { id: 'LEAVE', label: 'Leaves' },
            { id: 'EXPENSE', label: 'Expenses' },
            { id: 'TIMESHEET', label: 'Timesheets' },
            { id: 'ATTENDANCE', label: 'Attendance' },
            { id: 'PAYROLL', label: 'Payroll' },
            { id: 'HELPDESK', label: 'Helpdesk' },
            { id: 'ANNOUNCEMENT', label: 'Announcements' },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setFilterType(cat.id)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors border ${
                filterType === cat.id
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {cat.label}
              <span className="ml-1.5 opacity-70">
                ({cat.id === 'ALL' ? notifications.length : notifications.filter(n => n.notification_type === cat.id).length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Notification List Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
        {loading && notifications.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-500" />
            <p>Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 space-y-3">
            <BellOff className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-base font-semibold text-slate-800 dark:text-slate-200">No notifications found</p>
            <p className="text-sm max-w-md mx-auto">
              {unreadOnly
                ? "You've read all your notifications! Check back later or clear your filters."
                : "No notifications match your filter parameters."}
            </p>
          </div>
        ) : (
          filteredNotifications.map(notif => (
            <div
              key={notif.id}
              onClick={() => {
                if (!notif.is_read) {
                  hrmsApi.markNotificationRead(notif.id).catch(() => {});
                  setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
                }
                if (notif.action_url) {
                  handleNavigate(notif.action_url);
                }
              }}
              className={`p-5 flex items-start space-x-4 transition-colors cursor-pointer group hover:bg-slate-50/80 dark:hover:bg-slate-800/50 ${
                !notif.is_read ? 'bg-emerald-50/30 dark:bg-emerald-950/20' : ''
              }`}
            >
              {/* Type Icon Container */}
              <div className={`p-3 rounded-xl border flex-shrink-0 ${getTypeBadgeClass(notif.notification_type)}`}>
                {getTypeIcon(notif.notification_type)}
              </div>

              {/* Main Content Body */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 min-w-0">
                    {!notif.is_read && (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0 animate-pulse" title="Unread" />
                    )}
                    <h3 className={`text-sm font-semibold truncate ${!notif.is_read ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                      {notif.title}
                    </h3>
                    <span className={`px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase rounded border ${getTypeBadgeClass(notif.notification_type)}`}>
                      {notif.notification_type}
                    </span>
                  </div>

                  <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                    {formatRelativeTime(notif.created_at)}
                  </span>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  {notif.message}
                </p>

                {/* Footer Action Links */}
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-xs">
                  <div className="flex items-center space-x-3">
                    {notif.link && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNavigate(notif.link);
                        }}
                        className="inline-flex items-center space-x-1 font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                      >
                        <span>Open Details</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span className="text-slate-400 dark:text-slate-500">
                      {new Date(notif.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 opacity-80 group-hover:opacity-100 transition-opacity">
                    {!notif.isRead && (
                      <button
                        onClick={(e) => handleMarkSingleRead(notif.id, e)}
                        className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded transition-colors"
                        title="Mark as Read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDeleteSingle(notif.id, e)}
                      className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 rounded transition-colors"
                      title="Delete Notification"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
