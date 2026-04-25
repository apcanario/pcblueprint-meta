// _patch_chat_architecture.js — apply the 2026-04-25 chat-architecture pivot
// to the runbook PROMPTS + SESSIONS arrays.
//
// Usage:
//   cd "C:\Users\apcan\Downloads\Blueprint Tasks"
//   node helpers/_patch_chat_architecture.js
//
// Idempotent: each prompt note carries a sentinel and is skipped if present.
// New session S14c is added only if not already in PROMPTS.
//
// What it does:
//   1. Inserts an "ARCHITECTURE PIVOT (2026-04-25)" block into each of:
//      S10a, S10b, S10c, S11a, S11c, S13a, S14a, S14b, S15a, S15b
//      The block is inserted BEFORE the closing-checklist sentinel so the
//      standing rule stays at the very end of every prompt.
//   2. Adds NEW session S14c — Export Tools — to SESSIONS + PROMPTS, slotted
//      between S14b and S15a in the "Chatbot — Tool Surface" phase.
//   3. Updates S15a prereqs to include S14c.
//   4. Bumps subtitle + progressText session count from 54 to 55.
//   5. Refreshes prompts_line.txt mirror.

const fs = require("fs");

const HTML = "pcblueprint-checklist_25 april.html";
const MIRROR = "prompts_line.txt";
const CHECKLIST_SEP = "\n\n---\n**Closing checklist (standing rule";
const PIVOT_SENTINEL = "ARCHITECTURE PIVOT (2026-04-25)";

