# pcblueprint — Project PRD

> **Companion to `pcblueprint-checklist_<date>.html`.** The runbook is the *how* (per-session prompts, branching, PR flow); this doc is the *what + why* — the product we're building and how we'll know each piece is done.

## Vision

A private, web-accessible system for one person (Pedro Canário) to **store, browse, expand, and act on** the full record of their life — biographical text, medical history, fitness data, journal entries, memoirs, and identity context — across phone and laptop, with archive-first persistence to a versioned git repository.

## North-star user experience

1. **Browse** structured pages per domain (medical, memoirs, journal, chronology, sports, blueprint, identity), polished docs-site feel.
2. **Use a stateless natural-language interface to the archive** with three verbs — every interaction is one task, no conversation history retained:
   - **WRITE** — *"log bp 118 over 76, pulse 62, left arm"*, *"new memory tagged 'family' titled X"*, *"upload this PDF as my latest blood test"*. Agent classifies intent, parses, dedupes against existing records, auto-tags from the canonical vocabulary, surfaces a confirm preview, then commits with links back to the saved file.
   - **QUERY** — *"any of dad's memoirs that mention me"*, *"how did training load correlate with sleep last month"*, *"is this blood test result normal compared to my history"*. Agent reads relevant archive files, cross-references, cites sources inline. Short structured answer for fact queries; prose only when the question is interpretive.
   - **EXPORT** — *"give me a PDF report of my HRV trends in April"*, *"download all my 2024 medical files"*. Agent generates a deliverable (PDF / CSV / Markdown / `.zip`) following a universal filename convention.
3. **Access** all of the above from a phone, over the public internet, behind a real login with recovery — no shared password.

## System map

