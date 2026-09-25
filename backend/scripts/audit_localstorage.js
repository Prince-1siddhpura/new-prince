const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', '..', 'src');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'build') results = results.concat(walk(fullPath));
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

const files = walk(dir = srcDir);
const report = [];

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  if (content.includes('localStorage')) {
    const rel = path.relative(srcDir, f).replace(/\\/g, '/');
    const lines = content.split('\n');
    const matchedLines = [];
    lines.forEach((line, idx) => {
      if (line.includes('localStorage') || line.includes('STORAGE_KEY') || /_v\d+['"]/.test(line)) {
        matchedLines.push({ lineNum: idx + 1, text: line.trim() });
      }
    });
    report.push({ file: rel, lines: matchedLines });
  }
});

console.log(JSON.stringify(report, null, 2));
