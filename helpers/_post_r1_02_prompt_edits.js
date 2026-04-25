// _post_r1_02_prompt_edits.js — apply downstream-impact prompt edits after R1-02 merged.
//
// Why: R1-02 introduced two new public POST endpoints (POST /login, the form-post
// counterpart to the JSON POST /auth/login; and POST /auth/request-reset) plus
// two new env vars (RESEND_API_KEY required in prod for the reset flow to send
// email; RESET_EMAIL_FROM optional with a placeholder default). Two downstream
// prompts now contain stale assumptions:
//
// - R1-03 currently rate-limits only POST /auth/login. The new POST /login is
//   the same brute-force surface with a different URL and must be covered, plus
//   POST /auth/request-reset needs its own rate limit (per-IP and per-email)
//   to prevent inbox flooding. The 2FA challenge step also needs to wrap BOTH
//   login routes, not just the legacy JSON one.
// - R1-08 already had a BUILD_VERSION + AUTH_DB_PATH bullet (from R1-04 / R1-01
//   triage). Add a Resend bullet covering the two new env vars and the Resend
//   sender-domain verification step.
//
// Idempotent: each prompt body is checked for the sentinel "R1-02 POST-MERGE
// 2026-04-25" before patching. Re-running the helper is a no-op.
//
// Usage (run from the repo root):
//   node helpers/_post_r1_02_prompt_edits.js

const fs = require("fs");
const path = require("path");

const HTML = path.join(__dirname, "..", "pcblueprint-checklist_25 april.html");
const MIRROR = path.join(__dirname, "..", "prompts_line.txt");
const SENTINEL = "R1-02 POST-MERGE 2026-04-25";

const EDITS = {
  "R1-03": [
    // Extend the rate-limit bullet list to cover the new public POST /login
    // and POST /auth/request-reset routes.
    {
      anchor:
        "- Rate limiting: `express-rate-limit` instances:\n  - `POST /auth/login` + `POST /auth/login-2fa`: 10 requests per minute per IP.\n  - `POST /auth/request-reset`: 3 requests per minute per IP.\n  - 429 response includes `Retry-After`.",
      replacement:
        "- Rate limiting: `express-rate-limit` instances (" + SENTINEL + " — R1-02 added two new public POSTs that share the brute-force / abuse surface):\n" +
        "  - `POST /login` (the urlencoded form-post added in R1-02) + `POST /auth/login` (the JSON API entry) + `POST /auth/login-2fa`: 10 requests per minute per IP across the combined set.\n" +
        "  - `POST /auth/request-reset`: 3 requests per minute per IP, AND additionally throttle by destination email (e.g. 5/hour per email) to prevent inbox flooding even when the attacker rotates IPs.\n" +
        "  - `POST /auth/complete-reset`: 10 requests per minute per IP (token brute-force defence).\n" +
        "  - 429 response includes `Retry-After`.",
    },
    // Update the login-flow update bullet to wrap BOTH login entries with the
    // 2FA challenge.
    {
      anchor:
        "- Login flow update (in `POST /auth/login`): after password verify, if `users.totp_secret` is set, **don't create a session yet**. Render `views/login-2fa.ejs` (a code input) with a short-lived intermediate cookie (`pcb_login_pending=<userId>:<expiry>`, 5min). `POST /auth/login-2fa` consumes that cookie + the typed TOTP code; on match, create the real session and redirect.",
      replacement:
        "- Login flow update (in BOTH `POST /auth/login` (JSON) and `POST /login` (form-post from R1-02) — share the post-password-verify branch via a small helper): after password verify, if `users.totp_secret` is set, **don't create a session yet**. Render `views/login-2fa.ejs` (a code input) with a short-lived intermediate cookie (`pcb_login_pending=<userId>:<expiry>`, 5min). `POST /auth/login-2fa` consumes that cookie + the typed TOTP code; on match, create the real session and redirect — to `/` for HTML clients (or the safely-validated `next=` from the original POST /login if present), or `{ok:true}` JSON for API clients of POST /auth/login.",
    },
    // Update verification step #5 to cover both routes.
    {
      anchor:
        "5. Hammer POST /auth/login 11+ times in a minute → 429.",
      replacement:
        "5. Hammer POST /auth/login 11+ times in a minute → 429. Same threshold applies when split across POST /auth/login + POST /login (the limiter is shared across the brute-force surface, not per-URL). Hammer POST /auth/request-reset 4+ times in a minute → 429.",
    },
  ],

  "R1-08": [
    // Add a Resend bullet alongside BUILD_VERSION + AUTH_DB_PATH.
    {
      anchor:
        "1. Production environment config — env vars locked to actual values (API_TOKEN, DB_PATH, RESEND_API_KEY from R1-02, BUILD_VERSION, etc.). Document required env in README + CLAUDE.md. **Set `BUILD_VERSION` from the GitHub Actions image tag or a Docker build arg** (R1-04 POST-MERGE 2026-04-25) — R1-04 surfaces it in the rendered HTML footer; without this, the prod footer reads `dev` and Pedro can't tell which build is live. **Persist `.data/auth.db` across container restarts** — R1-01 made `AUTH_DB_PATH` configurable but did NOT wire the NAS docker-compose volume mount at `/volume2/docker/api/compose.yaml`. Add the mount here (or the equivalent Fly.io persistent-volume config). Without this, every redeploy logs everyone out and (worse) loses the user rows. Verify by `docker compose down && docker compose up -d` and confirming the existing session cookie still works against the same user.",
      replacement:
        "1. Production environment config — env vars locked to actual values (API_TOKEN, DB_PATH, RESEND_API_KEY from R1-02, RESET_EMAIL_FROM from R1-02, BUILD_VERSION, etc.). Document required env in README + CLAUDE.md. **Set `BUILD_VERSION` from the GitHub Actions image tag or a Docker build arg** (R1-04 POST-MERGE 2026-04-25) — R1-04 surfaces it in the rendered HTML footer; without this, the prod footer reads `dev` and Pedro can't tell which build is live. **Persist `.data/auth.db` across container restarts** — R1-01 made `AUTH_DB_PATH` configurable but did NOT wire the NAS docker-compose volume mount at `/volume2/docker/api/compose.yaml`. Add the mount here (or the equivalent Fly.io persistent-volume config). Without this, every redeploy logs everyone out and (worse) loses the user rows. Verify by `docker compose down && docker compose up -d` and confirming the existing session cookie still works against the same user. **Wire Resend** (" + SENTINEL + ") — R1-02 added password-reset emails behind `RESEND_API_KEY` (when unset, the link only logs to stdout) and `RESET_EMAIL_FROM` (default is the placeholder `pcblueprint <noreply@pcblueprint.local>` which Resend will reject). Set both env vars in `compose.yaml` and verify the Resend sender domain is verified in the Resend dashboard before going live; otherwise the reset flow is silently broken in production. Smoke test #4 below should request a reset and confirm the email actually arrives.",
    },
  ],
};

