// _restructure_releases.js — apply the 2026-04-25 MVP-driven release restructure
// to the runbook SESSIONS + PROMPTS + subtitle / progress text.
//
// Usage (run from Blueprint Tasks/):
//   node helpers/_restructure_releases.js
//
// Idempotent. Safe to re-run — uses the existence of "R1-01" in PROMPTS as the
// completion sentinel. After first successful run, subsequent runs are no-ops.
//
// What it does:
//   1. Drops Next.js+MUI scaffolding sessions (S07a, S07b, S08a–c, S09a–b)
//      from SESSIONS array AND PROMPTS object.
//   2. Drops the standalone deploy sessions S18a / S18b — folded into R1-08.
//   3. Renames the auth sessions: S20a→R1-01, S20b→R1-02, S20c→R1-03.
//      The prompt text for R1-01..03 reuses the existing S20a..c bodies with a
//      one-line "Pulled forward to R1 (2026-04-25)" note inserted at the top.
//   4. Adds six new sessions to SESSIONS + PROMPTS:
//      R1-04 (HTML rendering layer), R1-05 (index pages), R1-06 (detail pages),
//      R1-07 (search/filter), R1-08 (public deploy), R1-09 (observability min).
//   5. Adds `release: 'R0' | 'R1' | 'R2' | 'R4'` field to every kept session.
//      (R3 sessions will be defined at R3 kickoff per the plan.)
//   6. Rewrites prereqs that pointed at dropped sessions.
//   7. Updates subtitle + progressText to reflect new count (55 → 52).
//   8. Refreshes prompts_line.txt mirror.

const fs = require("fs");
const path = require("path");

const HTML = "pcblueprint-checklist_25 april.html";
const MIRROR = "prompts_line.txt";

// ── Configuration ──────────────────────────────────────────────────────────

// Sessions dropped entirely (Next.js+MUI scaffolding superseded by R1-04..R1-07,
// and the standalone deploy sessions folded into R1-08).
const DROP = ["S07a", "S07b", "S08a", "S08b", "S08c", "S09a", "S09b", "S18a", "S18b"];

// Auth sessions pulled forward to R1 (rename + retag).
const RENAME = {
  "S20a": "R1-01",
  "S20b": "R1-02",
  "S20c": "R1-03",
};

// Release tag per kept session (after rename). R3 has no sessions yet — to be
// planned at R3 kickoff. R4 sessions wait on R3 visual identity to be planned.
const RELEASE = {
  // R0 — Foundation
  "S00":"R0","S01":"R0","S02a":"R0","S02b":"R0","S03a":"R0","S03b":"R0",
  "S04a":"R0","S04b":"R0","S04c":"R0","S04d":"R0","S04e":"R0","S04f":"R0","S04g":"R0","S04h":"R0",
  "S05a":"R0","S05b":"R0","S05c":"R0",
  "S06a":"R0","S06b":"R0","S06c":"R0","S06d":"R0","S06e":"R0","S06f":"R0",
  "S16a":"R0","S16b":"R0",
  // R1 — Private Archive Browser
  "R1-01":"R1","R1-02":"R1","R1-03":"R1",
  "R1-04":"R1","R1-05":"R1","R1-06":"R1","R1-07":"R1","R1-08":"R1","R1-09":"R1",
  // R2 — AI Chat over the archive
  "S10a":"R2","S10b":"R2","S10c":"R2","S10d":"R2",
  "S11a":"R2","S11b":"R2","S11c":"R2",
  "S12":"R2",
  "S13a":"R2","S13b":"R2",
  "S14a":"R2","S14b":"R2","S14c":"R2",
  "S15a":"R2","S15b":"R2",
  // R4 — Mobile + Offline
  "S19a":"R4","S19b":"R4","S19c":"R4",
};

// Prereq rewrites for sessions whose old prereqs referenced dropped/renamed IDs.
const PREREQ_REWRITE = {
  "R1-01": [],
  "R1-02": ["R1-01"],
  "R1-03": ["R1-01", "R1-02"],
  "S11a":  ["R1-04", "S10a"],
  "S13b":  ["S13a", "R1-04", "S11a"],
  "S12":   ["S11c", "S10d", "S06f", "R1-08"],
  "S19a":  ["R1-08"],
  "S19b":  ["S19a"],
};

