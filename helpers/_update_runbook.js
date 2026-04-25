// _update_runbook.js — apply structural updates to the dated runbook HTML.
//
// Usage: node _update_runbook.js
//
// What it does (idempotent-ish — runs against the 25 april copy):
// 1. Insert 4 new foundation sessions (S06a..S06d) before the existing
//    S06a/S06b "Manifest/Sync" pair; renumber those to S06e/S06f.
// 2. Add S05c to DEFAULT_DONE (completed 2026-04-24).
// 3. Update Status-as-of block + handoff block to reflect 2026-04-25 state.
// 4. Update downstream prereqs (S08b, S09a, S12) that reference old S06a/S06b.
// 5. Update session count in subtitle + progressText (29 → 33).
// 6. Insert new Changelog section (out-of-scope prod reconciliation work).
// 7. Write new PROMPTS for the new sessions + keep old S06a/S06b bodies under
//    renamed keys S06e/S06f (branch names inside those prompts updated to match).

const fs = require("fs");

const INFILE = "pcblueprint-checklist_25 april.html";
const OUT = INFILE; // overwrite the dated copy in place
const PROMPTS_OUT = "prompts_line.txt";

const html = fs.readFileSync(INFILE, "utf8");

// ── NEW PROMPTS ─────────────────────────────────────────────────────────────

const STD_STANDING_FOOTER = `

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

const S06A_NEW = `STANDING INSTRUCTIONS

Before starting:
- Confirm S05c is merged on pcblueprint-api/main.
- In pcblueprint-api: git checkout main && git pull origin main.
- Then: git checkout -b claude/s06a-archive-bidir-sync.

NOTE: Touches pcblueprint-api (container-side behavior). No session-log entry — batched into S12.

Before ending the session you MUST:
- Update the repo's README.md to document the new sync behavior + env vars.
- Update CLAUDE.md if conventions changed.
- Push branch + open PR titled "S06a — Archive Bidirectional Sync".
- Do not merge without my approval.
${STD_STANDING_FOOTER}

SESSION S06a — Archive Bidirectional Sync — pcblueprint-api — ~45 min

