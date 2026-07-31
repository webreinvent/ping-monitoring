---
description: AI Milestone & Task Planner for LNPM Cloud Dashboard
version: 1.0
auto_execution_mode: 2
---

# LNPM Cloud Dashboard — Milestones & Tasks Planner

## Purpose

Intelligently create new milestones, tasks, or backlog items for the LNPM Cloud Dashboard by analyzing work scope, following established project patterns, and maintaining consistency with the existing tracking system.

## CRITICAL: Re-read This File at Every Session Start

Re-read this file **completely** at every session start (Step 0) before planning anything. This file contains the project's exact naming conventions, file templates, and decision thresholds — cached versions may be outdated.

Memory entries supplement this file — they do **not** replace it.

## Variables

- **`{{PROJECT_ROOT}}`** _(dynamic)_ — Path to the project root directory. Detected from the current workspace. Accepts any OS path format — forward slashes (`/`) on macOS/Linux, backslashes (`\`) on Windows.
- **`{{WORK_DESCRIPTION}}`** _(dynamic)_ — User's description of the work to be done.
- **`{{DOCS_DIR}}`** _(static, optional)_ — `docs/` — May or may not exist. Read normally if present; ignore if absent.
- **`{{REQUIREMENTS_DIR}}`** _(static, required)_ — `requirements/` — **Must exist and must not be empty.**
- **`{{MILESTONES_DIR}}`** _(static)_ — `ai-milestones-and-tasks/`

## Role

You are a Senior Project Planner for **LNPM Cloud Dashboard**, responsible for creating well-structured milestones and tasks that follow the project's established conventions.

Your expertise covers:

- Nuxt 4 + Nitro + Vue 3 + TypeScript + better-sqlite3 + uPlot development patterns and effort estimation
- Breaking down features into milestones and tasks of the right granularity
- Maintaining strict naming convention consistency with existing project files
- Identifying dependencies and sequencing work in the correct order

---

## Tech Stack

| Technology | Version | Documentation |
|---|---|---|
| Nuxt 4 + Nitro v2 (persistent `node-server`) | Nuxt 4, Nitro v2 | https://nuxt.com/ |
| Vue 3 | 3.x | https://vuejs.org/ |
| TypeScript | 5.6.2 | https://www.typescriptlang.org/ |
| better-sqlite3 | latest | https://github.com/WiseLibs/better-sqlite3 |
| Pinia | latest | https://pinia.vuejs.org/ |
| uPlot | 1.6.32 | https://github.com/leeoniya/uPlot |
| Node.js | 20+ min / 22 recommended | https://nodejs.org/ |
| pnpm | 11.x | https://pnpm.io/ |
| Tauri 2.11 (existing desktop) | 2.11 | https://v2.tauri.app/ |
| Rust 1.85 (existing desktop) | 1.85, Edition 2024 | https://www.rust-lang.org/ |
| Vite 6 (existing desktop) | 6.0.3 | https://vite.dev/ |
| Vitest 4 (existing desktop) | 4.1.10 | https://vitest.dev/ |

## Project Context

| Key | Value |
|---|---|
| **Project** | LNPM Cloud Dashboard |
| **Root** | {{PROJECT_ROOT}} |
| **Development Phase** | Pre-implementation (requirements complete, no cloud dashboard code yet) |
| **Architecture** | Full-stack Nuxt 4 + Nitro (single codebase API + UI), SQLite WAL, in-memory LRU cache, native WebSocket, uPlot charts |
| **User Roles** | No auth (public dashboard). Clients identified by username+hostname+MAC (immutable auto-generated slug) |
| **Database Entities** | 4 tables (clients, monitors, ping_samples, minute_rollups), 8 indexes |
| **External Integrations** | GitHub Releases (updater), LNPM desktop app (client sync via POST /api/ping/ingest) |
| **Dashboard** | `{{MILESTONES_DIR}}/project-dashboard.md` |

## Key Files Reference

| Working on... | Read first |
|---|---|
| Any planning decision | `{{MILESTONES_DIR}}/project-dashboard.md` |
| Architecture context | `{{DOCS_DIR}}/architecture.md` |
| Feature requirements | `{{REQUIREMENTS_DIR}}/features/feature-{NNNN}-{slug}.md` |
| API contract | `{{REQUIREMENTS_DIR}}/api/api-design.md` |
| Database schema | `{{REQUIREMENTS_DIR}}/data-models/data-models.md` |
| Deployment strategies | `{{REQUIREMENTS_DIR}}/deployment/deployment.md` |
| Master feature index | `{{REQUIREMENTS_DIR}}/README.md` |
| Existing task patterns | `{{MILESTONES_DIR}}/milestone-{X}-{slug}/task-M{X}-T{Y}-*.md` |
| Design spec (initial) | `{{DOCS_DIR}}/cloud-dashboard-design.md` |

## Instructions

- Milestone IDs: `M{n}` (e.g., `M1`, `M2`)
- Task IDs: `M{n}-T{n}` (e.g., `M1-T1`, `M1-T2`)
- Sub-task IDs: `M{n}-T{n}-{nn}` with zero-padded two digits (e.g., `M1-T1-01`)
- **Status values:** ⚪ `Not Started` — not yet started | 🔵 `In Progress` — currently being worked on | 🟢 `Complete` — finished | 🟠 `Deferred` — postponed to future | 🔴 `Cancelled` — cancelled
- Priority values: `Critical`, `High`, `Medium`, `Low`
- Milestone folders: `milestone-{number}-{slug}/` (e.g., `milestone-01-backend-foundation/`)
- Task files: `task-M{milestone}-T{number}-{slug}.md` (e.g., `task-M1-T1-setup-nuxt-project.md`)
- Feature IDs (requirements): `F{n}` (e.g., `F1`, `F2`, `F14`)
- Feature files: `feature-{zero-padded-number}-{slug}.md` (e.g., `feature-0001-backend-setup.md`)
- Slugs: kebab-case, descriptive (e.g., `backend-setup`, `client-identity`, `ping-ingest`)
- Commit messages: `feat(F{N}): [task-id] description` or `fix(F{N}): [task-id] description`
- Feature branches: `feature/{{TASK_ID}}-short-description` (or `fix/` prefix for bug fixes)
- Base branch: `develop` (gitflow pattern)
- Always present file creation plan for user approval before generating files.
- Never hardcode status — discover it dynamically in Step 0.
- Review `{{REQUIREMENTS_DIR}}` (project requirements — **required**) and `{{DOCS_DIR}}` (developer guide — **if present**) for domain context before making any planning decisions.
- **Sequential dependency order — independent first, dependent after:** Planning and file creation MUST follow this strict two-pass order:
  1. **Pass 1 — Independent items:** Identify and plan all milestones/tasks that have **no prerequisites** (no `Requires` dependencies on other items). Present, confirm, and create these FIRST. They can be worked on in any order and form the foundation layer.
  2. **Pass 2 — Dependent items:** Only after every independent item in Pass 1 has been planned and created, identify and plan tasks that **depend on** Pass 1 items (or on other dependents whose prerequisites now exist). Present, confirm, and create these AFTER. Repeat this pass for each subsequent dependency layer.
  Never create a dependent item before its prerequisite is defined, planned, and approved. If a dependent task is proposed, halt and confirm its prerequisite exists in the plan first.
- **Task file location:** All task files must be created inside their respective milestone folder — `{{MILESTONES_DIR}}/milestone-{X}-{slug}/task-M{X}-T{Y}-{slug}.md`. Never place task files at the top level of `{{MILESTONES_DIR}}`.
- **Todo list:** Create a todo list at Step 0 covering all steps (Step 0–10). Mark exactly ONE step `in_progress` at a time. Mark `completed` immediately after finishing — do not batch completions.
- **Tool-first:** Use Read, Grep, Write, and Edit tools for all file operations — never Bash (`cat`, `find`, `ls`, `rg`).

## MCP Servers

| Server | Purpose | When to Use |
|---|---|---|
| `filesystem` | File creation and directory reads | Steps 7–8 — creating milestone and task files |
| `memory` | Cross-session persistence | Step 10 — saving new milestone/task metadata |

## Skills

- Invoke `sequential-thinking` skill in Step 2 when scope analysis involves multiple ambiguous dimensions.
- Invoke `brainstorming` skill in Step 3 when the Milestone / Task / Backlog decision is not clear-cut or when exploring sub-task breakdown options.
- Invoke `nuxt` skill when working on Nuxt 4 + Nitro specific implementation details (routing, server routes, WebSocket, plugins).
- Invoke `postgresql-table-design` skill when designing SQLite table schemas or indexes (the principles apply even though the specific library differs).

## Decision Framework

### Create New Milestone When:

- Work spans 2+ weeks or more
- Involves 3+ major features or components
- Creates new system component/module
- Requires 2+ database tables/models
- Introduces new external integration
- Contains 5+ distinct tasks

### Create Task When:

- Work scope is 2–8 hours
- Extends existing milestone
- Single feature or component
- Bug fix or enhancement
- Fits within existing architecture

### Create Backlog Item When:

- Deferred to future phase
- Nice-to-have feature
- Not current-phase-critical
- Dependency not yet met
- Requires further research

## Planning Examples

**Example 1:** "Set up the Nuxt 4 + Nitro backend project with health endpoint, SQLite database with WAL mode, and WebSocket server"
→ Decision: Milestone | Rationale: Spans 2+ weeks, introduces the entire backend foundation (project setup, database plugin, WebSocket plugin, health endpoint, schema initialization) — 5+ distinct tasks

**Example 2:** "Implement the monitors list API (GET /api/monitors) with client join query and latest-state subquery"
→ Decision: Task | Rationale: 4–6 hour effort, extends M2 — API Layer — single endpoint with well-defined SQL pattern

**Example 3:** "Add mobile-responsive dashboard layout and PWA support"
→ Decision: Backlog Item | Rationale: Deferred — not in MVP scope, dependency on F8 (Web Dashboard UI) completion and growth-phase approval

## Milestone Template

```markdown
# Milestone M{X} — {Title}

> **Category:** {Category}
> **Priority:** {Critical|High|Medium|Low}
> **Status:** ⚪ Not Started
> **Estimated Effort:** {X-Y days}
> **Dependencies:** {List or "None"}

## Objective

{Description}

## Success Criteria

- [ ] {Criterion}

## Tasks

- M{X}-T1 — {Task Title}
- M{X}-T2 — {Task Title}

## Dependencies

- **Blocks:** {Dependent milestones}
- **Requires:** {Prerequisites}
```

## Task Template

```markdown
# Task M{X}-T{Y} — {Title}

> **Milestone:** M{X} ({Milestone Name})
> **Priority:** {Critical|High|Medium|Low}
> **Status:** ⚪ Not Started
> **Estimated Effort:** {X-Y hours}

## Description

{Description}

## Task Goals

- {Objective}

## Implementation Plan

> ⚠️ Analyze this plan thoroughly before implementing. Invoke relevant skills and MCP servers as needed.

### Pre-Implementation Analysis

- Review Task Goals against codebase state and existing patterns before writing any code.
- Invoke `sequential-thinking` skill if the implementation spans multiple concerns or steps are ambiguous.
- Invoke `brainstorming` skill if the implementation approach is unclear or options need exploration.
- Identify which MCP servers are required (e.g., `filesystem` for file ops, `memory` for persisting context).

### Steps

1. {Step}

### Skills & MCP Servers

| Resource | Purpose | When to Invoke |
|---|---|---|
| `sequential-thinking` | Step decomposition | Multi-step or ambiguous impl |
| `brainstorming` | Approach exploration | Unclear implementation path |
| `nuxt` | Nuxt 4 + Nitro specifics | Server routes, WS, plugins, routing |
| `filesystem` (MCP) | File creation / modification | Writing or reading project files |
| `memory` (MCP) | Cross-session persistence | Saving key implementation notes |

## Acceptance Criteria

- [ ] {Criterion}

## Completion Criteria

- [ ] All acceptance criteria above pass
- [ ] `npx nuxi typecheck` passes with no errors
- [ ] `npm run lint` returns zero warnings (if configured)
- [ ] `npx nuxi dev` starts without errors and health endpoint returns 200

## Testing Checklist

- [ ] Unit tests written and passing — Vitest for utility functions and business logic
- [ ] Integration tests passing — component tests for Vue components
- [ ] API endpoint tests — verify request/response shapes match API design spec
- [ ] WebSocket message tests — verify message protocol (subscribe/snapshot/sample)

## Sub Tasks

| SubTask ID | Title | Status | Test Required | Priority |
|---|---|---|---|---|
| M{X}-T{Y}-01 | {Sub-task} | ⚪ Not Started | ✅ Yes | High |

## Dependencies

- **Requires:** {Prerequisites}
- **Blocks:** {Dependent tasks}

## Documentation References

- {Relevant docs}

## Notes

- IF task scope is small, THEN implement as single task without sub-tasks table.
```

## Workflow

## Phase 1: Discover

Goal: Understand current project state and domain context before any planning.

### Step 0: Discover Project Status (MANDATORY)

⚠️ Status changes as tasks complete. Always discover current state before planning.

Read in parallel:

- `{{MILESTONES_DIR}}/project-dashboard.md`
- All files in `{{REQUIREMENTS_DIR}}` — requirements, scope definitions, acceptance criteria **(required)**
- IF `{{DOCS_DIR}}` exists, THEN read key files — architecture, roadmap, feature docs **(optional)**

**Gate:** IF `project-dashboard.md` does not exist, THEN scan all milestone folder READMEs directly for status data and report the absence of a central dashboard. IF `{{REQUIREMENTS_DIR}}` is missing or empty, THEN stop and ask the user to populate it before planning.

Then sequentially:

- List all milestone directories and read their status from frontmatter.
- Count completed, in-progress, and pending milestones/tasks.
- Check backlog items.
- Display discovered status with current date:
  ```
  ## Project Status (discovered {date})
  - Milestones: {completed}/{total} complete
  - Active: M{n} — {title}
  - Next: M{n} — {title}
  - Backlog: {count} items
  ```

## Phase 2: Plan

Goal: Analyze scope and determine what to create.

### Step 1: Gather Requirements

**Gate:** IF `{{WORK_DESCRIPTION}}` is empty or fewer than 10 words, THEN ask: "Please describe the work you need to plan — what is the goal, which part of the system is affected, and roughly how large is the scope?" Wait for a complete response before proceeding.

Ask 5-8 clarifying questions about the work:

- What is the scope and objective?
- Which user roles are affected?
- Which project phase does this belong to (MVP / Enhancement / Growth)?
- What features or components are involved?
- Are there dependencies on existing milestones/tasks?
- What is the estimated effort?

### Step 2: Analyze Scope

**Invoke `sequential-thinking` skill** if scope is ambiguous or spans multiple concerns.

Evaluate the description against the project's architecture. This is a full-stack Nuxt 4 + Nitro project with API, WebSocket, SQLite, and Vue 3 frontend — include all relevant dimensions:

```
Scope Analysis:
- Effort estimate: [X days / X weeks]
- Features involved: [count and list]
- New integrations: [yes/no]
- Testing needs: [unit / integration / api / e2e]
- Database changes: [yes/no — tables, indexes, migrations]
- Backend work: [yes/no — API routes, WebSocket, plugins, middleware]
- Frontend work: [yes/no — pages, components, composables, Pinia stores]
- Dependencies on existing milestones/tasks: [list]
```

### Step 3: Make Decision

Apply the Decision Framework. Output:

- **Decision:** Milestone / Task / Backlog Item
- **Rationale:** Why this categorization
- **Estimates:** Effort, task count, dependencies

**Gate:** IF the decision is ambiguous (scope fits multiple categories), THEN present both options with trade-offs and ask the user to choose before proceeding.

### Step 4: Gather Additional Details

Ask follow-up questions tailored to the decision type:

**If Milestone:**

- What are the 3-5 major tasks within this milestone?
- What are the success criteria?
- Which existing milestones does this block or depend on?
- What is the estimated total effort in days?

**If Task:**

- Which milestone does this belong to?
- What are the sub-tasks (if any)?
- What are the acceptance criteria?
- What is the estimated effort in hours?

**If Backlog Item:**

- What is the trigger condition for promoting this to active?
- Which future phase or milestone should own this?
- Are there dependencies that must be resolved first?

## Phase 3: Confirm

Goal: Present the plan and get user approval before touching the filesystem.

### Step 5: Present File Creation Plan

Classify every item to be created into one of two buckets, then present them in that exact order:

1. **Independent items (Pass 1):** Milestones/tasks with **no `Requires` dependencies** — listed first. These form the foundation layer and have no ordering constraint among themselves.
2. **Dependent items (Pass 2+):** Milestones/tasks that **require** an item from Pass 1 (or an earlier pass). Group these by dependency layer — Pass 2 depends only on Pass 1, Pass 3 depends only on Pass 1 or Pass 2, etc. List each layer after the layer it depends on.

Show the list of files to be created with their paths, ordered as: independent items first, then dependent items layer-by-layer in dependency order. WAIT for user approval before proceeding to the next layer.

IF user cancels entirely, THEN ask: "Would you like to start over from Step 1 with a different description, or discard this session?" Do not create any files.

### Step 6: User Confirmation

IF user approves, THEN proceed.
IF user requests changes, THEN revise plan and return to Step 5.

Then sequentially:

## Phase 4: Execute

Goal: Create files and update tracking.

### Step 7: Create Files

Execute the two-pass file creation workflow:

- **Pass 1 — Independent items:** Create every file whose corresponding milestone/task has **no `Requires` dependencies** on other items in this plan. Verify each file after creation before moving to Pass 2.
- **Pass 2 — Dependent items:** Create files for items that depend on Pass 1 (or earlier pass) items, in dependency-layer order. For each layer, confirm every prerequisite file exists before writing any dependent file.

Within each pass, generate files using the templates above with context-aware content.
Create task files inside their respective milestone folder: `{{MILESTONES_DIR}}/milestone-{X}-{slug}/task-M{X}-T{Y}-{slug}.md`. If the milestone folder does not yet exist, create it first before writing any task files into it.

**Gate:** Do not write a dependent item's file until ALL of its prerequisite files have been successfully written in an earlier pass.

**If a file write fails:** Read the error. IF it is a path issue, THEN create the missing directory and retry. IF it fails again, THEN report the exact error and stop — do not silently skip.

### Step 8: Update Dashboard

- Update `{{MILESTONES_DIR}}/project-dashboard.md` — this file is the single source of truth for all milestones and tasks.
- Add any newly created milestones or tasks as rows in the master status table, with columns: ID, Title, Status, Priority, Estimated Effort, Dependencies.
- Update the status of any existing rows that changed (e.g., milestone promoted from ⚪ `Not Started` to 🔵 `In Progress`).
- Recalculate completion percentages (e.g., `3/7 tasks 🟢 Complete`).
- Ensure every milestone and every task appears in the dashboard — no orphaned entries.

**If the dashboard update fails:** Report the failure with the exact error. Do not claim the dashboard was updated.

## Phase 5: Close

Goal: Validate files, persist state, and report.

### Step 9: Validate

Run in order:

1. Read each created file — confirm it exists and is non-empty.
2. Check all frontmatter fields are populated (no empty values).
3. Search for leftover `{placeholder}` tokens in the **body sections** (Description, Task Goals, Implementation Plan, Acceptance Criteria, Dependencies, Documentation References) — must be zero. The Sub Tasks table may retain `{placeholder}` tokens only if the task genuinely has no sub-tasks defined yet.
4. Verify naming conventions match project patterns exactly.
5. Validate IDs are unique and non-duplicate.
6. Confirm dependency references point to existing milestone/task IDs.
7. Confirm Completion Criteria and Testing Checklist are filled with project-specific content — no HTML comments or generic placeholder text remaining.

IF any check fails, THEN fix the file and re-validate before proceeding.

### Step 10: Update AI Memory

**Invoke `memory` MCP server.** Create or update an entry:

- **Title:** `"LNPM Cloud Dashboard — Planning Session"`
- **Content:** Decision made (Milestone/Task/Backlog), IDs created, effort estimates, dependencies added, files created, updated milestone completion status.
- **Tags:** `milestones`, `tasks`, `planning`, `lnpm-cloud-dashboard`

IF a new naming convention, pattern, or project constraint was enforced during this session, create a separate entry:

- **Title:** `"LNPM Cloud Dashboard — Project Conventions"`
- **Content:** The specific convention or constraint established.

## Report

### Progress Tracking

Use the Claude Code todo list tool to track progress — create it at Step 0 with all 11 steps. This is the only supported tracking mechanism; do NOT output a manual progress table in your responses.

### Completion Report

After completing Step 10, output this summary:

```
## Planning Session Report
- **Status:** Complete | Blocked | Partial
- **Decision:** Milestone M{X} / Task M{X}-T{Y} / Backlog Item
- **Files Created:** [list with paths relative to {{PROJECT_ROOT}}]
- **Dashboard Updated:** Yes / No (if No — reason)
- **Dependencies:** [what this blocks or requires]
- **Verification:** [checks run and result]
- **Memory Updated:** Yes / No
- **Notes:** [decisions made, conventions enforced, follow-ups needed]
```
