const fs = require('fs');
const path = require('path');

const apiPath = path.join(__dirname, '..', 'src', 'server', 'api.ts');
const routesDir = path.join(__dirname, '..', 'src', 'server', 'routes');
if (!fs.existsSync(routesDir)) {
  fs.mkdirSync(routesDir, { recursive: true });
}

let apiContent = fs.readFileSync(apiPath, 'utf8');

// The file has major sections separated by "// =========================================="
// We can split the file by these comment blocks.
const sections = apiContent.split(/\/\/\s*==========================================\r?\n\/\/\s*\d+\.\s*(.*?)\r?\n\/\/\s*==========================================\r?\n/);

let newApiTs = `import { Router } from 'express';\n\nexport const apiRouter = Router();\n\n`;

for (let i = 1; i < sections.length; i += 2) {
  const title = sections[i].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const code = sections[i + 1];
  
  if (title === 'health-check-database-connectivity') {
    newApiTs += code + '\n';
    continue;
  }
  
  const routeFileName = `${title}.routes.ts`;
  const routePath = path.join(routesDir, routeFileName);
  
  const fileContent = `import { Router, Request, Response, NextFunction } from 'express';\n`
    + `import { getDb, saveDb, generateId } from '../db';\n`
    + `import { query } from '../db/client.js';\n`
    + `import { authenticateToken, requireRoles, AuthenticatedRequest, isManagerOrAdmin, isHRorAdmin } from '../auth';\n\n`
    + `export const ${title.replace(/-([a-z])/g, g => g[1].toUpperCase())}Router = Router();\n\n`
    + code.replace(/apiRouter\./g, `${title.replace(/-([a-z])/g, g => g[1].toUpperCase())}Router.`);
    
  fs.writeFileSync(routePath, fileContent);
  
  newApiTs += `import { ${title.replace(/-([a-z])/g, g => g[1].toUpperCase())}Router } from './routes/${title}.routes';\n`;
  newApiTs += `apiRouter.use('/', ${title.replace(/-([a-z])/g, g => g[1].toUpperCase())}Router);\n\n`;
}

// Keep the top imports and helper functions
const topImports = sections[0];
newApiTs = topImports + newApiTs;

fs.writeFileSync(path.join(__dirname, 'src', 'server', 'api.new.ts'), newApiTs);
console.log('Split complete.');
