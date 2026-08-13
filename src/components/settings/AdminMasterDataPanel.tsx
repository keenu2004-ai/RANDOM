import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, MapPin, Users, Briefcase, Clock, Layers, Calendar, DollarSign,
  Plus, Edit2, Trash2, Power, Save, X, Check, AlertCircle, RefreshCw,
  ChevronRight, Settings, Tag, UserCheck
} from 'lucide-react';
import { hrmsApi } from '../../lib/api-client';

// ─── Shared mini-components ────────────────────────────────────────────────

const StatusBadge = ({ active }: { active: boolean }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
    active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
  }`}>
    <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
    {active ? 'Active' : 'Inactive'}
  </span>
);

const Toast = ({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) => (
  <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border text-sm font-semibold animate-in slide-in-from-bottom-4 duration-300 ${
    type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-red-600 text-white border-red-500'
  }`}>
    {type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
    {msg}
    <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
  </div>
);

const SectionHeader = ({ icon: Icon, title, subtitle, action }: { icon: any; title: string; subtitle?: string; action?: React.ReactNode }) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <h3 className="font-bold text-slate-900 text-sm">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

// ─── Generic inline edit row ────────────────────────────────────────────────

interface EditRowProps {
  label: string;
  value?: string;
  badge?: React.ReactNode;
  onEdit: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  [key: string]: any;
}

