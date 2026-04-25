// _add_v2_sessions.js — extend the runbook with the post-S12 scope-out
// sessions (S13–S20, no S17) plus a Changelog entry explaining the addition.
//
// Run from C:\Users\apcan\Downloads\Blueprint Tasks\:
//   node helpers/_add_v2_sessions.js

const fs = require("fs");
const path = require("path");

const HTML = "pcblueprint-checklist_25 april.html";
const PROMPTS_OUT = "helpers/prompts_line.txt";

const html = fs.readFileSync(HTML, "utf8");

// ── Standard footer used in every session prompt ────────────────────────────
const FOOTER = `

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

function buildPrompt({ id, title, repos, branch, prereqsLine, body }) {
  return `STANDING INSTRUCTIONS

Before starting:
- Confirm prereqs merged (${prereqsLine}).
- In ${repos[0]}: git checkout main && git pull origin main.
- Then: git checkout -b ${branch}.

NOTE: ${repos.length > 1 ? `Touches ${repos.join(", ")}.` : "Single-repo session."} No session-log entry — batched into S12.

Before ending the session you MUST:
- Update README.md + CLAUDE.md if conventions / endpoints / env vars changed.
- Push branch + open PR titled "${id} — ${title}".
- Do not merge without my approval.
${FOOTER}

SESSION ${id} — ${title} — ${repos.join(" + ")} — ~${body.time} min

${body.text}

---END ${id}---`;
}

// ── Prompt bodies ───────────────────────────────────────────────────────────

const NEW_PROMPTS = {
  S13a: buildPrompt({
    id: "S13a", title: "Upload Pipeline — api side", repos: ["pcblueprint-api"],
    branch: "claude/s13a-upload-api", prereqsLine: "S05c, S06a",
    body: { time: 45, text:
`Add multipart file upload to the api so chat (and the website) can ingest binaries (medical PDFs, photos, voice memos, IDML/Word originals) into the archive.

Implementation:
- Add multer (or formidable) middleware. Limit per request: 50MB. Allow types: pdf, png, jpg/jpeg, webp, heic, docx, idml, m4a/mp3/wav.
- New route POST /upload/{bucket} where bucket is one of: source-files/medical, source-files/sports, source-files/writing, writing/memories/drafts, _legacy/2026-04-25 (date-stamped quarantine for unsorted).
- Body: multipart with file + optional metadata (title, date, tags).
- Server-side: stream-write to bind mount path; commitArchive() with a meaningful message ("upload: <filename> → <bucket>").
- Path traversal guards (reject ../ in filename, sanitise to safe basename, accept user-supplied subdirectory only via a closed allowlist).
- Vitest: happy POST writes file + commits; oversize 413; bad type 415; path traversal 400.

Verification:
- pnpm test green; tsc clean.
- curl -F file=@test.pdf -F bucket=source-files/medical $API/upload writes the file + creates a commit on the archive.`}
  }),

  S13b: buildPrompt({
    id: "S13b", title: "Upload Pipeline — website + chat tool", repos: ["pcblueprint-website", "pcblueprint-api"],
    branch: "claude/s13b-upload-ui", prereqsLine: "S13a, S07b, S11a",
    body: { time: 50, text:
`Two surfaces:

1. Website upload UI:
- Drop-zone component (mui/material) on each archive section page (/medical, /memories, /journal). Bucket auto-selected by section context.
- Standalone /upload page for uncategorised files (lands them in _legacy/2026-04-25/).
- Server-action proxy via app/api/upload/route.ts → backend POST /upload/{bucket}, forwarding bearer token.

2. Chat tool attach_file:
- New tool in src/chat/tools.ts: attach_file({ filename, base64, bucket, metadata? }).
- Stub provider emits attach_file when user says "save this file as X" or attaches a file in the (future) message UI.
- For S13b chat scope: tool just calls the upload endpoint; UI for in-chat file attach is a follow-up note.

Verification:
- Drag-drop on /medical writes file + shows new entry in the page list within ~3s.
- Chat "save this PDF as my latest blood test" with a base64 payload writes to source-files/medical/.`}
  }),

  S14a: buildPrompt({
    id: "S14a", title: "Expanded Chat Write Tools", repos: ["pcblueprint-api"],
    branch: "claude/s14a-write-tools", prereqsLine: "S10b",
    body: { time: 60, text:
`Add write tools so chat can ingest into every domain, not just BP + journal:

