---
title: LNPM - Agent 14 - Update Project Context
description: Update project-level AI context files with new conventions, patterns, and decisions established during the LNPM Cloud Dashboard task.
version: 2.0
---

# Update Project Context

## Purpose

MANDATORY — DO NOT SKIP. Update project-level AI context files (AGENTS.md, CLAUDE.md, or equivalent) with any new conventions, patterns, or architectural decisions established during this LNPM Cloud Dashboard task.

## Instructions

- **Tool-first approach:** Use `memory` MCP server to load session knowledge, `filesystem` MCP server to read and update context files, and `git` MCP server to review changes.
- **Parallel reads:** There are no parallel steps — this agent has a sequential read-identify-write workflow.
- **Sequential reads:** Step 1 (Read Context File) must complete before Step 2 (Identify New Conventions), which must complete before Step 3 (Update Context File).
- **Compaction survival:** If the context window is nearing capacity, prioritize Step 3 (Update Context File) — the actual file update is the critical deliverable.

## Scope Boundaries

**This agent MUST:**
- Read the existing AI context file
- Identify new conventions, patterns, or decisions established
- Update the context file with new information (append only, never overwrite existing content)

**This agent MUST NOT:**
- Modify application source code
- Overwrite existing context content
- Commit changes

## Codebase Structure

```
ping-monitoring/
  AGENTS.md                   # Project-level AI context (primary target)
  CLAUDE.md                   # Alternative context file
  CONTEXT.md                  # Alternative context file
  .cursorrules                # Alternative context file
  ai-agents/                  # Agent definitions (this file's siblings)
  ai-milestones-and-tasks/    # Milestone and task tracking
    project-dashboard.md      # Project-level task dashboard
  dashboard/
    app/                      # Vue 3 pages, components, composables
    server/                   # Nitro API routes, WebSocket, utils
    shared/                   # TypeScript types shared between server/client
    schema/                   # SQLite migrations and schema
```

## Variables

- **`{{PROJECT_NAME}}`** _(static)_ — `LNPM Cloud Dashboard`
- **`{{PROJECT_ROOT}}`** _(static)_ — `/Users/pk/Projects/ping-monitoring`
- **`{{CONTEXT_FILE}}`** _(static)_ — `AGENTS.md` (or `CLAUDE.md` / `CONTEXT.md` / `.cursorrules` if present)

## MCP Servers

| Server | Purpose | Install / Configure | When to Use |
|--------|---------|-------------------|-------------|
| `filesystem` | File read/write | No install needed | Read and update context files |
| `memory` | Cross-session persistence | No install needed | Load session knowledge |
| `git` | Version control | No install needed | Review changes |
| `sequential-thinking` | Structured problem decomposition | No install needed | Complex decisions |

## Skills

No skills required for this agent.

## Workflow

### Step 1: Read Context File

Read the project's AI context file. Check for `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, `AI.md`, or `.cursorrules` at the project root. IF none exist, create `AGENTS.md`.

**Gate:** Context file located and read before proceeding.

### Step 2: Identify New Conventions

Review what was established during this task:
- Coding patterns (Nuxt 4 + Nitro file-based routing, Vue 3 composables)
- Architectural decisions (SQLite with WAL, better-sqlite3, in-memory LRU cache)
- File organization (`dashboard/server/`, `dashboard/app/`, `dashboard/shared/`)
- Testing patterns (Vitest for unit tests, Playwright for E2E)
- Tooling (pnpm workspace, TypeScript strict mode)
- API patterns (Nitro file-based routing, WebSocket via `server/ws/`)

**Gate:** New conventions identified and differentiated from existing context before proceeding.

### Step 3: Update Context File

**Invoke `filesystem` MCP server** to append new conventions. Only add new information — do not overwrite existing content. Structure the update as:

```markdown
## LNPM Cloud Dashboard — New Conventions (2026-08-01)

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

Provide a concise report of the context update:

```
Project Context Updated — LNPM Cloud Dashboard
  Context file: [file path, e.g., AGENTS.md]
  New conventions added: [list, or "none"]
  Existing conventions preserved: [yes]
  Status: [Complete | Partial | Blocked]
  Next agent: Agent 15 (Finalize & Commit)
```

- **Complete:** Context file read, new conventions identified, and file updated successfully.
- **Partial:** Context file updated but some conventions could not be identified (with reason).
- **Blocked:** Cannot read or write context file (e.g., filesystem unavailable).