const DataRow = ({ label, value, badge, onEdit, onDelete, deleteLabel }: EditRowProps) => (
  <div className="flex items-center justify-between py-2.5 px-3 bg-slate-50 rounded-lg border border-slate-200 group">
    <div>
      <p className="text-xs font-semibold text-slate-800">{label}</p>
      {value && <p className="text-xs text-slate-500 mt-0.5">{value}</p>}
    </div>
    <div className="flex items-center gap-1.5">
      {badge}
      <button onClick={onEdit} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors" title="Edit">
        <Edit2 className="w-3.5 h-3.5" />
      </button>
      {onDelete && (
        <button onClick={onDelete} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors" title={deleteLabel || 'Delete'}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  </div>
);

// ─── Main Admin Panel ────────────────────────────────────────────────────────

const TABS = [
  { id: 'org', label: 'Organization', icon: Settings },
  { id: 'branches', label: 'Branches', icon: Building2 },
  { id: 'departments', label: 'Departments', icon: Layers },
  { id: 'designations', label: 'Designations', icon: Briefcase },
  { id: 'teams', label: 'Teams', icon: Users },
  { id: 'locations', label: 'Locations', icon: MapPin },
  { id: 'shifts', label: 'Shifts', icon: Clock },
  { id: 'leavetypes', label: 'Leave Types', icon: Calendar },
  { id: 'expcat', label: 'Expense Categories', icon: DollarSign },
  { id: 'users', label: 'Users & Roles', icon: UserCheck },
];

export const AdminMasterDataPanel: React.FC<{ userRole: string }> = ({ userRole }) => {
  const [activeTab, setActiveTab] = useState('org');
  const [meta, setMeta] = useState<any>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(true);

  // Per-section data
  const [locations, setLocations] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [expCategories, setExpCategories] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  // Org settings
  const [orgSettings, setOrgSettings] = useState<any>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [metaData, locs, shiftData, ltData, ecData, usersData, orgData] = await Promise.all([
        hrmsApi.getOrganizationMeta(),
        hrmsApi.getAttendanceLocations(),
        hrmsApi.getShifts(),
        hrmsApi.getLeaveTypes(),
        hrmsApi.getExpenseCategories(),
        hrmsApi.getUsers(),
        hrmsApi.getOrgSettings(),
      ]);
      setMeta(metaData);
      setLocations(locs || []);
      setShifts(shiftData || []);
      setLeaveTypes(ltData || []);
      setExpCategories(ecData || []);
      setUsers(usersData || []);
      setOrgSettings(orgData);
    } catch (e: any) {
      showToast(e.message || 'Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <span className="ml-3 text-sm text-slate-500">Loading master data...</span>
    </div>
  );

  return (
    <div className="space-y-4">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Tab Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="flex overflow-x-auto scrollbar-hide border-b border-slate-200">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'org' && <OrgSection settings={orgSettings} onRefresh={loadAll} showToast={showToast} />}
          {activeTab === 'branches' && <BranchesSection branches={meta?.branches || []} onRefresh={loadAll} showToast={showToast} />}
          {activeTab === 'departments' && <DepartmentsSection departments={meta?.departments || []} branches={meta?.branches || []} onRefresh={loadAll} showToast={showToast} />}
          {activeTab === 'designations' && <DesignationsSection designations={meta?.designations || []} departments={meta?.departments || []} onRefresh={loadAll} showToast={showToast} />}
          {activeTab === 'teams' && <TeamsSection teams={meta?.teams || []} departments={meta?.departments || []} onRefresh={loadAll} showToast={showToast} />}
          {activeTab === 'locations' && <LocationsSection locations={locations} setLocations={setLocations} onRefresh={loadAll} showToast={showToast} />}
          {activeTab === 'shifts' && <ShiftsSection shifts={shifts} locations={locations} setShifts={setShifts} onRefresh={loadAll} showToast={showToast} />}
          {activeTab === 'leavetypes' && <LeaveTypesSection leaveTypes={leaveTypes} setLeaveTypes={setLeaveTypes} onRefresh={loadAll} showToast={showToast} />}
          {activeTab === 'expcat' && <ExpenseCategoriesSection categories={expCategories} setCategories={setExpCategories} onRefresh={loadAll} showToast={showToast} />}
          {activeTab === 'users' && <UsersSection users={users} onRefresh={loadAll} showToast={showToast} userRole={userRole} />}
        </div>
      </div>
    </div>
  );
};

// ─── Organization Settings ──────────────────────────────────────────────────

const OrgSection = ({ settings, onRefresh, showToast }: any) => {
  const [form, setForm] = useState<any>(settings || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (settings) setForm(settings); }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await hrmsApi.updateOrgSettings(form);
      showToast('Organization settings saved successfully');
      onRefresh();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <SectionHeader icon={Settings} title="Organization Settings" subtitle="Core company configuration" />
      <form onSubmit={handleSave} className="space-y-4 max-w-xl">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name</label>
            <input type="text" value={form.orgName || ''} onChange={e => setForm({ ...form, orgName: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
            <input type="text" value="₹ INR" disabled className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-lg text-slate-500" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Office Latitude</label>
            <input type="number" step="0.0001" value={form.officeLatitude || ''} onChange={e => setForm({ ...form, officeLatitude: Number(e.target.value) })}
              className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Office Longitude</label>
            <input type="number" step="0.0001" value={form.officeLongitude || ''} onChange={e => setForm({ ...form, officeLongitude: Number(e.target.value) })}
              className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Geofence Radius (meters)</label>
          <input type="number" value={form.allowedGeofenceRadiusMeters || 200} onChange={e => setForm({ ...form, allowedGeofenceRadiusMeters: Number(e.target.value) })}
            className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="enforce-gps" checked={form.enforceGpsCheckIn || false} onChange={e => setForm({ ...form, enforceGpsCheckIn: e.target.checked })} className="rounded" />
          <label htmlFor="enforce-gps" className="text-xs font-semibold text-slate-700">Enforce strict GPS geofence on check-in</label>
        </div>
        <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50">
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
};

// ─── Branches ──────────────────────────────────────────────────────────────

const BranchesSection = ({ branches, onRefresh, showToast }: any) => {
  const [form, setForm] = useState({ name: '', code: '', city: '', state: '', country: 'India', address: '' });
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editing) { await hrmsApi.updateBranch(editing.id, form); showToast('Branch updated'); }
      else { await hrmsApi.createBranch(form); showToast('Branch created'); }
      setForm({ name: '', code: '', city: '', state: '', country: 'India', address: '' });
      setEditing(null);
      onRefresh();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <SectionHeader icon={Building2} title="Branches" subtitle={`${branches.length} configured`} />
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {branches.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">No branches yet. Create your first branch →</p>}
          {branches.map((b: any) => (
            <DataRow key={b.id} label={b.name} value={[b.city, b.state, b.country].filter(Boolean).join(', ') || b.code}
              badge={<StatusBadge active={b.is_active !== false} />}
              onEdit={() => { setEditing(b); setForm({ name: b.name, code: b.code || '', city: b.city || '', state: b.state || '', country: b.country || 'India', address: b.address || '' }); }}
              onDelete={async () => { try { await hrmsApi.deleteBranch(b.id); showToast('Branch deactivated'); onRefresh(); } catch (e: any) { showToast(e.message, 'error'); } }}
              deleteLabel="Deactivate" />
          ))}
        </div>
      </div>
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
        <h4 className="text-xs font-bold text-slate-700 mb-4">{editing ? 'Edit Branch' : 'New Branch'}</h4>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-semibold text-slate-600 mb-1">Name *</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg" /></div>
            <div><label className="block text-xs font-semibold text-slate-600 mb-1">Code</label><input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg uppercase" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-semibold text-slate-600 mb-1">City</label><input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg" /></div>
            <div><label className="block text-xs font-semibold text-slate-600 mb-1">State</label><input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg" /></div>
          </div>
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Address</label><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg" /></div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-500 transition-all disabled:opacity-50">
              {saving ? 'Saving...' : editing ? 'Update Branch' : 'Create Branch'}
            </button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm({ name: '', code: '', city: '', state: '', country: 'India', address: '' }); }} className="px-3 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-300"><X className="w-4 h-4" /></button>}
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Departments ────────────────────────────────────────────────────────────

const DepartmentsSection = ({ departments, branches, onRefresh, showToast }: any) => {
  const [form, setForm] = useState({ name: '', code: '', branchId: '', description: '' });
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editing) { await hrmsApi.updateDepartment(editing.id, form); showToast('Department updated'); }
      else { await hrmsApi.createDepartment(form); showToast('Department created'); }
      setForm({ name: '', code: '', branchId: '', description: '' }); setEditing(null); onRefresh();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <SectionHeader icon={Layers} title="Departments" subtitle={`${departments.length} departments`} />
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {departments.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">No departments yet.</p>}
          {departments.map((d: any) => (
            <DataRow key={d.id} label={d.name} value={d.code}
              onEdit={() => { setEditing(d); setForm({ name: d.name, code: d.code || '', branchId: d.branch_id || '', description: d.description || '' }); }}
              onDelete={async () => { try { await hrmsApi.deleteDepartment(d.id); showToast('Department deleted'); onRefresh(); } catch (e: any) { showToast(e.message, 'error'); } }} />
          ))}
        </div>
      </div>
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
        <h4 className="text-xs font-bold text-slate-700 mb-4">{editing ? 'Edit Department' : 'New Department'}</h4>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-semibold text-slate-600 mb-1">Name *</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg" /></div>
            <div><label className="block text-xs font-semibold text-slate-600 mb-1">Code</label><input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg uppercase" /></div>
          </div>
          {branches.length > 0 && <div><label className="block text-xs font-semibold text-slate-600 mb-1">Branch</label><select value={form.branchId} onChange={e => setForm({ ...form, branchId: e.target.value })} className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg"><option value="">All Branches</option>{branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-500 transition-all disabled:opacity-50">{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm({ name: '', code: '', branchId: '', description: '' }); }} className="px-3 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"><X className="w-4 h-4" /></button>}
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Designations ───────────────────────────────────────────────────────────

const DesignationsSection = ({ designations, departments, onRefresh, showToast }: any) => {
  const [form, setForm] = useState({ title: '', level: 1, departmentId: '' });
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editing) { await hrmsApi.updateDesignation(editing.id, form); showToast('Designation updated'); }
      else { await hrmsApi.createDesignation(form); showToast('Designation created'); }
      setForm({ title: '', level: 1, departmentId: '' }); setEditing(null); onRefresh();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <SectionHeader icon={Briefcase} title="Designations" subtitle={`${designations.length} designations`} />
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {designations.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">No designations yet.</p>}
          {designations.map((d: any) => (
            <DataRow key={d.id} label={d.title} value={`Level ${d.level}`}
              onEdit={() => { setEditing(d); setForm({ title: d.title, level: d.level || 1, departmentId: d.department_id || '' }); }}
              onDelete={async () => { try { await hrmsApi.deleteDesignation(d.id); showToast('Designation deleted'); onRefresh(); } catch (e: any) { showToast(e.message, 'error'); } }} />
          ))}
        </div>
      </div>
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
        <h4 className="text-xs font-bold text-slate-700 mb-4">{editing ? 'Edit Designation' : 'New Designation'}</h4>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Title *</label><input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-semibold text-slate-600 mb-1">Level</label><input type="number" min={1} value={form.level} onChange={e => setForm({ ...form, level: Number(e.target.value) })} className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg" /></div>
            {departments.length > 0 && <div><label className="block text-xs font-semibold text-slate-600 mb-1">Department</label><select value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })} className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg"><option value="">Any</option>{departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-500 transition-all disabled:opacity-50">{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm({ title: '', level: 1, departmentId: '' }); }} className="px-3 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"><X className="w-4 h-4" /></button>}
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Teams ─────────────────────────────────────────────────────────────────

