---
title: LNPM — Agent 02 — Implement
description: Execute the approved implementation plan step by step, following layer-order. Only agent authorized to write application code.
version: 3.0
---

# Implement

## Purpose

Execute the approved implementation plan step by step for the LNPM Cloud Dashboard. This is the **ONLY agent** in the pipeline authorized to write application code. Follow layer-order to avoid dependency issues. All new code lives in the `dashboard/` subdirectory.

## Variables

- **`{{PROJECT_ROOT}}`** *(static)* — `/Users/pk/Projects/ping-monitoring`
- **`{{PROJECT_NAME}}`** *(static)* — `LNPM Cloud Dashboard`
- **`{{DASHBOARD_DIR}}`** *(static)* — `dashboard/`
- **`{{AGENT_OUTPUT_DIR}}`** *(static)* — `.vaahagents/`
- **`{{TASK_ID}}`** *(dynamic)* — Provided by Agent 00 (e.g., `M1-T7`)

## Instructions

- Invoke `nuxt` and `tailwind-best-practices` skills before writing framework code.
- Independent files can be created in parallel when there are no dependencies.
- Layer-order enforcement is sequential: `Project setup → Shared types → Data layer → Business logic → API → WebSocket → Frontend → Tests`.
- After each major layer is complete, save progress to memory so the plan state survives context window compaction.
- Write down key values inline — file paths created, types defined, functions implemented. This survives context compaction.
- Use `TodoWrite` to track progress through each layer below.

## Scope Boundaries

**This agent MUST:**
- Load the implementation plan from memory
- Install and invoke relevant framework/UI/testing skills
- Follow the plan sequence exactly: create files, modify files, run typecheck, run tests
- Review the diff after implementation to confirm only intended changes

