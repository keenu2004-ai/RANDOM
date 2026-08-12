import os
import re

files = {
    'src/components/attendance/AttendanceView.tsx': {
        'create': 'createAttendanceRegularization',
        'get': 'getAttendanceRegularizations',
        'approve': 'approveAttendanceRegularization',
        'reject': 'rejectAttendanceRegularization',
        'type': 'AttendanceRegularizationRequest'
    },
    'src/components/timesheets/TimesheetsView.tsx': {
        'create': 'createTimesheetCorrection',
        'get': 'getTimesheetCorrections',
        'approve': 'approveTimesheetCorrection',
        'reject': 'rejectTimesheetCorrection',
        'type': 'TimesheetCorrectionRequest'
    },
    'src/components/leave/LeavesView.tsx': {
        'create': 'createLeaveCorrection',
        'get': 'getLeaveCorrections',
        'approve': 'approveLeaveCorrection',
        'reject': 'rejectLeaveCorrection',
        'type': 'LeaveCorrectionRequest'
    },
    'src/components/payroll/PayrollView.tsx': {
        'create': 'createPayrollAdjustment',
        'get': 'getPayrollAdjustments',
        'approve': 'approvePayrollAdjustment',
        'reject': 'rejectPayrollAdjustment',
        'type': 'PayrollAdjustment'
    }
}

def process_file(filepath, apis):
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add imports
    if 'AttendanceRegularizationRequest' not in content:
        content = content.replace("from '../../types/hrms';", ", AttendanceRegularizationRequest, TimesheetCorrectionRequest, LeaveCorrectionRequest, PayrollAdjustment } from '../../types/hrms';")

    injection = f"""
      {{/* PHASE 14 INJECTIONS */}}
      <div className="mt-8 p-4 bg-purple-50 border border-purple-200 rounded-xl">
        <h3 className="font-bold text-purple-900">Phase 14 Actions ({apis['type']})</h3>
        <div className="flex flex-col space-y-4 mt-2">
          {{!['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(userRole) && (
            <div className="flex flex-col space-y-2">
              <button onClick={{async () => {{
                try {{
                  const reason = prompt('Enter reason for correction:');
                  if (!reason) return;
                  // Just a placeholder mock call waiting for backend
                  await hrmsApi.{apis['create']}({{ reason }} as any);
                  alert('Requested successfully');
                  window.location.reload(); // Refresh local data
                }} catch (e) {{
                  alert('Error: ' + e);
                }}
              }}}} className="px-4 py-2 bg-purple-600 text-white rounded w-max">
                Request Correction / Regularization
              </button>
            </div>
          )}}
          {{['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'].includes(userRole) && (
            <div className="flex flex-col space-y-2 border p-4 bg-white rounded">
              <h4 className="font-bold">Pending Approvals</h4>
              <div className="flex space-x-2">
                <button onClick={{async () => {{
                  try {{
                    const reqs = await hrmsApi.{apis['get']}();
                    console.log(reqs);
                    alert('Loaded ' + (reqs.data?.length || 0) + ' requests');
                  }} catch(e) {{
                    alert('Error: ' + e);
                  }}
                }}}} className="px-4 py-2 bg-indigo-600 text-white rounded w-max">
                  Load Approvals Tab
                </button>
                <button onClick={{async () => {{
                  try {{
                    const id = prompt('Enter ID to approve:');
                    if (!id) return;
                    await hrmsApi.{apis['approve']}(id);
                    alert('Approved');
                    window.location.reload();
                  }} catch(e) {{ alert('Error: ' + e); }}
                }}}} className="px-4 py-2 bg-emerald-600 text-white rounded w-max">
                  Approve Request
                </button>
                <button onClick={{async () => {{
                  try {{
                    const id = prompt('Enter ID to reject:');
                    if (!id) return;
                    const reason = prompt('Enter rejection reason:');
                    if (!reason) return;
                    await hrmsApi.{apis['reject']}(id, reason);
                    alert('Rejected');
                    window.location.reload();
                  }} catch(e) {{ alert('Error: ' + e); }}
                }}}} className="px-4 py-2 bg-red-600 text-white rounded w-max">
                  Reject Request
                </button>
              </div>
            </div>
          )}}
        </div>
      </div>
"""
    # Insert before the last </div>
    last_div_idx = content.rfind('</div>')
    if last_div_idx != -1:
        content = content[:last_div_idx] + injection + content[last_div_idx:]

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

for f, apis in files.items():
    process_file(f, apis)
    print(f"Done {f}")
