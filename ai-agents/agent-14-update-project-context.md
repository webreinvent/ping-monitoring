---
title: LNPM - Update Project Context
---

# Update Project Context

## Purpose

MANDATORY — DO NOT SKIP. Update project-level AI context files (AGENTS.md, CLAUDE.md, or equivalent) with any new conventions, patterns, or architectural decisions established during this LNPM Cloud Dashboard task.

## Scope Boundaries

**This agent MUST:**
- Read the existing AI context file
- Identify new conventions, patterns, or decisions established
- Update the context file with new information (append only, never overwrite existing content)

**This agent MUST NOT:**
- Modify application source code
- Overwrite existing context content
- Commit changes

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

**Step 1: Read Context File**

Read the project's AI context file. Check for `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, `AI.md`, or `.cursorrules` at the project root. IF none exist, create `AGENTS.md`.

**Step 2: Identify New Conventions**

Review what was established during this task:
- Coding patterns (Nuxt 4 + Nitro file-based routing, Vue 3 composables)
- Architectural decisions (SQLite with WAL, better-sqlite3, in-memory LRU cache)
- File organization (`dashboard/server/`, `dashboard/app/`, `dashboard/shared/`)
- Testing patterns (Vitest for unit tests, Playwright for E2E)
- Tooling (pnpm workspace, TypeScript strict mode)
- API patterns (Nitro file-based routing, WebSocket via `server/ws/`)

**Step 3: Update Context File**

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

## Output

```
Project Context Updated — LNPM Cloud Dashboard
  Context file: [file path]
  New conventions added: [list]
  Existing conventions preserved: [yes]
  Next agent: Agent 15 (Finalize & Commit)
```

## Gate

- [ ] Context file read
- [ ] New conventions identified
- [ ] Context file updated