const TeamsSection = ({ teams, departments, onRefresh, showToast }: any) => {
  const [form, setForm] = useState({ name: '', departmentId: '', description: '' });
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editing) { await hrmsApi.updateTeam(editing.id, form); showToast('Team updated'); }
      else { await hrmsApi.createTeam(form); showToast('Team created'); }
      setForm({ name: '', departmentId: '', description: '' }); setEditing(null); onRefresh();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const deptName = (id: string) => departments.find((d: any) => d.id === id)?.name || '-';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <SectionHeader icon={Users} title="Teams" subtitle={`${teams.length} teams`} />
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {teams.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">No teams yet.</p>}
          {teams.map((t: any) => (
            <DataRow key={t.id} label={t.name} value={deptName(t.department_id)}
              onEdit={() => { setEditing(t); setForm({ name: t.name, departmentId: t.department_id || '', description: t.description || '' }); }}
              onDelete={async () => { try { await hrmsApi.deleteTeam(t.id); showToast('Team deleted'); onRefresh(); } catch (e: any) { showToast(e.message, 'error'); } }} />
          ))}
        </div>
      </div>
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
        <h4 className="text-xs font-bold text-slate-700 mb-4">{editing ? 'Edit Team' : 'New Team'}</h4>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Team Name *</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg" /></div>
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Department *</label><select required value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })} className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg"><option value="">Select Department</option>{departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-500 disabled:opacity-50">{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm({ name: '', departmentId: '', description: '' }); }} className="px-3 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"><X className="w-4 h-4" /></button>}
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Attendance Locations ────────────────────────────────────────────────────

