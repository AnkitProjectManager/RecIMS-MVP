#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function updateFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Replace import statements
    if (content.includes('from "@/api/base44Client"')) {
      content = content.replace(/from "@\/api\/base44Client"/g, 'from "@/api/recimsClient"');
      modified = true;
    }
    
    // Replace base44 variable usage with recims
    const originalContent = content;
    content = content.replace(/\bbase44\./g, 'recims.');
    if (content !== originalContent) {
      modified = true;
    }
    
    // Update import destructuring
    if (content.includes('import { base44 }')) {
      content = content.replace(/import { base44 }/g, 'import { recims }');
      modified = true;
    }

    // Replace "Base44" text in comments
    content = content.replace(/\/\/ Use Base44 SDK/g, '// Use RecIMS SDK');
    content = content.replace(/Base44 SDK/g, 'RecIMS SDK');
    content = content.replace(/Base44 dashboard/g, 'RecIMS dashboard');
    content = content.replace(/Base44 Dashboard/g, 'RecIMS Dashboard');
    content = content.replace(/the Base44/g, 'the RecIMS');

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Updated: ${filePath}`);
      return true;
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
  return false;
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  let count = 0;
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!['node_modules', 'dist', '.git'].includes(file)) {
        count += walkDir(filePath);
      }
    } else if (/\.(jsx?|tsx?)$/.test(file)) {
      if (updateFile(filePath)) {
        count++;
      }
    }
  });
  
  return count;
}

console.log('Starting Base44 → RecIMS rename...\n');
const count = walkDir(path.join(__dirname, 'src'));
console.log(`\n✅ Updated ${count} files`);