| Repo | Role |
|---|---|
| `pcblueprint-archive` | Source of truth. Markdown + JSON files in lifecycle buckets (`records/`, `writing/`, `source-files/`, `_legacy/`, etc.). Every write is a git commit. |
| `pcblueprint-api` | Express/TypeScript api over the archive. Mounts at `/health`, `/biography`, `/blueprint`, `/identity`, `/timeline`, `/search`, `/archive`, `/chat` (planned). **As of R1 (2026-04-25): also serves the user-facing HTML pages directly via EJS — no separate frontend until R3.** |
| `pcblueprint-sync` | Docker cron worker. Pulls from Zepp + Strava, posts to api ingest endpoints. |
| `pcblueprint-meta` | Coordination repo (this PRD's home). Hosts the runbook HTML, helpers, and the GitHub Pages deploy of the runbook. New as of 2026-04-25. |
| `pcblueprint-website` | *Originally:* Next.js 16 (App Router) with MUI + Tailwind + Emotion. **Status post-2026-04-25 release pivot:** dormant until R3 (Visual Identity), at which point a Tailwind-vs-Next.js call gets made with real R1+R2 usage data informing the choice. |

## Roadmap structure

**52 sessions across 5 releases (R0–R4)** — restructured 2026-04-25 from the prior 55-session flat list. R3 has no sessions yet (planned at R3 kickoff). EPIC 0 is the pre-runbook foundation; the historical EPIC 1–19 sections below remain for context, with dropped epics marked inline.

## Chat architecture (codified 2026-04-25)

The chatbot is **not** conversational. It is a **stateless natural-language task endpoint** with three verbs (WRITE / QUERY / EXPORT — see North-star §2). Every interaction is one task; the agent's internal tool loop within a single request is unbounded (capped at 10 tool calls), but no state crosses requests.

- **WRITE contract** applied to every active user-data bucket (`records/`, `writing/`, `raw/`, `source-files/`, `sessions/`; system buckets `_legacy/`, `meta/`, `scripts/`, `claude-code-prompts/` are off-limits): classify intent → parse + extract → propose multi-domain split if applicable → call `get_tag_vocabulary` → run identity-based dedup (3-way: all-new / partial overlap silently merged / full duplicate escalated to user with side-by-side comparison) → surface confirm preview with editable per-domain fields → commit → return `{saved_path, github_url, viewer_url, tags_applied}`.
- **QUERY contract**: always cite source files. Reference ranges for medical comparisons prefer PDF-embedded ranges, fall back to `web_search`. Auto-save fresh inputs used in cross-reference (dedup contract still applies).
- **EXPORT contract**: universal filename convention `<verb>-<scope>-<YYYY-MM-DD>.<ext>`; simple PDF default, CSV as utility format (storage, not human-reading), `.zip` for source-file bundles (never `.tar.gz`).
- **Cost ceilings** (3 layers): per-request (max_tokens + max-iterations + 60s timeout); app-level monthly budget guard refusing requests at 100% and warning at 80%; vendor-level prepaid credits + workspace spend cap.

See memory `chat_architecture_three_verbs.md` for the full operational record.

## Release plan (2026-04-25 pivot)

The prior 55-session flat arc was "everything, everywhere, all at once": Next.js + MUI + Tailwind + Emotion + custom auth + mobile responsiveness all interleaved with no shippable intermediate before ~S20. The 2026-04-25 pivot replaces that with five releases under a strict "default styling first, dazzle last" discipline.

| Release | Goal | Sessions |
|---|---|---|
| **R0 — Foundation** *(largely done)* | Archive structure, API CRUD, sessions log, prod sync. | S00–S06f, S16a, S16b |
| **R1 — Private Archive Browser** | Read-only, server-rendered HTML directly from the API, default browser CSS only, real auth (Argon2id + Resend) from day one. No Next.js, no MUI, no Tailwind. | R1-01 (auth core, was S20a), R1-02 (auth UX, was S20b), R1-03 (auth hardening, was S20c), R1-04 (HTML rendering layer), R1-05 (index pages), R1-06 (detail pages), R1-07 (search/filter), R1-08 (public deploy, replaces S18a/b), R1-09 (observability minimum) |
| **R2 — AI Chat over the archive** | Stateless WRITE / QUERY / EXPORT command interface. Same default-CSS philosophy — `<form>` posting to `/chat`, results rendered server-side, vanilla-JS SSE. No React. | S10a–d, S11a–c (rewritten — replace React panel with EJS), S12, S13a–b, S14a–c, S15a–b |
| **R3 — Visual Identity** *(no sessions yet)* | Branding, typography, color, charts. Tailwind-vs-Next.js call made here with real usage data informing the choice. | TBD — planned at R3 kickoff |
| **R4 — Mobile + Offline** *(blocked on R3 planning)* | Responsive 375px viewport, drawer, optional PWA install + offline-read. | S19a, S19b, S19c |

**Sessions dropped (Next.js+MUI scaffolding superseded by R1-04..R1-07):** EPIC 7 (S07a, S07b), EPIC 8 (S08a, S08b, S08c), EPIC 9 (S09a, S09b). Their per-EPIC sections below stay for historical record but are flagged DROPPED.

**Sessions folded:** EPIC 17 (S18a, S18b — original Vercel website deploy + DNS) → folded into R1-08 (single deploy of the API+HTML unit on Cloudflare tunnel or Fly.io).

**Sessions moved:** EPIC 19 (S20a–c — Auth Hardening) → pulled forward to R1 as R1-01..R1-03; archive is private from first public deploy, no APP_PASSWORD-only window.

---

# EPIC 0 — Precursor Work (pre-runbook foundation)
**Phase:** Pre-S00 · **Status:** ✅ Shipped (manual, before formal sessions began) · **Sessions:** none — done by hand over weeks/months before the runbook existed

### Outcome
The entire foundation the runbook stands on: personal data gathered + curated, four GitHub repos created with initial code that builds, a Synology NAS configured as the production server, an end-to-end deploy chain wired up (cloudflared tunnel → api → archive → GitHub mirror), and Claude Code tooling installed with custom skills + MCP servers. None of S00–S20 would be runnable without this base.

### What was done

**Personal data gathered + curated** (the actual content of the system, sourced over years):
- Seven memoir-voice files written in 2014 — `intro 2014.md`, `pedro canario 2014.md`, `graça gomes 2014.md`, `francisco canario 2014.md`, `teresa faria 2014.md`, `rita canario 2014.md`, `domingos araujo 2014.md`.
- The "1934 to now, a Story of Remembrance" book + InDesign source (`.idml`) + ZIP bundle of family-book assets.
- Biographical baseline (`biography-baseline.original.md`, ~40KB) and biographical protocol (`protocol.md`, ~36KB).
- Chronology timeline of life events from 1934 onward.
- Compiled medical history (`pedro_medical.md`) plus 14 medical imaging PDFs — cardio ECGs, holters, MRIs, x-rays, ecographies, stress tests.
- Personal context + identity documents, pattern registry, blueprint v1 (psychological assessment), Word source (`pedro_blueprint.docx`).
- Personal journal (`pedro_journal.md`) + Word source.
- Coros Training Hub bulk export — ~562 historical workouts, ~20MB ZIP.
- Omron Connect CSV export of historical blood pressure readings.

**Repo scaffolding** — 4 GitHub repos created (`pcblueprint-archive`, `pcblueprint-api`, `pcblueprint-website`, `pcblueprint-sync`) with initial commits, `package.json`, `tsconfig.json`, Dockerfile + compose where applicable, GitHub Actions for image build/publish on `pcblueprint-api`, and initial `README.md` / `CLAUDE.md` / `PRIVACY.md` per repo.

**Initial pcblueprint-api implementation** (pre-S04 realign): Express + TypeScript, requireAuth Bearer middleware, full health endpoint surface (tracking, sports, medical, blood-pressure CRUD, ingest), biography read endpoints (protocol, chronology, journal, memories, identity, blueprint), schema/types, vitest infrastructure, `gitService.commitArchive()`.

**Initial pcblueprint-website**: Next.js 16 (App Router) with all major routes already scaffolded — `/sports`, `/sleep`, `/journal`, `/chronology`, `/medical`, `/memories`, `/protocol`, `/identity`, `/blueprint`, `/timeline`, `/search`, `/dashboard`, `/archive`, `/blood-pressure`, `/login`. MUI + Tailwind + Emotion stack. Auth flow (`APP_PASSWORD` → JWT cookie). `lib/api.ts` Bearer-token client.

**Initial pcblueprint-sync** (PR #1 in that repo): custom Zepp HTTP client (email + password, no third-party dep), Strava OAuth v3 client, daily/nightly cron jobs (Zepp 11:00, Strava 03:00), structured logger with optional webhook alerting, Dockerfile + compose.

**NAS production chain** (Synology DS423+): DSM configured, SSH key-auth set up, Container Manager projects deployed: api stack (api container + cloudflared tunnel + Watchtower), `git-clone` and `git-clone2` projects for archive seeding, ARCHIVE_PATH bind-mounted, GitHub PAT issued for container-side push/pull, Cloudflare tunnel routing public traffic to the api.

**Claude Code tooling**: custom domain skills (`/biography`, `/medical`, `/activity`, `/sleep`, `/psychology`, `/schema`), local MCP servers (`knowledge-rag` semantic search, `strava-mcp` OAuth, `sleep-decoder`), Stop hook validating `schema.json` on session end, GitHub Actions Claude Code review workflow (later removed in S04 cleanup once it became failure-noise), the runbook HTML itself with sessions S00–S12 sketched out.

### Why this matters

The runbook starts at S00 (manual binary prep) on the assumption that the data, code, infrastructure, and tooling listed above already exist and work. The total invested effort here easily matches or exceeds the formal-session work that follows — every session depends on it. Documented retrospectively so future readers (or fresh Claude Code sessions) understand what they're standing on.

### Acceptance criteria (retrospective)
- ✅ Personal data exists in some form across all domains (medical, biographical, fitness, journal, memories, identity, blueprint).
- ✅ All 4 GitHub repos exist with code that builds and tests pass.
- ✅ Production deploy chain functional in concept: api container running on NAS; cloudflared exposing it publicly; Watchtower polling ghcr.io for image updates.
- ✅ Claude Code can read the codebase + operating rules + memories.
- ✅ Runbook HTML exists with sessions S00–S12 sketched.

### Caveats discovered later
The 2026-04-25 prod reconciliation surfaced that several of the "✅ functional in concept" pieces above had latent gaps — the api had never successfully written to the archive (silent push failures), the NAS archive was 41 commits stale (no scheduled pull was actually running), the docker socket wasn't writable by `apcanario`. Those gaps are now closed (see Changelog and EPIC 6).

---

# EPIC 1 — Manual Binary Prep
**Phase:** Prep · **Status:** ✅ Shipped · **Sessions:** S00

### Outcome
One-time clean-up of binary blobs and large originals before the main IA migration, so subsequent sessions don't churn on giant files.

### User story
- *As Pedro,* I want oversized binary originals (16MB PDFs, IDML sources, ZIP exports) handled correctly before they pollute the git history.

### Acceptance criteria
- ✅ External backups taken before any moves.
- ✅ Decision recorded per file (keep / archive / move out of repo).
- ✅ Files with spaces renamed to kebab-case where applicable.
- ✅ Single PR landed cleanly with no large untracked binaries left behind.

### Out of scope
- Git LFS setup (left as optional follow-up).

---

# EPIC 2 — Archive IA + Migration
**Phase:** Archive · **Status:** ✅ Shipped · **Sessions:** S01, S02a, S02b, S03a, S03b

### Outcome
The archive folder structure is reorganised into nine canonical lifecycle buckets (`records/`, `writing/`, `source-files/`, `raw/`, `_legacy/`, `meta/`, `scripts/`, `sessions/`, `claude-code-prompts/`) with a published spec at `meta/ia-spec.md`, so every future write knows exactly where it goes.

### User stories
- *As Pedro,* I want a stable folder structure I can navigate by lifecycle (active vs. cold storage), not by content type alone.
- *As an api,* I want one canonical path per logical resource so PATHS constants stay simple.

### Acceptance criteria
- ✅ `meta/ia-spec.md` v1.2 approved and committed.
- ✅ All pre-migration top-level directories mapped to a new bucket (no orphans).
- ✅ Bilingual `.en.md` / `.pt.md` suffixes dropped — primary file is `.md`.
- ✅ `_legacy/2026-04-16/` retains pre-migration copies for reversibility.
- ✅ `schema.json` keys updated to new bucket paths (v1.3).
- ✅ `meta/part2-manifest.json` reflects new tree (v1.1.0).
- ✅ Health folder audit confirms `/sports` duplication is intentional (Coros + Zepp = different schemas).

### Out of scope
- Migrating the api code to match — that's Epic 3.

### Sessions
S01 (IA spec + first migration), S02a (memories-wip + `_legacy/` READMEs), S02b (`source-files/` + binary recovery), S03a (health audit), S03b (`schema.json` + import scripts + manifest).

---

# EPIC 3 — API Path Realign (S04a–c)
**Phase:** API — Realign · **Status:** ✅ Shipped · **Sessions:** S04a, S04b, S04c

### Outcome
Every api route reads/writes via a `PATHS` constant or path helper instead of hardcoded strings, so future archive moves require a one-line change in `fileService.ts` rather than a repo-wide grep.

### Acceptance criteria
- ✅ `PATHS` const exported from `src/services/fileService.ts` covering every archive file the api touches.
- ✅ Parameterised helpers added: `pathBloodPressureMonth`, `pathWorkoutStream`, `pathMedicalNote`, `pathBlueprintVersion`.
- ✅ All `/health/*` routes adopt `PATHS` (S04b).
- ✅ All `/biography/*`, `/blueprint`, `/identity/*` routes adopt `PATHS` (S04c).
- ✅ Test fixtures use the new bucket prefixes; vitest 86/86 green.

### Caveat
PATHS constants and several hardcoded strings were *not* fully aligned with the post-S01 archive at the time S04c shipped — that gap was fixed retroactively on 2026-04-25 (see Changelog block "Prod reconciliation + path realign"). All routes now correctly point at the post-S01 tree.

---

# EPIC 4 — Hardening / Backlog (S04d–h)
**Phase:** Hardening / Backlog · **Status:** ✅ Mostly shipped (S04f deferred)

### Outcome
A grab-bag of cross-repo housekeeping: shared operating-rules doc, cleanup of orphaned NAS state, lockfile drift resolution, and bot reviews.

### Sessions + status
- ✅ **S04d** — Shared "Working with Claude — Operating Rules" section in `CLAUDE.md` of all 4 repos.
- ✅ **S04e** — Stray `medical/notes` audit (manual).
- ⏸ **S04f** — Remove orphan `/volume1/pcblueprint-archive` (deferred to post-S12 cleanup).
- ✅ **S04g** — Investigate Claude PR Review bot (decision: removed the failing workflow).
- ✅ **S04h** — `package-lock.json` drift resolution + Node 22 pin via `.nvmrc` and `engines`.

### Acceptance criteria
- ✅ Operating rules section identical across all 4 repos.
- ✅ `pnpm-lock.yaml` removed; `package-lock.json` regenerated cleanly; future `npm install` produces no diff on Node 22.
- ⏸ `/volume1/pcblueprint-archive` deletion deferred — left for post-S12 sweep.

---

# EPIC 5 — API CRUD Gaps (S05a–c)
**Phase:** API — CRUD Gaps · **Status:** ✅ Shipped · **Sessions:** S05a, S05b, S05c

### Outcome
Every biographical resource has a complete CRUD surface, so the website (and the future chat tools) can write any entity without dropping to filesystem tricks.

### Acceptance criteria
- ✅ `POST /biography/memories`, `PATCH/DELETE /biography/memories/:slug` — slug-scoped.
- ✅ `PATCH/DELETE /blueprint/:version` — handles "delete current latest" by picking the previous version + setting `identity_stale: true`.
- ✅ `GET/POST /biography/sessions` — append-only AI session log; auto-incrementing session_number.
- ✅ `POST/PATCH/DELETE /biography/chronology/events` — slug = `${date}-${slugify(title)}`; category enum; preserves the `<!-- END OF CURRENT RECORD -->` marker on POST.
- ✅ Vitest coverage for happy path + key validation failures on every endpoint.

---

# EPIC 6 — Prod Stability & API Sync (S06a–f)
**Phase:** Prod Stability & API Sync · **Status:** 🟡 Planned (foundation work)

### Outcome
Production deploy is *actually* stable end-to-end: the api on the NAS bidirectionally syncs with GitHub, the sync worker is deployed and pulling Zepp/Strava data, infrastructure quirks (docker socket reset, PAT rotation) have permanent fixes, and the api exposes a manifest that the website can bind to.

### Sub-sessions
- **S06a** — Archive bidirectional sync (cron `git pull --rebase` inside api container; commitArchive retries on non-FF).
- **S06b** — Sync worker containerise + deploy (GHA publish → ghcr.io → Watchtower → NAS compose).
- **S06c** — Prod infra hardening (DSM Task Scheduler for docker socket persistence; PAT credential helper).
- **S06d** — Memoir endpoints cleanup (decide remove vs. recreate for athletic-record, family-book, reconstruction, book endpoints currently 404'ing).
- **S06e** — Archive Manifest Endpoint (`GET /archive/manifest` reading `meta/ia-spec.md` for the website's docs sidebar).
- **S06f** — Sync Path Audit (verify every write path in `pcblueprint-sync/src/**` matches post-S03 paths).

### Acceptance criteria
- [ ] After a laptop-side push to `pcblueprint-archive`, the next NAS api write succeeds without merge-conflict (proven by 10-min cron pull).
- [ ] `pcblueprint-sync` container running on the NAS, registered with Watchtower; first scheduled cron tick (Zepp 11:00 / Strava 03:00) writes data to api ingest endpoints; archive shows `API update:` commits in git log.
- [ ] NAS reboot does not break docker access for `apcanario` (Task Scheduler restores socket perms).
- [ ] PAT rotation procedure documented; new PAT can be deployed without manually editing `.git/config`.
- [ ] All four memoir endpoints either return 200 with content or are removed cleanly (no silent 404s).
- [ ] `GET /archive/manifest` returns `{ sections: [{ slug, label, description, routes, counts }], generated_at }` matching `meta/ia-spec.md`.
- [ ] `pcblueprint-sync` write paths in code match the post-S03 archive tree (audited).

### Out of scope
- Real-time conflict resolution UI (alerts log to webhook + leave repo in conflict state for manual fix).
- Cross-archive multi-write atomic transactions.

---

# EPIC 7 — Website Homepage (S07a–b) — ❌ DROPPED 2026-04-25
**Release pivot:** superseded by R1-04 (API HTML rendering layer) + R1-05 (archive index pages). Original Next.js/MUI scaffolding no longer needed under the server-rendered approach. Section retained below for historical reference.

**Phase:** Website — Homepage · **Status:** 🟡 Planned · **Sessions:** S07a, S07b

### Outcome
Replace the current dashboard-first homepage with a chat-first homepage that has a centered chat panel, a collapsible sidebar with archive section tiles + today-snapshot, and preserves the existing dashboard at `/today`.

### User stories
- *As Pedro on his phone in the morning,* I want to land on a chat input ready to receive *"how'd I sleep"* without navigating.
- *As Pedro at his desk,* I want the existing dashboard still reachable at `/today` so my muscle memory still works.

### Acceptance criteria
- [ ] `/today` renders the full pre-existing dashboard verbatim.
- [ ] `/` renders `<HomeShell>` with `<ChatPanel>` (stub) + collapsible left sidebar.
- [ ] Sidebar has tiles for at least 3 archive sections + today-snapshot card (HR, sleep, last workout — placeholder data OK at this stage).
- [ ] `app/api/chat/route.ts` exists as a stub returning `"Chat backend coming soon."` (real wiring in S11a).
- [ ] No regressions in existing routes (auth, archive, etc.).

---

# EPIC 8 — Website Archive Docs (S08a–c) — ❌ DROPPED 2026-04-25
**Release pivot:** superseded by R1-05 (archive index pages) + R1-06 (record detail pages). The "docs-shell + manifest sidebar + tiled landing" pattern collapses into plain semantic HTML lists rendered server-side; no React, no client-side data fetching. Section retained below for historical reference.

**Phase:** Website — Archive Docs · **Status:** 🟡 Planned · **Sessions:** S08a, S08b, S08c

### Outcome
A polished docs-site experience for browsing the archive: persistent collapsible sidebar, breadcrumbs, manifest-driven section list, tiled landing page, and consistent docs-shell wrapping for every existing sub-page.

### Acceptance criteria
- [ ] `app/archive/layout.tsx` renders a sticky sidebar + breadcrumbs + content area on every `/archive/*` route.
- [ ] `<ArchiveSidebar>` renders from manifest data (S06e), not hardcoded.
- [ ] `app/archive/page.tsx` shows a tile per section with label, description, and record count.
- [ ] Every existing `/archive/<section>` page is wrapped in the docs shell (no rebuilds, just wrapping).
- [ ] MUI Card visual pass — Stripe/Vercel docs feel.
- [ ] `pnpm build` green.

### Out of scope
- Generic file-tree browser (Pedro confirmed the docs-site feel is the goal, not Drive-like).

---

# EPIC 9 — Website Activity Detail (S09a–b) — ❌ DROPPED 2026-04-25
**Release pivot:** the per-workout hero + HRZones + Splits + Pace/Effort cards depend on MUI X Charts and a styled component layer that are explicitly deferred to R3 (Visual Identity). For R1, activity records render via the same generic detail-page template (R1-06) as everything else — tabular data, no charts. Charts are reintroduced in R3 with whatever stack R3 picks. Section retained below for historical reference.

**Phase:** Website — Activity Detail · **Status:** 🟡 Planned · **Sessions:** S09a, S09b

### Outcome
The `/sports/[id]` page becomes a useful single-workout view: hero with map + headline stats, HR zone breakdown, splits table, pace zones, and an effort/relative-effort card.

### Acceptance criteria
- [ ] Hero shows `<WorkoutMap>` + distance, duration, avg HR, elevation, pace.
- [ ] `<HRZones>` 5-zone time-in-zone bar chart renders for any real workout (using existing MUI X Charts; no new chart libs).
- [ ] Splits table includes split #, pace, avg HR, elevation gain/loss.
- [ ] Pace/speed zones block + relative-effort card with documented formula.
- [ ] Renders correctly on a 375px viewport (preview; full mobile pass in S19b).

---

# EPIC 10 — Chatbot Backend (S10a–d)
**Phase:** Chatbot — Backend · **Status:** 🟡 Planned · **Sessions:** S10a, S10b, S10c, S10d

### Outcome
A streaming **stateless** task endpoint on the api with a provider abstraction (so Anthropic/OpenAI/open-weight can swap), basic write tools (BP + journal) that set the response-shape contract, basic read tools (health + journal) plus `get_tag_vocabulary`, and a single cross-domain orchestrator (`analyze_wellbeing`).

### Acceptance criteria
- [ ] `POST /chat` streams assistant text via SSE/chunked. Stateless body: `{ messages: [<single user turn>], file?: <multipart>, intent?: <hint> }` — **no `session_id`**, no cross-request state.
- [ ] `LLMProvider` interface in `src/chat/providers/index.ts`; `stub.ts` deterministic provider for tests.
- [ ] `CHAT_PROVIDER` env var (default `stub`).
- [ ] Write tools: `log_blood_pressure`, `create_journal_entry` — both end-to-end (chat → tool_call → archive commit). Each returns the standard response shape `{saved_path, github_url, viewer_url, tags_applied}` and implements identity-based dedup (3-way: all-new / partial-overlap silently merged / full duplicate escalated). Pattern used by every later write tool.
- [ ] Read tools: `query_health_window`, `query_journal`, `get_tag_vocabulary` — return well-formed JSON; `get_tag_vocabulary` reads `writing/identity/tags` for canonical-tag lookups used by every WRITE flow.
- [ ] Orchestrator: `analyze_wellbeing(window_days)` bundles journal + sleep + HRV + HR.
- [ ] Full vitest round-trip per tool.

### Out of scope
- Real LLM provider (S15a).
- Expanded tool surface beyond these five (S14a/b).
- Export tools (S14c).
- Transaction audit log (S15b — replaces the original "conversation persistence" scope).

---

# EPIC 11 — Chatbot Frontend (S11a–c)
**Phase:** Chatbot — Frontend · **Status:** 🟡 Planned · **Sessions:** S11a, S11b, S11c

### Outcome
The `<ChatPanel>` component becomes a **command-bar + result-panel + deliverable-download slot** (not a chat thread). Each task is a single round-trip: input → streaming agent response → final result with confirm flows for writes and download links for exports. No persistent conversation history.

### Acceptance criteria
- [ ] Chat input streams responses via `/api/chat` proxy (server-side bearer-token forwarding).
- [ ] Markdown rendering for assistant prose.
- [ ] **No persistent chat thread.** After each task completes, the input clears for the next task. Optional: in-memory session-only history strip showing the last few tasks for visual context (cleared on page reload, not synced).
- [ ] `<ToolCallCard>` renders inline per tool call within the active task.
- [ ] Read tools render meaningful UI (mini sleep chart for `query_health_window`, entry list for `query_journal`).
- [ ] Write tools render an **editable preview** per domain (lab values table for medical, markdown editor for journal/memory, metadata form for chronology), with Confirm / Cancel buttons. Confirm executes via the api proxy and surfaces the response-shape links (saved_path / github_url / viewer_url) as clickable.
- [ ] Dedup outcomes surfaced: partial overlap shows the breakdown ("added X, skipped Y"); full duplicate shows side-by-side comparison + 3-way choice [Keep existing / Replace / Keep both].
- [ ] Multi-domain split proposal surfaced when one input contains records for multiple domains.
- [ ] Deliverable-download slot in the result panel for EXPORT verb outputs (clickable filename + `.zip` / PDF download).
- [ ] No write tool fires without an explicit Confirm tap.

---

# EPIC 12 — Cross-Repo Docs Sweep (S12)
**Phase:** Close-out · **Status:** 🟡 Planned

### Outcome
Final consistency pass across all four repos before declaring v1 shipped: README + CLAUDE.md fresh in every repo, session-log entries appended for every session that deferred them, branch hygiene confirmed.

### Acceptance criteria
- [ ] Every repo's README mentions `/archive/manifest`, `/chat`, and the post-S01 IA.
- [ ] Every repo's CLAUDE.md reflects current conventions.
- [ ] Session-log entries appended to `pcblueprint-archive/sessions/session-log.{en,pt}.md` for every session from S04a through the current point.
- [ ] Final S12 summary entry lists all sessions with dates + PR URLs.
- [ ] No orphan branches on any of the 4 repos (local + remote).

### Note
Originally scoped to also backfill missing CHANGELOG entries — that work was done inline during the 2026-04-24/25 reconciliation, so S12 only needs to verify consistency, not create.

---

# EPIC 13 — File Upload Pipeline (S13a–b) — *new*
**Phase:** Chatbot — File Upload · **Status:** 🟡 Planned

### Outcome
Pedro can upload binary files (medical PDFs, photos, voice memos, IDML/Word originals) into the archive — via website drop-zones on each section page or via a chat tool that accepts file attachments. Files land in the right `source-files/`, `writing/memories/drafts/`, or `_legacy/` bucket and a git commit lands within seconds.

### User stories
- *As Pedro at the doctor,* I want to drag-drop a PDF onto `/medical` and have it filed under `source-files/medical/` automatically.
- *As Pedro recording a voice memoir on his phone,* I want to attach the `.m4a` to a chat message saying *"save this as a new memoir draft"* and have it land in `writing/memories/drafts/`.

### Acceptance criteria
- [ ] `POST /upload/{bucket}` accepts multipart with file + optional metadata; 50MB max; allowed types: pdf, png, jpg, jpeg, webp, heic, docx, idml, m4a, mp3, wav.
- [ ] Buckets allowlist: `source-files/{medical,sports,writing}`, `writing/memories/drafts`, `_legacy/2026-04-25`.
- [ ] Path traversal guards (reject `../`, sanitise basename).
- [ ] Drop-zone UI on `/medical`, `/memories`, `/journal` with bucket auto-selected by section.
- [ ] Standalone `/upload` page for uncategorised files.
- [ ] Chat tool `attach_file({ filename, base64, bucket, metadata? })` works end-to-end.
- [ ] Vitest: happy path, oversize 413, bad type 415, traversal 400.
- [ ] commitArchive runs on every successful upload with a meaningful message.

### Out of scope
- Server-side virus scanning (defer until needed).
- Image thumbnail generation (manual or later epic).

---

# EPIC 14 — Chatbot Tool Surface (S14a–c) — *new*
**Phase:** Chatbot — Tool Surface · **Status:** 🟡 Planned · **Sessions:** S14a, S14b, S14c

### Outcome
The chat can ingest into, query, and export every active user-data bucket in the archive. Cross-domain orchestrators support the questions that motivated this project ("dad's memories where I'm mentioned", "any chronology event near my hospitalization"). Deliverable-generation tools turn QUERY answers into downloadable PDF / CSV / Markdown / `.zip` artifacts.

### User stories
- *As Pedro,* I want to say *"add a memory about Avó's last birthday tagged 'family' and 'avó'"* and have it written to drafts with the canonical tags applied.
- *As Pedro,* I want to ask *"any of dad's memoirs that mention me"* and get back the relevant passages with cited sources.
- *As Pedro,* I want to ask *"give me everything tagged 'cardio' across journal, medical, and chronology since 2024"* and get a merged timeline.
- *As Pedro,* I want to say *"export my Q1 2026 medical records as a PDF for my doctor"* and get a download link.
- *As Pedro,* I want to upload a blood-test PDF and ask *"is this normal compared to my history"* — the agent saves the new panel (silently deduping prior dates), compares against PDF-embedded reference ranges (or web-searches if absent), and answers with citations.

### Acceptance criteria

**Write tools (S14a) — covers all active user-data buckets, not just five examples:**
- [ ] **`writing/`**: `append_memory({ slug?, name, body_markdown, tags?, author? })` (default author Pedro Canário); `update_identity_context`; `add_identity_pattern`.
- [ ] **`records/`**: `add_blood_test`, `add_medical_note`, `add_medical_exam`, `add_medication`, `add_medical_flag`, `post_blueprint_version`. (S10b already covers `log_blood_pressure`; S14a inherits its response-shape contract.)
- [ ] **`raw/`**: `add_raw_record` (generic raw-bucket write).
- [ ] **`sessions/`**: covered by existing `POST /biography/sessions` from S05b.
- [ ] **Tags**: `add_tag_to_vocabulary` (canonical-tag write).
- [ ] **Chronology**: covered by existing `POST /biography/chronology/events` from S05c.
- [ ] **Likely api gaps to fill in this session** (verify + implement if missing): `PATCH /identity/context`, `POST /identity/patterns`, `POST /identity/tags`, write coverage for medical sub-resources (`/health/medical/notes`, `/exams`, `/medications`, `/flags`), `POST /raw/...`.
- [ ] Every write tool inherits the contract from S10b: standard response shape, identity-based dedup (3-way), auto-tag from canonical vocabulary, multi-domain-split proposal.

**Read tools (S14b):**
- [ ] `query_chronology({ from?, to?, category?, contains? })`.
- [ ] `query_memories({ author?, contains?, tags?, since? })`.
- [ ] `query_blueprint({ version? })`.
- [ ] `query_identity()`.
- [ ] `query_medical({ contains?, since? })`.
- [ ] `web_search(query)` — required by QUERY when comparing fresh inputs (blood tests, etc.) against medical reference values not embedded in source PDFs. Agent prefers PDF-embedded ranges first, falls back to `web_search`.

**Orchestrators (S14b):**
- [ ] `cross_reference({ query, domains?, window? })` — single search across any combination of domains; returns grouped hits with snippets.
- [ ] `timeline_summary({ from, to })` — chronology + journal + sessions + medical + sports merged + deduped.

**Export tools (S14c) — *new*:**
- [ ] `export_to_pdf({ query, scope, options? })` — simple PDF (header: name + date + scope; body; page numbers; footer). Default minimal template; iterate when needed.
- [ ] `export_to_csv({ query, scope })` — flat CSV, descriptive columns, ISO dates. Storage / downstream-tooling format, not for direct human reading.
- [ ] `export_to_markdown({ query, scope })` — concatenated Markdown for printable docs.
- [ ] `bundle_source_files({ query })` — `.zip` of selected source files with per-domain subdirs. Universal compatibility — never `.tar.gz`.
- [ ] `generate_report({ template, scope })` — composite: data + simple chart(s) + commentary, rendered to PDF.
- [ ] Universal filename convention: `<verb>-<scope>-<YYYY-MM-DD>.<ext>` (e.g. `report-hrv-2026-04.pdf`, `bundle-medical-2024.zip`).
- [ ] Deliverables stored at `<archive>/exports/<YYYY-MM>/` with TTL cleanup script (does not pollute user-data buckets).

Each tool has a stub-provider canned phrase + vitest round-trip.

---

# EPIC 15 — Real Chat Provider + Audit Log (S15a–b) — *new*
**Phase:** Chatbot — Real Provider · **Status:** 🟡 Planned

### Outcome
Anthropic's Claude replaces the deterministic stub provider. Default model is **Haiku 4.5** (cheap + fast for simple tasks); router escalates to **Sonnet 4.6** for hard cross-domain or interpretive queries. The system prompt encodes the stateless 3-verb router protocol (WRITE / QUERY / EXPORT) with full bucket knowledge, tool catalog, and citation conventions. A 3-layer cost ceiling makes runaway bills physically impossible. **S15b replaces the original "conversation persistence" scope with a "Transaction Audit Log"** — sqlite log of every chat task (verb, intent, tools called, result, tokens, cost) for debugging and accountability, *not* for chat-history continuity.

### Acceptance criteria

**S15a — provider + system prompt:**
- [ ] `src/chat/providers/anthropic.ts` implements `LLMProvider.generate` streaming both content_block_delta and tool_use events.
- [ ] System prompt encodes the 3-verb task-router protocol: classify intent (WRITE / QUERY / EXPORT) → dispatch to tools → return result with the appropriate response shape (saved-file links / cited answer / deliverable URL).
- [ ] System prompt covers: bucket structure, full tool catalog with usage hints (writes / reads / orchestrators / exports), citation conventions, dedup-contract behavior.
- [ ] `CHAT_PROVIDER=anthropic` requires `ANTHROPIC_API_KEY`; default still `stub` for tests.
- [ ] Model routing: Haiku 4.5 by default; escalation heuristic to Sonnet 4.6 for cross-domain / interpretive queries (per-request decision).
- [ ] **Three-layer cost ceiling:**
  - Per-request: `max_tokens=1024` default, max-iterations cap (≤10 tool calls), hard timeout (~60s).
  - App-level: monthly token-budget guard tracked in a small JSON/sqlite ledger; refuse new `/chat` with 429 at 100% of cap, warn at 80%.
  - Vendor-level: prepaid credits + workspace spend limit set in the Anthropic console (outside the codebase).
- [ ] Real one-shot task: ask *"find me family memories from before 1995"* → assistant calls a read tool, returns prose with cited sources, then `/chat` connection closes (no continuation).

**S15b — Transaction Audit Log (replaces original "Conversation Persistence" scope):**
- [ ] sqlite schema: `transactions(id, ts, verb, intent, tools_called, args, result_summary, error, tokens_in, tokens_out, cost_usd, model)`. Append-only, indexed by date + verb.
- [ ] DB lives at `<archive>/.chat/audit.db` (gitignored).
- [ ] Every `/chat` request writes one row on completion (success or error).
- [ ] Read endpoint `GET /chat/audit?from=&to=&verb=` for ops visibility (no UI in this session).
- [ ] **No conversation-persistence functionality.** The chat is stateless. There is no chat history to retrieve.

### Out of scope
- Multi-provider routing UI (env switch only).
- Token-budget billing UI (the ledger is debug-only for now).
- "Recent activity" frontend view consuming the audit log (defer).

---

# EPIC 16 — Observability & Backup (S16a–b) — *new*
**Phase:** Production — Observability · **Status:** 🟡 Planned

### Outcome
Failures stop being silent. The api alerts on push/pull errors via the same webhook pattern the sync worker already uses. A `/healthz` endpoint exposes archive state for external monitoring. A nightly tarball lands in `/volume2/backups/` for off-NAS recovery.

### Acceptance criteria
- [ ] `src/services/alert.ts` shared by api + sync; payload shape `{ severity, source, message, details }`.
- [ ] `commitArchive()` and the S06a archive puller call `postAlert` on failure.
- [ ] `GET /healthz` (no auth) returns `{ status, version, archive_head, last_commit_at }`.
- [ ] DSM Task Scheduler runs nightly `tar -czf /volume2/backups/archive-YYYY-MM-DD.tar.gz` (excluding `.git/`).
- [ ] 14-day retention on local snapshots.
- [ ] Documented in `pcblueprint-archive/CLAUDE.md`.

### Out of scope
- Cloud (B2/S3/R2) off-NAS sync — flagged as optional follow-up requiring a paid provider decision.

---

# EPIC 17 — Public Deployment (S18a–b) — 🔁 FOLDED 2026-04-25 → R1-08
**Release pivot:** under R1, the archive HTML lives inside the API (server-rendered EJS), so deploying "the website" and "the API" is one operation, not two. S18a (Vercel website deploy) + S18b (DNS / custom domain) collapse into a single R1-08 (Public deploy — Cloudflare tunnel or Fly.io, with custom domain inline). Section retained below for the original framing.

**Phase:** Production — Public Deploy · **Status:** 🟡 Planned · **Hard prereq:** EPIC 19 (Auth Hardening)

### Outcome
The website is reachable from the public internet on a custom domain, served via Vercel, talking to the existing public api (Cloudflare tunnel). Pedro can hit it from cellular, log in, and use everything.

### User story
- *As Pedro on the train,* I want to open the URL on my phone, log in once, then use chat + browse + write — same as on my desktop at home.

### Acceptance criteria
- [ ] Site deployed to Vercel; reachable on the custom domain.
- [ ] Production env vars set (`API_URL` → cloudflared hostname, fresh `COOKIE_SECRET`, `RESEND_API_KEY`, etc.).
- [ ] Cookies + CORS work correctly across the website + api subdomains.
- [ ] SSL provisioned (Cloudflare or Vercel).
- [ ] Verified end-to-end: open on cellular (not home wifi), log in, send a chat message, write a journal entry, see archive commit on GitHub.

### Out of scope (and **non-negotiable hard rule**)
- Deploying with the placeholder `APP_PASSWORD` from `.env.local`. EPIC 19 must land first.

---

# EPIC 18 — Mobile Responsive (S19a–c) — *new*
**Phase:** Production — Mobile UX · **Status:** 🟡 Planned

### Outcome
Every page works comfortably at 375px iPhone width. Sidebar collapses into a drawer; charts and tables reflow; chat input is keyboard-aware.

### Acceptance criteria
- [ ] Hamburger toggle + swipeable Drawer replaces the persistent docs-shell sidebar below 768px.
- [ ] No horizontal scroll on any page at 375px.
- [ ] MUI X Charts on `/sports/[id]`, `/blood-pressure`, `/sleep` reflow responsively.
- [ ] DataGrid swaps to a stacked-card list (`<ResponsiveList>`) below 768px.
- [ ] Chat input pinned to bottom with keyboard-aware padding (visualViewport API).
- [ ] Tool call cards stack full-width and are collapsible by default on mobile.
- [ ] File-attach button inline with text input.
- [ ] Real conversation completed on a phone, including a write-tool confirm flow.

---

# EPIC 19 — Auth Hardening (S20a–c) — 🔁 MOVED 2026-04-25 → R1-01..R1-03
**Release pivot:** the original plan deferred auth to the very end of the arc (S20). The 2026-04-25 pivot pulls it forward — the archive is private from first public deploy, so auth gates everything before R1 ships. S20a→R1-01, S20b→R1-02, S20c→R1-03. Scope is unchanged; only the release tag and ID change. Section retained below for the original framing.

**Phase:** Production — Auth Hardening · **Status:** 🟡 Planned · **Hard blocker:** EPIC 17 (Public Deploy)

### Outcome
The single shared `APP_PASSWORD` is replaced with a real account: argon2id-hashed credentials in sqlite, proper session management, email-based password reset via Resend, an account settings UI, and optional TOTP 2FA. Schema is multi-user-ready even though only one user exists today.

### User stories
- *As Pedro,* I want to change my password from the website without editing env vars.
- *As Pedro,* if I forget my password, I want to receive a reset link by email and recover access without manual intervention.
- *As Pedro,* I want to revoke a session if I log in on a borrowed device and forget to log out.
- *As Pedro,* I want to optionally enable 2FA for a stronger second factor.

### Acceptance criteria
**Core (S20a):**
- [ ] sqlite schema: `users(id, email UNIQUE, password_hash, created_at, last_login_at, totp_secret nullable)`, `sessions(id, user_id, created_at, expires_at, user_agent, ip)`, `password_resets(token UNIQUE, user_id, expires_at)`.
- [ ] argon2id hashing on password write/verify.
- [ ] `scripts/seed-user.ts` bootstraps Pedro's account once.
- [ ] `/api/login`: argon2id verify + httpOnly + secure + sameSite=Lax cookie + 30-day sliding expiration.
- [ ] `/api/logout`: deletes session row, clears cookie.
- [ ] Middleware: every page except `/login` + auth API routes checks session validity.

**Reset (S20b):**
- [ ] Resend integration; `RESEND_API_KEY` env.
- [ ] `/api/auth/request-reset` always returns 200 (no enumeration).
- [ ] `/reset-password?token=...` page accepts new password; complete-reset endpoint invalidates token + all user sessions.

**Settings + 2FA (S20c):**
- [ ] `/account` page: change password, view + revoke active sessions, "sign out everywhere".
- [ ] Optional TOTP via authenticator app; QR provisioning; verified at next login.

### Out of scope
- Multi-user / family sharing.
- WebAuthn / passkeys (defer; can add later as a second factor option).
- SSO providers.

---

# Cross-cutting non-goals

These are intentionally NOT in the roadmap, even if related:

- **Generic file-tree "Drive" UI** — confirmed out of scope; docs-site is the target.
- **Public sharing / anonymous read links** — not needed for v1.
- **Multi-tenant / family accounts** — schema is forward-compatible (Epic 19), but no UI for inviting users.
- **Native mobile apps** — responsive web is the v1 deliverable.
- **Automatic LLM-driven content generation** — the LLM only classifies, routes, parses, and summarises; it does not author memoir or medical text on its own.
- **Conversational chat with persistent history** *(codified 2026-04-25)* — the chat is stateless. Each interaction is one task (WRITE / QUERY / EXPORT); no `session_id`, no cross-request memory, no chat threads, no cross-device sync of conversation state. An audit log of *what the agent did* is kept (S15b), but not *what was said*.
- **Chat writes to system buckets** — `_legacy/`, `meta/`, `scripts/`, `claude-code-prompts/` are off-limits to chat WRITE. Schema-evolving changes belong in code PRs, not natural-language prompts.

---

# Sequencing notes (post-S12 picking order)

After S12 closes out the original 33-session arc, the recommended order for the new epics is:

```
S20 (Auth) ──┐
             ├─→ S18 (Public Deploy)
S19 (Mobile)─┘
S13 (Uploads) ──→ S14 (Tool surface) ──→ S15 (Real provider)
S16 (Observability) — can run any time after S06a/b
```

S20 + S19 are the hard blockers for going public; S13 → S14 → S15 unlocks the chat vision; S16 makes everything maintainable.

---

*Last updated: 2026-04-25 (chat architecture pivot — see runbook 📒 Changelog). Companion runbook: `pcblueprint-checklist_25 april.html`.*
