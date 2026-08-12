import os
import re

files = {
    'src/components/attendance/AttendanceView.tsx': {
        'create': 'createAttendanceRegularization({ reason } as any)',
    },
    'src/components/timesheets/TimesheetsView.tsx': {
        'create': 'createTimesheetCorrection(id, { reason } as any)',
    },
    'src/components/leave/LeavesView.tsx': {
        'create': 'createLeaveCorrection(id, { reason } as any)',
    },
    'src/components/payroll/PayrollView.tsx': {
        'create': 'createPayrollAdjustment({ reason } as any)',
    }
}

def process_file(filepath, apis):
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # We injected: await hrmsApi.createFoo({ reason } as any);
    # Let's fix the ones that need 'id'
    
    if filepath == 'src/components/timesheets/TimesheetsView.tsx':
        content = content.replace("await hrmsApi.createTimesheetCorrection({ reason } as any);", "const id = prompt('Enter record ID:'); await hrmsApi.createTimesheetCorrection(id, { reason } as any);")
    elif filepath == 'src/components/leave/LeavesView.tsx':
        content = content.replace("await hrmsApi.createLeaveCorrection({ reason } as any);", "const id = prompt('Enter record ID:'); await hrmsApi.createLeaveCorrection(id, { reason } as any);")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

for f, apis in files.items():
    process_file(f, apis)
    print(f"Fixed {f}")