const LocationsSection = ({ locations, setLocations, onRefresh, showToast }: any) => {
  const [form, setForm] = useState({ name: '', latitude: '', longitude: '', radiusMeters: 200, isActive: true });
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editing) { await hrmsApi.updateAttendanceLocation(editing.id, { ...form, latitude: Number(form.latitude), longitude: Number(form.longitude) }); showToast('Location updated — shifts using this location will use new coordinates immediately'); }
      else { await hrmsApi.createAttendanceLocation({ ...form, latitude: Number(form.latitude), longitude: Number(form.longitude) }); showToast('Attendance location created'); }
      setForm({ name: '', latitude: '', longitude: '', radiusMeters: 200, isActive: true }); setEditing(null); onRefresh();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <SectionHeader icon={MapPin} title="Attendance Locations" subtitle="GPS geofence zones used by shifts" />
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {locations.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">No locations yet. Create your first GPS location →</p>}
          {locations.map((l: any) => (
            <DataRow key={l.id} label={l.name}
              value={`${Number(l.latitude).toFixed(5)}, ${Number(l.longitude).toFixed(5)} | R: ${l.radiusMeters}m`}
              badge={<StatusBadge active={l.isActive !== false} />}
              onEdit={() => { setEditing(l); setForm({ name: l.name, latitude: String(l.latitude), longitude: String(l.longitude), radiusMeters: l.radiusMeters || 200, isActive: l.isActive !== false }); }}
              onDelete={async () => { try { await hrmsApi.deleteAttendanceLocation(l.id); showToast('Location deactivated'); onRefresh(); } catch (e: any) { showToast(e.message, 'error'); } }}
              deleteLabel="Deactivate" />
          ))}
        </div>
      </div>
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
        <h4 className="text-xs font-bold text-slate-700 mb-1">{editing ? 'Edit Location' : 'New Location'}</h4>
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          ⚠️ Changing coordinates immediately affects all shifts using this location.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Location Name *</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-semibold text-slate-600 mb-1">Latitude *</label><input required type="number" step="0.000001" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} className="w-full px-2.5 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg" /></div>
            <div><label className="block text-xs font-semibold text-slate-600 mb-1">Longitude *</label><input required type="number" step="0.000001" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} className="w-full px-2.5 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg" /></div>
          </div>
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Radius (meters)</label><input type="number" min={10} value={form.radiusMeters} onChange={e => setForm({ ...form, radiusMeters: Number(e.target.value) })} className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg" /></div>
          <div className="flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} /><label className="text-xs font-semibold text-slate-700">Active</label></div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-500 disabled:opacity-50">{saving ? 'Saving...' : editing ? 'Update Location' : 'Create Location'}</button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm({ name: '', latitude: '', longitude: '', radiusMeters: 200, isActive: true }); }} className="px-3 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"><X className="w-4 h-4" /></button>}
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Shifts ─────────────────────────────────────────────────────────────────

