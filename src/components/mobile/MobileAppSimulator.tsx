import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  MapPin,
  CalendarCheck,
  Receipt,
  CircleDollarSign,
  User,
  Bell,
  Navigation,
  Clock,
  CheckCircle2,
  ShieldCheck,
  ChevronLeft,
  HelpCircle,
  LogOut,
  Calendar,
  DollarSign,
  Briefcase,
  FileText,
  Send,
  AlertCircle,
  Plus,
  RefreshCw,
  Check,
  X,
  Layers,
  ChevronRight,
  Sparkles,
  Lock
} from 'lucide-react';
import { hrmsApi } from '../../lib/api-client';

interface MobileAppSimulatorProps {
  user: any;
  onLogout: () => void;
  onExitMobileMode: () => void;
}

type MobileScreen =
  | 'login'
  | 'dashboard'
  | 'attendance'
  | 'checkin'
  | 'checkout'
  | 'leave'
  | 'expenses'
  | 'timesheets'
  | 'holidays'
  | 'payslips'
  | 'notifications'
  | 'profile'
  | 'helpdesk';

export const MobileAppSimulator: React.FC<MobileAppSimulatorProps> = ({
  user,
  onLogout,
  onExitMobileMode
}) => {
  const [deviceModel, setDeviceModel] = useState<'iphone' | 'android' | 'responsive'>('iphone');
  const [currentScreen, setCurrentScreen] = useState<MobileScreen>('dashboard');

  // Mobile App Shared States
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Core Data loaded from backend
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [helpdeskTickets, setHelpdeskTickets] = useState<any[]>([]);
  const [orgStats, setOrgStats] = useState<any>(null);

  // Real GPS Device Coordinates State
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsAddress, setGpsAddress] = useState('Fetching device GPS location...');
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Form States
  const [leaveForm, setLeaveForm] = useState({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
  const [expenseForm, setExpenseForm] = useState({ categoryId: '', expenseDate: new Date().toISOString().split('T')[0], amount: '', description: '' });
  const [timesheetForm, setTimesheetForm] = useState({ projectId: '', date: new Date().toISOString().split('T')[0], hours: '8', taskDescription: '' });
  const [helpdeskForm, setHelpdeskForm] = useState({ subject: '', category: 'HR', priority: 'MEDIUM', description: '' });

  // Mobile Auth local form
  const [mobileAuthForm, setMobileAuthForm] = useState({ email: user?.email || '', password: 'password123' });

  useEffect(() => {
    loadAllBackendData();
    requestGpsLocation();
  }, []);

  const loadAllBackendData = async () => {
    try {
      setLoading(true);
      const [
        attRes,
        leaveRes,
        lTypesRes,
        expRes,
        eCatRes,
        tsRes,
        projRes,
        holRes,
        payRes,
        notifRes,
        helpRes,
        statsRes
      ] = await Promise.all([
        hrmsApi.getAttendance().catch(() => []),
        hrmsApi.getLeaves().catch(() => []),
        hrmsApi.getLeaveTypes().catch(() => []),
        hrmsApi.getExpenses().catch(() => []),
        hrmsApi.getExpenseCategories().catch(() => []),
        hrmsApi.getTimesheets().catch(() => []),
        hrmsApi.getProjects().catch(() => []),
        hrmsApi.getHolidays().catch(() => []),
        hrmsApi.getPayrollRecords().catch(() => []),
        hrmsApi.getNotifications().catch(() => []),
        hrmsApi.getTickets().catch(() => []),
        hrmsApi.getStats().catch(() => null)
      ]);

      setAttendance(attRes || []);
      setLeaves(leaveRes || []);
      setLeaveTypes(lTypesRes || []);
      setExpenses(expRes || []);
      setExpenseCategories(eCatRes || []);
      setTimesheets(tsRes || []);
      setProjects(projRes || []);
      setHolidays(holRes || []);
      setPayrollRecords(payRes || []);
      setNotifications(notifRes || []);
      setHelpdeskTickets(helpRes || []);
      setOrgStats(statsRes);
    } catch (err: any) {
      console.error('Error syncing mobile backend data:', err);
    } finally {
      setLoading(false);
    }
  };

  const requestGpsLocation = () => {
    setGpsError(null);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const accuracy = pos.coords.accuracy;
          setCoords({ latitude: lat, longitude: lng, accuracy });
          setGpsAddress(`GPS: ${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E (Device Location)`);
        },
        err => {
          setGpsError('GPS permission denied or unavailable. Attendance check-in requires a valid device location.');
          setCoords(null);
          setGpsAddress('Location Unavailable');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setGpsError('Geolocation is not supported by your browser.');
      setCoords(null);
      setGpsAddress('Location Unavailable');
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todayAttendance = attendance.find(a => a.date === todayStr);

  // Mobile Handlers calling Express Backend API directly
  const handleGpsCheckIn = async () => {
    if (!coords || coords.latitude == null || coords.longitude == null) {
      setStatusMsg({ text: 'GPS location is required to check in.', type: 'error' });
      return;
    }
    
    try {
      setLoading(true);
      setStatusMsg(null);
      
      await hrmsApi.checkIn({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy || 10,
        address: gpsAddress
      });

      setStatusMsg({ text: 'GPS Check-In verified and recorded in PostgreSQL!', type: 'success' });
      await loadAllBackendData();
      setCurrentScreen('attendance');
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'GPS Check-In failed', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleGpsCheckOut = async () => {
    if (!coords || coords.latitude == null || coords.longitude == null) {
      setStatusMsg({ text: 'GPS location is required to check out.', type: 'error' });
      return;
    }
    
    try {
      setLoading(true);
      setStatusMsg(null);
      
      await hrmsApi.checkOut({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy || 10,
        address: gpsAddress
      });

      setStatusMsg({ text: 'GPS Check-Out recorded successfully!', type: 'success' });
      await loadAllBackendData();
      setCurrentScreen('attendance');
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'GPS Check-Out failed', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveForm.leaveTypeId || !leaveForm.startDate || !leaveForm.endDate) {
      setStatusMsg({ text: 'Please fill all required leave fields', type: 'error' });
      return;
    }
    try {
      setLoading(true);
      await hrmsApi.applyLeave({
        employeeId: user.employeeId || user.id,
        leaveTypeId: leaveForm.leaveTypeId,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        reason: leaveForm.reason
      });
      setStatusMsg({ text: 'Leave application submitted to manager!', type: 'success' });
      setLeaveForm({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
      await loadAllBackendData();
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Failed to apply leave', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.amount || !expenseForm.categoryId) {
      setStatusMsg({ text: 'Please select category and enter amount', type: 'error' });
      return;
    }
    try {
      setLoading(true);
      await hrmsApi.createExpense({
        employeeId: user.employeeId || user.id,
        categoryId: expenseForm.categoryId,
        expenseDate: expenseForm.expenseDate,
        amount: parseFloat(expenseForm.amount),
        description: expenseForm.description,
        status: 'SUBMITTED'
      });
      setStatusMsg({ text: 'Expense claim submitted for approval!', type: 'success' });
      setExpenseForm({ categoryId: '', expenseDate: new Date().toISOString().split('T')[0], amount: '', description: '' });
      await loadAllBackendData();
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Failed to submit expense claim', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitTimesheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!timesheetForm.hours || !timesheetForm.taskDescription) {
      setStatusMsg({ text: 'Please fill task description and hours', type: 'error' });
      return;
    }
    try {
      setLoading(true);
      const proj = projects.find(p => p.id === timesheetForm.projectId);
      await hrmsApi.submitTimesheet({
        employeeId: user.employeeId || user.id,
        projectId: timesheetForm.projectId || projects[0]?.id,
        projectName: proj?.name || 'General Task',
        date: timesheetForm.date,
        hours: parseFloat(timesheetForm.hours),
        taskDescription: timesheetForm.taskDescription,
        status: 'SUBMITTED'
      });
      setStatusMsg({ text: 'Timesheet entry logged successfully!', type: 'success' });
      setTimesheetForm({ projectId: '', date: new Date().toISOString().split('T')[0], hours: '8', taskDescription: '' });
      await loadAllBackendData();
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Failed to submit timesheet', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitHelpdesk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!helpdeskForm.subject || !helpdeskForm.description) {
      setStatusMsg({ text: 'Subject and description are required', type: 'error' });
      return;
    }
    try {
      setLoading(true);
      await hrmsApi.createTicket({
        subject: helpdeskForm.subject,
        category: helpdeskForm.category,
        priority: helpdeskForm.priority,
        description: helpdeskForm.description
      });
      setStatusMsg({ text: 'Support ticket submitted to HR Helpdesk!', type: 'success' });
      setHelpdeskForm({ subject: '', category: 'HR', priority: 'MEDIUM', description: '' });
      await loadAllBackendData();
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Failed to create helpdesk ticket', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleMobileLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await hrmsApi.login(mobileAuthForm.email, mobileAuthForm.password);
      setStatusMsg({ text: `Logged in on mobile as ${res.user?.email}`, type: 'success' });
      await loadAllBackendData();
      setCurrentScreen('dashboard');
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Invalid credentials', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Status Badge Helper
  const renderBadge = (status: string) => {
    const s = String(status).toUpperCase();
    if (['ACTIVE', 'PRESENT', 'APPROVED', 'PAID', 'COMPLETED', 'RESOLVED'].includes(s)) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">{s}</span>;
    }
    if (['PENDING', 'SUBMITTED', 'IN_PROGRESS', 'OPEN'].includes(s)) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">{s}</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">{s}</span>;
  };

  return (
    <div id="mobile-app-root" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-2 sm:p-6 select-none font-sans">
      {/* Top Controls Header */}
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-md">
            EX
          </div>
          <div>
            <div className="font-black text-sm text-white flex items-center gap-2">
              <span>THEIAKSHI Expo React Native App</span>
              <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] rounded-full font-bold">
                Live Backend API Connected
              </span>
            </div>
            <p className="text-xs text-slate-400">Android & iPhone Native App Experience - Same PostgreSQL DB</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Device Model Switcher */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setDeviceModel('iphone')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${deviceModel === 'iphone' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              iPhone 15
            </button>
            <button
              onClick={() => setDeviceModel('android')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${deviceModel === 'android' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Android S24
            </button>
            <button
              onClick={() => setDeviceModel('responsive')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${deviceModel === 'responsive' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Full Screen
            </button>
          </div>

          <button
            onClick={onExitMobileMode}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 transition-all"
          >
            Web Portal ↗
          </button>
        </div>
      </div>

      {/* Smartphone Frame Container */}
      <div className={`transition-all duration-300 ${deviceModel === 'responsive'
          ? 'w-full max-w-md h-[780px]'
          : deviceModel === 'android'
            ? 'w-[370px] h-[750px] rounded-[36px] border-[10px] border-slate-800 shadow-2xl'
            : 'w-[360px] h-[740px] rounded-[52px] border-[12px] border-slate-800 shadow-2xl'
        } bg-slate-900 p-2.5 relative flex flex-col overflow-hidden`}>

        {/* Top Camera Notch / Dynamic Island */}
        <div className="w-28 h-4 bg-slate-950 rounded-b-xl mx-auto absolute top-0 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-900"></div>
          <div className="w-2 h-2 rounded-full bg-slate-800"></div>
        </div>

        {/* Phone Screen Inside */}
        <div className="flex-1 bg-slate-950 text-white rounded-[38px] overflow-hidden flex flex-col pt-5 relative">

          {/* Mobile App Bar */}
          <div className="px-4 py-3 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 flex items-center justify-between sticky top-0 z-40">
            {currentScreen !== 'dashboard' && currentScreen !== 'login' ? (
              <button
                onClick={() => setCurrentScreen('dashboard')}
                className="text-slate-300 hover:text-white p-1 rounded-lg bg-slate-800/50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                  TE
                </div>
                <span className="font-black text-xs text-white tracking-tight">THEIAKSHI</span>
              </div>
            )}

            <div className="font-black text-xs text-slate-200 capitalize">
              {currentScreen === 'dashboard' ? 'Mobile App' : currentScreen.replace('_', ' ')}
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentScreen('notifications')}
                className="relative p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
              >
                <Bell className="w-4 h-4" />
                {notifications.some(n => !n.isRead) && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1 right-1 animate-pulse"></span>
                )}
              </button>

              <button
                onClick={() => setCurrentScreen('profile')}
                className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center border border-blue-400"
              >
                {user?.employeeName?.[0] || 'U'}
              </button>
            </div>
          </div>

          {/* Status Message Toast */}
          {statusMsg && (
            <div className={`p-2.5 text-[11px] font-semibold text-center flex items-center justify-between px-4 animate-in fade-in slide-in-from-top-2 ${statusMsg.type === 'success' ? 'bg-emerald-600 text-white' : statusMsg.type === 'error' ? 'bg-rose-600 text-white' : 'bg-blue-600 text-white'
              }`}>
              <span className="truncate pr-2">{statusMsg.text}</span>
              <button onClick={() => setStatusMsg(null)}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Screen Content Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs scrollbar-none">

            {/* SCREEN 1: LOGIN */}
            {currentScreen === 'login' && (
              <div className="py-6 space-y-5">
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white font-black text-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-600/30">
                    TE
                  </div>
                  <h3 className="font-black text-lg text-white tracking-tight">THEIAKSHI ENTERPRISE</h3>
                  <p className="text-[11px] text-slate-400">Mobile Employee Portal Login</p>
                </div>

                <form onSubmit={handleMobileLogin} className="space-y-3 bg-slate-900 p-4 rounded-2xl border border-slate-800">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={mobileAuthForm.email}
                      onChange={e => setMobileAuthForm({ ...mobileAuthForm, email: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Password</label>
                    <input
                      type="password"
                      value={mobileAuthForm.password}
                      onChange={e => setMobileAuthForm({ ...mobileAuthForm, password: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 font-bold text-white rounded-xl text-xs shadow-md mt-2 flex items-center justify-center space-x-2"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Sign In Mobile App</span>}
                  </button>
                </form>
              </div>
            )}

            {/* SCREEN 2: DASHBOARD */}
            {currentScreen === 'dashboard' && (
              <div className="space-y-4">
                {/* Hero Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900 border border-blue-800/60 shadow-lg relative overflow-hidden">
                  <div className="text-[11px] font-semibold text-blue-300">Welcome back 👋</div>
                  <div className="font-black text-base text-white mt-0.5">{user?.employeeName}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-1">{user?.email} • {user?.role}</div>

                  <div className="mt-3 pt-3 border-t border-blue-800/40 flex items-center justify-between text-[11px]">
                    <span className="text-blue-200">Today: {new Date().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    <span className="font-bold text-emerald-400">{todayAttendance?.status || 'NOT CHECKED IN'}</span>
                  </div>
                </div>

                {/* GPS Clock In / Clock Out Quick Action */}
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-xs text-white flex items-center space-x-1.5">
                      <MapPin className="w-4 h-4 text-emerald-400" />
                      <span>GPS Attendance Punch</span>
                    </div>
                    <button
                      onClick={requestGpsLocation}
                      className="text-[10px] text-blue-400 font-bold hover:underline"
                    >
                      Locate GPS
                    </button>
                  </div>

                  <div className="text-[10px] text-slate-400 font-mono bg-slate-950 p-2 rounded-xl border border-slate-800 truncate">
                    {gpsAddress}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleGpsCheckIn}
                      disabled={loading || !!todayAttendance?.checkInTime}
                      className="py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 font-bold text-white rounded-xl text-xs flex items-center justify-center space-x-1 shadow-xs"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Clock In</span>
                    </button>

                    <button
                      onClick={handleGpsCheckOut}
                      disabled={loading || !todayAttendance?.checkInTime || !!todayAttendance?.checkOutTime}
                      className="py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 font-bold text-white rounded-xl text-xs flex items-center justify-center space-x-1 shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Clock Out</span>
                    </button>
                  </div>
                </div>

                {/* Mobile Quick Apps Grid */}
                <div>
                  <div className="font-bold text-xs text-slate-300 mb-2">Mobile Apps & Services</div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { screen: 'attendance', label: 'Attendance', icon: CalendarCheck, color: 'text-blue-400' },
                      { screen: 'leave', label: 'Leave', icon: Clock, color: 'text-purple-400' },
                      { screen: 'expenses', label: 'Expenses', icon: Receipt, color: 'text-emerald-400' },
                      { screen: 'timesheets', label: 'Timesheet', icon: Briefcase, color: 'text-amber-400' },
                      { screen: 'holidays', label: 'Holidays', icon: Calendar, color: 'text-rose-400' },
                      { screen: 'payslips', label: 'Payslips', icon: CircleDollarSign, color: 'text-emerald-400' },
                      { screen: 'notifications', label: 'Alerts', icon: Bell, color: 'text-sky-400' },
                      { screen: 'helpdesk', label: 'Support', icon: HelpCircle, color: 'text-indigo-400' }
                    ].map(app => {
                      const Icon = app.icon;
                      return (
                        <button
                          key={app.screen}
                          onClick={() => setCurrentScreen(app.screen as MobileScreen)}
                          className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center transition-all group"
                        >
                          <Icon className={`w-5 h-5 mb-1 ${app.color}`} />
                          <span className="text-[10px] font-bold text-slate-300 group-hover:text-white leading-tight">{app.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* SCREEN 3: ATTENDANCE */}
            {currentScreen === 'attendance' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-white">Attendance Logs</div>
                  <div className="flex space-x-1">
                    <button onClick={() => setCurrentScreen('checkin')} className="px-2.5 py-1 bg-blue-600 font-bold rounded-lg text-[10px] text-white">
                      In GPS
                    </button>
                    <button onClick={() => setCurrentScreen('checkout')} className="px-2.5 py-1 bg-emerald-600 font-bold rounded-lg text-[10px] text-white">
                      Out GPS
                    </button>
                  </div>
                </div>

                {attendance.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs">No attendance records found.</div>
                ) : (
                  attendance.map((a: any) => (
                    <div key={a.id} className="p-3 bg-slate-900 rounded-2xl border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{a.date}</span>
                        {renderBadge(a.status)}
                      </div>
                      <div className="text-[10px] text-slate-400 flex justify-between font-mono">
                        <span>In: {a.checkInTime ? new Date(a.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                        <span>Out: {a.checkOutTime ? new Date(a.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                        <span>{a.workingHours || 0} hrs</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* SCREEN 4: CHECK IN */}
            {currentScreen === 'checkin' && (
              <div className="space-y-4">
                <div className="font-bold text-xs text-white">GPS Check-In Punch</div>
                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs">
                    <Navigation className="w-4 h-4" />
                    <span>Real-Time Device GPS Location</span>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-300 font-mono">
                    {gpsAddress}
                  </div>

                  {gpsError && <div className="text-[10px] text-amber-400">{gpsError}</div>}

                  <button
                    onClick={handleGpsCheckIn}
                    disabled={loading || !!todayAttendance?.checkInTime}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-md"
                  >
                    {loading ? 'Validating Geofence...' : todayAttendance?.checkInTime ? 'Already Checked In Today' : 'Confirm GPS Check-In'}
                  </button>
                </div>
              </div>
            )}

            {/* SCREEN 5: CHECK OUT */}
            {currentScreen === 'checkout' && (
              <div className="space-y-4">
                <div className="font-bold text-xs text-white">GPS Check-Out Punch</div>
                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center space-x-2 text-blue-400 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Punch Out Verification</span>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-300 font-mono">
                    {gpsAddress}
                  </div>

                  <button
                    onClick={handleGpsCheckOut}
                    disabled={loading || !todayAttendance?.checkInTime || !!todayAttendance?.checkOutTime}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-md"
                  >
                    {loading ? 'Recording Punch Out...' : todayAttendance?.checkOutTime ? 'Already Checked Out' : 'Confirm GPS Check-Out'}
                  </button>
                </div>
              </div>
            )}

            {/* SCREEN 6: LEAVE */}
            {currentScreen === 'leave' && (
              <div className="space-y-4">
                <div className="font-bold text-xs text-white">Apply Leave Application</div>

                <form onSubmit={handleApplyLeave} className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Leave Type</label>
                    <select
                      value={leaveForm.leaveTypeId}
                      onChange={e => setLeaveForm({ ...leaveForm, leaveTypeId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                      required
                    >
                      <option value="">Select Leave Type</option>
                      {leaveTypes.map((lt: any) => (
                        <option key={lt.id} value={lt.id}>{lt.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Start Date</label>
                      <input
                        type="date"
                        value={leaveForm.startDate}
                        onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">End Date</label>
                      <input
                        type="date"
                        value={leaveForm.endDate}
                        onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reason</label>
                    <textarea
                      rows={2}
                      value={leaveForm.reason}
                      onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                      placeholder="Reason for leave..."
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-500 font-bold text-white rounded-xl text-xs shadow-xs"
                  >
                    Submit Leave Application
                  </button>
                </form>

                <div className="font-bold text-xs text-white pt-2">Submitted Leave Requests</div>
                {leaves.map((l: any) => (
                  <div key={l.id} className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-white">{l.startDate} to {l.endDate}</span>
                      {renderBadge(l.status)}
                    </div>
                    <div className="text-[10px] text-slate-400">{l.reason}</div>
                  </div>
                ))}
              </div>
            )}

            {/* SCREEN 7: EXPENSES */}
            {currentScreen === 'expenses' && (
              <div className="space-y-4">
                <div className="font-bold text-xs text-white">Submit Expense Claim</div>

                <form onSubmit={handleSubmitExpense} className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Expense Category</label>
                    <select
                      value={expenseForm.categoryId}
                      onChange={e => setExpenseForm({ ...expenseForm, categoryId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                      required
                    >
                      <option value="">Select Category</option>
                      {expenseCategories.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount (₹)</label>
                      <input
                        type="number"
                        placeholder="1500"
                        value={expenseForm.amount}
                        onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Expense Date</label>
                      <input
                        type="date"
                        value={expenseForm.expenseDate}
                        onChange={e => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Description</label>
                    <input
                      type="text"
                      placeholder="Client meeting dinner..."
                      value={expenseForm.description}
                      onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 font-bold text-white rounded-xl text-xs"
                  >
                    Submit Reimbursement Claim
                  </button>
                </form>

                <div className="font-bold text-xs text-white pt-2">Expense Claims History</div>
                {expenses.map((exp: any) => (
                  <div key={exp.id} className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white">{exp.description}</div>
                      <div className="text-[10px] text-slate-400">{exp.expenseDate}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-emerald-400">₹{exp.amount}</div>
                      {renderBadge(exp.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SCREEN 8: TIMESHEETS */}
            {currentScreen === 'timesheets' && (
              <div className="space-y-4">
                <div className="font-bold text-xs text-white">Log Work Hours</div>

                <form onSubmit={handleSubmitTimesheet} className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Project</label>
                    <select
                      value={timesheetForm.projectId}
                      onChange={e => setTimesheetForm({ ...timesheetForm, projectId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                    >
                      <option value="">Select Project</option>
                      {projects.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Hours Spent</label>
                      <input
                        type="number"
                        step="0.5"
                        value={timesheetForm.hours}
                        onChange={e => setTimesheetForm({ ...timesheetForm, hours: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date</label>
                      <input
                        type="date"
                        value={timesheetForm.date}
                        onChange={e => setTimesheetForm({ ...timesheetForm, date: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Task Summary</label>
                    <input
                      type="text"
                      placeholder="Completed API development..."
                      value={timesheetForm.taskDescription}
                      onChange={e => setTimesheetForm({ ...timesheetForm, taskDescription: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-500 font-bold text-white rounded-xl text-xs"
                  >
                    Submit Timesheet Entry
                  </button>
                </form>

                <div className="font-bold text-xs text-white pt-2">Logged Timesheets</div>
                {timesheets.map((ts: any) => (
                  <div key={ts.id} className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-white">{ts.taskDescription}</div>
                      <div className="text-[10px] text-slate-400">{ts.date} • {ts.hours} hrs</div>
                    </div>
                    {renderBadge(ts.status)}
                  </div>
                ))}
              </div>
            )}

            {/* SCREEN 9: HOLIDAYS */}
            {currentScreen === 'holidays' && (
              <div className="space-y-3">
                <div className="font-bold text-xs text-white">Company Holidays List</div>
                {holidays.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-xs">No holidays scheduled.</div>
                ) : (
                  holidays.map((h: any) => (
                    <div key={h.id} className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white">{h.name}</div>
                        <div className="text-[10px] text-slate-400">{h.date} ({h.type || 'Mandatory'})</div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 font-bold text-[10px]">
                        Holiday
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* SCREEN 10: PAYSLIPS */}
            {currentScreen === 'payslips' && (
              <div className="space-y-3">
                <div className="font-bold text-xs text-white">Mobile Payslips & Earnings</div>
                {payrollRecords.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-xs">No payslip records available.</div>
                ) : (
                  payrollRecords.map((p: any) => (
                    <div key={p.id} className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white text-xs">{p.periodName || 'Salary Payout'}</span>
                        {renderBadge(p.status || 'PAID')}
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Net Salary:</span>
                        <span className="font-mono font-black text-emerald-400 text-sm">₹{(p.netSalary || 119500).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 flex justify-between font-mono pt-1 border-t border-slate-800">
                        <span>Gross: ₹{(p.grossEarnings || 135000).toLocaleString('en-IN')}</span>
                        <span>Deductions: ₹{(p.totalDeductions || 15500).toLocaleString('en-IN')}</span>
                      </div>
                      <button
                        onClick={() => setStatusMsg({ text: 'Downloading PDF payslip to mobile device storage...', type: 'info' })}
                        className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-[11px] mt-1"
                      >
                        Download PDF Payslip
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* SCREEN 11: NOTIFICATIONS */}
            {currentScreen === 'notifications' && (
              <div className="space-y-3">
                <div className="font-bold text-xs text-white">Push Notifications</div>
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-xs">No push notifications.</div>
                ) : (
                  notifications.map((n: any) => (
                    <div key={n.id} className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white">{n.title}</span>
                        <span className="text-[9px] text-slate-400 font-mono">{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="text-[11px] text-slate-300">{n.message}</div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* SCREEN 12: PROFILE */}
            {currentScreen === 'profile' && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-blue-600 text-white font-black text-xl flex items-center justify-center mx-auto border-2 border-blue-400">
                    {user?.employeeName?.[0] || 'U'}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-white">{user?.employeeName}</div>
                    <div className="text-[11px] text-slate-400">{user?.email}</div>
                    <div className="mt-1 inline-block px-2 py-0.5 bg-blue-950 text-blue-300 rounded-full text-[10px] font-bold border border-blue-800 uppercase">
                      {user?.role}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-left text-[11px]">
                    <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
                      <div className="text-slate-500 text-[9px] font-bold">EMP CODE</div>
                      <div className="font-mono text-white font-bold">{user?.employeeCode || 'EMP-101'}</div>
                    </div>
                    <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
                      <div className="text-slate-500 text-[9px] font-bold">LOCATION</div>
                      <div className="font-semibold text-white truncate">Bengaluru HQ</div>
                    </div>
                  </div>

                  <button
                    onClick={onLogout}
                    className="w-full py-2 bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800 font-bold rounded-xl text-xs mt-2"
                  >
                    Sign Out Mobile App
                  </button>
                </div>
              </div>
            )}

            {/* SCREEN 13: HELPDESK */}
            {currentScreen === 'helpdesk' && (
              <div className="space-y-4">
                <div className="font-bold text-xs text-white">Create HR Support Ticket</div>

                <form onSubmit={handleSubmitHelpdesk} className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Subject</label>
                    <input
                      type="text"
                      placeholder="Salary query / IT support..."
                      value={helpdeskForm.subject}
                      onChange={e => setHelpdeskForm({ ...helpdeskForm, subject: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Category</label>
                      <select
                        value={helpdeskForm.category}
                        onChange={e => setHelpdeskForm({ ...helpdeskForm, category: e.target.value })}
                        className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                      >
                        <option value="HR">HR</option>
                        <option value="PAYROLL">Payroll</option>
                        <option value="IT">IT Support</option>
                        <option value="GENERAL">General</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Priority</label>
                      <select
                        value={helpdeskForm.priority}
                        onChange={e => setHelpdeskForm({ ...helpdeskForm, priority: e.target.value })}
                        className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Issue Details</label>
                    <textarea
                      rows={2}
                      value={helpdeskForm.description}
                      onChange={e => setHelpdeskForm({ ...helpdeskForm, description: e.target.value })}
                      placeholder="Explain your issue..."
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 font-bold text-white rounded-xl text-xs"
                  >
                    Submit Ticket
                  </button>
                </form>

                <div className="font-bold text-xs text-white pt-2">Helpdesk Tickets</div>
                {helpdeskTickets.map((t: any) => (
                  <div key={t.id} className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-white">{t.subject}</span>
                      {renderBadge(t.status)}
                    </div>
                    <div className="text-[10px] text-slate-400">{t.description}</div>
                  </div>
                ))}
              </div>
            )}

          </div>

          {/* Bottom Fixed Navigation Bar */}
          <div className="bg-slate-900 border-t border-slate-800 px-2 py-2 flex justify-around items-center shrink-0">
            <button
              onClick={() => setCurrentScreen('dashboard')}
              className={`flex flex-col items-center text-[10px] ${currentScreen === 'dashboard' ? 'text-blue-400 font-bold' : 'text-slate-400'}`}
            >
              <Smartphone className="w-4 h-4" />
              <span>Home</span>
            </button>

            <button
              onClick={() => setCurrentScreen('attendance')}
              className={`flex flex-col items-center text-[10px] ${['attendance', 'checkin', 'checkout'].includes(currentScreen) ? 'text-blue-400 font-bold' : 'text-slate-400'}`}
            >
              <MapPin className="w-4 h-4" />
              <span>GPS</span>
            </button>

            <button
              onClick={() => setCurrentScreen('leave')}
              className={`flex flex-col items-center text-[10px] ${currentScreen === 'leave' ? 'text-blue-400 font-bold' : 'text-slate-400'}`}
            >
              <Clock className="w-4 h-4" />
              <span>Leave</span>
            </button>

            <button
              onClick={() => setCurrentScreen('expenses')}
              className={`flex flex-col items-center text-[10px] ${currentScreen === 'expenses' ? 'text-blue-400 font-bold' : 'text-slate-400'}`}
            >
              <Receipt className="w-4 h-4" />
              <span>Claim</span>
            </button>

            <button
              onClick={() => setCurrentScreen('payslips')}
              className={`flex flex-col items-center text-[10px] ${currentScreen === 'payslips' ? 'text-blue-400 font-bold' : 'text-slate-400'}`}
            >
              <CircleDollarSign className="w-4 h-4" />
              <span>Payslip</span>
            </button>

            <button
              onClick={() => setCurrentScreen('profile')}
              className={`flex flex-col items-center text-[10px] ${currentScreen === 'profile' ? 'text-blue-400 font-bold' : 'text-slate-400'}`}
            >
              <User className="w-4 h-4" />
              <span>Profile</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
