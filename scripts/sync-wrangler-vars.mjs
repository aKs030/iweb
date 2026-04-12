import fs from 'fs';
import path from 'path';

const file = path.resolve('wrangler.jsonc');
const content = fs.readFileSync(file, 'utf8');

// Find top-level vars
const topVarsRegex = /"vars"\s*:\s*\{[\s\S]*?\n  \},/;
const match = content.match(topVarsRegex);

if (!match) {
  console.error('Could not find top-level vars in wrangler.jsonc');
  process.exit(1);
}

const topVars = match[0];
const indentedVars = topVars.split('\n').map((line, i) => i === 0 ? line : '    ' + line).join('\n');

// Replace production vars
const prodVarsRegex = /"vars"\s*:\s*\{[\s\S]*?\n      \},/;
const newContent = content.replace(prodVarsRegex, indentedVars);

if (content !== newContent) {
  fs.writeFileSync(file, newContent, 'utf8');
  console.log('Successfully synced wrangler.jsonc vars to production.');
} else {
  console.log('wrangler.jsonc vars are already in sync.');
}
