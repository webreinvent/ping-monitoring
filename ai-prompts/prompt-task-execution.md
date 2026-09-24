---
description: Execute LNPM development tasks
version: 1.0
auto_execution_mode: 3
generated_by: task-execution-generator@2.13
generated_at: 2026-09-25
---

# LNPM Task Execution Prompt

## Purpose

Implement LNPM development tasks by loading per-step instructions on-demand from `{{STEPS_DIR}}/step-{NN}-{slug}.md`. This file is the orchestrator — each step's detailed instructions live in its file, loaded one at a time.

LNPM is a pnpm monorepo with two stacks:
- **Root** — Tauri v2 desktop client (Rust + TypeScript, uPlot charts, system ping shell-out)
- **`dashboard/`** — Nuxt 4 + Nitro cloud dashboard (Vue 3, better-sqlite3, ws WebSocket, uPlot, Playwright E2E)

## Variables

- **`{{TASK_ID}}`** _(dynamic)_ — Task ID from the milestone tracker (e.g., `M3-T1`).
- **`{{FEATURE_BRANCH}}`** _(dynamic)_ — Git branch. Pattern: `feature/{{TASK_ID}}-short-description` (gitflow, base = `develop`).
- **`{{MILESTONES_DIR}}`** _(static)_ — `ai-milestones-and-tasks/`
- **`{{DOCS_DIR}}`** _(static)_ — `docs/`
- **`{{REQUIREMENTS_DIR}}`** _(static)_ — `requirements/`
- **`{{PROMPT_FILE_PATH}}`** _(static)_ — `ai-prompts/prompt-task-execution.md`
- **`{{STEPS_DIR}}`** _(static)_ — `ai-prompts/prompt-task-execution-steps/` — step files + reference files

---

## How to Follow This Workflow

1. **Read this file completely** to understand the orchestrator.
2. **Read the WORKFLOW table below** to identify the current step from your TodoWrite list.
3. **Load ONLY the current step file** from `{{STEPS_DIR}}/step-{NN}-{slug}.md`.
4. **Follow ONLY the loaded step's instructions exactly** — do not proceed to the next step.
5. **When the current step is complete**, return here, load the NEXT step file in sequence.
6. **Never load multiple step files at once.**

**Strict sequential execution:** Complete each step before moving to the next. Never skip steps.
**Reference files:** Load `{{STEPS_DIR}}/reference-{topic}.md` when a step instructs you to.

---

## Instructions (Global — Applies to All Steps)

### Re-read Rule

- IF this is a new session OR `{{TASK_ID}}` has changed, THEN re-read this file **completely**. This file wins over memory cache.

### Tool-First Rule

- Use **Read** for files (never `cat`/`head`/`tail`), **Edit** for modifications (never `sed`/`awk`), **Write** for new files (never `echo >`), **Glob/Grep** for search (never `find`/`ls`/`rg`). Use **Bash** only for actual shell operations (running tests, git commands, cargo).

### LNPM Patterns

