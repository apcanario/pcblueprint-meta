// _append_closing_checklist.js — append the standing post-completion rule
// to every PROMPTS entry whose session id is NOT in DEFAULT_DONE.
//
// Usage:
//   cd "C:\Users\apcan\Downloads\Blueprint Tasks"
//   node helpers/_append_closing_checklist.js
//
// Idempotent: if a prompt already contains the SENTINEL marker, it is skipped.
//
// What it does:
//   1. Reads the dated runbook HTML.
//   2. Parses the DEFAULT_DONE id list out of the HTML.
//   3. Walks every "Sxx":"<json-escaped string>" entry in the single-line
//      `const PROMPTS = {...};` object. For each one whose id is NOT in
//      DEFAULT_DONE and does NOT yet contain the SENTINEL, decodes the value,
//      appends the CHECKLIST block, re-encodes, and substitutes back.
//   4. Rewrites prompts_line.txt mirror.

const fs = require("fs");
const path = require("path");

const HTML_FILE = "pcblueprint-checklist_25 april.html";
const PROMPTS_MIRROR = "prompts_line.txt";

const SENTINEL = "Closing checklist (standing rule";

const CHECKLIST = `

---
**Closing checklist (standing rule — applies after this session's PR is merged to main; for manual sessions, after you mark complete in the runbook):**

1. Open \`Blueprint Tasks\\pcblueprint-checklist_25 april.html\` and add this session's id to the \`COMPLETED_SESSIONS\` array (~line 1986 — single source of truth, no more dual-write). Save in place — the folder is the source of truth and Pedro syncs it manually between machines.
2. Write the increment in scrum-master voice — *what shippable capability Pedro now has, plus accepted trade-offs/follow-ups*. Land it in TWO places: (a) the touched repo's \`CHANGELOG.md\` as a new \`### Increment\` paragraph in this session's dated entry; (b) the runbook HTML's \`📒 Changelog\` block as a single one-liner.
3. Walk the remaining not-done sessions in \`SESSIONS\`. For each one whose assumptions/scope/prereqs/necessity changed because of this merge, output one bullet to Pedro: \`<Sxx> — <Title>: <recommendation> — <one-sentence reason>\`. Do NOT silently edit other prompts; recommend only.`;

const cwd = process.cwd();
const htmlPath = path.join(cwd, HTML_FILE);
const mirrorPath = path.join(cwd, PROMPTS_MIRROR);

let html = fs.readFileSync(htmlPath, "utf8");

// 1. Parse DEFAULT_DONE ids.
const ddMatch = html.match(/const DEFAULT_DONE\s*=\s*\[([^\]]*)\]/);
if (!ddMatch) throw new Error("Could not locate DEFAULT_DONE in HTML");
const doneIds = new Set(
  ddMatch[1]
    .split(",")
    .map((s) => s.trim().replace(/^"/, "").replace(/"$/, ""))
    .filter(Boolean)
);
console.log(`DEFAULT_DONE has ${doneIds.size} ids: ${[...doneIds].join(", ")}`);

// 2. Locate the PROMPTS line (single long line).
const lines = html.split("\n");
const promptsLineIdx = lines.findIndex((l) => l.includes("const PROMPTS = {"));
if (promptsLineIdx < 0) throw new Error("Could not find `const PROMPTS = {` in HTML");
const promptsLine = lines[promptsLineIdx];

// 3. Walk every "Sxx":"..." entry. Use a regex with lookahead-style state machine
// to handle escaped quotes inside JSON strings.
const ENTRY_RE = /"(S\d+[a-z]?)":"((?:[^"\\]|\\.)*)"/g;

let appended = 0;
let skippedDone = 0;
let skippedAlready = 0;
let total = 0;

const newPromptsLine = promptsLine.replace(ENTRY_RE, (whole, key, encodedValue) => {
  total++;
  if (doneIds.has(key)) {
    skippedDone++;
    return whole;
  }
  // Decode (we have to wrap in quotes for JSON.parse).
  let decoded;
  try {
    decoded = JSON.parse('"' + encodedValue + '"');
  } catch (e) {
    console.warn(`!! could not JSON-decode value for ${key}; leaving untouched`);
    return whole;
  }
  if (decoded.includes(SENTINEL)) {
    skippedAlready++;
    return whole;
  }
  const updated = decoded + CHECKLIST;
  appended++;
  return `"${key}":${JSON.stringify(updated)}`;
});

console.log(`PROMPTS entries scanned: ${total}`);
console.log(`  appended:        ${appended}`);
console.log(`  skipped (done):  ${skippedDone}`);
console.log(`  skipped (already): ${skippedAlready}`);

if (appended === 0 && skippedAlready === 0) {
  throw new Error("No entries matched — regex anchor likely broken");
}

lines[promptsLineIdx] = newPromptsLine;
const newHtml = lines.join("\n");
fs.writeFileSync(htmlPath, newHtml, "utf8");
console.log(`Wrote ${HTML_FILE}`);

// 4. Rebuild prompts_line.txt mirror.
const promptsObjMatch = newHtml.match(/const PROMPTS = (\{[\s\S]*?\});/);
if (!promptsObjMatch) throw new Error("Could not re-extract PROMPTS for mirror");
fs.writeFileSync(mirrorPath, promptsObjMatch[1] + "\n", "utf8");
console.log(`Wrote ${PROMPTS_MIRROR}`);

console.log("Done.");