- append_memory({ slug?, name, body_markdown, tags? }) — writes to writing/memories/drafts/ (or recognises an existing slug).
- log_chronology_event({ date, title, category, body, tags? }) — proxies POST /biography/chronology/events.
- log_medical_event({ date, summary, attachments? }) — appends to records/medical/pedro_medical.md and optionally creates records/medical/notes/<slug>.md.
- update_blueprint({ version, body_markdown }) — proxies PATCH /blueprint/:version.
- attach_imaging({ date, modality, file_id }) — links an already-uploaded source-files/medical/* file into pedro_medical.md.

Each tool teaches the stub provider one canned phrase for round-trip testability.

Vitest: each tool exercises its underlying route + verifies an archive commit lands.

Verification: curl POST /chat with each canned phrase produces a tool_call + write.`}
  }),

  S14b: buildPrompt({
    id: "S14b", title: "Expanded Read Tools + Cross-Domain Orchestrators", repos: ["pcblueprint-api"],
    branch: "claude/s14b-read-tools", prereqsLine: "S10c, S14a",
    body: { time: 75, text:
`Add read tools so chat can answer cross-domain queries like "give me dad's memories where I'm mentioned" or "any chronology events near my hospitalization":

Read tools:
- query_chronology({ from?, to?, category?, contains? }) — filters chronology events.
- query_memories({ author?, contains?, tags?, since? }) — text search across writing/memories/* and writing/memories/drafts/*.
- query_blueprint({ version? }) — fetches blueprint version body + meta.
- query_identity() — returns context + pattern registry.
- query_medical({ contains?, since? }) — section-level search inside pedro_medical.md and notes.

Orchestrators (alongside existing analyze_wellbeing):
- cross_reference({ query, domains?, window? }) — single search across ANY combination of domains, returns grouped hits with snippets. Reuses the existing /search route + adds an LLM-friendly response shape (small, clipped passages with source slugs).
- timeline_summary({ from, to }) — bundles chronology + journal + sessions + medical + sports for a date range, deduped + chronologically merged.

Stub provider learns one canned phrase per tool. Vitest: each tool returns well-formed JSON matching its schema.

Verification: curl POST /chat "any of dad's memories that mention me" → tool_call cross_reference({ query: 'Pedro', domains: ['memories'], filter: { author: 'francisco-canario' } }) → matching passages.`}
  }),

  S15a: buildPrompt({
    id: "S15a", title: "Real Chat Provider — Anthropic SDK + System Prompt", repos: ["pcblueprint-api"],
    branch: "claude/s15a-anthropic", prereqsLine: "S10a, S14a, S14b",
    body: { time: 60, text:
`Replace the stub chat provider with a real LLM. Pick Anthropic Claude (Sonnet 4.6 default; allow override via env).

Implementation:
- npm i @anthropic-ai/sdk.
- src/chat/providers/anthropic.ts — implements LLMProvider.generate(messages, tools). Streams content_block_delta + tool_use events as the existing AsyncIterable<Event> shape.
- Wire env: CHAT_PROVIDER=anthropic|stub|openai (still defaulted to stub for tests). ANTHROPIC_API_KEY required when CHAT_PROVIDER=anthropic.
- System prompt that gives Claude the archive shape: bucket structure, available tools, when to use which, how to cite sources (slugs/URLs).
- Tool registration: convert the existing JSON schemas in tools.ts into the Anthropic tool_use schema.

Cost guardrails:
- Default max_tokens 1024, override via request body.
- Budget alert at first request that costs > $0.10 (log warning).

Vitest: stub-mode passes; anthropic-mode requires manual smoke (no API key in CI).

Verification: with ANTHROPIC_API_KEY set locally, curl POST /chat "find me family memories from before 1995" streams real assistant prose + a real tool_call.`}
  }),

  S15b: buildPrompt({
    id: "S15b", title: "Server-Side Conversation Persistence", repos: ["pcblueprint-api"],
    branch: "claude/s15b-conversations", prereqsLine: "S15a",
    body: { time: 45, text:
`Move chat history off localStorage onto the server so it survives across devices (you'll be on phone + laptop).

Implementation:
- Add better-sqlite3 (single-user, single-process — sqlite is fine; no Postgres yet).
- Schema: conversations(id, started_at, title), messages(id, conversation_id, role, content, tool_calls, created_at).
- Routes: GET /chat/conversations, GET /chat/conversations/:id, POST /chat/conversations, DELETE /chat/conversations/:id. Existing POST /chat takes optional conversation_id; appends messages as it streams.
- DB file at /data/archive/.chat/conversations.db (lives outside the git tree via .gitignore, keeps it on the bind mount but not committed).
- Vitest: round-trip create → list → get → delete.

Verification: send a message via curl with conversation_id; refresh; GET /chat/conversations/:id returns full history.`}
  }),

  S16a: buildPrompt({
    id: "S16a", title: "Observability — Standardized Alerting + /healthz", repos: ["pcblueprint-api", "pcblueprint-sync"],
    branch: "claude/s16a-observability", prereqsLine: "S06a, S06b",
    body: { time: 45, text:
`Today the api commitArchive() warns silently on push failure; the sync worker has ALERT_WEBHOOK_URL but the api doesn't. Standardize.

Changes (api):
- New src/services/alert.ts — postAlert({ severity, source, message, details? }) → POSTs to ALERT_WEBHOOK_URL if set, always logs to stderr.
- Wire commitArchive() to call postAlert on push/commit failure (severity=error).
- Wire startArchivePuller() (S06a) to call postAlert on rebase conflict.
- New GET /healthz (no auth) — returns { status: "ok", version, archive_head, last_commit_at }.

Changes (sync):
- Refactor existing logger.ts to share the same alert payload shape.

Vitest: api alert helper mocked; verify call on each error path.

Verification: artificial push failure (set bad PAT) → webhook receives a JSON alert. /healthz returns expected shape.`}
  }),

  S16b: buildPrompt({
    id: "S16b", title: "Daily Off-Site Archive Backup", repos: [],
    branch: "claude/s16b-backup", prereqsLine: "S06a",
    body: { time: 30, text:
`The archive is mirrored to GitHub via push. That's already an off-site backup, but it doesn't include the .chat/ sqlite (S15b) or other gitignored runtime state. Add a daily snapshot.

Implementation:
- DSM Task Scheduler nightly: tar -czf /volume2/backups/archive-YYYY-MM-DD.tar.gz /volume2/pcblueprint-archive (excluding .git/, since that's already mirrored).
- Retain 14 days; rotate older.
- Optional: rclone copy to a cloud bucket (B2 / S3 / Cloudflare R2). Requires picking a provider + credentials — defer if you don't want a paid service.

No code change required for the local snapshot. Document the schedule in pcblueprint-archive/CLAUDE.md.

Verification: trigger the task once manually; confirm tarball present in /volume2/backups/.`}
  }),

  S18a: buildPrompt({
    id: "S18a", title: "Public Website Deploy — Vercel", repos: ["pcblueprint-website"],
    branch: "claude/s18a-deploy", prereqsLine: "S20a, S20b, S20c",
    body: { time: 60, text:
`Deploy the website to the public internet. Pre-req: real auth must be in (S20a-c) — do not deploy with the single APP_PASSWORD.

Implementation:
- vercel CLI: vercel login → vercel link → vercel.
- Production env vars (set via Vercel dashboard, NOT committed):
  - API_URL = https://<your cloudflared hostname>
  - API_TOKEN = (api Bearer)
  - COOKIE_SECRET (rotated to a fresh strong value)
  - DATABASE_URL (sqlite path or Vercel Postgres if you migrated)
  - RESEND_API_KEY (S20b)
- next.config.js: add the cloudflared hostname to allowed images / CSP if needed.
- Verify: open the deploy on phone, log in, browse, send a chat message, write a journal entry.

Note: cloudflared tunnel already exposes api publicly; api auth (Bearer) protects it. Website becomes the second public surface.

Verification: prod URL reachable from cellular (not on home wifi); login works; chat sends + receives; archive write lands in GitHub.`}
  }),

  S18b: buildPrompt({
    id: "S18b", title: "DNS / Custom Domain / Cookie Domain", repos: ["pcblueprint-website"],
    branch: "claude/s18b-domain", prereqsLine: "S18a",
    body: { time: 25, text:
`Wire your custom domain (if you want one) to the Vercel deploy + ensure cookies + CORS work across subdomains.

Implementation:
- Buy / use existing domain (e.g. pcblueprint.app or similar). Add CNAME in DNS pointing at cname.vercel-dns.com.
- In Vercel: add the custom domain to the project; let it provision SSL.
- Set COOKIE_DOMAIN=.pcblueprint.app so api subdomain (api.pcblueprint.app via cloudflared) and website subdomain (app.pcblueprint.app) share cookies if they need to.
- api side: confirm CORS origin allows the website's public URL.

Verification: hit the custom domain on mobile, full flow works end-to-end.`}
  }),

  S19a: buildPrompt({
    id: "S19a", title: "Mobile — Audit + Sidebar Drawer", repos: ["pcblueprint-website"],
    branch: "claude/s19a-mobile-shell", prereqsLine: "S08c",
    body: { time: 60, text:
`Audit every page on a 375px iPhone width and convert the docs-shell sidebar to a mobile drawer.

Implementation:
- Hamburger toggle on app bar < 768px.
- Swipeable Drawer (mui/material) replaces the persistent sidebar.
- Top nav (S07a's /today addition) collapses into the drawer.
- Quick "audit" pass: list every page that visibly breaks at 375px. Capture as a checklist for S19b/c.

Verification: use Chrome DevTools device toolbar (iPhone 14 Pro). Sidebar collapses; drawer opens on tap; nav is reachable.`}
  }),

  S19b: buildPrompt({
    id: "S19b", title: "Mobile — Charts + DataGrid Reflow", repos: ["pcblueprint-website"],
    branch: "claude/s19b-mobile-data", prereqsLine: "S19a, S09b",
    body: { time: 45, text:
`Charts and tables on /sports/[id] + /blood-pressure + /sleep don't fit on narrow viewports.

Implementation:
- MUI X Charts: set responsive width via container + breakpoint-aware height.
- MUI X DataGrid: swap for a stacked-card list under 768px (extract a ResponsiveList component).
- Sports detail hero stats: collapse to 2-col grid (was 4-col) under 600px.

Verification: every chart renders without horizontal scroll on iPhone. Tables become tappable card stacks.`}
  }),

  S19c: buildPrompt({
    id: "S19c", title: "Mobile — Chat UX", repos: ["pcblueprint-website"],
    branch: "claude/s19c-mobile-chat", prereqsLine: "S19a, S11c",
    body: { time: 35, text:
`Chat UI specifics on phone:

- Input pinned to bottom with keyboard-aware padding (use @react-aria/utils or visualViewport API).
- Tool call cards stack full-width; collapsible by default on mobile.
- File-attach button inline with text input (S13b).
- Send-on-enter on desktop, send-on-arrow-tap on mobile.
- Long messages wrap properly; code blocks scroll horizontally inside the bubble.

Verification: real conversation on phone, including a write tool with confirm.`}
  }),

  S20a: buildPrompt({
    id: "S20a", title: "Auth — User Schema + Argon2id + Session Core", repos: ["pcblueprint-website"],
    branch: "claude/s20a-auth-core", prereqsLine: "S07b",
    body: { time: 60, text:
`Replace single APP_PASSWORD with proper user accounts. Single-user for now (just you), but built so a second user is a row insert later.

Implementation:
- Add better-sqlite3. DB at .data/auth.db (gitignored) — Vercel will use Vercel Postgres or Turso later (defer).
- Schema: users(id, email UNIQUE, password_hash, created_at, last_login_at, totp_secret nullable), sessions(id, user_id, created_at, expires_at, user_agent, ip), password_resets(token UNIQUE, user_id, expires_at).
- Bootstrap script: scripts/seed-user.ts inserts your email + a password you supply (one-time).
- Replace /api/login: argon2id verify (npm i argon2), set httpOnly + secure + sameSite=Lax cookie with sliding 30-day expiration.
- /api/logout: real implementation — delete session row, clear cookie.
- Middleware: every page (except /login + auth API routes) checks session validity; redirects to /login if absent/expired.
- Vitest: hash + verify, login happy/wrong-pw/expired-session.

Verification: seed user; log in; refresh; log out; refresh → redirected to /login.`}
  }),

  S20b: buildPrompt({
    id: "S20b", title: "Auth — Email Service + Password Reset", repos: ["pcblueprint-website"],
    branch: "claude/s20b-auth-reset", prereqsLine: "S20a",
    body: { time: 60, text:
`Add password reset via email + email service integration.

Implementation:
- Pick Resend (https://resend.com) — free tier 3k/mo, easy setup. npm i resend. Env: RESEND_API_KEY.
- /api/auth/request-reset: POST { email } → if user exists, insert password_resets row + email a magic link. Always returns 200 (no enumeration).
- /reset-password?token=...: page that POSTs new password + token to /api/auth/complete-reset.
- /api/auth/complete-reset: verify token (not expired, single-use), update password_hash, delete row, invalidate all sessions for that user, redirect to /login.
- Email template: simple, branded, includes the reset link + 1h expiry message.
- Vitest: token issue, expiry, single-use.

Verification: trigger reset → receive email → click link → set new password → log in.`}
  }),

  S20c: buildPrompt({
    id: "S20c", title: "Auth — Account Settings UI + Optional 2FA", repos: ["pcblueprint-website"],
    branch: "claude/s20c-auth-settings", prereqsLine: "S20a, S20b",
    body: { time: 75, text:
`Account self-service UI + optional TOTP 2FA.

Implementation:
- /account page: shows email + last login + "Change password" form + "Active sessions" list with revoke buttons.
- "Sign out everywhere" deletes all session rows for the user.
- 2FA setup: optional. /account/2fa shows QR (qrcode npm pkg) for an authenticator app. On enable, store totp_secret + require TOTP code on next login.
- Login flow updated to ask for TOTP after password if user has it enabled.
- Vitest: change password, revoke session, TOTP verify happy/wrong/expired-window.

Verification: change password; old password no longer works. Revoke a session from another device; that device gets logged out. Enable 2FA; log in requires code.`}
  }),
};

// ── SESSIONS array additions ────────────────────────────────────────────────

const NEW_SESSIONS = [
  // Chatbot Extensions
  `    { id: "S13a", title: "Upload Pipeline — api side", repos: ["api"], time: 45, prereqs: ["S05c", "S06a"], phase: "Chatbot — File Upload", branch: "claude/s13a-upload-api" },`,
  `    { id: "S13b", title: "Upload Pipeline — website + chat tool", repos: ["website", "api"], time: 50, prereqs: ["S13a", "S07b", "S11a"], phase: "Chatbot — File Upload", branch: "claude/s13b-upload-ui" },`,
  `    { id: "S14a", title: "Expanded Chat Write Tools", repos: ["api"], time: 60, prereqs: ["S10b"], phase: "Chatbot — Tool Surface", branch: "claude/s14a-write-tools" },`,
  `    { id: "S14b", title: "Expanded Read Tools + Cross-Domain Orchestrators", repos: ["api"], time: 75, prereqs: ["S10c", "S14a"], phase: "Chatbot — Tool Surface", branch: "claude/s14b-read-tools" },`,
  `    { id: "S15a", title: "Real Chat Provider — Anthropic SDK + System Prompt", repos: ["api"], time: 60, prereqs: ["S10a", "S14a", "S14b"], phase: "Chatbot — Real Provider", branch: "claude/s15a-anthropic" },`,
  `    { id: "S15b", title: "Server-Side Conversation Persistence", repos: ["api"], time: 45, prereqs: ["S15a"], phase: "Chatbot — Real Provider", branch: "claude/s15b-conversations" },`,
  // Production Readiness
  `    { id: "S16a", title: "Observability — Alerting + /healthz", repos: ["api", "sync"], time: 45, prereqs: ["S06a", "S06b"], phase: "Production — Observability", branch: "claude/s16a-observability" },`,
  `    { id: "S16b", title: "Daily Off-Site Archive Backup", repos: [], time: 30, prereqs: ["S06a"], phase: "Production — Observability", branch: "claude/s16b-backup", manual: true },`,
  `    { id: "S18a", title: "Public Website Deploy — Vercel", repos: ["website"], time: 60, prereqs: ["S20a", "S20b", "S20c", "S19a", "S19b", "S19c"], phase: "Production — Public Deploy", branch: "claude/s18a-deploy" },`,
  `    { id: "S18b", title: "DNS / Custom Domain / Cookie Domain", repos: ["website"], time: 25, prereqs: ["S18a"], phase: "Production — Public Deploy", branch: "claude/s18b-domain" },`,
  `    { id: "S19a", title: "Mobile — Audit + Sidebar Drawer", repos: ["website"], time: 60, prereqs: ["S08c"], phase: "Production — Mobile UX", branch: "claude/s19a-mobile-shell" },`,
  `    { id: "S19b", title: "Mobile — Charts + DataGrid Reflow", repos: ["website"], time: 45, prereqs: ["S19a", "S09b"], phase: "Production — Mobile UX", branch: "claude/s19b-mobile-data" },`,
  `    { id: "S19c", title: "Mobile — Chat UX", repos: ["website"], time: 35, prereqs: ["S19a", "S11c"], phase: "Production — Mobile UX", branch: "claude/s19c-mobile-chat" },`,
  `    { id: "S20a", title: "Auth — User Schema + Argon2id + Session Core", repos: ["website"], time: 60, prereqs: ["S07b"], phase: "Production — Auth Hardening", branch: "claude/s20a-auth-core" },`,
  `    { id: "S20b", title: "Auth — Email Service + Password Reset", repos: ["website"], time: 60, prereqs: ["S20a"], phase: "Production — Auth Hardening", branch: "claude/s20b-auth-reset" },`,
  `    { id: "S20c", title: "Auth — Account Settings UI + Optional 2FA", repos: ["website"], time: 75, prereqs: ["S20a", "S20b"], phase: "Production — Auth Hardening", branch: "claude/s20c-auth-settings" },`,
];

// ── Apply changes ───────────────────────────────────────────────────────────

let out = html;

// 1. Insert new SESSIONS entries right after S12 (which is the current last entry in the array).
const s12Line = `    { id: "S12", title: "Cross-Repo Docs Sweep", repos: ["archive", "api", "website", "sync"], time: 30, prereqs: ["S11c", "S10d", "S09b", "S08c", "S06f"], phase: "Close-out", branch: "claude/s12-docs-sweep" }`;
const s12Replacement = s12Line + `,\n${NEW_SESSIONS.join("\n")}`;
out = out.replace(s12Line, s12Replacement);
if (out === html) throw new Error("S12 anchor not found in SESSIONS array");

// 2. Update session count in subtitle + progressText (33 → 49).
out = out.replace(`33 sessions across 4 repos`, `49 sessions across 4 repos`);
out = out.replace(`>0 of 33<`, `>0 of 49<`);

// 3. Insert prompts into PROMPTS object (right after S12 entry, before closing `};`).
//    Build the appended fragment.
const promptsFragment = Object.entries(NEW_PROMPTS)
  .map(([k, v]) => `,${JSON.stringify(k)}:${JSON.stringify(v)}`)
  .join("");

// Locate end of PROMPTS object: find `};` that closes `const PROMPTS = {...}`.
const promptsCloseRegex = /(const PROMPTS = \{[\s\S]*?\})(;)/;
const promptsCloseMatch = out.match(promptsCloseRegex);
if (!promptsCloseMatch) throw new Error("PROMPTS close `};` not found");
out = out.replace(
  promptsCloseRegex,
  (_, body, semi) => body.slice(0, -1) + promptsFragment + "}" + semi
);

// 4. Update the Status-as-of block to mention the v2 scope-out.
const oldStatus = `<p style="margin: 0 0 10px;"><strong>Status as of 2026-04-25:</strong> S00–S04e, S04g, S04h, S05a, S05b, and S05c are ✅ done. S04f is ⏸ deferred (post-S12 cleanup). During the 2026-04-25 prod reconciliation we front-loaded four new foundation sessions (S06a–S06d) — see the Changelog section below. Next up: <strong>S06a — Archive Bidirectional Sync</strong>.</p>`;
const newStatus = `<p style="margin: 0 0 10px;"><strong>Status as of 2026-04-25:</strong> S00–S04e, S04g, S04h, S05a, S05b, and S05c are ✅ done. S04f is ⏸ deferred (post-S12 cleanup). The 2026-04-25 prod reconciliation front-loaded foundation sessions S06a–S06d. The same evening's scope-out added 16 new sub-sessions (S13–S20, no S17) covering file uploads, expanded chat tools, real LLM provider, observability, public deployment, mobile responsive, and a real auth system — see the Changelog section. Total: 49 sessions. Next up: <strong>S06a — Archive Bidirectional Sync</strong>.</p>`;
out = out.replace(oldStatus, newStatus);

// 5. Insert a new Changelog entry at the TOP of the Changelog body (newest-first).
const changelogAnchor = `<p style="margin: 10px 0 6px;"><strong>2026-04-25 — Prod reconciliation + path realign</strong></p>`;
const changelogPrepend = `<p style="margin: 10px 0 6px;"><strong>2026-04-25 (late) — Full-vision scope-out (S13–S20)</strong></p>
      <ul style="margin: 0 0 10px 20px; padding: 0;">
        <li><strong>Why:</strong> after the prod reconciliation closed all infrastructure gaps, Pedro asked what's still missing for the full vision: chat with records, upload to them via chat (binary files included), browse them on a phone over the public internet with a proper login. The existing roadmap (S07–S12) covers ~70% but leaves gaps.</li>
        <li><strong>What:</strong> 16 new sub-sessions added in 7 phases, slotted after S12.
          <ul style="margin: 6px 0 0 20px; padding: 0;">
            <li><strong>S13a/b — File Upload pipeline</strong> (multipart api endpoint + drop-zone UI + chat attach_file tool). The api is JSON-only today; you can't upload PDFs/photos/audio.</li>
            <li><strong>S14a/b — Expanded chat tool surface</strong> (write tools for memories/chronology/medical/blueprint/imaging; read tools for every domain; cross-domain orchestrators for queries like "dad's memories where I'm mentioned").</li>
            <li><strong>S15a/b — Real chat provider</strong> (Anthropic SDK replacing the stub; sqlite-backed conversation persistence so history survives across phone + laptop).</li>
            <li><strong>S16a/b — Observability + backup</strong> (standardized webhook alerting, /healthz endpoint, daily off-site tarball snapshot).</li>
            <li><strong>S18a/b — Public deploy</strong> (Vercel + cookie domain + DNS).</li>
            <li><strong>S19a/b/c — Mobile responsive pass</strong> (sidebar drawer, charts/DataGrid reflow, chat keyboard-aware UX).</li>
            <li><strong>S20a/b/c — Real auth</strong> (argon2id user schema replacing single APP_PASSWORD; email-based password reset via Resend; account settings UI + optional TOTP 2FA). Critical: must land before S18 — never deploy publicly with the placeholder shared password.</li>
          </ul>
        </li>
        <li><strong>PRs:</strong> none — runbook update only.</li>
        <li><strong>Impact on tasks:</strong> total session count 33 → 49. Suggested execution order after S12 close-out: S20 (auth) → S19 (mobile) → S13 (uploads) → S14 (tools) → S15 (real provider) → S16 (observability) → S18 (public deploy). The auth + mobile work has to land before the public deploy, full stop.</li>
      </ul>

      `;
out = out.replace(changelogAnchor, changelogPrepend + changelogAnchor);

// ── Write out ───────────────────────────────────────────────────────────────

fs.writeFileSync(HTML, out, "utf8");
console.log(`Wrote ${HTML}`);

// Regenerate prompts_line.txt mirror
const updatedPrompts = out.match(/const PROMPTS = (\{[\s\S]*?\});/);
if (!updatedPrompts) throw new Error("Could not re-extract PROMPTS for mirror");
fs.writeFileSync(PROMPTS_OUT, updatedPrompts[1] + "\n", "utf8");
console.log(`Wrote ${PROMPTS_OUT}`);

console.log("Done.");