- **Monorepo awareness:** The project has two independent stacks. ALWAYS determine which stack(s) the task touches before implementing. Dashboard tasks live in `dashboard/`; Tauri tasks live in `src/` and `src-tauri/`. Cross-stack tasks (e.g., new API endpoint + dashboard UI) touch both.
- **Package manager:** pnpm. Use `pnpm install` (never `npm install`). The root `package.json` has `packageManager: pnpm@11.9.0`; the dashboard has `packageManager: pnpm@10.4.1`.
- **Dashboard commands:** `cd dashboard && pnpm dev` (port 3000), `pnpm test` (vitest), `pnpm test:e2e` (playwright), `pnpm typecheck` (nuxt typecheck), `pnpm build`.
- **Root (Tauri) commands:** `pnpm dev` (vite port 1420), `pnpm build` (tsc && vite build), `pnpm test` (vitest), `pnpm tauri` (tauri CLI).
- **Rust commands:** `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets --all-features -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml --locked`.
- **No ESLint/Biome/Prettier** for TypeScript. Quality gate is `tsc` (root) + `nuxt typecheck` (dashboard) + `cargo fmt`/`cargo clippy` (Rust). Do NOT add linter configs.
- **CSS:** Dashboard uses plain scoped CSS with design tokens (`dashboard/app/assets/css/dashboard.css`, `charts.css`). No Tailwind, no PrimeVue. Tauri frontend uses `src/styles.css`.
- **Charts:** uPlot (`^1.6.32`) in both stacks. Dashboard uses uPlot Qual plugin for quality bands, Point plugin for thresholds.
- **Database (dashboard):** better-sqlite3 with WAL mode. Access via `getDb()` from `~/server/utils/db` — never import the plugin directly. Migrations in `dashboard/schema/migrations/` (numbered, 3-digit prefix).
- **WebSocket (dashboard):** Nitro native `defineWebSocketHandler` in `server/routes/ws/`. Enabled via `nitro.experimental.websocket: true`.
- **Shared types (dashboard):** `dashboard/shared/types.ts` — client-server contract. Import explicitly (Nuxt auto-import does NOT work for type-only exports).
- **Server utilities (dashboard):** `dashboard/server/utils/` — business logic. Nitro plugins in `server/plugins/` — startup/shutdown. Middleware in `server/middleware/` — auto-runs before routes.
- **API routes (dashboard):** File-based in `server/api/` (e.g., `health.get.ts` → `GET /api/health`). Use `defineEventHandler`, return structured JSON, wrap in try/catch.
- **Vue components (dashboard):** `<script setup lang="ts">` (Composition API), `useHead()` for titles, `data-testid` attributes for E2E hooks, scoped CSS with semantic HTML.
- **Tauri frontend:** Plain TypeScript in `src/`, no Vue/React. Uses `@tauri-apps/api` for IPC. uPlot for charts.
- **Rust (Tauri):** Ping via system shell-out (`SystemPingProbe`), `rusqlite` for local DB, `tokio` async runtime, `reqwest` for HTTP.
- **Git:** Gitflow — base branch is `develop` (not `main`). Feature branches: `feature/M{N}-T{M}-{slug}`. Commits: conventional with milestone scope, e.g., `feat(M3-T1): [M3-T1] Add chart match feature`.
- **AGENTS.md:** The AI-context file at project root. 450+ lines of conventions, ADRs, and patterns. Read it at session start. Append new conventions to the appropriate section — do NOT rewrite existing content.
- **Milestone tracking:** Tasks defined in `ai-milestones-and-tasks/milestone-{NN}-{name}/`. Status tracked via `> **Status:**` frontmatter in each task file. Dashboard at `ai-milestones-and-tasks/project-dashboard.md`.
- **Testing:** Vitest for unit/integration (both stacks), Playwright for dashboard E2E only. Root vitest uses `include: ["**/*.test.ts"]`. Dashboard vitest uses `setupFiles: ["./test/setup.ts"]` and mocks better-sqlite3 (native module crashes forked workers).
- **Env vars:** Dashboard uses 19 env vars (see `dashboard/.env.example`). Always validate before using as numbers. Key: `DATABASE_PATH`, `LOG_LEVEL`, `PORT`, `INGEST_MAX_SAMPLES`.

### Blast Radius

- File edits and test runs are freely taken — no confirmation needed.
- Git pushes, branch deletions, and deploys require user confirmation — each independently.
- Modifying `schema/migrations/` (database schema) requires user confirmation before applying.
- Modifying `src-tauri/tauri.conf.json` (Tauri config, updater endpoints, CSP) requires user confirmation.

### Faithful Reporting

- Report failures honestly — do not claim success on failing tests.
- Label unverifiable items `manual-verified` in the Report.
- Never suppress failures to manufacture a green result.
- When a task touches both stacks, report test results per stack separately.

> **Context recovery:** If compacted, read the TodoWrite list to find the last `completed` step. Load `memory` MCP entry for `"LNPM — {{TASK_ID}} Implementation Plan"`. Resume from the next `pending` step.

---

## Workflow

Load `{{STEPS_DIR}}/step-{NN}-{slug}.md` for each step. Follow it exactly. Never load multiple.

