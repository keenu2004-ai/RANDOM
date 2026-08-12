import fs from 'fs';

function fixImports(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\} \s*,\s*AttendanceRegularizationRequest/g, ', AttendanceRegularizationRequest');
  fs.writeFileSync(file, content);
}

function fixBackticks(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\\\`/g, '`');
  content = content.replace(/\\\$/g, '$');
  fs.writeFileSync(file, content);
}

['src/components/attendance/AttendanceView.tsx', 'src/components/payroll/PayrollView.tsx', 'src/components/timesheets/TimesheetsView.tsx'].forEach(fixImports);
['src/server/repositories/attendance.repository.ts', 'src/server/repositories/timesheet.repository.ts'].forEach(fixBackticks);
