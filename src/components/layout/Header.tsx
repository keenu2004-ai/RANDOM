import React, { useState, useEffect } from 'react';
import {
  Bell,
  LogOut,
  User as UserIcon,
  Smartphone,
  Monitor,
  Shield,
  Building2,
  Sparkles,
  Menu
} from 'lucide-react';
import { hrmsApi, removeStoredToken } from '../../lib/api-client';
import { Notification } from '../../types/hrms';

interface HeaderProps {
  user: any;
  onLogout: () => void;
  isMobileSimulator?: boolean;
  onToggleMobileSimulator?: () => void;
  onOpenMobileMode?: () => void;
  onToggleSidebar?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  isMobileSimulator = false,
  onToggleMobileSimulator,
  onOpenMobileMode,
  onToggleSidebar,
  onNavigateTab
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadUnreadCount = async () => {
    try {
      const res = await hrmsApi.getUnreadNotificationCount();
      setUnreadCount(res.count || 0);
    } catch (err) {
      console.error(err);
    }
  };

  const loadNotifications = async () => {
    try {
      const res = await hrmsApi.getNotifications({ limit: '5' });
      setNotifications(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (showNotifDropdown) {
      loadNotifications();
    }
  }, [showNotifDropdown]);

  const handleMarkAllRead = async () => {
    try {
      await hrmsApi.markNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMobileToggle = () => {
    if (onToggleMobileSimulator) {
      onToggleMobileSimulator();
    }
    if (onOpenMobileMode) {
      onOpenMobileMode();
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'ADMIN':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'HR_MANAGER':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'MANAGER':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <header id="header-root" className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left Branding & Menu Toggle */}
      <div className="flex items-center space-x-3">
        {onToggleSidebar && (
          <button
            id="btn-toggle-sidebar"
            onClick={onToggleSidebar}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg lg:hidden"
            title="Toggle Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg sm:text-xl shadow-md tracking-wider">
            TE
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-base sm:text-lg leading-snug flex items-center gap-1.5 sm:gap-2">
              <span>THEIAKSHI</span>
              <span className="hidden xs:inline">ENTERPRISE</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 px-1.5 sm:px-2 py-0.5 rounded border border-slate-200">
                ₹ INR
              </span>
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium hidden sm:block">Enterprise HRMS Platform</p>
          </div>
        </div>
      </div>

      {/* Right User Actions & Controls */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* View Mode Toggle: Desktop Portal vs Mobile App */}
        <button
          id="btn-toggle-mobile-mode"
          onClick={handleMobileToggle}
          className={`flex items-center space-x-1.5 sm:space-x-2 text-xs font-semibold px-2.5 sm:px-3 py-2 rounded-lg border transition-all ${
            isMobileSimulator
              ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
          title="Switch between Web Portal & Mobile App UI"
        >
          {isMobileSimulator ? (
            <>
              <Monitor className="w-4 h-4" />
              <span className="hidden sm:inline">Web Portal View</span>
            </>
          ) : (
            <>
              <Smartphone className="w-4 h-4" />
              <span className="hidden sm:inline">Mobile App Mode</span>
            </>
          )}
        </button>

        {/* Notification Bell Dropdown */}
        <div className="relative">
          <button
            id="btn-notifications-toggle"
            onClick={() => setShowNotifDropdown(!showNotifDropdown)}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg relative transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifDropdown && (
            <div id="dropdown-notifications" className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-xs text-slate-800">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.2 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-emerald-600 hover:underline font-semibold"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">No notifications yet</div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (!n.is_read) {
                          hrmsApi.markNotificationRead(n.id).catch(() => {});
                          setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, is_read: true } : item));
                          setUnreadCount(prev => Math.max(0, prev - 1));
                        }
                        setShowNotifDropdown(false);
                        if (n.action_url && onNavigateTab) {
                          onNavigateTab(n.action_url.replace('/', ''));
                        } else if (onNavigateTab) {
                          onNavigateTab('notifications');
                        }
                      }}
                      className={`p-3 text-xs cursor-pointer hover:bg-slate-50 transition-colors ${!n.is_read ? 'bg-blue-50/50' : 'bg-white'}`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-slate-900 truncate pr-2">{n.title}</span>
                      </div>
                      <div className="text-slate-600 text-[11px] leading-relaxed line-clamp-2">{n.message}</div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-2 bg-slate-50 border-t border-slate-200 text-center">
                <button
                  onClick={() => {
                    setShowNotifDropdown(false);
                    if (onNavigateTab) onNavigateTab('notifications');
                  }}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 w-full py-1"
                >
                  View Notification Center ({notifications.length})
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Badge */}
        <div className="flex items-center space-x-3 pl-2 sm:pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs uppercase border border-slate-300">
            {user?.employeeName?.[0] || user?.email?.[0] || 'U'}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-semibold text-slate-900 leading-tight">
              {user?.employeeName || 'User'}
            </div>
            <div className="flex items-center space-x-1 mt-0.5">
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border uppercase ${getRoleBadgeColor(user?.role)}`}>
                {user?.role}
              </span>
            </div>
          </div>

          <button
            id="btn-header-logout"
            onClick={onLogout}
            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