| Phase                              | Steps | Step Files                         |
| ---------------------------------- | ----- | ---------------------------------- |
| **Phase 1: Orientation**           | 0–2   | `step-00` → `step-02`             |
| **Phase 2: Preparation & Planning**| 3–8   | `step-03` → `step-08`             |
| **Phase 3: Execution**             | 9–13  | `step-09` → `step-13`             |
| **Phase 4: Completion**            | 14–18 | `step-14` → `step-18`             |

---

## Report

```
## Task Completion Report
- **Task:** {{TASK_ID}} — [Task title]
- **Branch:** {{FEATURE_BRANCH}}
- **Stack:** [Dashboard | Tauri | Cross-stack]
- **Status:** 🟢 Complete | 🔵 Blocked | 🟠 Partial
- **Changes:** [List of files created/modified]
- **Tests:** [Pass/Fail count + commands run, per stack]
- **Verification:** [What was verified vs `manual-verified`]
- **Memory Updated:** [List of entries]
- **Notes:** [Decisions, patterns, follow-ups, skipped steps with justification]
```

## Progress Tracker (TodoWrite)

At the start of each task (Step 0), invoke **TodoWrite** with the full step list. This survives compaction.

**Rules:** Only ONE step `in_progress` at a time. Mark `completed` immediately. Never batch. Add sub-tasks for complex steps (e.g., `step-09a`).

**Invoke TodoWrite at Step 0 with this data:**

```json
[
  { "id": "step-00", "content": "Step 0: Load Session Context", "activeForm": "Loading session context", "status": "in_progress" },
  { "id": "step-01", "content": "Step 1: Select Next Task", "activeForm": "Selecting next task", "status": "pending" },
  { "id": "step-02", "content": "Step 2: Create Feature Branch", "activeForm": "Creating feature branch", "status": "pending" },
  { "id": "step-03", "content": "Step 3: Understand Task Scope", "activeForm": "Understanding task scope", "status": "pending" },
  { "id": "step-04", "content": "Step 4: Research Required Technologies", "activeForm": "Researching required technologies", "status": "pending" },
  { "id": "step-05", "content": "Step 5: Analyze Related Code", "activeForm": "Analyzing related code", "status": "pending" },
  { "id": "step-06", "content": "Step 6: Plan UI/UX Design", "activeForm": "Planning UI/UX design", "status": "pending" },
  { "id": "step-07", "content": "Step 7: Create Implementation Plan", "activeForm": "Creating implementation plan", "status": "pending" },
  { "id": "step-08", "content": "Step 8: Audit & Present Plan", "activeForm": "Auditing and presenting plan", "status": "pending" },
  { "id": "step-09", "content": "Step 9: Implement the Task", "activeForm": "Implementing the task", "status": "pending" },
  { "id": "step-10", "content": "Step 10: Code Quality & Principles Audit", "activeForm": "Running code quality audit", "status": "pending" },
  { "id": "step-11", "content": "Step 11: Automated UAT & Bug Fixes", "activeForm": "Running automated UAT and bug fixes", "status": "pending" },
  { "id": "step-12", "content": "Step 12: Write Unit and Integration Tests", "activeForm": "Writing unit and integration tests", "status": "pending" },
  { "id": "step-13", "content": "Step 13: Write E2E Tests", "activeForm": "Writing E2E tests", "status": "pending" },
  { "id": "step-14", "content": "Step 14: Propagate Impact to Upcoming Tasks", "activeForm": "Propagating impact to upcoming tasks", "status": "pending" },
  { "id": "step-15", "content": "Step 15: Update AI Memory & Cache", "activeForm": "Updating AI memory and cache", "status": "pending" },
  { "id": "step-16", "content": "Step 16: Update Tracking & Generate Docs", "activeForm": "Updating tracking and generating docs", "status": "pending" },
  { "id": "step-17", "content": "Step 17: Update Project Context Files", "activeForm": "Updating project context files", "status": "pending" },
  { "id": "step-18", "content": "Step 18: Completion Audit & Git Commit", "activeForm": "Running completion audit and committing", "status": "pending" }
]
```

**Transition:** Mark current step `in_progress` → complete → move to next `pending`.
**Recovery:** Read todo list after compaction — resume from next `pending` step.
