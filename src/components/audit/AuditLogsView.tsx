import React, { useEffect, useState } from 'react';
import { History, Shield, Terminal, Search, Lock, RefreshCw, UserCheck, KeyRound } from 'lucide-react';
import { hrmsApi } from '../../lib/api-client';
import { AuditLog } from '../../types/hrms';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const pageSize = 15;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [logsResponse, usersData] = await Promise.all([
        hrmsApi.getAuditLogs(),
        hrmsApi.getUsers().catch(() => [])
      ]);
      // Sort newest first
      setLogs([...logsResponse.data].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      setUsers(usersData);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      setUpdatingUser(userId);
      await hrmsApi.updateUserRole(userId, newRole);
      alert(`User access role updated to ${newRole} successfully! Audit entry recorded.`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update user role');
    } flex: {
      setUpdatingUser(null);
    }
  };

  // Filter logs
  const filteredLogs = logs.filter(l => {
    if (actionFilter !== 'ALL' && l.action !== actionFilter) return false;
    if (entityFilter !== 'ALL' && l.entity !== entityFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        l.userName.toLowerCase().includes(q) ||
        l.userEmail.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.entity.toLowerCase().includes(q) ||
        (l.metadata || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Extract unique actions & entities for dropdown filters
  const uniqueActions = Array.from(new Set(logs.map(l => l.action))).sort();
  const uniqueEntities = Array.from(new Set(logs.map(l => l.entity))).sort();

  const getActionBadge = (action: string) => {
    if (action.startsWith('CREATE') || action.startsWith('APPROVE') || action === 'USER_LOGIN') {
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
    if (action.startsWith('REJECT') || action.startsWith('DELETE') || action.startsWith('SOFT_DELETE')) {
      return 'bg-rose-100 text-rose-800 border-rose-200';
    }
    if (action.startsWith('CHANGE') || action.startsWith('UPDATE') || action === 'PROCESS_PAYROLL') {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    return 'bg-slate-100 text-slate-800 border-slate-200';
  };

  return (
    <div id="audit-view-root" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Security & System Audit Logs</span>
            <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-[10px] font-bold flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Immutable
            </span>
          </h2>
          <p className="text-xs text-slate-500">Read-only immutable log tracking authentication, approvals, profile changes, and permissions</p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Audit Logs</span>
        </button>
      </div>

      {/* User Permissions Management Section */}
      {users.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
            <KeyRound className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-900">User Access & Permission Management</h3>
          </div>
          <p className="text-xs text-slate-500">Update system user access levels. Every change instantly generates an immutable audit record.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {users.map((u: any) => (
              <div key={u.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-slate-900">{u.employeeName}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                </div>

                <select
                  value={u.role}
                  disabled={updatingUser === u.id}
                  onChange={e => handleRoleChange(u.id, e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold text-[11px] text-slate-800"
                >
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="HR_MANAGER">HR_MANAGER</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="EMPLOYEE">EMPLOYEE</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit Logs Filter & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search audit trail..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
          />
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div>
            <select
              value={actionFilter}
              onChange={e => {
                setActionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
            >
              <option value="ALL">All Actions ({uniqueActions.length})</option>
              {uniqueActions.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={entityFilter}
              onChange={e => {
                setEntityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
            >
              <option value="ALL">All Entities ({uniqueEntities.length})</option>
              {uniqueEntities.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 font-bold text-xs text-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-slate-600" />
            <span>Audit Trail Entries ({filteredLogs.length})</span>
          </div>
          <span className="text-[11px] text-slate-500 font-normal">Immutable storage</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-600" />
            <span>Fetching system security log entries...</span>
          </div>
        ) : paginatedLogs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No audit records matching criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor / User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity & ID</th>
                  <th className="px-4 py-3">Activity Description / Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {paginatedLogs.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(l.timestamp).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 font-sans">
                      <div className="font-bold text-slate-900">{l.userName || 'System User'}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{l.userEmail}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-md border font-bold text-[10px] ${getActionBadge(l.action)}`}>
                        {l.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      <span className="font-bold">{l.entity}</span>: <span className="text-slate-500">{l.entityId}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-md font-sans">
                      {l.metadata || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div>
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex space-x-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg font-bold"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg font-bold"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