// Phase + branch updates for renamed sessions (S20a→R1-01 etc).
const RENAMED_META = {
  "R1-01": { phase: "R1 — Private Archive Browser", branch: "claude/r1-01-auth-core" },
  "R1-02": { phase: "R1 — Private Archive Browser", branch: "claude/r1-02-auth-ux" },
  "R1-03": { phase: "R1 — Private Archive Browser", branch: "claude/r1-03-auth-hardening" },
};

// New sessions to add (R1-04..R1-09). Inserted into SESSIONS array.
const NEW_SESSIONS = [
  { id: "R1-04", title: "API HTML rendering layer + base layout", repos: ["api"], time: 60, prereqs: ["R1-01"], phase: "R1 — Private Archive Browser", branch: "claude/r1-04-html-render" },
  { id: "R1-05", title: "Archive index pages (one route per top-level bucket)", repos: ["api"], time: 75, prereqs: ["R1-04"], phase: "R1 — Private Archive Browser", branch: "claude/r1-05-index-pages" },
  { id: "R1-06", title: "Record detail pages (per-domain templates)", repos: ["api"], time: 75, prereqs: ["R1-04"], phase: "R1 — Private Archive Browser", branch: "claude/r1-06-detail-pages", parallel: true },
  { id: "R1-07", title: "Search + tag filter pages", repos: ["api"], time: 60, prereqs: ["R1-05", "R1-06"], phase: "R1 — Private Archive Browser", branch: "claude/r1-07-search-filter" },
  { id: "R1-08", title: "Public deploy (API + HTML as one unit)", repos: ["api"], time: 60, prereqs: ["R1-03", "R1-07"], phase: "R1 — Private Archive Browser", branch: "claude/r1-08-deploy" },
  { id: "R1-09", title: "Observability minimum (request log + crash reporting)", repos: ["api"], time: 45, prereqs: ["R1-08"], phase: "R1 — Private Archive Browser", branch: "claude/r1-09-observability" },
];

// ── Prompt templates ───────────────────────────────────────────────────────

const STD_HEADER_PREFIX = `STANDING INSTRUCTIONS

Before starting:`;

const STD_FOOTER = `

SECURITY RULES (added 2026-04-24, follow strictly):
- Never paste discovered secret values (API keys, tokens, passwords) into chat responses or PR descriptions. Reference by variable name only (e.g. "the API_KEY env var"), never the value itself.
- When investigating env/config, prefer variable-name-only output. If a value must be revealed to answer a question, warn the user first and confirm before showing it.
- Do not modify package-lock.json. If npm install drifts the lockfile, discard (git checkout --) rather than commit — the repo has pre-existing drift that should be resolved in a dedicated PR.

DEFENSIVE RULES (follow strictly):
- Never read files >30KB.
- Use git mv only for file moves.
- Don't boot the dev server; leave runtime verification to me.
- On test failure, read only the failing test's output.
- Commit in small chunks, not one mega-commit.
- If scope is wider than expected, STOP and hand back a note.

---`;

const CLOSING_CHECKLIST = `

---
**Closing checklist (standing rule — applies after this session's PR is merged to main; for manual sessions, after you mark complete in the runbook):**

1. Open \`Blueprint Tasks\\pcblueprint-checklist_25 april.html\` and add this session's id to the \`COMPLETED_SESSIONS\` array (~line 2135 — single source of truth, no more dual-write). Save in place — the folder is the source of truth and Pedro syncs it manually between machines (now also via the \`pcblueprint-meta\` GitHub repo).
2. Write the increment in scrum-master voice — *what shippable capability Pedro now has, plus accepted trade-offs/follow-ups*. Land it in TWO places: (a) the touched repo's \`CHANGELOG.md\` as a new \`### Increment\` paragraph in this session's dated entry; (b) the runbook HTML's \`📒 Changelog\` block as a single one-liner.
3. Walk the remaining not-done sessions in \`SESSIONS\`. For each one whose assumptions/scope/prereqs/necessity changed because of this merge, output one bullet to Pedro: \`<Sxx | R1-xx> — <Title>: <recommendation> — <one-sentence reason>\`. Do NOT silently edit other prompts; recommend only.`;

