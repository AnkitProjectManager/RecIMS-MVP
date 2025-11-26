#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Patterns to fix
const fixes = [
  // Remove unused React imports (when not using JSX transform)
  {
    pattern: /^import React from ['"]react['"];?\s*\n/m,
    replacement: '',
    condition: (content) => {
      // Keep if React is used (React.useState, React.useEffect, etc)
      return !content.match(/React\.(useState|useEffect|useCallback|useMemo|useRef|createContext|Component|forwardRef)/);
    }
  },
  // Fix unescaped quotes
  {
    pattern: /([^&])"/g,
    replacement: '$1&quot;',
    condition: (content) => {
      // Only in JSX content (between > and <)
      return content.includes('>') && content.includes('<');
    }
  },
  // Fix unescaped apostrophes  
  {
    pattern: /([^&])'/g,
    replacement: '$1&apos;',
    condition: (content) => {
      // Only in JSX content
      return content.includes('>') && content.includes('<');
    }
  }
];

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Remove unused React import if applicable
    if (content.includes('import React from') && 
        !content.match(/React\.(useState|useEffect|useCallback|useMemo|useRef|createContext|Component|forwardRef)/)) {
      content = content.replace(/^import React from ['"]react['"];?\s*\n/m, '');
      modified = true;
      console.log(`✓ Removed unused React import from ${filePath}`);
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

function walkDir(dir, filePattern = /\.jsx?$/) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and dist
      if (!['node_modules', 'dist', '.git'].includes(file)) {
        walkDir(filePath, filePattern);
      }
    } else if (filePattern.test(file)) {
      processFile(filePath);
    }
  });
}

console.log('Starting lint fixes...\n');
walkDir(path.join(__dirname, 'src'));
console.log('\nLint fixes completed!');
