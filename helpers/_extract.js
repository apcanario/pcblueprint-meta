// _extract.js — print one session's prompt body from a runbook HTML.
//
// Usage:
//   node helpers/_extract.js <html> <key>
//   node helpers/_extract.js "../pcblueprint-checklist_25 april.html" S06a
//
// The HTML embeds a long single-line `const PROMPTS = {...};` JS object.
// We locate that line dynamically (no hardcoded line number), then scan
// for the requested key's JSON-escaped string value.

const fs = require('fs');

const htmlPath = process.argv[2];
const key = process.argv[3];

if (!htmlPath || !key) {
  console.error('Usage: node _extract.js <html-file> <session-key>');
  process.exit(1);
}

const lines = fs.readFileSync(htmlPath, 'utf8').split('\n');
const promptsLine = lines.find(l => l.includes('const PROMPTS = {'));
if (!promptsLine) {
  console.error('Could not find `const PROMPTS = {` in the HTML.');
  process.exit(1);
}

const start = promptsLine.indexOf('"' + key + '":"');
if (start < 0) {
  console.error(`Key "${key}" not found in PROMPTS.`);
  process.exit(1);
}

let i = start + key.length + 4; // past `"<key>":"`
let out = '';
while (i < promptsLine.length) {
  const c = promptsLine[i];
  if (c === '\\') { out += c + promptsLine[i + 1]; i += 2; continue; }
  if (c === '"') break;
  out += c;
  i++;
}

try {
  console.log(JSON.parse('"' + out + '"'));
} catch (e) {
  console.log(out);
}