function r1Header(sessionId, title, branch, repos, timeMin) {
  const repoList = repos.join(", ");
  const repoCheckout = repos.length === 1
    ? `In pcblueprint-${repos[0]}: git checkout main && git pull origin main.`
    : repos.map(r => `In pcblueprint-${r}: git checkout main && git pull origin main.`).join("\n- ");
  return `${STD_HEADER_PREFIX}
- Confirm prereqs merged.
- ${repoCheckout}
- Then: git checkout -b ${branch}.

NOTE: Single-repo session. No session-log entry — batched into S12.

Before ending the session you MUST:
- Update README.md + CLAUDE.md if conventions / endpoints / env vars changed.
- Push branch + open PR titled "${sessionId} — ${title}".
- Do not merge without my approval.
${STD_FOOTER}

SESSION ${sessionId} — ${title} — pcblueprint-${repoList} — ~${timeMin} min`;
}

// Per-session prompt bodies. Tight scope; each session is independently mergeable.
const NEW_PROMPT_BODIES = {
  "R1-04": `

Background: R1 (Private Archive Browser, MVP-driven plan 2026-04-25) ships server-rendered HTML directly from the API — no Next.js, no MUI, no Tailwind. Default browser CSS only. This session lays the rendering foundation for R1-05..R1-09.

Pick a minimal templating engine — recommend EJS (mature, no compile step, plays nicely with Express). Add it as a dependency.

Implement:
1. Mount the engine: \`app.set('view engine', 'ejs')\`, views directory at \`src/views/\`.
2. Single base layout \`views/_layout.ejs\` — semantic \`<header>\` (site title + nav links to /records /writing /raw /source-files /sessions), \`<main>\` (block: content), \`<footer>\` (build version + auth status).
3. One tiny default-CSS sheet at \`public/_/runbook.css\` (or similar) — fewer than 100 lines, focused on readable typography and table layout. NO framework. NO custom branding.
4. A \`/\` route that renders a landing page listing the five buckets with link-throughs.
5. A 404 page rendered by the engine.

Auth gating: every HTML route (including /) requires a valid session from R1-01. Anonymous requests redirect to /login.

Verification: \`pnpm test\` green. Manual smoke: visit /, see the bucket list. Visit /records without a session → redirected to /login.

No actual archive data rendering yet — that's R1-05 / R1-06. This session is pure scaffold + auth-gated.`,

  "R1-05": `

Background: R1-04 landed the rendering layer. This session implements one index page per top-level archive bucket — the user can navigate from / into any bucket and see a list of contents.

Implement \`GET\` routes returning EJS-rendered HTML for:
- \`/records\` → grouped sub-list (BP, blood tests, medical notes, exams, medications, flags, blueprint versions). Each group shows the most recent N entries with date + slug, link-throughs to detail pages (R1-06).
- \`/writing\` → grouped (journal, memories per author, biography, identity context, identity patterns). Same shape.
- \`/raw\` → flat list of raw files with date + filename.
- \`/source-files\` → grouped by domain subdir (medical, fitness, etc.) with filename + size + upload date.
- \`/sessions\` → reverse-chronological session log entries.

Each list links to detail pages whose URLs are TBD in R1-06 — for this session, render placeholder hrefs (\`#\`) where the detail page doesn't exist yet, but make the structure right.

Pull the data via existing read services (already exist from S04*/S05*) — do NOT re-implement reads here. If a service doesn't yet expose what you need, add a thin reader; do not write to the archive in this session.

Verification: \`pnpm test\` green. Manual smoke: visit each /index page, see real archive data, view-source confirms it's pure HTML (no JS bundle).`,

  "R1-06": `

Background: R1-05 produced index pages with link-throughs to detail pages. This session implements the detail pages.

Implement one EJS template per active record domain, rendered server-side at canonical URLs:
- \`/records/bp/:date-:time-:arm\`
- \`/records/blood-tests/:slug\`
- \`/records/medical/notes/:date-:slug\`
- \`/records/medical/exams/:date-:slug\`
- \`/records/medical/medications/:slug\`
- \`/records/medical/flags/:slug\`
- \`/records/blueprint/:version\`
- \`/writing/journal/:date\`
- \`/writing/memories/:author/:date-:slug\`
- \`/writing/biography\` (single page; not slug-indexed)
- \`/writing/identity/context\` (single page)
- \`/writing/identity/patterns/:slug\`
- \`/raw/:filename\`
- \`/source-files/:domain/:filename\` — for binaries, render metadata + a download link, never inline the bytes.
- \`/sessions/:id\`

Per-domain template renders the JSON / markdown contents in a human-readable format. Tables for tabular data (lab values, BP readings). Markdown rendered with a tiny tool (e.g. \`marked\`) — no live preview, just static output.

Tag chips on every page: render \`tags_applied\` (or analog field) as small links to \`/search?tag=<tag>\` (the search page is R1-07).

Verification: \`pnpm test\` green. Manual smoke: click through index pages from R1-05 into a representative detail page in each domain, verify all fields render.`,

  "R1-07": `

Background: R1-05 + R1-06 give navigable browsing. This session adds search.

Implement:
1. \`GET /search\` — renders a search form (text input + tag filter dropdown populated from \`get_tag_vocabulary()\` style read).
2. \`POST /search\` (or \`GET /search?q=&tag=\`) — executes:
   - **Text query**: full-text scan across journal entries, memories, medical notes, identity context. Use existing search services if any; otherwise add a minimal grep-style scanner over the relevant files (acceptable for R1's data volume — optimise later if needed).
   - **Tag filter**: filter records whose \`tags_applied\` (or per-domain tag field) include the selected tag.
   - **Combined**: AND of both.
3. Result page renders a flat list of matched records — title, snippet, date, link-through to detail page.

No JS-side filtering. Form submits, server renders results page.

Verification: \`pnpm test\` green. Manual smoke: search for a known journal phrase → result. Filter by a known tag → records appear.`,

  "R1-08": `

Background: replaces the original S18a (Vercel website deploy) + S18b (custom domain) — under R1 the archive HTML lives in the API, so deploy is one operation, not two.

Choose a hosting target. Two acceptable paths:
- **Cloudflare tunnel to NAS** (uses existing infra; lowest cost; api already runs on /volume2).
- **Fly.io** small instance (more managed; auto-deploys from main; small monthly cost).

Recommend Cloudflare tunnel given existing NAS infra.

Implement:
1. Production environment config — env vars locked to actual values (API_TOKEN, DB_PATH, RESEND_API_KEY from R1-02, etc.). Document required env in README + CLAUDE.md.
2. Cloudflare tunnel config OR Fly.io \`fly.toml\` — pick one, document the other as the alternative for future reference.
3. Custom domain (Pedro's choice; document in README) with HTTPS via tunnel / Fly.
4. Smoke test from public URL: hit /login, complete auth (R1-01..03), browse /records, view a detail page, run a search.

No CDN, no edge caching tricks — first deploy keeps it boring. Cache headers on static CSS only.

Verification: full end-to-end smoke from a clean browser session. Document the smoke checklist in README so future deploys can re-run it.`,

  "R1-09": `

Background: R1 is now publicly reachable. Operability needs request-level visibility.

Implement (minimum viable, NOT the full S16a observability):
1. Structured request log — one JSON line per request with: timestamp, method, path, status, duration_ms, user_id (if authenticated), error_code (if any). Write to \`logs/requests-<YYYY-MM-DD>.ndjson\`. Rotate daily.
2. Crash reporting — uncaught exceptions + 5xx responses captured with stack trace into \`logs/errors-<YYYY-MM-DD>.ndjson\`.
3. \`GET /healthz\` — returns 200 with build version + uptime + last-error timestamp. Public (no auth).
4. Daily logrotate-style archival into \`logs/archive/\` after 7 days; delete after 90 days.

Do NOT add Sentry / Datadog / external SaaS in this session. NDJSON logs on disk are enough for R1 launch — escalate if/when volume justifies.

Verification: induce a 5xx (e.g. force a route to throw), confirm crash log captures stack. Confirm /healthz returns 200. Check log rotation by setting the date forward in a test.`,
};

