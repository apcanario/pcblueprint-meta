// _rescope_r1_auth.js — rescope R1-01 / R1-02 / R1-03 auth sessions from
// pcblueprint-website (Next.js) to pcblueprint-api (Express + EJS).
//
// Why: when S-META-02 renamed S20a/b/c → R1-01/02/03, only the session header
// + branch name were rebranded. The PROMPT BODIES still referenced Next.js
// concepts (/api/login pages, Vercel Postgres, Next middleware) that don't
// match R1's actual stack — under R1, the archive HTML lives in pcblueprint-api
// served via EJS, and auth must live there too.
//
// This helper rewrites the three prompt bodies for the Express stack while
// preserving the original scope (same features, same acceptance criteria).
// Also updates SESSIONS entries: repos website → api, branch name unchanged.
//
// Usage (run from Blueprint Tasks/):
//   node helpers/_rescope_r1_auth.js
//
// Idempotent: sentinel = "R1 RESCOPE 2026-04-25" string in R1-01's body.

const fs = require("fs");

const HTML = "pcblueprint-checklist_25 april.html";
const MIRROR = "prompts_line.txt";
const SENTINEL = "R1 RESCOPE 2026-04-25";

// ── Shared header/footer (copied from _restructure_releases.js conventions) ──

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

1. Open \`Blueprint Tasks\\pcblueprint-checklist_25 april.html\` and add this session's id to the \`COMPLETED_SESSIONS\` array (grep for \`const COMPLETED_SESSIONS\` — single source of truth, no more dual-write). Save in place — the folder is the source of truth and it lives in the \`pcblueprint-meta\` GitHub repo (auto-deploys to Pages on push).
2. Write the increment in scrum-master voice — *what shippable capability Pedro now has, plus accepted trade-offs/follow-ups*. Land it in TWO places: (a) the touched repo's \`CHANGELOG.md\` as a new \`### Increment\` paragraph in this session's dated entry; (b) the runbook HTML's \`📒 Changelog\` block as a single one-liner.
3. Walk the remaining not-done sessions in \`SESSIONS\`. For each one whose assumptions/scope/prereqs/necessity changed because of this merge, output one bullet to Pedro: \`<Sxx | R1-xx> — <Title>: <recommendation> — <one-sentence reason>\`. Do NOT silently edit other prompts; recommend only.`;

function buildHeader({ sessionId, title, branch, prereqsText, prTitle, timeMin }) {
  return `${STD_HEADER_PREFIX}
- ${prereqsText}
- In pcblueprint-api: git checkout main && git pull origin main.
- Then: git checkout -b ${branch}.

NOTE: Single-repo session. No session-log entry — batched into S12.

Before ending the session you MUST:
- Update README.md + CLAUDE.md if conventions / endpoints / env vars changed.
- Push branch + open PR titled "${prTitle}".
- Do not merge without my approval.
${STD_FOOTER}

SESSION ${sessionId} — ${title} — pcblueprint-api — ~${timeMin} min

RELEASE NOTE (2026-04-25): This session was pulled forward from the original "Production — Auth Hardening" phase to R1 (Private Archive Browser). Real auth gates the public archive from day one — no APP_PASSWORD-only window. Scope unchanged; implementation re-targeted from pcblueprint-website (Next.js) to pcblueprint-api (Express + EJS) on 2026-04-25 because R1 ships server-rendered HTML directly from the api. ${SENTINEL}`;
}

// ── Per-session bodies ──────────────────────────────────────────────────────