const ShiftsSection = ({ shifts, locations, setShifts, onRefresh, showToast }: any) => {
  const [form, setForm] = useState({ name: '', startTime: '09:00', endTime: '18:00', gracePeriodMinutes: 15, locationId: '', active: true });
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editing) {
        await hrmsApi.updateShift(editing.id, { ...form, locationId: form.locationId || null });
        showToast('Shift updated — all assigned employees will use the new location on next check-in');
      } else {
        await hrmsApi.createShift({ ...form, locationId: form.locationId || null });
        showToast('Shift created');
      }
      setForm({ name: '', startTime: '09:00', endTime: '18:00', gracePeriodMinutes: 15, locationId: '', active: true });
      setEditing(null); onRefresh();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const locName = (id: string) => locations.find((l: any) => l.id === id)?.name || 'No Location';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <SectionHeader icon={Clock} title="Shifts" subtitle="Work schedule templates" />
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {shifts.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">No shifts yet.</p>}
          {shifts.map((s: any) => (
            <DataRow key={s.id} label={s.name}
              value={`${s.startTime} – ${s.endTime} | ${s.locationId ? locName(s.locationId) : '⚠️ No location set'}`}
              badge={<StatusBadge active={s.active} />}
              onEdit={() => { setEditing(s); setForm({ name: s.name, startTime: s.startTime, endTime: s.endTime, gracePeriodMinutes: s.gracePeriodMinutes || 15, locationId: s.locationId || '', active: s.active }); }}
              onDelete={async () => { try { await hrmsApi.toggleShiftStatus(s.id, !s.active); showToast(`Shift ${s.active ? 'deactivated' : 'activated'}`); onRefresh(); } catch (e: any) { showToast(e.message, 'error'); } }}
              deleteLabel={s.active ? 'Deactivate' : 'Activate'} />
          ))}
        </div>
      </div>
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
        <h4 className="text-xs font-bold text-slate-700 mb-1">{editing ? 'Edit Shift' : 'New Shift'}</h4>
        {editing && <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">⚠️ Changing the location will affect all employees assigned to this shift on their next check-in.</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Shift Name *</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-semibold text-slate-600 mb-1">Start Time</label><input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg" /></div>
            <div><label className="block text-xs font-semibold text-slate-600 mb-1">End Time</label><input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg" /></div>
          </div>
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Attendance Location</label>
            <select value={form.locationId} onChange={e => setForm({ ...form, locationId: e.target.value })} className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg">
              <option value="">No Location Assigned</option>
              {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name} ({Number(l.latitude).toFixed(4)}, {Number(l.longitude).toFixed(4)})</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Grace Period (mins)</label><input type="number" min={0} value={form.gracePeriodMinutes} onChange={e => setForm({ ...form, gracePeriodMinutes: Number(e.target.value) })} className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg" /></div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-500 disabled:opacity-50">{saving ? 'Saving...' : editing ? 'Update Shift' : 'Create Shift'}</button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm({ name: '', startTime: '09:00', endTime: '18:00', gracePeriodMinutes: 15, locationId: '', active: true }); }} className="px-3 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"><X className="w-4 h-4" /></button>}
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Leave Types ────────────────────────────────────────────────────────────

