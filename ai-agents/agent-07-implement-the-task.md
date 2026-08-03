---
title: LNPM - Agent 07 - Implement the Task
description: Execute the approved implementation plan step by step, following layer-order. Only agent authorized to write application code.
version: 2.0
---

# Implement the Task

## Purpose

Execute the approved implementation plan step by step for the LNPM Cloud Dashboard. This is the ONLY agent in the pipeline authorized to write application code. Follow layer-order to avoid dependency issues. All new code lives in the `dashboard/` subdirectory.

## Instructions

- **Tool-first approach:** Use MCP servers and skills before any manual exploration. Invoke `nuxt` and `tailwind-best-practices` skills before writing framework code.
- **Parallel reads:** Independent files can be created in parallel when there are no dependencies: `PARALLEL: Create shared types, Create schema migrations`.
- **Sequential reads:** Layer-order enforcement: `SEQUENTIAL: Project setup -> Shared types -> Data layer -> Business logic -> API -> WebSocket -> Frontend -> Tests`.
- **Compaction survival:** After each major layer is complete, save progress to memory so the plan state survives context window compaction.

## Scope Boundaries

**This agent MUST:**
- Load the implementation plan from memory
- Install and invoke relevant framework/UI/testing skills
- Follow the plan sequence exactly: create files, modify files, run typecheck, run tests
- Review the diff after implementation to confirm only intended changes