const BODY_R1_01 = `

Replace the legacy single-\`APP_PASSWORD\` model with proper user accounts. Single-user for now (just Pedro), but built so a second user is a row insert later.

Implementation in pcblueprint-api:
- Dependencies: \`pnpm add argon2 better-sqlite3 cookie-parser\` (and \`@types/cookie-parser\` as dev dep).
- Auth DB at \`.data/auth.db\` (gitignored). Schema:
  - \`users(id INTEGER PK, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL, last_login_at INTEGER, totp_secret TEXT)\`
  - \`sessions(id TEXT PK, user_id INTEGER REFERENCES users(id), created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, user_agent TEXT, ip TEXT)\`
  - \`password_resets(token TEXT PK, user_id INTEGER REFERENCES users(id), expires_at INTEGER NOT NULL)\` — schema only; behaviour comes in R1-02.
- Bootstrap: \`scripts/seed-user.ts\` reads email + password from CLI args (or stdin), inserts the user with an argon2id hash. Document one-time usage in README.
- Service: \`src/services/auth.ts\` exposes \`hashPassword\`, \`verifyPassword\`, \`createSession(userId, ua, ip)\` returning the session id, \`findValidSession(id)\`, \`deleteSession(id)\`. Argon2id parameters: defaults from the \`argon2\` package are fine for v1.
- Routes (Express, mounted before the requireAuth middleware): \`POST /auth/login\` (validates email+password, creates a session row, sets the cookie), \`POST /auth/logout\` (deletes session row, clears cookie). Cookie: \`pcb_session=<sessionId>\`, \`HttpOnly\`, \`Secure\` (set conditionally — false in dev, true in prod via NODE_ENV check), \`SameSite=Lax\`, sliding 30-day expiration. On every authenticated request that reads a valid session, refresh \`expires_at\` to now+30d.
- Middleware: \`src/middleware/requireAuth.ts\`. Mount globally at app-level AFTER the auth routes. Bypass list: \`/auth/login\`, \`/auth/logout\`, \`/login\` (the EJS form route in R1-02), \`/healthz\` (R1-09), and any future \`/auth/*\` reset routes. For other routes: read the cookie, look up the session, attach \`req.user\` if valid. Otherwise: redirect to \`/login\` for HTML \`Accept\` headers, or return \`401 { error: "auth_required" }\` for JSON requests.
- Tests (vitest, in \`src/__tests__/\`): \`auth.hash.test.ts\` (hash + verify roundtrip; verify rejects wrong password), \`auth.session.test.ts\` (createSession + findValidSession happy path + expired-session rejection), \`auth.routes.test.ts\` (POST /auth/login happy + wrong-pw 401 + missing-fields 400; POST /auth/logout deletes the row).

Out of scope here (handled in later R1 sessions): the HTML \`/login\` form view (R1-02), email-based password reset (R1-02), TOTP enrollment (R1-03), rate limiting (R1-03), \`/healthz\` endpoint (R1-09).

Production note for later: \`.data/auth.db\` is fine for the NAS / Fly.io single-instance R1-08 deploy. Switching to a managed DB (Postgres / Turso / Cloudflare D1) is a future concern when scaling beyond one instance — defer entirely.

Verification: \`pnpm test\` green. Manual smoke (Pedro runs locally):
1. \`pnpm tsx scripts/seed-user.ts <email> <password>\` → users row exists.
2. \`curl -X POST http://localhost:3000/auth/login -H 'content-type: application/json' -d '{"email":"...","password":"..."}'\` → 200, \`Set-Cookie: pcb_session=...\` in headers.
3. \`curl -b 'pcb_session=...' http://localhost:3000/records\` → 200 (or whatever the records route returns; the point is no redirect).
4. \`curl http://localhost:3000/records\` (no cookie) → 302 \`Location: /login\` for HTML, or 401 for \`Accept: application/json\`.`;

