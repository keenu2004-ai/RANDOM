import React, { useEffect, useState } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  CalendarDays,
  Receipt,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  MapPin,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { hrmsApi } from '../../lib/api-client';

interface DashboardViewProps {
  user: any;
  onNavigateTab: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ user, onNavigateTab }) => {
  const [stats, setStats] = useState<any>(null);
  const [charts, setCharts] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, chartsRes] = await Promise.all([
        hrmsApi.getStats(),
        hrmsApi.getCharts()
      ]);
      setStats(statsRes);
      setCharts(chartsRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-medium text-xs">
        Loading real database analytics for THEIAKSHI ENTERPRISE...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
        {error}
      </div>
    );
  }

  return (
    <div id="dashboard-view-root" className="space-y-6">
      {/* Top Banner & Quick Status */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 text-[11px] font-semibold bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-md border border-blue-400/30 mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Welcome Back, {user?.employeeName}</span>
            </div>
            <h2 className="text-xl font-black tracking-tight text-white">
              {stats?.organization?.orgName || 'THEIAKSHI ENTERPRISE'}
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Geofenced HQ: {stats?.organization?.officeLatitude}, {stats?.organization?.officeLongitude} (Radius: {stats?.organization?.allowedGeofenceRadiusMeters}m). Currency: ₹ INR.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => onNavigateTab('attendance')}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all flex items-center space-x-2"
            >
              <MapPin className="w-4 h-4" />
              <span>GPS Check-In Panel</span>
            </button>
            <button
              onClick={() => onNavigateTab('leaves')}
              className="bg-white/10 hover:bg-white/20 text-white font-semibold text-xs px-4 py-2.5 rounded-xl border border-white/20 transition-all"
            >
              Apply Leave
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Employees */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Active Headcount</span>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{stats?.activeEmployees || 0}</div>
            <div className="text-[11px] text-slate-500 mt-1">Out of {stats?.totalEmployees || 0} total enrolled</div>
          </div>
        </div>

        {/* Present Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Present Today</span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-600">{stats?.presentToday || 0}</div>
            <div className="text-[11px] text-slate-500 mt-1">
              Includes <strong className="text-amber-600">{stats?.lateToday || 0}</strong> late arrivals
            </div>
          </div>
        </div>

        {/* On Leave Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">On Leave Today</span>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <CalendarDays className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-600">{stats?.onLeaveToday || 0}</div>
            <div className="text-[11px] text-slate-500 mt-1">Approved leave records</div>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Pending Approvals</span>
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-purple-600">
              {(stats?.pendingLeaveRequests || 0) + (stats?.pendingExpenseRequests || 0)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {stats?.pendingLeaveRequests || 0} Leaves, {stats?.pendingExpenseRequests || 0} Expenses
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Charts & Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Distribution */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Headcount by Department</h3>
              <p className="text-xs text-slate-500">Live breakdown calculated from database records</p>
            </div>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">Real DB</span>
          </div>

          <div className="space-y-3 pt-2">
            {charts?.departmentDistribution?.map((dept: any, idx: number) => {
              const max = Math.max(...charts.departmentDistribution.map((d: any) => d.value || d.count || 0), 1);
              const count = dept.value || dept.count || 0;
              const percentage = Math.round((count / max) * 100);

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-slate-700">
                    <span>{dept.name}</span>
                    <span className="font-bold text-slate-900">{count} Employees</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Holidays Widget */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900">Upcoming Holidays</h3>
            <button
              onClick={() => onNavigateTab('leaves')}
              className="text-xs text-blue-600 hover:underline font-semibold"
            >
              View Calendar
            </button>
          </div>

          <div className="space-y-3">
            {stats?.upcomingHolidays?.length === 0 ? (
              <div className="text-xs text-slate-400 py-4 text-center">No upcoming holidays scheduled</div>
            ) : (
              stats?.upcomingHolidays?.map((h: any) => (
                <div key={h.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div>
                    <div className="font-bold text-xs text-slate-900">{h.name}</div>
                    <div className="text-[11px] text-slate-500">{h.description || h.type}</div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">
                      {h.date}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
