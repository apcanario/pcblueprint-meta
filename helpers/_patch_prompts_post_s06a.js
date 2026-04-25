// _patch_prompts_post_s06a.js — one-shot post-S06a downstream-impact prompt edits.
//
// Usage:
//   cd "C:\Users\apcan\Downloads\Blueprint Tasks"
//   node helpers/_patch_prompts_post_s06a.js
//
// Idempotent: each note carries a sentinel string and is skipped if already present.
// Inserts each note BEFORE the closing-checklist separator (preserves the standing
// rule block at the end of every prompt).

const fs = require("fs");

const HTML = "pcblueprint-checklist_25 april.html";
const MIRROR = "prompts_line.txt";
const CHECKLIST_SEP = "\n\n---\n**Closing checklist (standing rule";

const NOTES = {
  S04f:
    "\n\nADDITIONAL SCOPE (added 2026-04-25 post-S06a): also remove `/volume2/docker/git-clone2/`. Confirmed during S06a investigation that this DSM project is a one-shot `alpine/git clone` (no schedule); container exited 10 days ago after the initial clone and has never run since. The README claim that it handles scheduled pulls was incorrect — that role is now owned by the container-side cron in pcblueprint-api (`src/services/gitSync.ts` shipped in S06a). Safe to delete the entire `/volume2/docker/git-clone2/` directory.",
  S12:
    "\n\nADDITIONAL CHECK (added 2026-04-25 post-S06a): verify `ALERT_WEBHOOK_URL` is documented consistently across `pcblueprint-api/README.md`, `pcblueprint-api/CLAUDE.md`, `pcblueprint-api/.env.example`, AND `pcblueprint-sync/README.md`. S06a added it on the api side; the sync side may already reference it (Setup section) — confirm wording and required/optional status match.",
  S16a:
    "\n\nNOTE (added 2026-04-25 post-S06a): `pcblueprint-api/src/services/gitSync.ts` already exports `sendAlert(message)` which POSTs to `ALERT_WEBHOOK_URL`. Before adding new alerting plumbing here, extract `sendAlert` into a shared module (suggested: `pcblueprint-api/src/services/alerts.ts`) and have both the cron puller and the new `/healthz` alerting depend on it. Avoid reimplementing the webhook POST.",
};

const html = fs.readFileSync(HTML, "utf8");
const lines = html.split("\n");
const idx = lines.findIndex((l) => l.includes("const PROMPTS = {"));
if (idx < 0) throw new Error("PROMPTS line not found");
let line = lines[idx];

let patched = 0;
let already = 0;
let missing = 0;

for (const [key, note] of Object.entries(NOTES)) {
  const entryRe = new RegExp(`"${key}":"((?:[^"\\\\]|\\\\.)*)"`);
  const m = line.match(entryRe);
  if (!m) {
    console.error(`!! ${key}: entry not found in PROMPTS`);
    missing++;
    continue;
  }
  const value = JSON.parse('"' + m[1] + '"');
  const sentinel = note.split("\n")[2] || note.slice(0, 60);
  if (value.includes(sentinel.slice(0, 50))) {
    console.log(`-- ${key}: note already present, skipping`);
    already++;
    continue;
  }
  const sepAt = value.indexOf(CHECKLIST_SEP);
  const updated =
    sepAt >= 0 ? value.slice(0, sepAt) + note + value.slice(sepAt) : value + note;
  const newEntry = `"${key}":${JSON.stringify(updated)}`;
  line = line.replace(m[0], newEntry);
  console.log(`++ ${key}: patched`);
  patched++;
}

lines[idx] = line;
fs.writeFileSync(HTML, lines.join("\n"), "utf8");

const newHtml = lines.join("\n");
const promptsObj = newHtml.match(/const PROMPTS = (\{[\s\S]*?\});/);
if (promptsObj) fs.writeFileSync(MIRROR, promptsObj[1] + "\n", "utf8");

console.log(`\ndone: patched=${patched} already=${already} missing=${missing}`);