const BODY_R1_02 = `

Add the human-facing login form + email-based password reset on top of R1-01's auth core. Stay in pcblueprint-api / EJS — no React, no client-side framework.

Implementation in pcblueprint-api:
- Dependency: \`pnpm add resend\`. Env: \`RESEND_API_KEY\`. Add an entry in README env table.
- EJS views (under \`src/views/\` per R1-04's convention; R1-04 lands the rendering layer first, so this session adds new templates that fit R1-04's \`_layout.ejs\`):
  - \`views/login.ejs\` — email + password form, submits POST /login.
  - \`views/reset-request.ejs\` — email-only form, submits POST /auth/request-reset.
  - \`views/reset-form.ejs\` — new-password form, hidden token field, submits POST /auth/complete-reset.
  - \`views/email/reset-email.ejs\` — Resend email body. Plain-ish HTML, includes the reset link with the token, "expires in 1 hour" copy.
- Routes (Express, all under the auth-bypass list from R1-01's middleware):
  - \`GET /login\` → renders \`login.ejs\`.
  - \`POST /login\` → calls the same handler as R1-01's \`POST /auth/login\` but on success, 302 to \`/\` (or wherever the user came from); on failure, re-renders \`login.ejs\` with an error.
  - \`GET /reset-password\` (no token) → renders \`reset-request.ejs\`.
  - \`POST /auth/request-reset\` → if a user with that email exists, insert a \`password_resets\` row with a cryptographically random token (32 bytes hex), 1h expiry, and send the reset email via Resend. **Always returns 200 with the same response** regardless of whether the email exists — no enumeration. Log the outcome internally.
  - \`GET /reset-password?token=<t>\` → look up the token; if valid + unexpired, render \`reset-form.ejs\` with the token in a hidden field; otherwise render \`reset-request.ejs\` with an "invalid or expired" message.
  - \`POST /auth/complete-reset\` → validate token (exists, not expired, single-use), update \`users.password_hash\`, delete the \`password_resets\` row, **delete all sessions for that user** (force re-login on every device), 302 to \`/login\` with a "password reset, please log in" flash.
- Service additions in \`src/services/auth.ts\`: \`createResetToken(userId)\`, \`findValidResetToken(token)\`, \`completeReset(token, newPassword)\`, \`deleteAllSessionsForUser(userId)\`.
- Tests (vitest): token issue + retrieval; expiry rejection; single-use (token deleted after consume); complete-reset invalidates all sessions for that user; request-reset returns 200 for both existing and non-existing email (no enumeration).

Out of scope here: TOTP / 2FA flow (R1-03), account settings UI (R1-03), rate limiting on /auth/request-reset (R1-03).

Verification: \`pnpm test\` green. Manual smoke:
1. \`GET /login\` → form renders.
2. POST \`/auth/request-reset\` for a real email → email arrives in inbox with a link.
3. Click link → reset-form.ejs renders with token populated.
4. POST a new password → 302 to /login.
5. Old password no longer works; new one does. Sessions on any other browser are dead.`;

const BODY_R1_03 = `

Account self-service UI + optional TOTP 2FA + login/reset rate limiting. Closes R1's auth release.

Implementation in pcblueprint-api:
- Dependencies: \`pnpm add speakeasy qrcode express-rate-limit\` (and \`@types/qrcode\` as dev).
- EJS view: \`views/account.ejs\`. Sections:
  1. Email + last login (from \`users\` row).
  2. Change password form → POST /account/change-password (requires current password + new password, calls \`hashPassword\`, updates row).
  3. Active sessions list (rows from \`sessions\` for this user, with user_agent + ip + created_at). Each row has a "Revoke" button → POST /account/sessions/:id/revoke.
  4. "Sign out everywhere" button → POST /account/sign-out-everywhere (deletes all sessions for the user; current request gets a fresh cookie pointing at a new session so the user isn't kicked out of the page they're on).
  5. 2FA section: if \`users.totp_secret\` is null → "Enable 2FA" button (POST /account/2fa/enroll). If set → "Disable 2FA" button (POST /account/2fa/disable, requires current password).
- 2FA enrollment flow:
  - \`POST /account/2fa/enroll\` generates a speakeasy secret + the otpauth URL, stores the secret as a PROVISIONAL value in a short-lived in-memory map (or in a temp column \`totp_secret_pending\`), renders \`views/account-2fa-verify.ejs\` showing a QR (rendered via qrcode lib as a data URL) + a code input. User scans the QR in their authenticator app and types the current code.
  - \`POST /account/2fa/verify\` checks the typed code against the provisional secret. On match, write the secret to \`users.totp_secret\` and clear the provisional. On miss, re-render with an error.
- Login flow update (in \`POST /auth/login\`): after password verify, if \`users.totp_secret\` is set, **don't create a session yet**. Render \`views/login-2fa.ejs\` (a code input) with a short-lived intermediate cookie (\`pcb_login_pending=<userId>:<expiry>\`, 5min). \`POST /auth/login-2fa\` consumes that cookie + the typed TOTP code; on match, create the real session and redirect.
- Rate limiting: \`express-rate-limit\` instances:
  - \`POST /auth/login\` + \`POST /auth/login-2fa\`: 10 requests per minute per IP.
  - \`POST /auth/request-reset\`: 3 requests per minute per IP.
  - 429 response includes \`Retry-After\`.
- Tests (vitest): change-password happy + wrong-current-password rejected; revoke specific session; sign-out-everywhere kills all but current; TOTP enroll+verify happy + wrong-code rejected; rate limiter triggers 429 after threshold.

Out of scope here: WebAuthn / passkeys (future option, post-R1); SMS-based 2FA; admin/multi-user features.

Verification: \`pnpm test\` green. Manual smoke:
1. Change password from /account → old fails, new works.
2. Open a second browser, log in → see two session rows in /account; revoke the second; second browser is logged out on next request.
3. Enable 2FA → scan QR with authenticator app → verify code → totp_secret saved.
4. Log out + log in → password prompt → 2FA prompt → success.
5. Hammer POST /auth/login 11+ times in a minute → 429.`;