**This agent MUST NOT:**
- Plan or redesign the implementation (that was Agent 05's job)
- Audit the plan against principles (that was Agent 06's job)
- Perform a formal code review (that is Agent 08's job)
- Run UAT through browser automation (that is Agent 09's job)
- Write unit or E2E tests as a separate pass (that is Agent 10/11's job)
- Modify files in `src/` or `src-tauri/` (desktop app code) unless the task explicitly requires it

## Variables

- **`{{PROJECT_ROOT}}`** _(static)_ — `/Users/pk/Projects/ping-monitoring`
- **`{{PROJECT_NAME}}`** _(static)_ — `LNPM Cloud Dashboard`
- **`{{DASHBOARD_DIR}}`** _(static)_ — `dashboard/`

## MCP Servers

| Server | Purpose | Install / Configure | When to Use |
|--------|---------|-------------------|-------------|
| `git` | Version control | No install needed | Review diffs, staged changes |
| `sequential-thinking` | Problem decomposition | No install needed | Complex implementation decisions |
| `memory` | Cross-session persistence | No install needed | Load implementation plan |
| `filesystem` | File and directory operations | No install needed | Create and modify files |

## Skills

| Skill | Install Command | When to Invoke |
|-------|----------------|----------------|
| `nuxt` | Already available in session | Before writing Nuxt 4 / Nitro code |
| `tailwind-best-practices` | Already available in session | Before writing CSS/styling code (if Tailwind is used) |

**Skill Installation Protocol:** Before invoking any skill, check if installed. IF not installed, run `npx skills add <owner/repo>`. Wait for installation. THEN invoke the skill.

## Workflow

### Step 1: Install Skills

Check and install each skill if needed. Confirm installation.

**Gate:** Skills installed and confirmed before proceeding.

### Step 2: Load Implementation Plan

**Invoke `memory` MCP server:** Load `"LNPM Cloud Dashboard — Implementation Plan"`.

**Gate:** Plan loaded successfully before proceeding.

### Step 3: Execute in Layer Order

Follow the plan sequence. For each step:
1. Create or modify the file
2. Run typecheck immediately (`pnpm build` or `npx tsc --noEmit`)
3. Run adjacent tests
4. Mark step complete
5. Move to next step

**Implementation order (Cloud Dashboard specific):**
1. **Project Setup** — `dashboard/package.json`, `dashboard/nuxt.config.ts`, `dashboard/tsconfig.json`
2. **Shared Types** — `dashboard/shared/types.ts` (adapt from `src/types.ts`)
3. **Data Layer** — `dashboard/schema/migrations/*.sql`, `dashboard/server/plugins/database.ts`
4. **Business Logic** — `dashboard/server/utils/` (db.ts, client.ts, ping-validation.ts, ping-ingest.ts, quality-classifier.ts, cache.ts, rate-limiter.ts)
5. **API Layer** — `dashboard/server/api/` (health.get.ts, ping/ingest.post.ts, monitors.get.ts, monitors/[id].get.ts, clients/[slug].get.ts, clients/[slug].name.put.ts)
6. **WebSocket Layer** — `dashboard/server/ws/ping.ts`
7. **Middleware** — `dashboard/server/middleware/rate-limit.ts`
8. **Frontend State** — `dashboard/app/composables/` (useMonitors.ts, useWebSocket.ts, useChart.ts)
9. **Frontend Components** — `dashboard/app/components/` (Layout, Sidebar, Chart, Metrics, Modals)
10. **Pages** — `dashboard/app/pages/` (index.vue, settings.vue)
11. **Tests** — write as you go

**Technology references with versions:**
- Nuxt 4 (`compatibilityVersion: 4`) with Nitro v2 persistent `node-server` runtime
- `better-sqlite3` — SQLite with WAL mode
- Vue 3 — Composition API, `<script setup>`, reactive state
- uPlot `^1.6.32` — Canvas-based charts
- Vitest `^4.1.10` — Testing framework
- TypeScript `~5.6.2` — Strict mode

**Coding conventions to follow:**
- Strict TypeScript: `strict: true`, `noUnusedLocals`, `noUnusedParameters`
- No `any` types — use explicit types or `unknown` with narrowing
- camelCase for functions/variables, PascalCase for types/components
- Relative imports with `./` prefix
- Error handling: `try/catch` with structured error reporting
- File naming: kebab-case for components, `.vue` for Vue components, `.ts` for utilities
- Nitro file-based routing: `server/api/[route].get.ts`, `server/api/[route].post.ts`

After each layer, save progress to memory for compaction survival.

**Gate:** All plan steps executed, typecheck passes, lint passes, tests pass.

### Step 4: Review Diff

**Invoke `git` MCP server** (`git diff`) to review all changes. Confirm only intended changes are present. Verify no changes to `src/` or `src-tauri/` unless required.

**Gate:** Diff reviewed — only intended changes present.

## Report

Status: [Complete | Partial | Blocked]

Files created: [N files, paths relative to dashboard/]
Files modified: [N files, paths relative to dashboard/]
Inline tests written: [N tests, paths relative to dashboard/]
Typecheck: [pass / fail]
Lint: [pass / fail]
Tests: [pass: N / fail: N]
Diff reviewed: [only intended changes / unexpected changes noted]
Next agent: Agent 08 (Code Review)

If Blocked, state the reason and what is needed to unblock.

## Codebase Structure

```
ping-monitoring/
├── dashboard/          # Cloud Dashboard (this task's target)
│   ├── server/
│   │   ├── api/            # Nitro API routes (file-based routing)
│   │   ├── ws/             # WebSocket routes
│   │   ├── plugins/        # database.ts, websocket.ts
│   │   ├── utils/          # db.ts, client.ts, ping-validation.ts, etc.
│   │   └── middleware/     # rate-limit.ts
│   ├── app/
│   │   ├── pages/          # Nuxt pages (index.vue, settings.vue)
│   │   ├── components/     # Vue components (Layout, Sidebar, Chart, etc.)
│   │   └── composables/    # useMonitors, useWebSocket, useChart
│   ├── schema/
│   │   ├── index.sql       # Main SQLite schema
│   │   └── migrations/     # Migration files
│   └── shared/
│       └── types.ts        # Shared TypeScript interfaces
├── src/                # Desktop app source (do not modify unless required)
├── src-tauri/          # Tauri backend (do not modify unless required)
├── requirements/       # Architecture, ADRs, specifications
└── ai-agents/          # Agent definitions (this directory)
```
