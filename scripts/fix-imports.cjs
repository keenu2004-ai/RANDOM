const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, searchRegex, replacement) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(searchRegex, replacement);
    fs.writeFileSync(filePath, content);
  }
}

const routesPath = path.join(__dirname, '..', 'src', 'server', 'routes');
const files = fs.readdirSync(routesPath);
for (const file of files) {
  if (file.endsWith('.ts')) {
    replaceInFile(path.join(routesPath, file), /from '\.\.\/db'/g, "from '../utils'");
  }
}

// Fix dashboard-stats arguments
replaceInFile(path.join(__dirname, '..', 'src', 'server', 'repositories', 'report.repository.ts'), /async getStats\(orgId: string\)/g, "async getStats(...args: any[])");
replaceInFile(path.join(__dirname, '..', 'src', 'server', 'repositories', 'report.repository.ts'), /async getCharts\(orgId: string\)/g, "async getCharts(...args: any[])");

// Fix auth.ts
replaceInFile(path.join(__dirname, '..', 'src', 'server', 'auth.ts'), /from '\.\/db'/g, "from './utils'");
