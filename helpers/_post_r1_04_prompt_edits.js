// _post_r1_04_prompt_edits.js — apply downstream-impact prompt edits after R1-04 merged.
//
// Why: R1-04 shipped the EJS rendering layer plus a working /login form (with
// inline-JS submission to the existing JSON /auth/login). Three downstream
// prompts now contain stale assumptions:
//
// - R1-02 still asks for `views/login.ejs` and a `GET /login` route — both
//   already exist. Narrow scope to (a) password-reset flow (the actual unmet
//   need) and (b) login form polish: replace the inline JS with a server-side
//   POST /login that re-renders the form with errors, plus a "forgot your
//   password?" link.
// - R1-05 should explicitly call out that R1-04 already built the rendering
//   scaffold (renderPage, _layout.ejs) and the bucket links on / — reuse, do
//   not rebuild.
// - R1-08 deploy config gained a new env var (BUILD_VERSION) shown in the
//   rendered footer — must be set in production alongside AUTH_DB_PATH.
//
// Idempotent: each prompt body is checked for the sentinel "R1-04 POST-MERGE
// 2026-04-25" before patching. Re-running the helper is a no-op.
//
// Usage (run from the repo root):
//   node helpers/_post_r1_04_prompt_edits.js

const fs = require("fs");
const path = require("path");

const HTML = path.join(__dirname, "..", "pcblueprint-checklist_25 april.html");
const MIRROR = path.join(__dirname, "..", "prompts_line.txt");
const SENTINEL = "R1-04 POST-MERGE 2026-04-25";

// ── Edit operations ─────────────────────────────────────────────────────────

const EDITS = {
  "R1-02": [
    // Reframe the intro paragraph: acknowledge R1-04 already shipped the form
    // and narrow scope to reset + polish.
    {
      anchor:
        "Add the human-facing login form + email-based password reset on top of R1-01's auth core. Stay in pcblueprint-api / EJS — no React, no client-side framework.",
      replacement:
        "Add email-based password reset on top of R1-01's auth core, and polish R1-04's login form. Stay in pcblueprint-api / EJS — no React, no client-side framework.\n\n" +
        "Note (" + SENTINEL + "): R1-04 already shipped `src/views/login.ejs` (an email + password form posting to the existing JSON `/auth/login` via inline fetch JS) and `src/views/_layout.ejs`. This session ADDS reset templates + routes, REUSES the layout, and POLISHES the login form (drop inline JS in favour of a server-rendered POST /login + add a 'forgot your password?' link).",
    },
    // Drop the duplicate "create login.ejs" bullet — R1-04 already shipped it.
    {
      anchor:
        "  - `views/login.ejs` — email + password form, submits POST /login.\n",
      replacement: "",
    },
    // Reframe the POST /login bullet: it's now a polish step over R1-04's
    // inline-JS form, not a novel route. Also wire the 'forgot' link.
    {
      anchor:
        "  - `GET /login` → renders `login.ejs`.\n  - `POST /login` → calls the same handler as R1-01's `POST /auth/login` but on success, 302 to `/` (or wherever the user came from); on failure, re-renders `login.ejs` with an error.",
      replacement:
        "  - `POST /login` (NEW) → calls the same handler as R1-01's `POST /auth/login` but accepts `application/x-www-form-urlencoded`; on success, 302 to `/` (or `?next=` if provided); on failure, re-renders `login.ejs` with an error message via `renderPage()`. Add `app.use(express.urlencoded({ extended: false }))` near the JSON parser in `app.ts`.\n" +
        "  - Update `src/views/login.ejs` (already exists from R1-04): drop the inline `<script>` fetch handler; change `<form id=\"login-form\">` to `<form method=\"post\" action=\"/login\">`; add a `<p><a href=\"/reset-password\">Forgot your password?</a></p>` link below the submit button. The renderPage helper already passes a `flash` local on redirects from /auth/complete-reset — surface it as a top-of-form notice.\n" +
        "  - `GET /login` → R1-04 already implemented this in `src/routes/login.ts`. No change.",
    },
    // Update verification step #1 to reflect the form is already there.
    {
      anchor: "1. `GET /login` → form renders.",
      replacement: "1. `GET /login` → form renders WITHOUT the inline-JS fetch handler (view-source confirms a plain `<form method=\"post\" action=\"/login\">`); the 'Forgot your password?' link is visible and points to `/reset-password`.",
    },
  ],

  "R1-05": [
    // Add a reuse note immediately after the Background paragraph so the agent
    // doesn't try to rebuild the layout.
    {
      anchor:
        "Background: R1-04 landed the rendering layer. This session implements one index page per top-level archive bucket — the user can navigate from / into any bucket and see a list of contents.",
      replacement:
        "Background: R1-04 landed the rendering layer. This session implements one index page per top-level archive bucket — the user can navigate from / into any bucket and see a list of contents.\n\n" +
        "Reuse note (" + SENTINEL + "): R1-04 already built `src/views/_layout.ejs`, the `renderPage(req, res, next, view, locals?, status?)` helper at `src/views/render.ts`, and the five bucket links on `/` (rendered from `src/views/index.ejs` via `src/routes/home.ts`). Do NOT recreate the layout, the helper, or the home route. Each new bucket route just imports `renderPage` and renders its own per-bucket EJS template — the layout (header/nav/footer + auth status) wraps it automatically.",
    },
  ],

  "R1-08": [
    // Add a BUILD_VERSION line to the env-vars bullet alongside AUTH_DB_PATH.
    {
      anchor:
        "1. Production environment config — env vars locked to actual values (API_TOKEN, DB_PATH, RESEND_API_KEY from R1-02, etc.). Document required env in README + CLAUDE.md.",
      replacement:
        "1. Production environment config — env vars locked to actual values (API_TOKEN, DB_PATH, RESEND_API_KEY from R1-02, BUILD_VERSION, etc.). Document required env in README + CLAUDE.md. **Set `BUILD_VERSION` from the GitHub Actions image tag or a Docker build arg** (" + SENTINEL + ") — R1-04 surfaces it in the rendered HTML footer; without this, the prod footer reads `dev` and Pedro can't tell which build is live.",
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

const newHtml = lines.join("\n");

fs.writeFileSync(HTML, newHtml, "utf8");
fs.writeFileSync(MIRROR, newPromptsJson + "\n", "utf8");

console.log(
  `\nDone. Edits applied: ${totalEdits}. Skipped (already patched): ${totalSkipped}.`
);
console.log(`Sentinel "${SENTINEL}" embedded; re-running this helper is a no-op.`);