// ── SESSIONS array entry updates ────────────────────────────────────────────
// R1-01..R1-03 currently have repos: ["website"] (inherited from S20a-c).
// Update to repos: ["api"]. Phase / branch / time / prereqs unchanged.

const SESSIONS_PATCHES = [
  { id: "R1-01", oldRepos: '["website"]', newRepos: '["api"]' },
  { id: "R1-02", oldRepos: '["website"]', newRepos: '["api"]' },
  { id: "R1-03", oldRepos: '["website"]', newRepos: '["api"]' },
];

// ── Apply ──────────────────────────────────────────────────────────────────

const html = fs.readFileSync(HTML, "utf8");
const lines = html.split("\n");
const promptsIdx = lines.findIndex(l => l.includes("const PROMPTS = {"));
if (promptsIdx < 0) throw new Error("PROMPTS line not found");
const promptsLine = lines[promptsIdx];

// Idempotency check.
if (promptsLine.includes(SENTINEL)) {
  console.log(`-- Sentinel "${SENTINEL}" already present in PROMPTS → rescope already applied. Exiting no-op.`);
  process.exit(0);
}

const promptsJsonStart = promptsLine.indexOf("{");
const promptsJsonEnd = promptsLine.lastIndexOf("}");
const promptsJsonStr = promptsLine.slice(promptsJsonStart, promptsJsonEnd + 1);
const PROMPTS = JSON.parse(promptsJsonStr);

const REWRITES = {
  "R1-01": {
    title: "Auth — User Schema + Argon2id + Session Core",
    branch: "claude/r1-01-auth-core",
    prereqsText: "No prereqs (R1-01 starts the R1 chain — only R0 dependencies which are already shipped).",
    prTitle: "R1-01 — Auth — User Schema + Argon2id + Session Core",
    timeMin: 60,
    body: BODY_R1_01,
  },
  "R1-02": {
    title: "Auth — Login Form + Password Reset (Resend)",
    branch: "claude/r1-02-auth-ux",
    prereqsText: "Confirm R1-01 + R1-04 merged. R1-04 lands the EJS rendering layer + base layout this session adds new views into.",
    prTitle: "R1-02 — Auth — Login Form + Password Reset (Resend)",
    timeMin: 60,
    body: BODY_R1_02,
  },
  "R1-03": {
    title: "Auth — Account Settings UI + Optional 2FA + Rate Limiting",
    branch: "claude/r1-03-auth-hardening",
    prereqsText: "Confirm R1-01 + R1-02 + R1-04 merged.",
    prTitle: "R1-03 — Auth — Account Settings UI + Optional 2FA + Rate Limiting",
    timeMin: 75,
    body: BODY_R1_03,
  },
};