// ── Per-prompt pivot notes ─────────────────────────────────────────────────
const NOTES = {
  S10a: `

ARCHITECTURE PIVOT (2026-04-25): The chat is NOT a conversational chatbot. It is a stateless natural-language task endpoint with three verbs: WRITE / QUERY / EXPORT. Each interaction is one task, no conversation history retained between requests.

Adjustments to the original implementation:
- Request body drops \`session_id\`. New shape: \`{ messages: [<single user turn>], file?: <multipart>, intent?: <optional hint> }\`.
- No state persisted between requests on the server.
- The \`messages\` array passed into the provider is the agent's INTERNAL tool loop within ONE transaction — it is NOT cross-request chat history.
- Response: stream events until the final assistant turn, then close. No "continue conversation" semantics.

See memory \`chat_architecture_three_verbs.md\` for the full WRITE/QUERY/EXPORT contracts.`,

  S10b: `

ARCHITECTURE PIVOT (2026-04-25): Every write tool MUST return a standardised response shape:
  \`{ saved_path: string, github_url: string, viewer_url: string, tags_applied: string[] }\`
The frontend (S11c) renders these as clickable links so Pedro can verify writes landed. log_bp + create_journal set the pattern; every later write tool inherits it.

Identity-based duplicate detection contract (applies to every write tool):
- Define \`identityOf(record)\` for the domain (e.g. journal: \`(date, body_hash)\`; BP: \`(date, time, arm)\`).
- Implement \`findExisting(identity)\` against the relevant archive file(s).
- Three-way decision on every write:
  1. All-new → write all, normal confirm.
  2. Partial overlap → silently dedupe, write only the delta, surface a breakdown ("added X, skipped Y already in archive").
  3. Full duplicate → escalate to user with side-by-side comparison + 3-way choice [Keep existing / Replace / Keep both]. "Keep both" = versioned suffix (\`-v2\`, \`-v3\`).

Move shared dedup logic into \`src/chat/tools/dedup.ts\` (or similar) so every write tool consumes the same utility.

See memory \`chat_architecture_three_verbs.md\`.`,

  S10c: `

ARCHITECTURE PIVOT (2026-04-25): Add \`get_tag_vocabulary()\` to the read-tool catalog. Reads \`writing/identity/tags\` and returns the canonical tag list. Required by every WRITE flow — the agent applies only canonical tags, never invents free-text tags (which would fragment future search).

See memory \`chat_architecture_three_verbs.md\`.`,

  S11a: `

ARCHITECTURE PIVOT (2026-04-25): The chat is stateless. DROP the persistence half of this session. The frontend is a "command bar + result panel + deliverable-download slot" — NOT a chat thread.

Adjustments:
- No conversation thread UI. Each task = one round-trip; after the result, input clears for the next task.
- Optional in-memory session-only history strip showing the last few tasks for context (no persistence, no cross-device sync, no sqlite).
- Streaming text rendering still applies WITHIN a single task (agent emits partial text + tool calls before final answer).
- Markdown rendering still applies for answers.
- Add a deliverable-download slot in the result panel for EXPORT verb outputs.

See memory \`chat_architecture_three_verbs.md\`.`,

  S11c: `

ARCHITECTURE PIVOT (2026-04-25): The confirm flow is much richer than yes/no. Per the WRITE contract:

1. Render extracted fields as an EDITABLE PREVIEW per domain:
   - Lab values table (medical / blood tests)
   - Markdown editor (journal / memory)
   - Metadata form (chronology events, BP readings)
2. Surface dedup outcomes:
   - Partial overlap: breakdown ("added X new, skipped Y already in archive").
   - Full duplicate: side-by-side existing vs incoming + 3-way choice [Keep existing / Replace / Keep both].
3. Multi-domain split: if a single input contains records for multiple domains, surface the proposed split with [Save split / Bundle / Edit] choice. Default to split once approved.
4. After commit: render the response shape (\`saved_path\` / \`github_url\` / \`viewer_url\`) as clickable links + the \`tags_applied\` list.

See memory \`chat_architecture_three_verbs.md\` for full contracts.`,

  S13a: `

ARCHITECTURE PIVOT (2026-04-25): Scope expands beyond just the multipart endpoint. INCLUDE in this session:

- PDF text extraction (\`pdf-parse\` or \`pdfjs-dist\`).
- Medical lab-report schema mapper: extract per-marker records \`{date, lab_name, marker, value, units, range, flag}\` from common Portuguese / English clinic-issued lab PDFs. Reference ranges in the PDF are FIRST-CLASS data (used by the QUERY verb's normal-range comparison).
- Image OCR is OUT OF SCOPE here — defer to a follow-up session if/when needed.

Why expanded: the chat's WRITE verb has PDF blood-test ingestion as a stated first-class use case; deferring the parser leaves S13a half-done.

See memory \`chat_architecture_three_verbs.md\`.`,

  S14a: `

ARCHITECTURE PIVOT (2026-04-25): Scope expands. The chat's WRITE verb covers ALL active user-data buckets in the archive (\`records/\`, \`writing/\`, \`raw/\`, \`source-files/\`, \`sessions/\`), NOT a curated subset. System buckets (\`_legacy/\`, \`meta/\`, \`scripts/\`, \`claude-code-prompts/\`) are explicitly off-limits to chat writes.

Required write tools to enumerate (some already exist in the api from S05*):
- WRITING: create_journal (S10b), create_memory (default \`author=Pedro Canário\`), update_identity_context, add_identity_pattern.
- RECORDS: log_bp (S10b), add_blood_test, add_medical_note, add_medical_exam, add_medication, add_medical_flag, post_blueprint_version.
- RAW: add_raw_record (generic raw-bucket write).
- SOURCE-FILES: add_source_file (covered by S13a/b).
- SESSIONS: append_session_log (already exists from S05b).
- TAGS: add_tag_to_vocabulary.
- CHRONOLOGY: add_chronology_event (already from S05c).

Likely api gaps to fill in this session (verify + implement if missing):
- \`PATCH /identity/context\`
- \`POST /identity/patterns\`
- \`POST /identity/tags\`
- Verify medical sub-resources (\`/health/medical/notes\`, \`/exams\`, \`/medications\`, \`/flags\`) all have writes.
- \`POST /raw/...\` for the generic raw write, if used by chat.

EVERY write tool inherits the contracts from S10b:
- Response shape \`{ saved_path, github_url, viewer_url, tags_applied }\`.
- Identity-based dedup (3-way: all-new / partial / full duplicate).
- Auto-tag from canonical vocabulary (\`get_tag_vocabulary\` from S10c).

See memory \`chat_architecture_three_verbs.md\`.`,

  S14b: `

ARCHITECTURE PIVOT (2026-04-25): In addition to cross-domain orchestrators, ADD \`web_search(query)\` to the tool catalog. Required by the QUERY verb when comparing fresh inputs (blood tests, etc.) against medical reference values not embedded in the source PDFs. The agent's preference order: PDF-embedded ranges first → web_search fallback. The answer cites the source of the comparison range.

See memory \`chat_architecture_three_verbs.md\`.`,

  S15a: `

ARCHITECTURE PIVOT (2026-04-25): The system prompt is NOT conversational. It encodes a stateless task router with three verbs.

System prompt structure:
1. Classify intent: WRITE / QUERY / EXPORT.
2. WRITE protocol:
   - Parse + extract records from input (text or file).
   - Detect multi-domain input → propose split before commit.
   - Call \`get_tag_vocabulary()\` to get canonical tags.
   - Run identity-based dedup → all-new / partial / full duplicate.
   - Surface confirmation preview (S11c) before commit.
   - Return response with \`saved_path / github_url / viewer_url / tags_applied\`.
3. QUERY protocol:
   - Read relevant archive files via read tools.
   - Cross-reference if needed: when comparing fresh input to history, AUTO-SAVE the input first (dedup contract still applies).
   - For reference ranges: prefer PDF-embedded ranges, fall back to \`web_search\`.
   - Always cite sources in the answer (link to the archive files read).
   - Short structured answer for fact queries; prose for interpretive queries.
4. EXPORT protocol:
   - Gather data via read tools.
   - Generate deliverable using S14c's export tools (pdf / csv / markdown / zip) following the standard filename convention \`<verb>-<scope>-<YYYY-MM-DD>.<ext>\`.
   - Return download URL.

Provider: Anthropic SDK with prepaid credits + workspace spend cap. Default model = Claude Haiku 4.5 (cheap + fast for simple tasks). Escalate to Sonnet 4.6 for hard cross-domain or interpretive queries (router decides per request, e.g. heuristic on query complexity / tool-call count).

Three-layer cost ceiling (all in this session):
- Per-request: \`max_tokens\` cap, max-iterations cap (≤10 tool calls per request), hard timeout (~60s).
- App-level monthly budget guard: track tokens spent in a small JSON / sqlite ledger; refuse new \`/chat\` with 429 when 100% of monthly cap hit, warn at 80%.
- Vendor-level: prepaid credits + workspace spend limit (set in Anthropic console, outside the codebase).

Add S14c as a prereq (was \`["S10a", "S14a", "S14b"]\`, now \`["S10a", "S14a", "S14b", "S14c"]\`) so the export tools exist when the system prompt is written.

See memory \`chat_architecture_three_verbs.md\`.`,

  S15b: `

ARCHITECTURE PIVOT (2026-04-25): REPLACE this session's scope.

OLD: "Server-Side Conversation Persistence — sqlite-backed chat history".
NEW: "Transaction Audit Log — sqlite-backed log of every chat task" — timestamp, verb (WRITE/QUERY/EXPORT), classified intent, tools called (with args), result/error, tokens used, cost.

Why: under the new architecture, there is no conversation history to persist. But an audit trail of "what did the agent do to my archive" is still valuable for debugging, accountability, and answering "what changed last Thursday?".

Schema: append-only, indexed by date + verb. Frontend may surface recent transactions in a "recent activity" view (out of scope for this session — backend only).

Title may want to change to \`S15b — Transaction Audit Log\` post-merge.

See memory \`chat_architecture_three_verbs.md\`.`,
};