// Renamed-session prompts (R1-01..R1-03) reuse S20a..c bodies with a one-line
// "pulled forward" note inserted at the very top, plus updated header banner.
function rebrandRenamedPrompt(oldId, newId, oldPrompt) {
  // Update SESSION banner: "SESSION S20a — Auth ..." → "SESSION R1-01 — Auth core ..."
  let p = oldPrompt;
  p = p.replace(new RegExp(`SESSION ${oldId} — `, "g"), `SESSION ${newId} — `);
  // Update branch references (claude/s20a-auth-core → claude/r1-01-auth-core).
  const newBranch = RENAMED_META[newId].branch;
  p = p.replace(/claude\/s20[abc][^"\s,)]*/g, newBranch);
  // Insert a "pulled forward" note immediately after the first SESSION header.
  const sessionHeaderRe = new RegExp(`(SESSION ${newId} — [^\\n]+)`);
  const note = `\n\nRELEASE NOTE (2026-04-25): This session was pulled forward from the original "Production — Auth Hardening" phase to R1 (Private Archive Browser). Real auth gates the public archive from day one — no APP_PASSWORD-only window. Scope is unchanged.`;
  p = p.replace(sessionHeaderRe, `$1${note}`);
  return p;
}

// ── Apply ──────────────────────────────────────────────────────────────────

const html = fs.readFileSync(HTML, "utf8");

// 1. Locate PROMPTS line and parse it as JSON.
const lines = html.split("\n");
const promptsIdx = lines.findIndex(l => l.includes("const PROMPTS = {"));
if (promptsIdx < 0) throw new Error("PROMPTS line not found");
const promptsLine = lines[promptsIdx];

// Idempotency check: if R1-01 already exists in PROMPTS, the restructure has been applied.
if (promptsLine.includes(`"R1-01":`)) {
  console.log("-- R1-01 already in PROMPTS → restructure already applied. Exiting no-op.");
  process.exit(0);
}

// Extract the JSON object literal from the line.
const promptsJsonStart = promptsLine.indexOf("{");
const promptsJsonEnd = promptsLine.lastIndexOf("}");
if (promptsJsonStart < 0 || promptsJsonEnd < 0) throw new Error("Could not bracket-locate PROMPTS object");
const promptsJsonStr = promptsLine.slice(promptsJsonStart, promptsJsonEnd + 1);
const PROMPTS = JSON.parse(promptsJsonStr);

console.log(`-- parsed PROMPTS object with ${Object.keys(PROMPTS).length} entries`);

// 2. Drop superseded sessions from PROMPTS.
let dropped = 0;
for (const id of DROP) {
  if (PROMPTS[id] !== undefined) {
    delete PROMPTS[id];
    dropped++;
  }
}
console.log(`++ dropped ${dropped} session prompts: ${DROP.filter(id => true).join(", ")}`);

// 3. Rename auth prompts.
let renamed = 0;
for (const [oldId, newId] of Object.entries(RENAME)) {
  if (PROMPTS[oldId] !== undefined && PROMPTS[newId] === undefined) {
    PROMPTS[newId] = rebrandRenamedPrompt(oldId, newId, PROMPTS[oldId]);
    delete PROMPTS[oldId];
    renamed++;
  }
}
console.log(`++ renamed ${renamed} prompts (S20a→R1-01, S20b→R1-02, S20c→R1-03)`);

// 4. Add new R1-04..R1-09 prompts.
let added = 0;
for (const session of NEW_SESSIONS) {
  if (PROMPTS[session.id] === undefined) {
    const header = r1Header(session.id, session.title, session.branch, session.repos, session.time);
    const body = NEW_PROMPT_BODIES[session.id];
    if (!body) throw new Error(`Missing prompt body for ${session.id}`);
    PROMPTS[session.id] = header + body + CLOSING_CHECKLIST;
    added++;
  }
}
console.log(`++ added ${added} new R1-* prompts`);

// 5. Re-serialize PROMPTS as single-line JSON and replace the line.
const newPromptsJson = JSON.stringify(PROMPTS);
lines[promptsIdx] = `${promptsLine.slice(0, promptsJsonStart)}${newPromptsJson}${promptsLine.slice(promptsJsonEnd + 1)}`;

// 6. Now process the SESSIONS array — drop, rename, add release field, rewrite prereqs.
//    Find the SESSIONS array start + end lines.
const sessionsStartIdx = lines.findIndex(l => /const SESSIONS\s*=\s*\[/.test(l));
if (sessionsStartIdx < 0) throw new Error("SESSIONS array start not found");

// Find the closing `];` after sessionsStartIdx.
let sessionsEndIdx = -1;
for (let i = sessionsStartIdx + 1; i < lines.length; i++) {
  if (/^\s*\];/.test(lines[i])) { sessionsEndIdx = i; break; }
}
if (sessionsEndIdx < 0) throw new Error("SESSIONS array end not found");

// Process each session line in [sessionsStartIdx + 1, sessionsEndIdx).
const newSessionLines = [];
let sessionsDropped = 0, sessionsRenamed = 0, sessionsTagged = 0;

for (let i = sessionsStartIdx + 1; i < sessionsEndIdx; i++) {
  const line = lines[i];
  const idMatch = line.match(/id:\s*"([^"]+)"/);
  if (!idMatch) {
    // Comment line or blank — keep as-is.
    newSessionLines.push(line);
    continue;
  }
  const oldId = idMatch[1];

  // Drop?
  if (DROP.includes(oldId)) {
    sessionsDropped++;
    continue;
  }

  // Rename?
  let id = oldId;
  if (RENAME[oldId]) {
    id = RENAME[oldId];
    sessionsRenamed++;
  }

  // Build the new session line.
  // We mutate the ID, the prereqs (if rewritten), the phase + branch (if renamed),
  // and append `release: "Rx"`.
  let newLine = line;

  if (id !== oldId) {
    newLine = newLine.replace(`id: "${oldId}"`, `id: "${id}"`);
    // Update branch + phase if this is a rename.
    const meta = RENAMED_META[id];
    if (meta) {
      newLine = newLine.replace(/branch:\s*"[^"]*"/, `branch: "${meta.branch}"`);
      newLine = newLine.replace(/phase:\s*"[^"]*"/, `phase: "${meta.phase}"`);
    }
  }

  // Prereq rewrite?
  if (PREREQ_REWRITE[id]) {
    const newPrereqs = JSON.stringify(PREREQ_REWRITE[id]).replace(/,/g, ", ");
    newLine = newLine.replace(/prereqs:\s*\[[^\]]*\]/, `prereqs: ${newPrereqs}`);
  }

  // Add waitingFor for R4 sessions (gated on R3 being planned).
  if (RELEASE[id] === "R4" && !/waitingFor:/.test(newLine)) {
    // Insert before the closing `}` of the session object.
    newLine = newLine.replace(/(\s*)\},(\s*)$/, `$1, waitingFor: "R3 visual identity sessions to be planned" $1},$2`);
  }

  // Add release field.
  const release = RELEASE[id];
  if (release && !/release:/.test(newLine)) {
    // Insert immediately after `id: "..."` for source readability.
    newLine = newLine.replace(/(id:\s*"[^"]+",)/, `$1 release: "${release}",`);
    sessionsTagged++;
  }

  newSessionLines.push(newLine);
}

