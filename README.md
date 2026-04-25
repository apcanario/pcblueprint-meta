# pcblueprint-meta

The meta / coordination repo for the **pcblueprint** project — a personal data archive with API, sync workers, and (eventually) a private chat-driven web interface.

**📒 Live runbook:** https://apcanario.github.io/pcblueprint-meta/

This repo is the **outer shell**: the session runbook that sequences work across the other three repos, the source PRD, and helper scripts that maintain them. Push to `main` redeploys the runbook automatically via GitHub Actions (~15s).

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
│   ├── _restructure_releases.js         # 2026-04-25 R0–R4 release restructure (idempotent one-shot)
│   ├── _append_closing_checklist.js     # appends the standing close-of-session rule to all not-done prompts
│   ├── _update_closing_checklist_to_v2.js
│   ├── _patch_chat_architecture.js
│   ├── _patch_prompts_post_s06a.js
│   ├── _add_v2_sessions.js
│   └── _update_runbook.js
├── history/
│   ├── PROJECT-PRD.md                   # source of truth for the embedded 📋 PRD pane
│   └── (prior dated runbook snapshots)
└── .github/workflows/pages.yml          # auto-deploys the latest dated HTML to GitHub Pages
```

## How the runbook works

The runbook is a **single static HTML file** with embedded JS data structures. No build step, no node_modules.

- **`SESSIONS`** — array of session objects (id, release, title, repos, time, prereqs, phase, branch, optional manual/parallel/waitingFor flags)
- **`PROMPTS`** — id → full Claude Code prompt text
- **`COMPLETED_SESSIONS`** — single source of truth for "what's done"
- **`RELEASES`** — R0–R4 metadata (id, name, outcome) used by the release tabs + recruiter summary
- **localStorage** — per-machine UI state (active tab, active release, expanded panels, recruiter-mode flag)

The HTML opens in any browser. Click a session card to see its full prompt. The 📒 Changelog tab logs out-of-scope work and architectural pivots; the 📋 PRD tab embeds the project spec; the 📐 Approach tab is recruiter-readable.

### Tasks pane UI (as of 2026-04-25)

- **Release tabs** at the top (R0 · R1 · R2 · R3 · R4) — click to filter the phase grid below to that release's sessions. Active release persists in localStorage.
- **Next-ready widget** (banner above the tabs) — auto-computes the highest-priority ready session by walking releases R0→R4 in order. One-click opens its prompt.
- **Recruiter view** (⚙️ menu → Reset) — replaces the 52-row session grid with 5 release-level outcome cards showing real completion data. Restore via the banner button to return to the working view.

**The dated filename is intentional** — when a substantial restructure happens, the new runbook is saved with the new date and the prior file kept for history. Most-recent-date wins.

## Helpers

All helpers are idempotent — re-running them doesn't double-apply changes. Run from repo root:

```bash
# Print one session's full prompt:
node helpers/_extract.js "pcblueprint-checklist_25 april.html" R1-01

# Re-render the embedded 📋 PRD pane after editing history/PROJECT-PRD.md:
node helpers/_embed_prd.js

# Apply the 2026-04-25 R0–R4 release restructure (already applied; no-op on re-run):
node helpers/_restructure_releases.js
```

After writing or modifying a helper, run it once locally and verify the diff before committing the regenerated HTML.

## GitHub Pages deploy

The runbook is also served at the repo's GitHub Pages URL. The workflow at `.github/workflows/pages.yml` picks the most recent dated HTML file and publishes it as `index.html`. The recruiter-view toggle inside the runbook works on the deployed copy too — share the URL instead of zipping the file between machines.

## Project releases

Work is organised into five releases (re-planned 2026-04-25 — see the runbook's 📒 Changelog for the full pivot record):

| Release | Status | Goal |
|---|---|---|
| **R0 — Foundation** | 🟢 Mostly done | Archive structure, API CRUD, sessions log, prod sync. |
| **R1 — Private Archive Browser** | 🔵 Ready to start (R1-01) | Read-only, server-rendered HTML from the API. Default browser CSS. Real auth (Argon2id + Resend) from day one. No Next.js, no MUI. |
| **R2 — AI Chat over the archive** | ⚪ Pending R1 | Stateless WRITE / QUERY / EXPORT command interface layered on R1. Same default-CSS philosophy. |
| **R3 — Visual identity** | 🔮 To be planned | Branding, typography, charts. Tailwind-vs-Next.js call made here with real R1+R2 usage data. |
| **R4 — Mobile + offline** | 🔮 Pending R3 | Responsive, PWA install, offline-read. |

The **"default styling first, dazzle last"** discipline is intentional — get the data displayable and the foundations clean before layering on visual polish.

## Standing rules

Every numbered session inherits the **S01 standing instructions** (file size limit, `git mv` for moves, no dev server boot, no package-lock edits, no secrets in chat) and the **closing checklist** (HTML done-flip, scrum-master CHANGELOG entry, downstream-impact triage). Both are documented in the runbook prompts themselves and don't need re-stating per task.
