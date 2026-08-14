import React, { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { LoginForm } from './components/auth/LoginForm';
import { DashboardView } from './components/dashboard/DashboardView';
import { EmployeesView } from './components/employees/EmployeesView';
import { AttendanceView } from './components/attendance/AttendanceView';
import { LeavesView } from './components/leaves/LeavesView';
import { HolidaysView } from './components/holidays/HolidaysView';
import { ShiftsView } from './components/shifts/ShiftsView';
import { ExpensesView } from './components/expenses/ExpensesView';
import { PayrollView } from './components/payroll/PayrollView';
import { TimesheetsView } from './components/timesheets/TimesheetsView';
import { ComplianceView } from './components/compliance/ComplianceView';
import { DocumentsView } from './components/documents/DocumentsView';
import { AnnouncementsView } from './components/announcements/AnnouncementsView';
import { HelpdeskView } from './components/helpdesk/HelpdeskView';
import { NotificationsView } from './components/notifications/NotificationsView';
import { ReportsView } from './components/reports/ReportsView';
import { AuditLogsView } from './components/audit/AuditLogsView';
import { SettingsView } from './components/settings/SettingsView';
import { MobileAppSimulator } from './components/mobile/MobileAppSimulator';
import { hrmsApi } from './lib/api-client';
import { ShieldAlert } from 'lucide-react';

const ROLE_PERMITTED_TABS: Record<string, string[]> = {
  SUPER_ADMIN: ['dashboard', 'employees', 'attendance', 'leaves', 'holidays', 'shifts', 'expenses', 'timesheets', 'payroll', 'compliance', 'documents', 'announcements', 'helpdesk', 'notifications', 'reports', 'audit', 'settings'],
  ADMIN: ['dashboard', 'employees', 'attendance', 'leaves', 'holidays', 'shifts', 'expenses', 'timesheets', 'payroll', 'compliance', 'documents', 'announcements', 'helpdesk', 'notifications', 'reports', 'audit', 'settings'],
  HR_MANAGER: ['dashboard', 'employees', 'attendance', 'leaves', 'holidays', 'shifts', 'expenses', 'timesheets', 'payroll', 'compliance', 'documents', 'announcements', 'helpdesk', 'notifications', 'reports'],
  MANAGER: ['dashboard', 'employees', 'attendance', 'leaves', 'holidays', 'shifts', 'expenses', 'timesheets', 'payroll', 'documents', 'announcements', 'helpdesk', 'notifications', 'reports'],
  EMPLOYEE: ['dashboard', 'employees', 'attendance', 'leaves', 'holidays', 'shifts', 'expenses', 'timesheets', 'payroll', 'documents', 'announcements', 'helpdesk', 'notifications'],
};

export function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileSimulatorMode, setMobileSimulatorMode] = useState(false);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      setLoading(true);
      const res = await hrmsApi.getMe();
      const loadedUser = res.user || res;
      if (!loadedUser || !loadedUser.role) {
        hrmsApi.logout();
        setUser(null);
      } else {
        setUser(loadedUser);
      }
    } catch (err) {
      hrmsApi.logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (userData: any) => {
    setUser(userData);
  };

  const handleLogout = () => {
    hrmsApi.logout();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <div className="font-bold text-sm tracking-wide">THEIAKSHI ENTERPRISE HRMS</div>
        <div className="text-xs text-slate-400 mt-1">Booting Enterprise Core & Data Engine...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  if (mobileSimulatorMode) {
    return (
      <MobileAppSimulator
        user={user}
        onLogout={handleLogout}
        onExitMobileMode={() => setMobileSimulatorMode(false)}
      />
    );
  }

  const allowedTabs = ROLE_PERMITTED_TABS[user.role] || ['dashboard'];
  const isTabAllowed = allowedTabs.includes(activeTab);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 antialiased">
      <Header
        user={user}
        onLogout={handleLogout}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onOpenMobileMode={() => setMobileSimulatorMode(true)}
        onToggleMobileSimulator={() => setMobileSimulatorMode(!mobileSimulatorMode)}
        isMobileSimulator={mobileSimulatorMode}
        onNavigateTab={tab => setActiveTab(tab)}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeTab={activeTab as any}
          onTabChange={tab => {
            setActiveTab(tab);
            setSidebarOpen(false);
          }}
          onSelectTab={tab => {
            setActiveTab(tab);
            setSidebarOpen(false);
          }}
          userRole={user.role}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {!isTabAllowed ? (
            <div className="bg-white p-8 rounded-2xl border border-red-200 shadow-xs text-center max-w-lg mx-auto my-12 space-y-4">
              <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto border border-red-100">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Access Restricted</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Your current account role <span className="font-bold text-red-600">[{user.role}]</span> does not have authorization permissions to access the <span className="font-bold uppercase">{activeTab}</span> module.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('dashboard')}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-xs"
              >
                Return to Dashboard
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView user={user} onNavigateTab={tab => setActiveTab(tab)} />
              )}

              {activeTab === 'employees' && (
                <EmployeesView userRole={user.role} />
              )}

              {activeTab === 'attendance' && (
                <AttendanceView userRole={user.role} />
              )}

              {activeTab === 'leaves' && (
                <LeavesView userRole={user.role} />
              )}

              {activeTab === 'holidays' && (
                <HolidaysView userRole={user.role} />
              )}

              {activeTab === 'shifts' && (
                <ShiftsView userRole={user.role} />
              )}

              {activeTab === 'expenses' && (
                <ExpensesView userRole={user.role} />
              )}

              {activeTab === 'payroll' && (
                <PayrollView userRole={user.role} />
              )}

              {activeTab === 'timesheets' && (
                <TimesheetsView userRole={user.role} />
              )}

              {activeTab === 'compliance' && (
                <ComplianceView userRole={user.role} />
              )}

              {activeTab === 'documents' && (
                <DocumentsView userRole={user.role} currentUserId={user.id} currentEmployeeId={user.employeeId} />
              )}

              {activeTab === 'announcements' && (
                <AnnouncementsView userRole={user.role} />
              )}

              {activeTab === 'helpdesk' && (
                <HelpdeskView userRole={user.role} />
              )}

              {activeTab === 'notifications' && (
                <NotificationsView userRole={user.role} onNavigateTab={tab => setActiveTab(tab)} />
              )}

              {activeTab === 'reports' && (
                <ReportsView />
              )}

              {activeTab === 'audit' && (
                <AuditLogsView />
              )}

              {activeTab === 'settings' && (
                <SettingsView />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
