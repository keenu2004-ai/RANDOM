const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Fix escaped backticks
      content = content.replace(/\\`/g, '`');
      
      // Fix escaped dollar signs in template literals
      content = content.replace(/\\\$/g, '$');
      
      fs.writeFileSync(fullPath, content);
    }
  }
}

processDir(path.join(__dirname, '..', 'src', 'server', 'routes'));
processDir(path.join(__dirname, '..', 'src', 'server', 'repositories'));
console.log('Fixed escaped characters.');