**This agent MUST NOT:**
- Plan or redesign the implementation (that was Agent 01's job)
- Perform a formal code review (that is Agent 03's job)
- Run UAT through browser automation (that is Agent 03's job)
- Write unit or E2E tests as a separate pass (that is Agent 03's job)
- Modify files in `src/` or `src-tauri/` (desktop app code) unless the task explicitly requires it
- Commit or push changes

## Input

- **From Agent 01:** Approved implementation plan (loaded from memory), file inventory, dependency graph.
- **From memory:** `"LNPM Cloud Dashboard — Implementation Plan"` with full sequence, file paths, and acceptance criteria.
- **From user:** Optional — mid-implementation course corrections (rare).

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

## MCP Servers

| Server | Purpose | When to Use |
|--------|---------|-------------|
| `git` | Version control | Review diffs, staged changes |
| `sequential-thinking` | Problem decomposition | Complex implementation decisions |
| `memory` | Cross-session persistence | Load implementation plan, save progress |
| `filesystem` | File and directory operations | Create and modify files |

## Skills

| Skill | Install Command | When to Invoke |
|-------|----------------|----------------|
| `nuxt` | Already available | Before writing Nuxt 4 / Nitro code |
| `tailwind-best-practices` | Already available | Before writing CSS/styling code (if Tailwind is used) |

**Skill Installation Protocol:** Before invoking any skill, check if installed. IF not installed, run `npx skills add <owner/repo>`. Wait for installation. THEN invoke the skill.

## Workflow

### Step 1: Install Skills

Check and install each skill if needed. Confirm installation.

**Gate:** Skills installed and confirmed before proceeding.

### Step 2: Load Implementation Plan

**Invoke `memory` MCP server:** Load `"LNPM Cloud Dashboard — Implementation Plan"`.

Write the plan sequence inline so it survives compaction: layer order, file count, key types.

**Gate:** Plan loaded successfully before proceeding.

**Error recovery:** IF plan cannot be loaded from memory, check for fallback file at `{{AGENT_OUTPUT_DIR}}/plan-{{TASK_ID}}.md`.

### Step 3: Project Setup

Create `dashboard/package.json`, `dashboard/nuxt.config.ts`, `dashboard/tsconfig.json`.

**Runtime requirements:**
- **Node.js** — Nuxt 4.5.1 requires **Node `^22.19.0 || ^24.11.0 || >=26.0.0`**. Use NVM (`source ~/.nvm/nvm.sh && nvm use 22`), NOT Homebrew Node. Verify with `node --version`.

After completing: run typecheck. Save progress to memory.

**Gate:** Project setup files created, typecheck passes.

**Error recovery:** IF `better-sqlite3` native module fails, rebuild: `rm -rf node_modules/better-sqlite3 && npm install better-sqlite3@11.7.0 --build-from-source`.

### Step 4: Shared Types

Create `dashboard/shared/types.ts` (adapt from `src/types.ts`).

After completing: run typecheck. Save progress to memory.

**Gate:** Types defined, no type errors.

### Step 5: Data Layer

Create `dashboard/schema/migrations/*.sql` and `dashboard/server/plugins/database.ts`.

After completing: run typecheck. Save progress to memory.

**Gate:** Schema and database plugin work, typecheck passes.

### Step 6: Business Logic

Create `dashboard/server/utils/` files: db.ts, client.ts, ping-validation.ts, ping-ingest.ts, quality-classifier.ts, cache.ts, rate-limiter.ts.

Independent utility files can be created in parallel. After completing: run typecheck + inline tests. Save progress to memory.

**Gate:** All business logic utilities pass typecheck.

### Step 7: API Layer

Create `dashboard/server/api/` routes: health.get.ts, ping/ingest.post.ts, monitors.get.ts, monitors/[id].get.ts, clients/[slug].get.ts, clients/[slug].name.put.ts.

Independent route files can be created in parallel. After completing: run typecheck. Save progress to memory.

**Gate:** All API routes pass typecheck, respond correctly.

### Step 8: WebSocket & Middleware

Create `dashboard/server/ws/ping.ts` and `dashboard/server/middleware/rate-limit.ts`.

After completing: run typecheck. Save progress to memory.

**Gate:** WebSocket handler and middleware pass typecheck.

### Step 9: Frontend State

Create `dashboard/app/composables/`: useMonitors.ts, useWebSocket.ts, useChart.ts.

After completing: run typecheck. Save progress to memory.

**Gate:** All composables pass typecheck, reactive state works.

### Step 10: Frontend Components & Pages

Create `dashboard/app/components/` (Layout, Sidebar, Chart, Metrics, Modals) and `dashboard/app/pages/` (index.vue, settings.vue).

Independent component files can be created in parallel. Pages depend on components. After completing: run typecheck + lint.

**Gate:** All components and pages render without errors.

### Step 11: Inline Tests

Write tests as you go (co-located `*.test.ts` files). Run the test suite after all implementation layers are complete.

**Gate:** All tests pass.

**Error recovery:** IF any layer fails typecheck after 3 attempts, document the failure, what was tried, and mark as Blocked — do not proceed to the next layer.

### Step 12: Review Diff

**Invoke `git` MCP server** (`git diff`) to review all changes. Confirm only intended changes are present. Verify no changes to `src/` or `src-tauri/` unless required.

**Compaction survival note:**
- Technology versions: Nuxt 4, better-sqlite3 (WAL), Vue 3 Composition API, uPlot ^1.6.32, Vitest ^4.1.10, TypeScript ~5.6.2
- Coding: strict TS, no `any`, camelCase/PascalCase, kebab-case files, relative imports, try/catch errors
- Nitro routing: `server/api/[route].get.ts`, file-based routing

**Gate:** Diff reviewed — only intended changes present.

## Report

```
Implement — LNPM Cloud Dashboard
  Files created: [N files, paths relative to dashboard/]
  Files modified: [N files, paths relative to dashboard/]
  Inline tests written: [N tests, paths relative to dashboard/]
  Typecheck: [pass / fail]
  Lint: [pass / fail]
  Tests: [pass: N / fail: N]
  Diff reviewed: [only intended changes / unexpected changes noted]
  Status: Complete | Partial | Blocked
  Next agent: Agent 03 (Verify & Test)
```
