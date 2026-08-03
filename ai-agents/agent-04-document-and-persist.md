---
title: LNPM — Agent 04 — Document & Persist
description: Update AI memory, generate technical documentation, and update project-level AI context files
version: 3.0
---

# Document & Persist

## Purpose

Persist session knowledge to the memory MCP server, generate technical documentation for all new components and patterns, and update project-level AI context files. This reduces ramp-up time and prevents repeating mistakes for future sessions.

## Instructions

- Use the `memory` MCP server as the primary tool for all memory operations.
- Use `filesystem` MCP server to read source code and write docs.
- Use `git` MCP server to review changes before writing.
- Load existing memory and context before writing to ensure updates augment rather than duplicate.
- This agent is **read-only for project source files** — only writes to memory, docs, and context files.

## Scope Boundaries

**This agent MUST:**
- Load existing memory entries to avoid duplication
- Save patterns established, decisions made, lessons learned, and task summary to memory
- Generate documentation for new components, composables, utilities, API patterns, or architectural decisions
- Update project-level AI context files (AGENTS.md, CLAUDE.md, or equivalent) with new conventions

**This agent MUST NOT:**
- Modify any application source code
- Update task tracking or milestone status (that is Agent 05's job)
- Commit changes

## Variables

- **`{{PROJECT_NAME}}`** *(static)* — `LNPM Cloud Dashboard`
- **`{{PROJECT_ROOT}}`** *(static)* — `/Users/pk/Projects/ping-monitoring`
- **`{{DOCS_DIR}}`** *(static)* — `docs/`
- **`{{AGENT_OUTPUT_DIR}}`** *(static)* — `.vaahagents/`
- **`{{CONTEXT_FILE}}`** *(static)* — `AGENTS.md` (or `CLAUDE.md` / `CONTEXT.md` / `.cursorrules` if present)

## Codebase Structure

```
ping-monitoring/
├── AGENTS.md                   # Project-level AI context (primary target)
├── docs/                       # Technical documentation (target directory)
├── ai-agents/                  # Agent definitions (this file's siblings)
├── ai-milestones-and-tasks/    # Milestone and task tracking
└── dashboard/
    ├── app/                    # Vue 3 pages, components, composables
    ├── server/                 # Nitro API routes, WebSocket, utils
    ├── shared/                 # TypeScript types shared between server/client
    └── schema/                 # SQLite migrations and schema
```

## MCP Servers

| Server | Purpose | When to Use |
|--------|---------|-------------|
| `memory` | Cross-session persistence | Load existing entries, save new knowledge |
| `filesystem` | File read/write | Read source code, write docs, update context files |
| `git` | Version control | Review changes for context |
| `sequential-thinking` | Problem decomposition | Complex decisions |

## Workflow

### Phase A: Update AI Memory

#### Step A1: Load Existing Memory

**Invoke `memory` MCP server** to check if any existing entries for LNPM Cloud Dashboard are present. This ensures updates augment rather than duplicate existing knowledge.

**Gate:** Existing memory reviewed before creating or updating entries.

#### Step A2: Save Session Knowledge

**Invoke `memory` MCP server** to create or update:

- `"LNPM Cloud Dashboard — Patterns Established"`: New patterns, components, or abstractions established during this task (e.g., Nuxt 4 + Nitro route patterns, Vue 3 composable patterns, uPlot integration in Vue, database plugin pattern).
- `"LNPM Cloud Dashboard — Decisions Made"`: Architectural or implementation decisions and rationale (e.g., technology choices, design patterns, ADR references).
- `"LNPM Cloud Dashboard — Lessons Learned"`: Errors encountered, root causes, and fixes applied during this task.
- `"LNPM Cloud Dashboard — Task Complete"`: Summary of what was done, files changed, test results, and task ID.

**Gate:** All four memory entries created or updated.

### Phase B: Generate Documentation

#### Step B1: Determine Scope

Review what was implemented during this task. IF this task introduced new components, composables, utilities, API patterns, or architectural decisions, identify documentation targets:

- New API endpoints — document request/response shapes, error codes
- New database tables or migrations — document schema, indexes
- New Vue components — document props, events, slots
- New composables — document parameters, return values, reactivity
- New utilities — document function signature, inputs, outputs
- WebSocket protocol — document subscription model, message shapes

Each doc includes: purpose, API/parameters, usage example, integration notes, edge cases.

**Gate:** Scope determined, documentation targets identified.

#### Step B2: Write Documentation

**Invoke `filesystem` MCP server** to create or update documentation files in `docs/`. Follow the existing documentation convention if one exists. Code snippets must be copy-pasteable and reflect actual code.

**Gate:** All docs written, code snippets verified against actual source code.

### Phase C: Update Project Context

#### Step C1: Read Context File

Read the project's AI context file. Check for `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, `AI.md`, or `.cursorrules` at the project root. IF none exist, create `AGENTS.md`.

**Gate:** Context file located and read before proceeding.

#### Step C2: Identify New Conventions

Review what was established during this task:
- Coding patterns (Nuxt 4 + Nitro file-based routing, Vue 3 composables)
- Architectural decisions (SQLite with WAL, better-sqlite3, in-memory LRU cache)
- File organization (`dashboard/server/`, `dashboard/app/`, `dashboard/shared/`)
- Testing patterns (Vitest for unit tests, Playwright for E2E)
- API patterns (Nitro file-based routing, WebSocket via `server/ws/`)

**Gate:** New conventions identified and differentiated from existing context.

#### Step C3: Update Context File

**Invoke `filesystem` MCP server** to append new conventions. Only add new information — do not overwrite existing content.

```markdown
## LNPM Cloud Dashboard — New Conventions (YYYY-MM-DD)

### Dashboard Directory Structure
- `dashboard/server/` — Nitro API routes, WebSocket, plugins, utils
- `dashboard/app/` — Vue 3 pages, components, composables
- `dashboard/shared/` — TypeScript types shared between server and client
- `dashboard/schema/` — SQLite migrations and schema

### Technology Stack
- Nuxt 4 + Nitro v2 (persistent node-server runtime)
- better-sqlite3 with WAL mode
- Vue 3 Composition API
- uPlot for charts
- Vitest for unit/integration tests
- Playwright for E2E tests

### Coding Conventions
- [Add any new conventions established]
```

**Gate:** Context file updated with append-only changes, existing content preserved.

## Report

```
Document & Persist — LNPM Cloud Dashboard
  Memory:
    Patterns: [saved / updated / skipped — reason]
    Decisions: [saved / updated / skipped — reason]
    Lessons: [saved / updated / skipped — reason]
    Task summary: [saved / updated / skipped — reason]
  Documentation:
    Docs created: [list with paths, or "none"]
    Docs updated: [list with paths, or "none"]
    New patterns documented: [list, or "none"]
  Project Context:
    Context file: [file path, e.g., AGENTS.md]
    New conventions added: [list, or "none"]
    Existing conventions preserved: [yes]
  Status: Complete | Partial | Blocked
  Next agent: Agent 05 (Finalize & Commit)
```
