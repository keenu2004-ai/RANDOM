import React from 'react';
import {
  LayoutDashboard,
  Users,
  MapPin,
  CalendarCheck,
  Calendar,
  Layers,
  Receipt,
  Clock,
  CircleDollarSign,
  ShieldAlert,
  FileText,
  HelpCircle,
  Megaphone,
  BarChart3,
  History,
  Settings,
  ChevronRight,
  X,
  Bell
} from 'lucide-react';
import { Role } from '../../types/hrms';

export type NavTab =
  | 'dashboard'
  | 'employees'
  | 'attendance'
  | 'leaves'
  | 'holidays'
  | 'shifts'
  | 'expenses'
  | 'timesheets'
  | 'payroll'
  | 'compliance'
  | 'documents'
  | 'announcements'
  | 'helpdesk'
  | 'notifications'
  | 'reports'
  | 'audit'
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange?: (tab: NavTab) => void;
  onSelectTab?: (tab: NavTab) => void;
  userRole: Role;
  isOpen?: boolean;
  onClose?: () => void;
}

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ElementType;
  roles: Role[];
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  onSelectTab,
  userRole,
  isOpen = false,
  onClose
}) => {
  const handleTabClick = (tab: NavTab) => {
    if (onTabChange) {
      onTabChange(tab);
    }
    if (onSelectTab) {
      onSelectTab(tab);
    }
    if (onClose) {
      onClose();
    }
  };

  const allNavItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'],
    },
    {
      id: 'employees',
      label: 'Employees',
      icon: Users,
      roles: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'],
    },
    {
      id: 'attendance',
      label: 'Attendance',
      icon: MapPin,
      roles: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'],
    },
    {
      id: 'leaves',
      label: 'Leave Management',
      icon: CalendarCheck,
      roles: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'],
    },
    {
      id: 'holidays',
      label: 'Holidays & Calendar',
      icon: Calendar,
      roles: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'],
    },
    {
      id: 'shifts',
      label: 'Shifts & Rosters',
      icon: Layers,
      roles: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'],
    },
    {
      id: 'expenses',
      label: 'Expense Claims',
      icon: Receipt,
      roles: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'],
    },
    {
      id: 'timesheets',
      label: 'Weekly Plan',
      icon: Clock,
      roles: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'],
    },
    {
      id: 'payroll',
      label: 'Payroll & Payslips',
      icon: CircleDollarSign,
      roles: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'],
      badge: '₹ INR',
    },
    {
      id: 'compliance',
      label: 'Compliance & Tax',
      icon: ShieldAlert,
      roles: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'],
    },
    {
      id: 'documents',
      label: 'Document Library',
      icon: FileText,
      roles: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'],
    },
    {
      id: 'announcements',
      label: 'Announcements',
      icon: Megaphone,
      roles: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'],
    },
    {
      id: 'helpdesk',
      label: 'Helpdesk Support',
      icon: HelpCircle,
      roles: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'],
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      roles: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'],
    },
    {
      id: 'reports',
      label: 'Reports & Export',
      icon: BarChart3,
      roles: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'],
    },
    {
      id: 'audit',
      label: 'Audit Security Logs',
      icon: History,
      roles: ['SUPER_ADMIN', 'ADMIN'],
    },
    {
      id: 'settings',
      label: 'Org & GPS Settings',
      icon: Settings,
      roles: ['SUPER_ADMIN', 'ADMIN'],
    },
  ];

  const visibleItems = allNavItems.filter(
    item => item.roles.includes(userRole) || userRole === 'SUPER_ADMIN'
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        id="sidebar-root"
        className={`fixed inset-y-0 left-0 z-40 lg:static lg:z-auto w-64 bg-slate-900 text-slate-300 flex flex-col h-full lg:h-[calc(100vh-4rem)] border-r border-slate-800 shrink-0 select-none transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 flex items-center justify-between">
          <span>Navigation</span>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1 text-slate-400 hover:text-white rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {visibleItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                id={`nav-item-${item.id}`}
                onClick={() => handleTabClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge ? (
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${isActive ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    {item.badge}
                  </span>
                ) : (
                  isActive && <ChevronRight className="w-3.5 h-3.5 text-white/70" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Role Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Active Scope: <strong className="text-slate-200">{userRole}</strong></span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="System Online"></span>
        </div>
      </aside>
    </>
  );
};