// ── New S14c session ────────────────────────────────────────────────────────
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

const S14C_PROMPT_BODY = `STANDING INSTRUCTIONS

Before starting:
- Confirm prereqs merged (S14b at minimum).
- In pcblueprint-api: git checkout main && git pull origin main.
- Then: git checkout -b claude/s14c-export-tools.

NOTE: Single-repo session. No session-log entry — batched into S12.

Before ending the session you MUST:
- Update README.md + CLAUDE.md if conventions / endpoints / env vars changed.
- Push branch + open PR titled "S14c — Export Tools".
- Do not merge without my approval.
${STD_FOOTER}

SESSION S14c — Export Tools — pcblueprint-api — ~40 min

Background: the chat's EXPORT verb (per the 2026-04-25 architecture pivot) needs tools to generate downloadable deliverables. See memory \`chat_architecture_three_verbs.md\`.

Implement (each as an internal chat tool, callable by the agent):
1. \`export_to_pdf({ query, scope, options? })\` — simple PDF (header: Pedro's name + date + scope; body: content; page numbers; footer). Library: \`pdfkit\` or \`puppeteer\`. Default minimal template; iterate when needed.
2. \`export_to_csv({ query, scope })\` — flat CSV, descriptive column names, ISO dates. Optimised for storage / downstream tooling, NOT direct human reading.
3. \`export_to_markdown({ query, scope })\` — concatenated Markdown for "give me everything as one printable doc" exports.
4. \`bundle_source_files({ query })\` — \`.zip\` of selected source files (per-domain subdirs inside the zip). Universal cross-platform compatibility — never \`.tar.gz\`.
5. \`generate_report({ template, scope })\` — composite: data + simple chart(s) + commentary, rendered to PDF.

Filename convention (universal): \`<verb>-<scope>-<YYYY-MM-DD>.<ext>\`. Examples: \`report-hrv-2026-04.pdf\`, \`export-journal-2024-01_to_2024-12.md\`, \`bundle-medical-2024.zip\`.

Storage: deliverables written to \`<archive>/exports/<YYYY-MM>/\` — does NOT pollute user-data buckets. Add a TTL cleanup script in \`scripts/\` (e.g. delete deliverables older than 30 days). Response includes a download URL.

Tool catalog: register the five tools in the existing tool surface (per S14a's enumeration). Agent picks based on user intent ("give me a PDF report" vs "let me download my 2024 medical files").

Verification: \`pnpm test\` green. Manual smoke: ask the agent for each export type, verify the file exists at the returned URL with the expected filename + reasonable content.

---END S14c---`;

