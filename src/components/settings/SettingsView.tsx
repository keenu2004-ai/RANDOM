import React, { useEffect, useState } from 'react';
import { Settings, MapPin, Database, RefreshCw, Save } from 'lucide-react';
import { hrmsApi } from '../../lib/api-client';
import { OrganizationSettings } from '../../types/hrms';

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: '', code: '' });
  const [creatingDept, setCreatingDept] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [data, meta] = await Promise.all([
        hrmsApi.getOrgSettings(),
        hrmsApi.getOrganizationMeta()
      ]);
      setSettings(data);
      if (meta && meta.departments) setDepartments(meta.departments);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    try {
      await hrmsApi.updateOrgSettings(settings);
      alert('Organization & GPS Geofence parameters updated successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to save settings');
    }
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingDept(true);
    try {
      await hrmsApi.createDepartment(deptForm);
      setDeptForm({ name: '', code: '' });
      await loadSettings();
    } catch (err: any) {
      alert(err.message || 'Failed to add department');
    } finally {
      setCreatingDept(false);
    }
  };

  const handleResetDb = async () => {
    if (!confirm('WARNING: Are you sure you want to reset the database to initial seed state? All newly created records will be re-initialized.')) {
      return;
    }

    setResetting(true);
    try {
      await hrmsApi.resetDatabase();
      alert('Database restored to initial seed state!');
      window.location.reload();
    } catch (err: any) {
      alert(err.message || 'Failed to reset database');
    } finally {
      setResetting(false);
    }
  };

  if (loading || !settings) {
    return <div className="p-8 text-center text-xs text-slate-500">Loading settings...</div>;
  }

  return (
    <div id="settings-view-root" className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">Organization & GPS Geofence Settings</h2>
        <p className="text-xs text-slate-500">Configure company metadata, currency, and office GPS coordinates</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs lg:col-span-2 space-y-4 text-xs">
          <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">Organization Parameters</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Company Name</label>
              <input
                type="text"
                required
                value={settings.orgName}
                onChange={e => setSettings({ ...settings, orgName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Currency</label>
              <input
                type="text"
                disabled
                value="₹ INR"
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-800"
              />
            </div>
          </div>

          <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pt-3 pb-2 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-blue-600" />
            Office Geofence Location Coordinates
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Office Latitude</label>
              <input
                type="number"
                step="0.0001"
                required
                value={settings.officeLatitude}
                onChange={e => setSettings({ ...settings, officeLatitude: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Office Longitude</label>
              <input
                type="number"
                step="0.0001"
                required
                value={settings.officeLongitude}
                onChange={e => setSettings({ ...settings, officeLongitude: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Allowed Radius (Meters)</label>
            <input
              type="number"
              required
              value={settings.allowedGeofenceRadiusMeters}
              onChange={e => setSettings({ ...settings, allowedGeofenceRadiusMeters: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
            />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="enforce-gps"
              checked={settings.enforceGpsCheckIn}
              onChange={e => setSettings({ ...settings, enforceGpsCheckIn: e.target.checked })}
              className="rounded border-slate-300"
            />
            <label htmlFor="enforce-gps" className="font-semibold text-slate-800">
              Strict Geofence Enforcement (Reject Check-In outside boundary radius)
            </label>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-xs transition-all flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>Save Configuration</span>
            </button>
          </div>
        </form>

        <div className="space-y-6">
          {/* Departments */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">Departments</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {departments.map(d => (
                <div key={d.id} className="text-xs bg-slate-50 p-2 rounded border border-slate-200 font-medium flex justify-between">
                  <span>{d.name}</span>
                  <span className="text-slate-500">{d.code}</span>
                </div>
              ))}
              {departments.length === 0 && <div className="text-xs text-slate-500">No departments added.</div>}
            </div>
            <form onSubmit={handleAddDepartment} className="space-y-3 pt-3 border-t border-slate-100">
              <input
                type="text"
                placeholder="Department Name"
                required
                value={deptForm.name}
                onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
              />
              <input
                type="text"
                placeholder="Code (e.g. ENG)"
                required
                value={deptForm.code}
                onChange={e => setDeptForm({ ...deptForm, code: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg uppercase"
              />
              <button type="submit" disabled={creatingDept} className="w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all">
                {creatingDept ? 'Adding...' : 'Add Department'}
              </button>
            </form>
          </div>

          {/* Database Maintenance */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5">
            <Database className="w-4 h-4 text-purple-600" />
            Database Operations
          </h3>

          <p className="text-xs text-slate-500 leading-relaxed">
            The application is connected to a persistent PostgreSQL/relational storage file (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono">/data/db.json</code>).
          </p>

          <button
            onClick={handleResetDb}
            disabled={resetting}
            className="w-full py-2.5 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${resetting ? 'animate-spin' : ''}`} />
            <span>Reset Database to Initial Seed State</span>
          </button>
        </div>
      </div>
    </div>
  );
};