let rewritten = 0;
for (const [id, cfg] of Object.entries(REWRITES)) {
  if (!PROMPTS[id]) {
    console.warn(`!! ${id} not found in PROMPTS — skipping`);
    continue;
  }
  const header = buildHeader({
    sessionId: id,
    title: cfg.title,
    branch: cfg.branch,
    prereqsText: cfg.prereqsText,
    prTitle: cfg.prTitle,
    timeMin: cfg.timeMin,
  });
  PROMPTS[id] = header + cfg.body + CLOSING_CHECKLIST;
  console.log(`++ ${id} prompt rewritten for pcblueprint-api stack`);
  rewritten++;
}

const newPromptsJson = JSON.stringify(PROMPTS);
lines[promptsIdx] = promptsLine.slice(0, promptsJsonStart) + newPromptsJson + promptsLine.slice(promptsJsonEnd + 1);

let newHtml = lines.join("\n");

// Update SESSIONS array entries.
let sessionsPatched = 0;
for (const p of SESSIONS_PATCHES) {
  // Match only lines whose id is exactly this one — anchor on `id: "R1-01"` to avoid collisions.
  const rowRegex = new RegExp(`(\\{ id: "${p.id}",[^}]*?repos: )${p.oldRepos.replace(/[\[\]]/g, m => "\\" + m)}`);
  if (rowRegex.test(newHtml)) {
    newHtml = newHtml.replace(rowRegex, `$1${p.newRepos}`);
    console.log(`++ SESSIONS ${p.id}: repos website → api`);
    sessionsPatched++;
  } else if (newHtml.includes(`id: "${p.id}"`) && newHtml.includes(`repos: ${p.newRepos}`)) {
    console.log(`-- SESSIONS ${p.id}: already api`);
  } else {
    console.warn(`!! SESSIONS ${p.id}: anchor not found — manual review`);
  }
}

// Update titles in SESSIONS array to match the new R1-01..R1-03 titles
// (the auth core title gained "+ Session Core", R1-02 gained "Login Form + ...").
const TITLE_PATCHES = [
  { id: "R1-01", oldTitle: 'Auth — User Schema + Argon2id + Session Core', newTitle: 'Auth — User Schema + Argon2id + Session Core' }, // unchanged
  { id: "R1-02", oldTitle: 'Auth — Email Service + Password Reset', newTitle: 'Auth — Login Form + Password Reset (Resend)' },
  { id: "R1-03", oldTitle: 'Auth — Account Settings UI + Optional 2FA', newTitle: 'Auth — Account Settings UI + Optional 2FA + Rate Limiting' },
];
let titlesPatched = 0;
for (const t of TITLE_PATCHES) {
  if (t.oldTitle === t.newTitle) continue;
  const sessionRowRegex = new RegExp(`(\\{ id: "${t.id}",[^}]*?title: )"${t.oldTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`);
  if (sessionRowRegex.test(newHtml)) {
    newHtml = newHtml.replace(sessionRowRegex, `$1${JSON.stringify(t.newTitle)}`);
    console.log(`++ SESSIONS ${t.id}: title updated`);
    titlesPatched++;
  } else if (newHtml.includes(`id: "${t.id}"`) && newHtml.includes(`title: "${t.newTitle}"`)) {
    console.log(`-- SESSIONS ${t.id}: title already current`);
  } else {
    console.warn(`!! SESSIONS ${t.id}: title anchor not found — manual review`);
  }
}

fs.writeFileSync(HTML, newHtml, "utf8");
fs.writeFileSync(MIRROR, newPromptsJson + "\n", "utf8");

console.log(`\nDone. Prompts rewritten: ${rewritten}. SESSIONS rows patched: ${sessionsPatched}. Titles patched: ${titlesPatched}.`);
console.log(`Sentinel "${SENTINEL}" embedded in each rewritten prompt; re-running this helper will be a no-op.`);
