const fs = require('fs');

const files = [
  'app/admin/inventory/indents/page.tsx',
  'app/admin/inventory/items/page.tsx',
  'app/admin/inventory/reports/page.tsx',
  'app/admin/inventory/stock-counts/page.tsx'
];

files.forEach(file => {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const out = [];
  let keep = true;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('<<<<<<< HEAD')) {
      keep = true;
      continue;
    } else if (line.startsWith('=======')) {
      keep = false;
      continue;
    } else if (line.startsWith('>>>>>>>')) {
      keep = true;
      continue;
    }
    
    if (keep) {
      out.push(line);
    }
  }
  fs.writeFileSync(file, out.join('\n'));
  console.log('Cleaned ' + file);
});
