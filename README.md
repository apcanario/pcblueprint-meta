# pcblueprint-meta

The meta / coordination repo for the **pcblueprint** project — a personal data archive with API, sync workers, and (eventually) a private chat-driven web interface.

This repo is the **outer shell**: the session runbook that sequences work across the other three repos, the source PRD, and helper scripts that maintain them.

## Sibling repos

| Repo | Purpose |
|---|---|
| [`pcblueprint-api`](https://github.com/apcanario/pcblueprint-api) | Express/TypeScript API. Reads/writes the archive. |
| [`pcblueprint-archive`](https://github.com/apcanario/pcblueprint-archive) | The data archive itself (records, writing, raw, source files, sessions). |
| [`pcblueprint-sync`](https://github.com/apcanario/pcblueprint-sync) | Docker cron container that pulls Zepp + Strava → API ingest endpoints. |
| **`pcblueprint-meta`** *(this repo)* | Runbook, PRD, helpers, deploy workflow. |

## What's in this repo

```
.
├── pcblueprint-checklist_<date>.html   # the runbook — single static HTML, latest-date-wins
├── prompts_line.txt                     # mirror of the runbook's PROMPTS object, easy grepping
├── helpers/                             # idempotent JS scripts that patch the runbook
│   ├── _embed_prd.js                    # re-renders history/PROJECT-PRD.md into the HTML
│   ├── _extract.js                      # prints one session's prompt: node helpers/_extract.js <html> <id>
│   ├── _append_closing_checklist.js     # appends the standing close-of-session rule to all not-done prompts
│   ├── _update_closing_checklist_to_v2.js
│   ├── _patch_chat_architecture.js
│   ├── _patch_prompts_post_s06a.js
│   ├── _add_v2_sessions.js
│   └── _update_runbook.js
└── history/
    ├── PROJECT-PRD.md                   # source of truth for the embedded 📋 PRD pane
    └── (prior dated runbook snapshots)
```

## How the runbook works

The runbook is a **single static HTML file** with embedded JS data structures. No build step, no node_modules.

- **`SESSIONS`** — array of session objects (id, title, repos, time, prereqs, phase, branch, optional manual/parallel/waitingFor flags)
- **`PROMPTS`** — id → full Claude Code prompt text
- **`COMPLETED_SESSIONS`** — single source of truth for "what's done"
- **localStorage** — per-machine UI state (active tab, expanded panels, recruiter-mode flag)

The HTML opens in any browser. Click a session card to see its full prompt. The 📒 Changelog tab logs out-of-scope work and architectural pivots; the 📋 PRD tab embeds the project spec; the 📐 Approach tab is recruiter-readable.

**The dated filename is intentional** — when a substantial restructure happens, the new runbook is saved with the new date and the prior file kept for history. Most-recent-date wins.

## Helpers

All helpers are idempotent — re-running them doesn't double-apply changes. Run from repo root:

```bash
node helpers/_extract.js pcblueprint-checklist_<date>.html S06b
node helpers/_embed_prd.js
```

After writing or modifying a helper, run it once locally and verify the diff before committing the regenerated HTML.

## GitHub Pages deploy

The runbook is also served at the repo's GitHub Pages URL. The workflow at `.github/workflows/pages.yml` picks the most recent dated HTML file and publishes it as `index.html`. The recruiter-view toggle inside the runbook works on the deployed copy too — share the URL instead of zipping the file between machines.

## Project releases

Work is organized into five releases (re-planned 2026-04-25 — see the runbook's 📒 Changelog for the full pivot record):

- **R0 — Foundation** *(largely done)*: archive structure, API CRUD, sessions log, prod sync.
- **R1 — Private Archive Browser**: read-only, server-rendered HTML from the API, default browser CSS, real auth from day one.
- **R2 — AI Chat over the archive**: stateless WRITE / QUERY / EXPORT command interface.
- **R3 — Visual identity**: branding, typography, charts. Tailwind-vs-Next.js call deferred to here.
- **R4 — Mobile + offline**: responsive, PWA, offline-read.

The "default styling first, dazzle last" discipline is intentional — get the data displayable and the foundations clean before layering on visual polish.

## Standing rules

Every numbered session inherits the **S01 standing instructions** (file size limit, `git mv` for moves, no dev server boot, no package-lock edits, no secrets in chat) and the **closing checklist** (HTML done-flip, scrum-master CHANGELOG entry, downstream-impact triage). Both are documented in the runbook prompts themselves and don't need re-stating per task.
