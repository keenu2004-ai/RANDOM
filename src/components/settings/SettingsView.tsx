import React, { useEffect, useState } from 'react';
import { Settings, Database, RefreshCw, Shield } from 'lucide-react';
import { hrmsApi } from '../../lib/api-client';
import { AdminMasterDataPanel } from './AdminMasterDataPanel';

// We need the user role — read from hrmsApi.getMe()
export const SettingsView: React.FC = () => {
  const [userRole, setUserRole] = useState<string>('');
  const [resetting, setResetting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hrmsApi.getMe().then((res: any) => {
      setUserRole(res?.user?.role || res?.role || '');
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleResetDb = async () => {
    if (!confirm('WARNING: This will reset all data to seed state. This is irreversible in development. Continue?')) return;
    setResetting(true);
    try {
      await hrmsApi.resetDatabase();
      alert('Database reset successfully!');
      window.location.reload();
    } catch (err: any) {
      alert(err.message || 'Failed to reset database');
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-500">Loading settings...</div>;
  }

  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(userRole);
  const isHROrAdmin = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(userRole);

  return (
    <div id="settings-view-root" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            Admin Control Panel
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage all master data for your organization</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-xl">
          <Shield className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-xs font-bold text-blue-700">{userRole}</span>
        </div>
      </div>

      {isHROrAdmin ? (
        <AdminMasterDataPanel userRole={userRole} />
      ) : (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs text-center space-y-3">
          <Shield className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="font-bold text-slate-700">Admin Access Required</h3>
          <p className="text-xs text-slate-500">Master data management requires HR Manager, Admin, or Super Admin role.</p>
        </div>
      )}

      {/* Database Maintenance — dev only, Super Admin only */}
      {isAdmin && (
        <div className="bg-white p-6 rounded-2xl border border-red-100 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5">
            <Database className="w-4 h-4 text-red-500" />
            Database Operations
          </h3>
          <p className="text-xs text-slate-500">Development-only operation. Disabled in production environments.</p>
          <button
            onClick={handleResetDb}
            disabled={resetting}
            className="px-4 py-2.5 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-bold text-xs rounded-xl flex items-center gap-2 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${resetting ? 'animate-spin' : ''}`} />
            {resetting ? 'Resetting...' : 'Reset Database to Seed State'}
          </button>
        </div>
      )}
    </div>
  );
};
