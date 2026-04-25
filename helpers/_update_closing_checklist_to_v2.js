// _update_closing_checklist_to_v2.js — one-shot text patch.
//
// Updates the closing-checklist text inside every PROMPTS entry to reference
// the new COMPLETED_SESSIONS array (single source of truth) instead of the
// retired DEFAULT_DONE + bootstrapInitialState dual-write protocol.
//
// Usage:
//   cd "C:\Users\apcan\Downloads\Blueprint Tasks"
//   node helpers/_update_closing_checklist_to_v2.js
//
// Idempotent: skips entries already updated (sentinel = "COMPLETED_SESSIONS").

const fs = require("fs");

const HTML = "pcblueprint-checklist_25 april.html";
const MIRROR = "prompts_line.txt";

const OLD_STEP1 = "1. Open `Blueprint Tasks\\pcblueprint-checklist_25 april.html` and add this session's id to BOTH `DEFAULT_DONE` (~line 1447) and `bootstrapInitialState()` seed (~line 1761). Save in place — the folder is the source of truth and Pedro syncs it manually between machines.";

const NEW_STEP1 = "1. Open `Blueprint Tasks\\pcblueprint-checklist_25 april.html` and add this session's id to the `COMPLETED_SESSIONS` array (~line 1986 — single source of truth, no more dual-write). Save in place — the folder is the source of truth and Pedro syncs it manually between machines.";

const html = fs.readFileSync(HTML, "utf8");
const lines = html.split("\n");
const idx = lines.findIndex((l) => l.includes("const PROMPTS = {"));
if (idx < 0) throw new Error("PROMPTS line not found");
let line = lines[idx];

const ENTRY_RE = /"(S\d+[a-z]?)":"((?:[^"\\]|\\.)*)"/g;

let updated = 0;
let already = 0;
let skipped = 0;

const newLine = line.replace(ENTRY_RE, (whole, key, encodedValue) => {
  let value;
  try {
    value = JSON.parse('"' + encodedValue + '"');
  } catch {
    skipped++;
    return whole;
  }
  if (!value.includes(OLD_STEP1)) {
    if (value.includes(NEW_STEP1)) already++;
    else skipped++;
    return whole;
  }
  const next = value.replace(OLD_STEP1, NEW_STEP1);
  updated++;
  return `"${key}":${JSON.stringify(next)}`;
});

lines[idx] = newLine;
fs.writeFileSync(HTML, lines.join("\n"), "utf8");

const promptsObj = lines.join("\n").match(/const PROMPTS = (\{[\s\S]*?\});/);
if (promptsObj) fs.writeFileSync(MIRROR, promptsObj[1] + "\n", "utf8");

console.log(`updated=${updated} already=${already} skipped(no checklist)=${skipped}`);