// ── Apply ───────────────────────────────────────────────────────────────────

const html = fs.readFileSync(HTML, "utf8");
const lines = html.split("\n");
const idx = lines.findIndex((l) => l.includes("const PROMPTS = {"));
if (idx < 0) throw new Error("PROMPTS line not found");
let line = lines[idx];

let patched = 0;
let alreadyPatched = 0;
const skipped = [];

// 1. Insert pivot notes into existing prompts.
for (const [key, note] of Object.entries(NOTES)) {
  const entryRe = new RegExp(`"${key}":"((?:[^"\\\\]|\\\\.)*)"`);
  const m = line.match(entryRe);
  if (!m) {
    console.error(`!! ${key}: not found in PROMPTS`);
    skipped.push(key);
    continue;
  }
  const value = JSON.parse('"' + m[1] + '"');
  if (value.includes(PIVOT_SENTINEL)) {
    console.log(`-- ${key}: pivot already present, skipping`);
    alreadyPatched++;
    continue;
  }
  const sepAt = value.indexOf(CHECKLIST_SEP);
  const updated =
    sepAt >= 0 ? value.slice(0, sepAt) + note + value.slice(sepAt) : value + note;
  line = line.replace(m[0], `"${key}":${JSON.stringify(updated)}`);
  console.log(`++ ${key}: pivot patched`);
  patched++;
}

// 2. Add S14c if not present (with closing checklist appended).
const closingChecklist = `

---
**Closing checklist (standing rule — applies after this session's PR is merged to main; for manual sessions, after you mark complete in the runbook):**

1. Open \`Blueprint Tasks\\pcblueprint-checklist_25 april.html\` and add this session's id to the \`COMPLETED_SESSIONS\` array (~line 1986 — single source of truth, no more dual-write). Save in place — the folder is the source of truth and Pedro syncs it manually between machines.
2. Write the increment in scrum-master voice — *what shippable capability Pedro now has, plus accepted trade-offs/follow-ups*. Land it in TWO places: (a) the touched repo's \`CHANGELOG.md\` as a new \`### Increment\` paragraph in this session's dated entry; (b) the runbook HTML's \`📒 Changelog\` block as a single one-liner.
3. Walk the remaining not-done sessions in \`SESSIONS\`. For each one whose assumptions/scope/prereqs/necessity changed because of this merge, output one bullet to Pedro: \`<Sxx> — <Title>: <recommendation> — <one-sentence reason>\`. Do NOT silently edit other prompts; recommend only.`;