const LeaveTypesSection = ({ leaveTypes, setLeaveTypes, onRefresh, showToast }: any) => {
  const [form, setForm] = useState({ name: '', code: '', annualQuota: 12, carryForwardAllowed: false, requiresAttachment: false, description: '' });
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editing) { await hrmsApi.updateLeaveType(editing.id, form); showToast('Leave type updated'); }
      else { await hrmsApi.createLeaveType(form); showToast('Leave type created'); }
      setForm({ name: '', code: '', annualQuota: 12, carryForwardAllowed: false, requiresAttachment: false, description: '' }); setEditing(null); onRefresh();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <SectionHeader icon={Calendar} title="Leave Types" subtitle={`${leaveTypes.length} types configured`} />
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {leaveTypes.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">No leave types yet.</p>}
          {leaveTypes.map((lt: any) => (
            <DataRow key={lt.id} label={lt.name} value={`${lt.code} | ${lt.annualQuota} days/year`}
              badge={<StatusBadge active={lt.isActive !== false} />}
              onEdit={() => { setEditing(lt); setForm({ name: lt.name, code: lt.code, annualQuota: lt.annualQuota, carryForwardAllowed: lt.carryForwardAllowed, requiresAttachment: lt.requiresAttachment, description: lt.description || '' }); }}
              onDelete={async () => { try { await hrmsApi.deleteLeaveType(lt.id); showToast('Leave type deactivated'); onRefresh(); } catch (e: any) { showToast(e.message, 'error'); } }}
              deleteLabel="Deactivate" />
          ))}
        </div>
      </div>
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
        <h4 className="text-xs font-bold text-slate-700 mb-4">{editing ? 'Edit Leave Type' : 'New Leave Type'}</h4>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-semibold text-slate-600 mb-1">Name *</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg" /></div>
            <div><label className="block text-xs font-semibold text-slate-600 mb-1">Code *</label><input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} disabled={!!editing} className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg uppercase disabled:bg-slate-100" /></div>
          </div>
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Annual Quota (days)</label><input type="number" min={0} value={form.annualQuota} onChange={e => setForm({ ...form, annualQuota: Number(e.target.value) })} className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg" /></div>
          <div className="space-y-2">
            <div className="flex items-center gap-2"><input type="checkbox" id="carry" checked={form.carryForwardAllowed} onChange={e => setForm({ ...form, carryForwardAllowed: e.target.checked })} /><label htmlFor="carry" className="text-xs font-semibold text-slate-700">Allow carry forward</label></div>
            <div className="flex items-center gap-2"><input type="checkbox" id="attach" checked={form.requiresAttachment} onChange={e => setForm({ ...form, requiresAttachment: e.target.checked })} /><label htmlFor="attach" className="text-xs font-semibold text-slate-700">Requires attachment</label></div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-500 disabled:opacity-50">{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm({ name: '', code: '', annualQuota: 12, carryForwardAllowed: false, requiresAttachment: false, description: '' }); }} className="px-3 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"><X className="w-4 h-4" /></button>}
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Expense Categories ─────────────────────────────────────────────────────

