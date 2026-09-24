# LNPM Project Context

## Project

- **Name:** LNPM (Live Network Ping Monitor) — `ping-monitoring` repo
- **Description:** Cross-platform live ICMP latency and network stability monitor
- **Author:** xxsLuna
- **License:** MIT
- **Repository:** https://github.com/xxsLuna/LNPM
- **Version (current):** 0.2.2-wri.1

## Monorepo Layout

- **Root** = Tauri v2 desktop client (Rust + TypeScript, pnpm@11.9.0)
- **`dashboard/`** = Nuxt 4 + Nitro cloud dashboard (pnpm@10.4.1, Node ≥20)
- **`pnpm-workspace.yaml`** links them; `allowBuilds: better-sqlite3, esbuild`

## Milestones (as of 2026-09-25)

| ID | Name | Status | Progress |
|---|---|---|---|
| M1 | Backend Platform | 🟢 Complete | 11/12 (M1-T11 data retention file says Complete; dashboard table may be stale) |
| M2 | Dashboard UI | 🟢 Complete | 9/9 |
| M3 | Tauri Client Enhancement | ⚪ Not Started | 0/2 |

**Active milestone: M3** — two tasks:
- `M3-T1` — Match Tauri chart with dashboard (palette, line, thresholds, quality bands)
- `M3-T2` — Fix Tauri slug generation (use last 10 hex MAC chars to match dashboard)

## Feature IDs (F1–F14)

| ID | Feature | Milestone |
|---|---|---|
| F1 | Backend project setup | M1-T1 |
| F2 | Client registration & identity | M1-T5 |
| F3 | Ping data ingest endpoint | M1-T6 |
| F4 | LNPM client sync service | M2-T9 |
| F5 | Monitors list API | M1-T7 |
| F6 | Monitor history API | M1-T8 |
| F7 | WebSocket live broadcast | M1-T9 |
| F8 | Web dashboard UI | M2-T2…T8 |
| F9 | Client settings UI | M2-T7 |
| F10 | Data retention cleanup | M1-T11 |
| F11 | Dashboard client name editing | M2-T6 |
| F12 | Backend quality classifier | M1-T10 |
| F13 | Rate limiting | M1-T12 |
| F14 | Health check endpoint | M1-T4 |

## Git

- **Model:** Gitflow — `develop` (integration), `main` (release), `feature/M{N}-T{M}-{slug}` (short-lived).
- **Base branch for new work:** `develop` (NOT `main`).
- **Commit convention:** `type(scope): [TASK_ID] short description`
  - Examples: `feat(M3-T1): [M3-T1] Match Tauri chart with dashboard`
  - Types: `feat`, `fix`, `refactor`, `chore`, `docs`
- **Branch examples seen in history:** `feature/M1-T6-ping-ingest-endpoint`, `feature/M2-T9-dashboard-ingest-endpoint`
- **CI:** `.github/workflows/ci.yml` — matrix (windows/macos/ubuntu-24.04), pnpm 11.9.0, Node 22, Rust stable.

## Documentation

- `AGENTS.md` — AI-context file (primary, read at session start, append-only)
- `docs/` — architecture, API, database, frontend, middleware, shared, tauri, utils, websocket
- `requirements/` — feature specs F1–F14 + architecture.md + data-models + deployment
- `ai-milestones-and-tasks/` — milestone dashboard + per-task files with status frontmatter
- `ai-prompts/` — task execution prompt (this workflow) + planner prompt
- `ai-base-prompts/` — generator meta-prompts (do not execute these directly)

## Memory

- `memory/MEMORY.md` — index of 40+ memory entries (per-task plans, patterns, lessons learned)
- `memory/*.md` — individual memory files; check for `{{TASK_ID}}` tagged entries at session start

## Known Staleness (check before relying)

- `project-dashboard.md` M1-T11 row may say "Not Started" but the task file says Complete.
- `milestone-01-backend-platform/README.md` frontmatter says "In Progress" while all 12 task files say Complete.
- `memory/lnpm-milestones-plan.md` references 2 milestones / 19 tasks (stale — now 3 milestones / 23 tasks).
- `AGENTS.md` states pnpm v10.4.1 globally — this is stale. Root `package.json` declares `pnpm@11.9.0`; `dashboard/package.json` declares `pnpm@10.4.1`. The prompts in this directory are correct.