Background: the 2026-04-25 reconciliation confirmed api → GitHub push works end-to-end via commitArchive(), but nothing pulls GitHub → NAS. A laptop-side push to pcblueprint-archive leaves the NAS bind mount stale, and the next api write commits on top of divergent history — push fails silently (gitService warns, doesn't throw). Also investigate: /volume2/docker/git-clone2/ DSM project was supposed to handle scheduled pulls but the archive reflog only shows the initial clone — it either never ran or has been failing.

Goal: periodic git pull --rebase origin main inside the api container every 10 min. On conflict, log a structured ERROR and optionally POST to ALERT_WEBHOOK_URL if set; leave the repo in a state the human can inspect and resolve.

Implementation:
- Add node-cron dependency (runtime).
- New src/services/gitSync.ts with pullArchive() and startArchivePuller(). pullArchive tries fetch + fast-forward first; on non-FF tries rebase; on rebase conflict aborts rebase and alerts.
- Hook startArchivePuller() in server.ts after app.listen; skip when NODE_ENV=test.
- Harden commitArchive() in gitService.ts: on push failure, inspect stderr — if non-FF, run pullArchive + retry push once. Still throws nothing but logs ERROR + alerts on the second failure.
- Vitest coverage: mock spawnSync; three cases — happy pull, already-up-to-date pull, conflict pull (verify alert fn called).

If git-clone2 DSM project is still scheduled, decide in PR whether to deprecate (container-side cron supersedes) or keep for off-hours safety-net.

Verification:
- pnpm test green.
- Post-merge smoke: push a trivial commit to pcblueprint-archive from laptop; wait 10 min; docker exec into api, verify git log shows the commit.

---END S06a---`;

const S06B_NEW = `STANDING INSTRUCTIONS

Before starting:
- Confirm S05c merged (and S06a if already landed).
- In pcblueprint-sync: git checkout main && git pull origin main.
- Then: git checkout -b claude/s06b-sync-deploy.

NOTE: Touches pcblueprint-sync (new GHA workflow) + /volume2/docker/api/compose.yaml on the NAS (Watchtower list) + new /volume2/docker/sync/ directory on the NAS (compose + env). No session-log entry — batched into S12.

Before ending the session you MUST:
- Verify the sync README Setup section still matches what was actually deployed; reconcile if not.
- Update CLAUDE.md if conventions changed.
- Push branch + open PR titled "S06b — Sync Worker Containerise + Deploy".
- Do not merge without my approval.
${STD_STANDING_FOOTER}

SESSION S06b — Sync Worker Containerise + Deploy — pcblueprint-sync + NAS — ~45 min

Background: the pcblueprint-sync README was rewritten on 2026-04-25 to describe image-based deployment via ghcr.io + Watchtower. But the plumbing behind that deploy path doesn't exist yet — the README describes a target state, not current reality. Three pieces must be built:

1. .github/workflows/publish.yml in pcblueprint-sync — builds + pushes image to ghcr.io on merge to main. Mirror pcblueprint-api's workflow exactly (Node 22 matrix, GHCR creds from GITHUB_TOKEN, tag :latest + :sha).
2. Watchtower must watch the new container — append pcblueprint-sync to the command: list of the Watchtower service in /volume2/docker/api/compose.yaml.
3. First-time deploy on NAS — create /volume2/docker/sync/compose.yaml (exactly as in the sync README Setup), create /volume2/docker/sync/.env (0600) with all credentials, then docker compose up -d.

Ordering matters: workflow must land + run + push the first image to ghcr.io before the NAS compose can pull it. So: step 1 → merge + wait for first image → steps 2+3.

Credentials needed in .env (reference by name only):
- API_URL=http://pcblueprint-api:3001
- API_TOKEN (same as API_KEY in /volume2/docker/api/compose.yaml)
- ZEPP_EMAIL, ZEPP_PASSWORD, ZEPP_REGION
- STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN
- ALERT_WEBHOOK_URL (optional)

Verification:
- docker logs pcblueprint-sync shows successful boot + scheduled cron registration.
- On next cron tick (03:00 Strava, 11:00 Zepp), logs show a successful POST to api.
- Watch the archive's sessions/session-log for a new API update commit triggered by the ingest write.

---END S06b---`;

const S06C_NEW = `STANDING INSTRUCTIONS

Before starting:
- No code branch unless credential-helper work is added to api. If it is: pcblueprint-api + claude/s06c-infra-hardening.
- Otherwise a pure ops session — just DSM work.

NOTE: Primarily NAS-side. No session-log entry — batched into S12.

Before ending the session you MUST:
- Document the Task Scheduler script + credential-helper approach in pcblueprint-api/CLAUDE.md (under User Environment).
- If code changed, push branch + open PR titled "S06c — Prod Infra Hardening".
- Do not merge without my approval.
${STD_STANDING_FOOTER}

SESSION S06c — Prod Infra Hardening — ops / NAS — ~30 min

Two small, high-value infra fixes surfaced during the 2026-04-25 reconciliation.

1. Docker socket chgrp persistence.
Today apcanario can use the docker CLI only because of a one-off sudo chgrp docker /var/run/docker.sock && sudo chmod g+rw ... NAS reboot reverts this. Fix via DSM Task Scheduler:
- Control Panel → Task Scheduler → Create → Triggered Task → User-defined script
- Event: Boot-up. User: root.
- Script:
    chgrp docker /var/run/docker.sock
    chmod g+rw /var/run/docker.sock
- Verify: reboot the NAS, SSH in as apcanario, run docker ps — succeeds without further sudo.

2. GitHub PAT stored out-of-URL.
Today the PAT is baked into /data/archive/.git/config's remote URL. Rotating the PAT means manually rewriting that file. Clean fix options (pick one):
a. Docker secret + git credential helper. Add GITHUB_PAT to /volume2/docker/api/.env (0600). In docker-entrypoint.sh, write it to a helper file (e.g. ~/.git-credentials) and run git config --system credential.helper store. Change the remote URL back to plain https://github.com/apcanario/pcblueprint-archive.git.
b. Keep the embedded token but document a one-liner rotation procedure in CLAUDE.md (docker exec pcblueprint-api git -C /data/archive remote set-url origin https://x-access-token:NEW_PAT@github.com/apcanario/pcblueprint-archive.git).

Option (a) is cleaner long-term; (b) is 5 minutes. Your call.

Verification:
- Reboot the NAS (or stop + start the api container). Confirm apcanario still has docker access and that commitArchive() still pushes successfully (trigger via any POST to an api endpoint that writes).

---END S06c---`;

const S06D_NEW = `STANDING INSTRUCTIONS

Before starting:
- Confirm S05c merged.
- In pcblueprint-api: git checkout main && git pull origin main.
- Then: git checkout -b claude/s06d-memoir-cleanup.

NOTE: No session-log entry — batched into S12.

Before ending the session you MUST:
- Update README.md + CLAUDE.md if route table shrinks.
- Push branch + open PR titled "S06d — Memoir Endpoints Cleanup".
- Do not merge without my approval.
${STD_STANDING_FOOTER}

SESSION S06d — Memoir Endpoints Cleanup — pcblueprint-api — ~30 min

Decision point. Four GET endpoints currently 404 because their source files live only in _legacy/2026-04-16/ (intentionally deprecated — Pedro has since restructured the memoir narrative and does not want the old content promoted):

- GET /biography/memories/book              → writing/memories/1934 to now, a Story of Remembrance.md (file absent)
- GET /biography/memories/athletic-record   → writing/memories/athletic-record.md (file absent)
- GET /biography/memories/family-book       → writing/memories/family-book-transcription.md (file absent)
- GET /biography/memories/reconstruction    → writing/memories/reconstruction-2023-2026.md (file absent)

Options per endpoint (ask before bulk-applying):

A. Remove the endpoint. Delete the route handler in routes/biography/memories.ts, any README/CLAUDE.md reference, the matching PATHS constant in fileService.ts (or wipFiles entry in search.ts). Remove related tests.

B. Keep the route; leave PATHS pointing at the expected future location. Endpoint 404s until you recreate the content there. Defer further decisions.

C. Bulk remove all four. Cleanest if you've fully moved on from that memoir shape.

This session is mostly decision-capture + surgical delete. Expect to touch: routes/biography/memories.ts, routes/search.ts (wipFiles + book indexer), src/services/fileService.ts (PATHS), README.md route table, tests (if any were specific to these endpoints).

Verification:
- pnpm test green after removals.
- GET on any removed path hits the express 404 catch-all (not a route handler returning 404).
- README route table matches actual live routes.

---END S06d---`;

// ── SESSIONS ARRAY ──────────────────────────────────────────────────────────

// New list of S06 entries, in execution order (foundation first, then existing).
const S06_LINES = [
  `    { id: "S06a", title: "Archive Bidirectional Sync", repos: ["api"], time: 45, prereqs: ["S05c"], phase: "Prod Stability & API Sync", branch: "claude/s06a-archive-bidir-sync" },`,
  `    { id: "S06b", title: "Sync Worker Containerise + Deploy", repos: ["sync", "api"], time: 45, prereqs: ["S05c"], phase: "Prod Stability & API Sync", branch: "claude/s06b-sync-deploy" },`,
  `    { id: "S06c", title: "Prod Infra Hardening", repos: [], time: 30, prereqs: [], phase: "Prod Stability & API Sync", branch: "claude/s06c-infra-hardening", manual: true },`,
  `    { id: "S06d", title: "Memoir Endpoints Cleanup", repos: ["api"], time: 30, prereqs: ["S05c"], phase: "Prod Stability & API Sync", branch: "claude/s06d-memoir-cleanup" },`,
  `    { id: "S06e", title: "Archive Manifest Endpoint", repos: ["api"], time: 40, prereqs: ["S05c", "S06a"], phase: "Prod Stability & API Sync", branch: "claude/s06e-manifest" },`,
  `    { id: "S06f", title: "Sync Path Audit", repos: ["sync"], time: 30, prereqs: ["S06b"], phase: "Prod Stability & API Sync", branch: "claude/s06f-sync-audit", parallel: true },`,
];

// Replace the old two-line S06 block with the new six-line block.
const oldS06Block =
  `    { id: "S06a", title: "Archive Manifest Endpoint", repos: ["api"], time: 40, prereqs: ["S05c"], phase: "API — Manifest & Sync", branch: "claude/s06a-manifest" },\n` +
  `    { id: "S06b", title: "Sync Path Audit", repos: ["sync"], time: 30, prereqs: ["S03b"], phase: "API — Manifest & Sync", branch: "claude/s06b-sync-audit", parallel: true },`;
const newS06Block = S06_LINES.join("\n");

let out = html.replace(oldS06Block, newS06Block);
if (out === html) throw new Error("S06 block replacement failed — anchor not found");

// Downstream prereqs: S08b depended on S06a (manifest) → now S06e.
// S09a depended on S06a (manifest) → now S06e.
// S12 depended on S06b (sync audit) → now S06f.
out = out.replace(
  `{ id: "S08b", title: "Tiled Landing + Manifest Fetch", repos: ["website"], time: 40, prereqs: ["S06a", "S08a"]`,
  `{ id: "S08b", title: "Tiled Landing + Manifest Fetch", repos: ["website"], time: 40, prereqs: ["S06e", "S08a"]`
);
out = out.replace(
  `{ id: "S09a", title: "Hero Refactor + HRZones Component", repos: ["website"], time: 45, prereqs: ["S06a"]`,
  `{ id: "S09a", title: "Hero Refactor + HRZones Component", repos: ["website"], time: 45, prereqs: ["S06e"]`
);
out = out.replace(
  `prereqs: ["S11c", "S10d", "S09b", "S08c", "S06b"]`,
  `prereqs: ["S11c", "S10d", "S09b", "S08c", "S06f"]`
);

// ── DEFAULT_DONE: add S05c ──────────────────────────────────────────────────

out = out.replace(
  `"S04g","S04h","S05a","S05b"]`,
  `"S04g","S04h","S05a","S05b","S05c"]`
);

// ── Subtitle + progressText: 29 → 33 sessions ──────────────────────────────

out = out.replace(`29 sessions across 4 repos`, `33 sessions across 4 repos`);
out = out.replace(`>0 of 29<`, `>0 of 33<`);

// ── Status-as-of block ──────────────────────────────────────────────────────

const oldStatusLine = `<p style="margin: 0 0 10px;"><strong>Status as of 2026-04-24:</strong> S00–S04e, S04g, S04h, S05a, and S05b are ✅ done. S04f is ⏸ deferred (see its card — clean up after S12). Next up: <strong>S05c — Chronology CRUD</strong>.</p>`;
const newStatusLine = `<p style="margin: 0 0 10px;"><strong>Status as of 2026-04-25:</strong> S00–S04e, S04g, S04h, S05a, S05b, and S05c are ✅ done. S04f is ⏸ deferred (post-S12 cleanup). During the 2026-04-25 prod reconciliation we front-loaded four new foundation sessions (S06a–S06d) — see the Changelog section below. Next up: <strong>S06a — Archive Bidirectional Sync</strong>.</p>`;
out = out.replace(oldStatusLine, newStatusLine);

// ── Handoff "Next session" block ────────────────────────────────────────────

const oldHandoffHead = `<p style="margin: 10px 0 6px;"><strong>Next session: S05b — Sessions CRUD</strong></p>
      <p style="margin: 0 0 0;">Open the <code>S05b</code> card below for the full prompt, then: branch <code>claude/s05b-sessions-crud</code> off <code>pcblueprint-api/main</code>, add <code>/biography/sessions</code> GET + GET/:id + POST, Zod validation, vitest coverage, PR titled "S05b — Sessions CRUD".</p>`;
const newHandoffHead = `<p style="margin: 10px 0 6px;"><strong>Next session: S06a — Archive Bidirectional Sync</strong></p>
      <p style="margin: 0 0 0;">Open the <code>S06a</code> card below for the full prompt. Closes the latent foot-gun where GitHub-side archive pushes never reach the NAS bind mount — adds a 10-min cron <code>git pull --rebase</code> inside the api container + hardens <code>commitArchive()</code> to retry on non-FF push.</p>`;
out = out.replace(oldHandoffHead, newHandoffHead);

// ── PROMPTS object edits ────────────────────────────────────────────────────
// Line 688 is a single long `const PROMPTS = {...};` line. We need to:
//   1. Rename old "S06a": → "S06e": (with updated branch name inside body: s06a-manifest → s06e-manifest)
//   2. Rename old "S06b": → "S06f": (s06b-sync-audit → s06f-sync-audit)
//   3. Insert four new entries "S06a","S06b","S06c","S06d" before "S06e".
//
// We do this by locating the old S06a entry (its opening "S06a": after S05c's closing quote) and rewriting.
// All PROMPTS string literals are JSON-escaped (\n, \\, \").

function jsonEscape(s) {
  return JSON.stringify(s); // returns double-quoted string with proper escapes
}

// Find boundary: `,"S06a":"...","S06b":"..."` between S05c and the next key after S06b.
// The PROMPTS object is on one long line — match non-greedily.
const beforeS06A = out.match(/,"S06a":"(?:[^"\\]|\\.)*"/);
if (!beforeS06A) throw new Error("Could not locate PROMPTS.S06a entry");
const s06aEntryLen = beforeS06A[0].length;
const s06aStart = beforeS06A.index;

// Same for S06b (must come immediately after S06a).
const afterS06A = out.slice(s06aStart + s06aEntryLen);
const beforeS06B = afterS06A.match(/^,"S06b":"(?:[^"\\]|\\.)*"/);
if (!beforeS06B) throw new Error("Could not locate PROMPTS.S06b entry immediately after S06a");
const s06aEnd = s06aStart + s06aEntryLen;
const s06bEnd = s06aEnd + beforeS06B[0].length;

// Extract old S06a/S06b raw content (the JSON strings, including keys).
const oldS06aEntry = out.slice(s06aStart + 1, s06aEnd); // strip leading comma
const oldS06bEntry = out.slice(s06aEnd + 1, s06bEnd);   // strip leading comma

// Decode the value, update branch name references, re-encode under new key.
function swapKeyAndBranch(oldEntry, oldKey, newKey, oldBranch, newBranch) {
  const prefix = `"${oldKey}":`;
  if (!oldEntry.startsWith(prefix)) throw new Error(`entry does not start with ${prefix}`);
  const valueJson = oldEntry.slice(prefix.length);
  const value = JSON.parse(valueJson);
  const updated = value.split(oldBranch).join(newBranch);
  return `"${newKey}":${jsonEscape(updated)}`;
}

const renamedS06e = swapKeyAndBranch(oldS06aEntry, "S06a", "S06e", "claude/s06a-manifest", "claude/s06e-manifest");
const renamedS06f = swapKeyAndBranch(oldS06bEntry, "S06b", "S06f", "claude/s06b-sync-audit", "claude/s06f-sync-audit");

// New entries serialized.
const newA = `"S06a":${jsonEscape(S06A_NEW)}`;
const newB = `"S06b":${jsonEscape(S06B_NEW)}`;
const newC = `"S06c":${jsonEscape(S06C_NEW)}`;
const newD = `"S06d":${jsonEscape(S06D_NEW)}`;

// Replacement segment: `,"S06a":...,"S06b":...,"S06c":...,"S06d":...,"S06e":...,"S06f":...`
const replacementSegment = `,${newA},${newB},${newC},${newD},${renamedS06e},${renamedS06f}`;
const originalSegment = out.slice(s06aStart, s06bEnd);

out = out.slice(0, s06aStart) + replacementSegment + out.slice(s06bEnd);

// ── Changelog section ───────────────────────────────────────────────────────
// Insert a new <details> block right after the existing handoff <details>,
// before the <div class="summary"> or whatever follows. We anchor before the
// "Phase summary" / phase-nav / session-list section.

const changelogHTML = `
  <details class="notice" style="margin-top: 12px;">
    <summary style="cursor: pointer; font-weight: 600;">📒 Changelog — out-of-scope work done outside the numbered sessions</summary>
    <div style="margin-top: 14px; line-height: 1.55;">
      <p style="margin: 0 0 12px;">Ad-hoc work done between or around numbered sessions. Why this exists: the numbered sessions assume a working prod deploy + in-sync archive + stable infra. The 2026-04-25 reconciliation found those assumptions were not met, which triggered a cascade of unplanned fixes. Logging here so future sessions can see the full history.</p>

      <p style="margin: 10px 0 6px;"><strong>2026-04-25 — Prod reconciliation + path realign</strong></p>
      <ul style="margin: 0 0 10px 20px; padding: 0;">
        <li><strong>Why:</strong> smoke test of <code>commitArchive()</code> revealed the NAS archive was frozen 41 commits behind GitHub at pre-S01 state (commit <code>0c12945</code>), and the api's <code>PATHS</code> constants still pointed at pre-S01 paths that no longer exist. Container had never successfully written to the archive.</li>
        <li><strong>What:</strong> Rotated GitHub PAT, fixed git remote URL format, pulled archive 41 commits forward, added apcanario to docker group, chgrp'd docker socket, chowned archive bind mount to node, baked <code>safe.directory</code> + ownership entrypoint into the api Dockerfile, realigned every PATHS constant + hardcoded archive path across <code>src/**</code> for the post-S01 bucket tree (<code>writing/</code>, <code>records/</code>, etc.), updated tests. Verified end-to-end with a live POST that committed + pushed to GitHub.</li>
        <li><strong>PRs:</strong> <code>apcanario/pcblueprint-api#21</code> (realign + Dockerfile fix).</li>
        <li><strong>Impact on tasks:</strong> foundation sessions <code>S06a</code>–<code>S06d</code> were inserted into the runbook to close remaining gaps (bidirectional sync, sync worker deploy, infra hardening, memoir endpoints). All downstream tasks now assume a working prod archive.</li>
      </ul>

      <p style="margin: 10px 0 6px;"><strong>2026-04-24/25 — CHANGELOG backfills across all four repos</strong></p>
      <ul style="margin: 0 0 10px 20px; padding: 0;">
        <li><strong>Why:</strong> CHANGELOG.md in api + archive + sync had drifted many sessions behind. Agreed with Pedro mid-session that CHANGELOG stays current per session rather than being deferred to S12.</li>
        <li><strong>What:</strong> Backfilled entries for S04b..S05c in api; S02a..S04d in archive; S04d in sync. Added a standing "keep CHANGELOG current" memory rule for future sessions.</li>
        <li><strong>PRs:</strong> <code>pcblueprint-api#20</code>, <code>pcblueprint-archive#10</code>, <code>pcblueprint-sync#3</code>.</li>
        <li><strong>Impact on tasks:</strong> <code>S12 — Cross-Repo Docs Sweep</code> no longer has to backfill — scope reduces to verifying consistency across repos.</li>
      </ul>

      <p style="margin: 10px 0 6px;"><strong>2026-04-25 — Sync worker deploy docs rewrite</strong></p>
      <ul style="margin: 0 0 10px 20px; padding: 0;">
        <li><strong>Why:</strong> pcblueprint-sync README assumed git-clone-onto-NAS + <code>docker compose up -d --build</code>. Api has long since moved to image-based deploy via ghcr.io + Watchtower; sync should match.</li>
        <li><strong>What:</strong> Rewrote Setup + Updating sections to describe image-based deploy at <code>/volume2/docker/sync/</code>, fixed the stale <code>pcblueprint.env</code> reference.</li>
        <li><strong>PR:</strong> <code>pcblueprint-sync#4</code>.</li>
        <li><strong>Impact on tasks:</strong> docs lead the implementation — the deploy path is documented, but the infrastructure (GHA workflow, Watchtower list, compose file) to actually follow it is <code>S06b</code>.</li>
      </ul>

      <p style="margin: 10px 0 6px;"><strong>2026-04-24 — Local repo cleanup + branch pruning</strong></p>
      <ul style="margin: 0 0 10px 20px; padding: 0;">
        <li><strong>Why:</strong> Local clones had stale branches for merged PRs + one superseded feature branch (<code>reorganize-archive-structure</code> in archive) that had been abandoned on the remote.</li>
        <li><strong>What:</strong> Fast-forwarded main across all 4 repos; deleted local stale branches; pruned remote-tracking refs. Cloned <code>pcblueprint-sync</code> locally for the first time.</li>
        <li><strong>Impact on tasks:</strong> none — pure hygiene.</li>
      </ul>
    </div>
  </details>
`;

// Anchor: insert right before the line that closes the initial handoff <details>.
// The handoff details ends on line with `    </details>` after the "Next session" block.
// To avoid matching the wrong </details>, anchor on the unique text just before:
const anchor = `Open the <code>S06a</code> card below for the full prompt. Closes the latent foot-gun`;
const idx = out.indexOf(anchor);
if (idx === -1) throw new Error("handoff anchor for changelog insert not found");
const afterAnchor = out.indexOf(`</details>`, idx);
if (afterAnchor === -1) throw new Error("closing </details> after handoff not found");
// Insert changelog right after that </details>.
const insertAt = afterAnchor + `</details>`.length;
out = out.slice(0, insertAt) + changelogHTML + out.slice(insertAt);

// ── Write out ───────────────────────────────────────────────────────────────

fs.writeFileSync(OUT, out, "utf8");
console.log(`Wrote ${OUT}`);

// ── Rebuild prompts_line.txt mirror ─────────────────────────────────────────

// Extract the now-updated PROMPTS object from the new HTML.
const promptsMatch = out.match(/const PROMPTS = (\{[\s\S]*?\});/);
if (!promptsMatch) throw new Error("Could not re-extract PROMPTS");
fs.writeFileSync(PROMPTS_OUT, promptsMatch[1] + "\n", "utf8");
console.log(`Wrote ${PROMPTS_OUT}`);

console.log("Done.");