// ── Apply ──────────────────────────────────────────────────────────────────

const html = fs.readFileSync(HTML, "utf8");
const lines = html.split("\n");
const promptsIdx = lines.findIndex(l => l.includes("const PROMPTS = {"));
if (promptsIdx < 0) throw new Error("PROMPTS line not found");
const promptsLine = lines[promptsIdx];

const promptsJsonStart = promptsLine.indexOf("{");
const promptsJsonEnd = promptsLine.lastIndexOf("}");
const promptsJsonStr = promptsLine.slice(promptsJsonStart, promptsJsonEnd + 1);
const PROMPTS = JSON.parse(promptsJsonStr);

let totalEdits = 0;
let totalSkipped = 0;

for (const [id, edits] of Object.entries(EDITS)) {
  const original = PROMPTS[id];
  if (!original) {
    console.warn(`!! ${id} not found in PROMPTS — skipping`);
    continue;
  }
  if (original.includes(SENTINEL)) {
    console.log(`-- ${id}: sentinel already present, skipping (idempotent)`);
    totalSkipped += edits.length;
    continue;
  }
  let body = original;
  let appliedHere = 0;
  for (const { anchor, replacement } of edits) {
    if (!body.includes(anchor)) {
      console.warn(`!! ${id}: anchor not found — manual review:\n     ${anchor.slice(0, 120)}…`);
      continue;
    }
    body = body.replace(anchor, replacement);
    appliedHere++;
  }
  if (appliedHere > 0) {
    PROMPTS[id] = body;
    console.log(`++ ${id}: ${appliedHere}/${edits.length} edits applied`);
    totalEdits += appliedHere;
  }
}

const newPromptsJson = JSON.stringify(PROMPTS);
lines[promptsIdx] =
  promptsLine.slice(0, promptsJsonStart) +
  newPromptsJson +
  promptsLine.slice(promptsJsonEnd + 1);

fs.writeFileSync(HTML, lines.join("\n"), "utf8");
fs.writeFileSync(MIRROR, newPromptsJson + "\n", "utf8");

console.log(
  `\nDone. Edits applied: ${totalEdits}. Skipped (already patched): ${totalSkipped}.`
);
console.log(`Sentinel "${SENTINEL}" embedded; re-running this helper is a no-op.`);
