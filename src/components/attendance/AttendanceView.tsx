import React, { useEffect, useState } from 'react';
import {
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Compass,
  Navigation,
  Calendar,
  ShieldCheck,
  Building,
  Filter,
  Search,
  Plus,
  Edit3,
  Settings,
  Users,
  Coffee,
  Download,
  RefreshCw,
  FileText,
  Check,
  RotateCcw,
  Info,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  Briefcase
} from 'lucide-react';
import { hrmsApi } from '../../lib/api-client';
import { AttendanceRecord, AttendanceStatus, Employee, AttendanceRegularizationRequest, TimesheetCorrectionRequest, LeaveCorrectionRequest, PayrollAdjustment } from '../../types/hrms';

interface AttendanceViewProps {
  userRole: string;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({ userRole }) => {
  const isAdminOrManager = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(userRole);

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<'MY_ATTENDANCE' | 'WORKFORCE' | 'SETTINGS'>(
    'MY_ATTENDANCE'
  );

  // Common State
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Employee Personal Attendance State
  const [myAttendance, setMyAttendance] = useState<AttendanceRecord[]>([]);
  const [todayData, setTodayData] = useState<{
    record: AttendanceRecord | null;
    isCheckedIn: boolean;
    isCheckedOut: boolean;
    onBreak: boolean;
    shift: any;
  } | null>(null);

  // Live GPS state
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null>(null);
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(null);

  // Calendar Month/Year state
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());


  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Workforce Attendance State (Admin/Manager)
  const [workforceAttendance, setWorkforceAttendance] = useState<AttendanceRecord[]>([]);
  const [workforceStats, setWorkforceStats] = useState<{
    date: string;
    totalEmployees: number;
    present: number;
    late: number;
    absent: number;
    onLeave: number;
    halfDay: number;
    weekOff: number;
    avgWorkingHours: number;
  } | null>(null);

