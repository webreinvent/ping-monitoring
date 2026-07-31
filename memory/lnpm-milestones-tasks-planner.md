---
name: lnpm-milestones-tasks-planner
description: AI milestones and tasks planner prompt generated for LNPM Cloud Dashboard
metadata:
  type: project
---

# LNPM Cloud Dashboard — Milestones & Tasks Planner Generated

## Details

- **Generated:** 2026-07-31
- **Output file:** `ai-prompts/prompt-ai-milestones-tasks-planner.md`
- **Project:** LNPM Cloud Dashboard (extending [[lnpm-cloud-dashboard]])

## Milestones & Tasks Status

- **Milestones analyzed:** 0 (no milestones created yet — project at requirements stage)
- **Tasks analyzed:** 0 (no tasks created yet)
- **Milestone directory:** `ai-milestones-and-tasks/` — does not exist yet

## Decision Thresholds

- **Milestone:** 3+ tasks or 2+ weeks, 3+ major features, 2+ database tables, new integration, 5+ distinct tasks
- **Task:** 2–8 hours effort, single feature/component, extends existing milestone
- **Sub-task:** When a task has 3+ distinct implementation steps
- **Backlog:** Deferred to future phase, not current-phase-critical, dependency not met

## Naming Conventions

- **Milestone IDs:** `M{n}` (e.g., `M1`, `M2`)
- **Task IDs:** `M{n}-T{n}` (e.g., `M1-T1`, `M1-T2`)
- **Sub-task IDs:** `M{n}-T{n}-{nn}` (e.g., `M1-T1-01`)
- **Milestone folders:** `milestone-{number}-{slug}/` (e.g., `milestone-01-backend-foundation/`)
- **Task files:** `task-M{milestone}-T{number}-{slug}.md` (e.g., `task-M1-T1-setup-nuxt-project.md`)
- **Feature IDs (requirements):** `F{n}` (e.g., `F1`, `F14`)
- **Feature files:** `feature-{zero-padded-number}-{slug}.md` (e.g., `feature-0001-backend-setup.md`)
- **Slugs:** kebab-case, descriptive

## Status Values

- ⚪ `Not Started` — not yet started
- 🔵 `In Progress` — currently being worked on
- 🟢 `Complete` — finished
- 🟠 `Deferred` — postponed to future
- 🔴 `Cancelled` — cancelled

## Priority Values

`Critical`, `High`, `Medium`, `Low`

## Tech Stack Summary

- **Backend:** Nuxt 4 + Nitro v2 (persistent `node-server` runtime)
- **Frontend:** Nuxt 4 + Vue 3
- **Storage:** SQLite (`better-sqlite3`) with WAL mode
- **Caching:** In-memory LRU cache (no Redis)
- **Real-time:** WebSocket (Nitro native)
- **Charts:** uPlot 1.6.32
- **Language:** TypeScript 5.6.2
- **State:** Pinia
- **Package Manager:** pnpm 11.x
- **Runtime:** Node.js 20+ min / 22 recommended
- **Desktop app (existing):** Tauri 2.11, Rust 1.85, Vite 6, Vitest 4

## Requirements Context

14 features across 3 phases (see [[lnpm-cloud-dashboard-requirements]]):
- MVP: F1-F9 (backend setup through client settings UI)
- Enhancement: F10-F13 (retention, edit name, quality classifier, rate limiting)
- Growth: F14 (health check)

## Related Memories

- [[lnpm-cloud-dashboard]]
- [[lnpm-cloud-dashboard-requirements]]