const ExpenseCategoriesSection = ({ categories, setCategories, onRefresh, showToast }: any) => {
  const [form, setForm] = useState({ name: '', description: '', maxAmount: '' });
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { name: form.name, description: form.description, maxAmount: form.maxAmount ? Number(form.maxAmount) : undefined };
      if (editing) { await hrmsApi.updateExpenseCategory(editing.id, payload); showToast('Category updated'); }
      else { await hrmsApi.createExpenseCategory(payload); showToast('Category created'); }
      setForm({ name: '', description: '', maxAmount: '' }); setEditing(null); onRefresh();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <SectionHeader icon={DollarSign} title="Expense Categories" subtitle={`${categories.length} categories`} />
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {categories.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">No expense categories yet.</p>}
          {categories.map((c: any) => (
            <DataRow key={c.id} label={c.name} value={c.maxAmount ? `Max ₹${Number(c.maxAmount).toLocaleString('en-IN')}` : c.description}
              badge={<StatusBadge active={c.isActive !== false} />}
              onEdit={() => { setEditing(c); setForm({ name: c.name, description: c.description || '', maxAmount: c.maxAmount ? String(c.maxAmount) : '' }); }}
              onDelete={async () => { try { await hrmsApi.deleteExpenseCategory(c.id); showToast('Category deactivated'); onRefresh(); } catch (e: any) { showToast(e.message, 'error'); } }}
              deleteLabel="Deactivate" />
          ))}
        </div>
      </div>
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
        <h4 className="text-xs font-bold text-slate-700 mb-4">{editing ? 'Edit Category' : 'New Category'}</h4>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Name *</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg" /></div>
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Max Amount (₹)</label><input type="number" min={0} value={form.maxAmount} onChange={e => setForm({ ...form, maxAmount: e.target.value })} placeholder="No limit" className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg" /></div>
          <div><label className="block text-xs font-semibold text-slate-600 mb-1">Description</label><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg" /></div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-500 disabled:opacity-50">{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm({ name: '', description: '', maxAmount: '' }); }} className="px-3 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"><X className="w-4 h-4" /></button>}
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Users & Roles ──────────────────────────────────────────────────────────

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'];

const UsersSection = ({ users, onRefresh, showToast, userRole }: any) => {
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleRoleChange = async (userId: string, role: string) => {
    setSavingId(userId);
    try {
      await hrmsApi.updateUserRole(userId, role);
      showToast(`User role updated to ${role}`);
      onRefresh();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setSavingId(null); }
  };

  return (
    <div>
      <SectionHeader icon={UserCheck} title="Users & Roles" subtitle={`${users.length} user accounts`} />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-3 py-2 font-semibold text-slate-600">User</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Employee</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Current Role</th>
              {['SUPER_ADMIN', 'ADMIN'].includes(userRole) && <th className="text-left px-3 py-2 font-semibold text-slate-600">Change Role</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2.5">
                  <p className="font-semibold text-slate-800">{u.email}</p>
                </td>
                <td className="px-3 py-2.5 text-slate-600">{u.employeeName || '-'} <span className="text-slate-400">{u.employeeCode ? `(${u.employeeCode})` : ''}</span></td>
                <td className="px-3 py-2.5">
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">{u.role}</span>
                </td>
                {['SUPER_ADMIN', 'ADMIN'].includes(userRole) && (
                  <td className="px-3 py-2.5">
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      disabled={savingId === u.id}
                      className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="text-xs text-slate-400 py-8 text-center">No users found.</p>}
      </div>
    </div>
  );
};

export default AdminMasterDataPanel;