  // Workforce Filters
  const [filterDate, setFilterDate] = useState(now.toISOString().split('T')[0]);
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [departments, setDepartments] = useState<any[]>([]);
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);

  // Manual Correction Modal State
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({
    employeeId: '',
    date: now.toISOString().split('T')[0],
    status: 'PRESENT' as AttendanceStatus,
    checkInTime: '09:00',
    checkOutTime: '18:00',
    notes: ''
  });

  // Settings State
  const [settingsForm, setSettingsForm] = useState({
    officeLatitude: 28.6209,
    officeLongitude: 77.1363,
    allowedGeofenceRadiusMeters: 500,
    enforceGpsCheckIn: true,
    shiftStartTime: '09:00',
    shiftEndTime: '18:00',
    gracePeriodMinutes: 15
  });

  useEffect(() => {
    loadInitialData();
    requestLocation();
  }, [page, limit, sortBy, sortOrder, selectedMonth, selectedYear]);

  useEffect(() => {
    if (activeTab === 'WORKFORCE') {
      loadWorkforceData();
    } else if (activeTab === 'SETTINGS') {
      loadSettingsData();
    }
  }, [activeTab, filterDate, filterDepartment, filterStatus, page, limit, sortBy, sortOrder]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [todayRes, myAttRes, settingsRes, deptRes] = await Promise.all([
        hrmsApi.getTodayAttendance(),
        hrmsApi.getAttendance({ month: String(selectedMonth), year: String(selectedYear), page: String(page), limit: String(limit), sortBy, sortOrder }),
        hrmsApi.getAttendanceSettings(),
        hrmsApi.getOrganizationMeta().catch(() => ({ departments: [] }))
      ]);

      setTodayData(todayRes);
      setMyAttendance(myAttRes.data || myAttRes);
      if (myAttRes.pagination) {
        setTotal(myAttRes.pagination.total);
        setTotalPages(myAttRes.pagination.totalPages);
      }
      setDepartments(deptRes.departments || []);

      if (settingsRes) {
        setSettingsForm({
          officeLatitude: settingsRes.officeLatitude || 28.6209,
          officeLongitude: settingsRes.officeLongitude || 77.1363,
          allowedGeofenceRadiusMeters: settingsRes.allowedGeofenceRadiusMeters || 500,
          enforceGpsCheckIn: settingsRes.enforceGpsCheckIn ?? true,
          shiftStartTime: settingsRes.defaultShift?.startTime || '09:00',
          shiftEndTime: settingsRes.defaultShift?.endTime || '18:00',
          gracePeriodMinutes: settingsRes.defaultShift?.gracePeriodMinutes || 15
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const loadWorkforceData = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {
        date: filterDate,
        page: String(page),
        limit: String(limit),
        sortBy,
        sortOrder
      };
      if (filterDepartment) params.departmentId = filterDepartment;
      if (filterStatus) params.status = filterStatus;

      const [attRes, statsRes, empRes] = await Promise.all([
        hrmsApi.getAttendance(params),
        hrmsApi.getAttendanceStats({ date: filterDate, departmentId: filterDepartment }),
        hrmsApi.getEmployees().catch(() => ({ employees: [] }))
      ]);

      setWorkforceAttendance(attRes.data || attRes);
      if (attRes.pagination) {
        setTotal(attRes.pagination.total);
        setTotalPages(attRes.pagination.totalPages);
      }
      setWorkforceStats(statsRes);
      if (empRes?.data || empRes?.employees) {
        setEmployeesList(empRes.data || empRes.employees || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load workforce attendance data');
    } finally {
      setLoading(false);
    }
  };

  const loadSettingsData = async () => {
    try {
      setLoading(true);
      const res = await hrmsApi.getAttendanceSettings();
      if (res) {
        setSettingsForm({
          officeLatitude: res.officeLatitude || 28.6209,
          officeLongitude: res.officeLongitude || 77.1363,
          allowedGeofenceRadiusMeters: res.allowedGeofenceRadiusMeters || 500,
          enforceGpsCheckIn: res.enforceGpsCheckIn ?? true,
          shiftStartTime: res.defaultShift?.startTime || '09:00',
          shiftEndTime: res.defaultShift?.endTime || '18:00',
          gracePeriodMinutes: res.defaultShift?.gracePeriodMinutes || 15
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const requestLocation = () => {
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser or device.');
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
        setCurrentCoords(coords);

        const dist = calculateDistanceMeters(
          coords.latitude,
          coords.longitude,
          settingsForm.officeLatitude,
          settingsForm.officeLongitude
        );
        setCalculatedDistance(dist);
        setGpsLoading(false);
      },
      err => {
        setGpsLoading(false);
        console.warn('Geolocation permission error:', err.message);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError(
            'Location access permission was denied. Location permission is required when mandatory attendance location is enabled. Please allow location access in your browser site settings and try again.'
          );
        } else {
          setGpsError('Unable to retrieve current location fix: ' + err.message);
        }
        // Set fallback coordinates for demonstration/testing if blocked in iFrame
        const fallback = { latitude: 28.6209, longitude: 77.1363, accuracy: 10 };
        setCurrentCoords(fallback);
        setCalculatedDistance(0);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  }

  const handleCheckIn = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser or device.');
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setActionLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude, accuracy } = pos.coords;
          await hrmsApi.checkIn({
            latitude,
            longitude,
            accuracy,
            address: `Geofenced Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
          });
          setSuccessMsg('Check-In successful! Attendance recorded in database and synchronized.');
          await loadInitialData();
        } catch (err: any) {
          setError(err.message || 'Check-In failed');
        } finally {
          setActionLoading(false);
        }
      },
      (err) => {
        setActionLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setError('Location access permission was denied. Location permission is required when mandatory attendance location is enabled. Please allow location access in your browser site settings and try again.');
        } else if (err.code === err.TIMEOUT) {
          setError('Location request timed out. Please try again.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError('Location information is unavailable.');
        } else {
          setError('Unable to retrieve current location fix: ' + err.message);
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleCheckOut = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser or device.');
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setActionLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude, accuracy } = pos.coords;
          await hrmsApi.checkOut({
            latitude,
            longitude,
            accuracy,
            address: `Check-out Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
          });
          setSuccessMsg('Check-Out successful! Net working hours calculated and saved.');
          await loadInitialData();
        } catch (err: any) {
          setError(err.message || 'Check-Out failed');
        } finally {
          setActionLoading(false);
        }
      },
      (err) => {
        setActionLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setError('Location access permission was denied. Location permission is required when mandatory attendance location is enabled. Please allow location access in your browser site settings and try again.');
        } else if (err.code === err.TIMEOUT) {
          setError('Location request timed out. Please try again.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError('Location information is unavailable.');
        } else {
          setError('Unable to retrieve current location fix: ' + err.message);
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleToggleBreak = async () => {
    if (!todayData?.record) return;
    setError(null);
    setSuccessMsg(null);
    setActionLoading(true);

    try {
      if (todayData.onBreak) {
        const res = await hrmsApi.endBreak();
        setSuccessMsg(res.message || 'Break ended successfully');
      } else {
        const res = await hrmsApi.startBreak();
        setSuccessMsg('Break started. Enjoy your break!');
      }
      loadInitialData();
    } catch (err: any) {
      setError(err.message || 'Failed to update break status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveManualCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionForm.employeeId || !correctionForm.date) {
      alert('Please select an employee and date');
      return;
    }

    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      // Build ISO strings for checkInTime / checkOutTime if provided
      let checkInIso = undefined;
      let checkOutIso = undefined;

      if (correctionForm.checkInTime) {
        checkInIso = new Date(`${correctionForm.date}T${correctionForm.checkInTime}:00`).toISOString();
      }
      if (correctionForm.checkOutTime) {
        checkOutIso = new Date(`${correctionForm.date}T${correctionForm.checkOutTime}:00`).toISOString();
      }

      await hrmsApi.submitManualAttendance({
        employeeId: correctionForm.employeeId,
        date: correctionForm.date,
        status: correctionForm.status,
        checkInTime: checkInIso,
        checkOutTime: checkOutIso,
        notes: correctionForm.notes
      });

      setSuccessMsg('Attendance manual correction saved successfully.');
      setShowCorrectionModal(false);
      loadWorkforceData();
    } catch (err: any) {
      setError(err.message || 'Failed to save attendance correction');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await hrmsApi.updateAttendanceSettings(settingsForm);
      setSuccessMsg('Geofence & Shift settings updated successfully!');
      loadSettingsData();
    } catch (err: any) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setActionLoading(false);
    }
  };

  const exportWorkforceCsv = () => {
    if (workforceAttendance.length === 0) {
      alert('No records available to export');
      return;
    }

    const headers = ['Employee Code', 'Employee Name', 'Department', 'Date', 'Status', 'Check-In', 'Check-Out', 'Working Hours', 'Notes'];
    const rows = workforceAttendance.map(a => [
      a.employeeCode || '-',
      `"${a.employeeName || ''}"`,
      `"${a.departmentName || ''}"`,
      a.date,
      a.status,
      a.checkInTime ? new Date(a.checkInTime).toLocaleTimeString() : '-',
      a.checkOutTime ? new Date(a.checkOutTime).toLocaleTimeString() : '-',
      a.workingHours || 0,
      `"${a.notes || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `THEIAKSHI_Attendance_${filterDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isGeofenceValid =
    calculatedDistance !== null && calculatedDistance <= settingsForm.allowedGeofenceRadiusMeters;

  // Filter workforce table by client search query
  const filteredWorkforceList = workforceAttendance.filter(a => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.employeeName?.toLowerCase().includes(q) ||
      a.employeeCode?.toLowerCase().includes(q) ||
      a.departmentName?.toLowerCase().includes(q) ||
      a.status.toLowerCase().includes(q)
    );
  });

  return (
    <div id="attendance-module-root" className="space-y-6">
      {/* Header & Tabs Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <MapPin className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                GPS Geofenced Attendance Management
              </h1>
              <p className="text-xs text-slate-500">
                Real-time satellite coordinate validation & workforce tracking
              </p>
            </div>
          </div>
        </div>

        {/* Tab Buttons for Admin/Managers */}
        {isAdminOrManager && (
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              id="tab-my-attendance"
              onClick={() => setActiveTab('MY_ATTENDANCE')}
              className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-1.5 ${activeTab === 'MY_ATTENDANCE'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <Compass className="w-4 h-4" />
              <span>My Geofence Check-In</span>
            </button>

            <button
              id="tab-workforce-attendance"
              onClick={() => setActiveTab('WORKFORCE')}
              className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-1.5 ${activeTab === 'WORKFORCE'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <Users className="w-4 h-4" />
              <span>Workforce Attendance</span>
            </button>

            {['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(userRole) && (
              <button
                id="tab-attendance-settings"
                onClick={() => setActiveTab('SETTINGS')}
                className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-1.5 ${activeTab === 'SETTINGS'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <Settings className="w-4 h-4" />
                <span>Geofence & Shifts</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error and Success Notifications */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-xs rounded-2xl flex items-start space-x-3 shadow-xs">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-bold">Attendance System Warning</div>
            <div>{error}</div>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            &times;
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-start space-x-3 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-semibold">{successMsg}</div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            &times;
          </button>
        </div>
      )}

      {/* GPS Location Permission Denied Warning Card */}
      {gpsError && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-2xl flex items-start space-x-3 shadow-xs">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <div className="font-bold">Location Permission Needed</div>
            <div>{gpsError}</div>
            <button
              onClick={requestLocation}
              className="mt-2 inline-flex items-center space-x-1 bg-amber-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-amber-700 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
              <span>Retry Location Permission Request</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: MY GEOFENCED ATTENDANCE */}
      {activeTab === 'MY_ATTENDANCE' && (
        <div className="space-y-6">
          {/* Geofence Radar Box & Today's Control Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Live GPS Radar Card */}
            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Compass className="w-5 h-5 text-blue-400 animate-spin-slow" />
                  <span className="font-bold text-sm text-white">Live Geofence Location Monitor</span>
                </div>
                <button
                  onClick={requestLocation}
                  disabled={gpsLoading}
                  className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 flex items-center space-x-1"
                >
                  <RefreshCw className={`w-3 h-3 ${gpsLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh Satellite GPS</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Current Coords */}
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-slate-400 font-semibold block text-[11px]">Your Current Position</span>
                  {gpsLoading ? (
                    <div className="text-slate-400 font-medium animate-pulse flex items-center space-x-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                      <span>Acquiring satellite fix...</span>
                    </div>
                  ) : currentCoords ? (
                    <div>
                      <div className="text-base font-black text-white font-mono">
                        {currentCoords.latitude.toFixed(4)}°, {currentCoords.longitude.toFixed(4)}°
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                        <span>Accuracy: ±{Math.round(currentCoords.accuracy || 5)}m</span>
                        <span className="text-emerald-400 font-bold">GPS Active</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-red-400 font-bold">Location Permission Denied / Unavailable</div>
                  )}
                </div>

                {/* Office Target & Radius */}
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-slate-400 font-semibold block text-[11px]">Office Geofence Target</span>
                  <div className="text-base font-black text-white font-mono">
                    {settingsForm.officeLatitude.toFixed(4)}°, {settingsForm.officeLongitude.toFixed(4)}°
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Allowed Radius: {settingsForm.allowedGeofenceRadiusMeters}m</span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[10px] ${isGeofenceValid
                          ? 'bg-emerald-900/80 text-emerald-300 border border-emerald-700'
                          : 'bg-red-900/80 text-red-300 border border-red-700'
                        }`}
                    >
                      {calculatedDistance !== null ? `${calculatedDistance}m away` : 'Calculating...'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: CHECK IN, CHECK OUT, BREAK */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  id="btn-attendance-checkin"
                  onClick={handleCheckIn}
                  disabled={actionLoading || (!!todayData?.record && !!todayData.record.checkInTime)}
                  className="w-full sm:w-1/3 py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Navigation className="w-4 h-4" />
                  <span>
                    {todayData?.record?.checkInTime
                      ? `Checked In (${new Date(todayData.record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                      : 'CHECK IN NOW'}
                  </span>
                </button>

                <button
                  id="btn-attendance-checkout"
                  onClick={handleCheckOut}
                  disabled={
                    actionLoading ||
                    !todayData?.record ||
                    !todayData.record.checkInTime ||
                    !!todayData.record.checkOutTime
                  }
                  className="w-full sm:w-1/3 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Clock className="w-4 h-4" />
                  <span>
                    {todayData?.record?.checkOutTime
                      ? `Checked Out (${new Date(todayData.record.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                      : 'CHECK OUT NOW'}
                  </span>
                </button>

                <button
                  id="btn-attendance-break"
                  onClick={handleToggleBreak}
                  disabled={
                    actionLoading ||
                    !todayData?.record ||
                    !todayData.record.checkInTime ||
                    !!todayData.record.checkOutTime
                  }
                  className={`w-full sm:w-1/3 py-3 px-4 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:bg-slate-800 disabled:text-slate-500 ${todayData?.onBreak
                      ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                >
                  <Coffee className="w-4 h-4" />
                  <span>{todayData?.onBreak ? 'END BREAK' : 'TAKE A BREAK'}</span>
                </button>
              </div>
            </div>

            {/* Today Shift Summary Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
                  <span>Today's Shift Status</span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                </h3>

                <div className="mt-4 space-y-3 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500 font-medium">Configured Shift:</span>
                    <span className="font-bold text-slate-900">
                      {settingsForm.shiftStartTime} - {settingsForm.shiftEndTime}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500 font-medium">Check-In Time:</span>
                    <span className="font-bold text-slate-900">
                      {todayData?.record?.checkInTime
                        ? new Date(todayData.record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Pending'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500 font-medium">Check-Out Time:</span>
                    <span className="font-bold text-slate-900">
                      {todayData?.record?.checkOutTime
                        ? new Date(todayData.record.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Pending'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500 font-medium">Break Duration:</span>
                    <span className="font-bold text-amber-600">
                      {todayData?.record?.totalBreakMinutes || 0} Minutes
                    </span>
                  </div>

                  <div className="flex justify-between py-1">
                    <span className="text-slate-500 font-medium">Logged Hours:</span>
                    <span className="font-black text-blue-600 text-sm">
                      {todayData?.record?.workingHours || 0} Hours
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 text-center">
                <span
                  className={`inline-flex items-center space-x-1 px-3.5 py-1 rounded-full text-xs font-bold uppercase ${todayData?.record?.status === 'PRESENT'
                      ? 'bg-emerald-100 text-emerald-800'
                      : todayData?.record?.status === 'LATE'
                        ? 'bg-amber-100 text-amber-800'
                        : todayData?.record?.status === 'HALF_DAY'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Status: {todayData?.record?.status || 'NOT CHECKED IN'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Monthly Attendance Log History Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 font-bold text-sm text-slate-900 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>My Attendance History Log</span>
              </div>

              <div className="text-xs text-slate-500 font-medium">
                Records Month: {selectedMonth}/{selectedYear}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Check-In</th>
                    <th className="px-4 py-3">Check-Out</th>
                    <th className="px-4 py-3">Geofence Status</th>
                    <th className="px-4 py-3">Working Hours</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Location / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myAttendance.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        No attendance history records found for this month.
                      </td>
                    </tr>
                  ) : (
                    myAttendance.map(a => (
                      <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900">{a.date}</td>
                        <td className="px-4 py-3 text-slate-700 font-mono">
                          {a.checkInTime
                            ? new Date(a.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-slate-700 font-mono">
                          {a.checkOutTime
                            ? new Date(a.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center space-x-1 font-medium ${a.inGeofence !== false ? 'text-emerald-700' : 'text-amber-700'
                              }`}
                          >
                            {a.inGeofence !== false ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            )}
                            <span>{a.inGeofence !== false ? 'Inside Geofence' : 'Remote / Out of Radius'}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{a.workingHours || 0} hrs</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${a.status === 'PRESENT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : a.status === 'LATE'
                                  ? 'bg-amber-100 text-amber-800'
                                  : a.status === 'HALF_DAY'
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : a.status === 'ON_LEAVE'
                                      ? 'bg-purple-100 text-purple-800'
                                      : 'bg-red-100 text-red-800'
                              }`}
                          >
                            {a.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                          {a.checkInAddress || a.notes || 'Office Geofence Check-in'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <div>
                Showing page {page} of {totalPages} (Total: {total})
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WORKFORCE ATTENDANCE DASHBOARD (Admin/Manager) */}
      {activeTab === 'WORKFORCE' && isAdminOrManager && (
        <div className="space-y-6">
          {/* Workforce Summary Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-slate-500 font-semibold text-[11px] block">Total Active</span>
              <span className="text-xl font-black text-slate-900 mt-1 block">
                {workforceStats?.totalEmployees || 0}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-emerald-600 font-semibold text-[11px] block">Present Today</span>
              <span className="text-xl font-black text-emerald-600 mt-1 block">
                {workforceStats?.present || 0}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-amber-600 font-semibold text-[11px] block">Late Arrivals</span>
              <span className="text-xl font-black text-amber-600 mt-1 block">
                {workforceStats?.late || 0}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-purple-600 font-semibold text-[11px] block">On Leave</span>
              <span className="text-xl font-black text-purple-600 mt-1 block">
                {workforceStats?.onLeave || 0}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-red-600 font-semibold text-[11px] block">Absent / Unaccounted</span>
              <span className="text-xl font-black text-red-600 mt-1 block">
                {workforceStats?.absent || 0}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-blue-600 font-semibold text-[11px] block">Avg Work Hours</span>
              <span className="text-xl font-black text-blue-600 mt-1 block">
                {workforceStats?.avgWorkingHours || 0} hrs
              </span>
            </div>
          </div>

          {/* Filter Bar & Action Controls */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs w-full lg:w-auto">
              {/* Date Filter */}
              <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
                <Calendar className="w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 focus:outline-none"
                />
              </div>

              {/* Department Filter */}
              <select
                value={filterDepartment}
                onChange={e => setFilterDepartment(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-800 font-bold px-3 py-2 rounded-xl focus:outline-none"
              >
                <option value="">All Departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-800 font-bold px-3 py-2 rounded-xl focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="PRESENT">PRESENT</option>
                <option value="LATE">LATE</option>
                <option value="ABSENT">ABSENT</option>
                <option value="HALF_DAY">HALF_DAY</option>
                <option value="ON_LEAVE">ON_LEAVE</option>
                <option value="WEEK_OFF">WEEK_OFF</option>
              </select>

              {/* Search Box */}
              <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl w-full sm:w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search name/code..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-transparent text-xs text-slate-800 focus:outline-none w-full"
                />
              </div>
            </div>

            {/* Admin Action Buttons */}
            <div className="flex items-center space-x-2">
              {['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(userRole) && (
                <button
                  id="btn-manual-attendance-correction"
                  onClick={() => setShowCorrectionModal(true)}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Manual Correction</span>
                </button>
              )}

              <button
                onClick={exportWorkforceCsv}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Workforce Attendance Roster Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 font-bold text-sm text-slate-900 flex justify-between items-center">
              <span>Workforce Roster ({filteredWorkforceList.length} records)</span>
              <span className="text-xs text-slate-500 font-normal">Date: {filterDate}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Check-In Time</th>
                    <th className="px-4 py-3">Check-Out Time</th>
                    <th className="px-4 py-3">Working Hours</th>
                    <th className="px-4 py-3">Geofence Status</th>
                    <th className="px-4 py-3">Status</th>
                    {['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(userRole) && (
                      <th className="px-4 py-3 text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredWorkforceList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                        No attendance records match the selected filters for {filterDate}.
                      </td>
                    </tr>
                  ) : (
                    filteredWorkforceList.map(a => (
                      <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900">
                          <div>{a.employeeName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{a.employeeCode}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{a.departmentName}</td>
                        <td className="px-4 py-3 font-mono text-slate-800">
                          {a.checkInTime
                            ? new Date(a.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '-'}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-800">
                          {a.checkOutTime
                            ? new Date(a.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '-'}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">{a.workingHours || 0} hrs</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center space-x-1 text-[11px] font-medium ${a.inGeofence !== false ? 'text-emerald-700' : 'text-amber-700'
                              }`}
                          >
                            {a.inGeofence !== false ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            )}
                            <span>{a.inGeofence !== false ? 'Verified' : 'Unverified'}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${a.status === 'PRESENT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : a.status === 'LATE'
                                  ? 'bg-amber-100 text-amber-800'
                                  : a.status === 'HALF_DAY'
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : a.status === 'ON_LEAVE'
                                      ? 'bg-purple-100 text-purple-800'
                                      : 'bg-red-100 text-red-800'
                              }`}
                          >
                            {a.status}
                          </span>
                        </td>
                        {['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(userRole) && (
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => {
                                setCorrectionForm({
                                  employeeId: a.employeeId,
                                  date: a.date,
                                  status: a.status,
                                  checkInTime: a.checkInTime ? new Date(a.checkInTime).toTimeString().substring(0, 5) : '09:00',
                                  checkOutTime: a.checkOutTime ? new Date(a.checkOutTime).toTimeString().substring(0, 5) : '18:00',
                                  notes: a.notes || ''
                                });
                                setShowCorrectionModal(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit / Correct Attendance"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <div>
                Showing page {page} of {totalPages} (Total: {total})
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GEOFENCE & SHIFT SETTINGS (Admin View) */}
      {activeTab === 'SETTINGS' && ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(userRole) && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs max-w-3xl space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900">Organization Geofence & Shift Settings</h3>
            <p className="text-xs text-slate-500">
              Configure latitude/longitude boundaries, allowed GPS radius, and default shift times
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-6 text-xs">
            {/* Office Location Coordinates */}
            <div className="space-y-4">
              <h4 className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                <Building className="w-4 h-4 text-blue-600" />
                <span>Headquarters Office GPS Coordinates</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Office Latitude (°)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={settingsForm.officeLatitude}
                    onChange={e => setSettingsForm({ ...settingsForm, officeLatitude: parseFloat(e.target.value) })}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">Office Longitude (°)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={settingsForm.officeLongitude}
                    onChange={e => setSettingsForm({ ...settingsForm, officeLongitude: parseFloat(e.target.value) })}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">
                    Allowed Radius (Meters)
                  </label>
                  <input
                    type="number"
                    value={settingsForm.allowedGeofenceRadiusMeters}
                    onChange={e =>
                      setSettingsForm({ ...settingsForm, allowedGeofenceRadiusMeters: parseInt(e.target.value, 10) })
                    }
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Check-in is permitted only within this distance from office
                  </span>
                </div>

                <div className="flex items-center pt-5">
                  <label className="relative inline-flex items-center cursor-pointer space-x-3">
                    <input
                      type="checkbox"
                      checked={settingsForm.enforceGpsCheckIn}
                      onChange={e => setSettingsForm({ ...settingsForm, enforceGpsCheckIn: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="font-bold text-slate-800 text-xs">
                      Mandatory GPS Geofence Check-In Enforced
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Shift Timings & Grace Period */}
            <div className="space-y-4 border-t border-slate-100 pt-4">
              <h4 className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Working Shift & Late Arrival Rules</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Shift Start Time</label>
                  <input
                    type="time"
                    value={settingsForm.shiftStartTime}
                    onChange={e => setSettingsForm({ ...settingsForm, shiftStartTime: e.target.value })}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">Shift End Time</label>
                  <input
                    type="time"
                    value={settingsForm.shiftEndTime}
                    onChange={e => setSettingsForm({ ...settingsForm, shiftEndTime: e.target.value })}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">Late Grace Period (Mins)</label>
                  <input
                    type="number"
                    value={settingsForm.gracePeriodMinutes}
                    onChange={e => setSettingsForm({ ...settingsForm, gracePeriodMinutes: parseInt(e.target.value, 10) })}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={actionLoading}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Save Geofence & Shift Settings</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MANUAL ATTENDANCE CORRECTION MODAL */}
      {showCorrectionModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                <Edit3 className="w-4 h-4 text-blue-600" />
                <span>Manual Attendance Correction</span>
              </h3>
              <button
                onClick={() => setShowCorrectionModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveManualCorrection} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Select Employee *</label>
                <select
                  value={correctionForm.employeeId}
                  onChange={e => setCorrectionForm({ ...correctionForm, employeeId: e.target.value })}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Choose Employee --</option>
                  {employeesList.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Date *</label>
                  <input
                    type="date"
                    value={correctionForm.date}
                    onChange={e => setCorrectionForm({ ...correctionForm, date: e.target.value })}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">Attendance Status *</label>
                  <select
                    value={correctionForm.status}
                    onChange={e =>
                      setCorrectionForm({ ...correctionForm, status: e.target.value as AttendanceStatus })
                    }
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PRESENT">PRESENT</option>
                    <option value="LATE">LATE</option>
                    <option value="ABSENT">ABSENT</option>
                    <option value="HALF_DAY">HALF_DAY</option>
                    <option value="ON_LEAVE">ON_LEAVE</option>
                    <option value="HOLIDAY">HOLIDAY</option>
                    <option value="WEEK_OFF">WEEK_OFF</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Check-In Time</label>
                  <input
                    type="time"
                    value={correctionForm.checkInTime}
                    onChange={e => setCorrectionForm({ ...correctionForm, checkInTime: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">Check-Out Time</label>
                  <input
                    type="time"
                    value={correctionForm.checkOutTime}
                    onChange={e => setCorrectionForm({ ...correctionForm, checkOutTime: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Correction Notes / Reason</label>
                <textarea
                  value={correctionForm.notes}
                  onChange={e => setCorrectionForm({ ...correctionForm, notes: e.target.value })}
                  placeholder="e.g. Official outdoor client visit, system attendance adjustment approved by manager"
                  rows={2}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCorrectionModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-xs"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PHASE 14 INJECTIONS */}
      <div className="mt-8 p-4 bg-purple-50 border border-purple-200 rounded-xl">
        <h3 className="font-bold text-purple-900">Phase 14 Actions (AttendanceRegularizationRequest)</h3>
        <div className="flex flex-col space-y-4 mt-2">
          {!['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(userRole) && (
            <div className="flex flex-col space-y-2">
              <button onClick={async () => {
                try {
                  const reason = prompt('Enter reason for correction:');
                  if (!reason) return;
                  // Just a placeholder mock call waiting for backend
                  await hrmsApi.createAttendanceRegularization({ reason } as any);
                  alert('Requested successfully');
                  window.location.reload(); // Refresh local data
                } catch (e) {
                  alert('Error: ' + e);
                }
              }} className="px-4 py-2 bg-purple-600 text-white rounded w-max">
                Request Correction / Regularization
              </button>
            </div>
          )}
          {['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(userRole) && (
            <div className="flex flex-col space-y-2 border p-4 bg-white rounded">
              <h4 className="font-bold">Pending Approvals</h4>
              <div className="flex space-x-2">
                <button onClick={async () => {
                  try {
                    const reqs = await hrmsApi.getAttendanceRegularizations();
                    console.log(reqs);
                    alert('Loaded ' + (reqs.data?.length || 0) + ' requests');
                  } catch (e) {
                    alert('Error: ' + e);
                  }
                }} className="px-4 py-2 bg-indigo-600 text-white rounded w-max">
                  Load Approvals Tab
                </button>
                <button onClick={async () => {
                  try {
                    const id = prompt('Enter ID to approve:');
                    if (!id) return;
                    await hrmsApi.approveAttendanceRegularization(id);
                    alert('Approved');
                    window.location.reload();
                  } catch (e) { alert('Error: ' + e); }
                }} className="px-4 py-2 bg-emerald-600 text-white rounded w-max">
                  Approve Request
                </button>
                <button onClick={async () => {
                  try {
                    const id = prompt('Enter ID to reject:');
                    if (!id) return;
                    const reason = prompt('Enter rejection reason:');
                    if (!reason) return;
                    await hrmsApi.rejectAttendanceRegularization(id, reason);
                    alert('Rejected');
                    window.location.reload();
                  } catch (e) { alert('Error: ' + e); }
                }} className="px-4 py-2 bg-red-600 text-white rounded w-max">
                  Reject Request
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