const s14cFullPrompt = S14C_PROMPT_BODY + closingChecklist;

if (line.includes(`"S14c":`)) {
  console.log(`-- S14c: already in PROMPTS, skipping prompt insert`);
} else {
  // Insert immediately after S14b's entry.
  const s14bMatch = line.match(/"S14b":"((?:[^"\\]|\\.)*)"/);
  if (!s14bMatch) throw new Error("Could not find S14b entry to anchor S14c insert");
  const s14bEnd = s14bMatch.index + s14bMatch[0].length;
  const s14cEntry = `,"S14c":${JSON.stringify(s14cFullPrompt)}`;
  line = line.slice(0, s14bEnd) + s14cEntry + line.slice(s14bEnd);
  console.log(`++ S14c: prompt inserted after S14b`);
  patched++;
}

lines[idx] = line;
let newHtml = lines.join("\n");

// 3. Add S14c to SESSIONS array if not present.
const s14cSessionLine = `    { id: "S14c", title: "Export Tools", repos: ["api"], time: 40, prereqs: ["S14b"], phase: "Chatbot — Tool Surface", branch: "claude/s14c-export-tools" },\n`;
if (newHtml.includes(`id: "S14c"`)) {
  console.log(`-- S14c: already in SESSIONS array, skipping`);
} else {
  const s14bSessionRe = /(\s+\{ id: "S14b"[^}]*\},\n)/;
  const s14bSessionMatch = newHtml.match(s14bSessionRe);
  if (!s14bSessionMatch) throw new Error("Could not find S14b in SESSIONS array");
  newHtml = newHtml.replace(s14bSessionMatch[0], s14bSessionMatch[0] + s14cSessionLine);
  console.log(`++ S14c: added to SESSIONS array`);
  patched++;
}

// 4. Update S15a prereqs to include S14c.
const s15aOldPrereqs = `prereqs: ["S10a", "S14a", "S14b"]`;
const s15aNewPrereqs = `prereqs: ["S10a", "S14a", "S14b", "S14c"]`;
if (newHtml.includes(s15aNewPrereqs)) {
  console.log(`-- S15a prereqs: already include S14c, skipping`);
} else if (newHtml.includes(s15aOldPrereqs)) {
  newHtml = newHtml.replace(s15aOldPrereqs, s15aNewPrereqs);
  console.log(`++ S15a prereqs: added S14c`);
  patched++;
} else {
  console.warn(`!! S15a prereqs: anchor not found — manual review needed`);
}

// 5. Bump session counts (54 → 55).
const subBefore = `<p class="subtitle">54 sessions across 4 repos.`;
const subAfter = `<p class="subtitle">55 sessions across 4 repos.`;
if (newHtml.includes(subAfter)) {
  console.log(`-- subtitle: already 55`);
} else if (newHtml.includes(subBefore)) {
  newHtml = newHtml.replace(subBefore, subAfter);
  console.log(`++ subtitle: 54 → 55`);
  patched++;
}

const progBefore = `>0 of 54<`;
const progAfter = `>0 of 55<`;
if (newHtml.includes(progAfter)) {
  console.log(`-- progressText: already 55`);
} else if (newHtml.includes(progBefore)) {
  newHtml = newHtml.replace(progBefore, progAfter);
  console.log(`++ progressText: 54 → 55`);
  patched++;
}

// 6. Write back.
fs.writeFileSync(HTML, newHtml, "utf8");

const promptsObj = newHtml.match(/const PROMPTS = (\{[\s\S]*?\});/);
if (promptsObj) fs.writeFileSync(MIRROR, promptsObj[1] + "\n", "utf8");

console.log(`\nDone. patched=${patched} already=${alreadyPatched} skipped=${skipped.length ? skipped.join(",") : "0"}`);