console.log(`++ SESSIONS: dropped=${sessionsDropped} renamed=${sessionsRenamed} release-tagged=${sessionsTagged}`);

// 7. Append the new R1-04..R1-09 sessions.
for (const s of NEW_SESSIONS) {
  const release = RELEASE[s.id];
  const optParallel = s.parallel ? `, parallel: true` : "";
  const prereqsStr = JSON.stringify(s.prereqs).replace(/,/g, ", ");
  const reposStr = JSON.stringify(s.repos).replace(/,/g, ", ");
  newSessionLines.push(`    { id: "${s.id}", release: "${release}", title: ${JSON.stringify(s.title)}, repos: ${reposStr}, time: ${s.time}, prereqs: ${prereqsStr}, phase: ${JSON.stringify(s.phase)}, branch: "${s.branch}"${optParallel} },`);
}
console.log(`++ appended ${NEW_SESSIONS.length} new R1-* sessions to SESSIONS array`);

// Replace the section in `lines`.
const beforeSessions = lines.slice(0, sessionsStartIdx + 1);
const afterSessions = lines.slice(sessionsEndIdx);
const newLines = [...beforeSessions, ...newSessionLines, ...afterSessions];

// 8. Update subtitle + progressText counts.
const oldCount = 55;
const newCount = oldCount - DROP.length /* 9 dropped */ + NEW_SESSIONS.length /* 6 new */; // = 52
// (Renames don't change count.)
let subtitleSwapped = 0, progressSwapped = 0;
for (let i = 0; i < newLines.length; i++) {
  if (newLines[i].includes(`<p class="subtitle">`) && newLines[i].includes(`${oldCount} sessions across`)) {
    newLines[i] = newLines[i].replace(`${oldCount} sessions across`, `${newCount} sessions across`);
    subtitleSwapped++;
  }
  if (newLines[i].includes(`>0 of ${oldCount}<`)) {
    newLines[i] = newLines[i].replace(`>0 of ${oldCount}<`, `>0 of ${newCount}<`);
    progressSwapped++;
  }
}
console.log(`++ subtitle bumped ${oldCount}→${newCount}: ${subtitleSwapped} replacement(s); progressText: ${progressSwapped} replacement(s)`);

// 9. Write back.
fs.writeFileSync(HTML, newLines.join("\n"), "utf8");

// 10. Refresh prompts_line.txt mirror.
fs.writeFileSync(MIRROR, newPromptsJson + "\n", "utf8");
console.log(`++ refreshed ${MIRROR}`);

console.log(`\nDone. New session count = ${newCount}. R1-01..R1-09 added/renamed. _extract.js should now find any new R1-* id.`);
