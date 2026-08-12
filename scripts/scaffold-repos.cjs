const fs = require('fs');
const path = require('path');

const repoDir = path.join(__dirname, 'src', 'server', 'repositories');
if (!fs.existsSync(repoDir)) {
  fs.mkdirSync(repoDir, { recursive: true });
}

const repos = [
  'user', 'employee', 'attendance', 'leave', 'holiday-shift',
  'expense', 'timesheet', 'payroll', 'document', 'notification',
  'helpdesk', 'compliance', 'report', 'misc'
];

repos.forEach(repo => {
  const file = path.join(repoDir, `${repo}.repository.ts`);
  const content = `import { query, queryOne, beginTransaction, TransactionClient } from '../db/client';

export class ${repo.charAt(0).toUpperCase() + repo.slice(1).replace(/-([a-z])/g, g => g[1].toUpperCase())}Repository {
  // TODO: Add methods for ${repo}
}

export const ${repo.replace(/-([a-z])/g, g => g[1].toUpperCase())}Repository = new ${repo.charAt(0).toUpperCase() + repo.slice(1).replace(/-([a-z])/g, g => g[1].toUpperCase())}Repository();
`;
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, content);
  }
});
console.log('Repositories scaffolded.');
