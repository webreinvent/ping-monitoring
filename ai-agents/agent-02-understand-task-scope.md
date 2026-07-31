---
title: LNPM - Agent 02 - Understand Task Scope
---

# Understand Task Scope

## Purpose

Read the task definition, related requirements, and documentation to fully understand what needs to be built for the LNPM Cloud Dashboard. This agent is a READ-ONLY analysis — it produces a scope summary that subsequent agents consume.

## Scope Boundaries

**This agent MUST:**
- Read the task file, requirements, and documentation
- Map which files will be affected (created, modified, deleted) in the `dashboard/` subdirectory
- Summarize the acceptance criteria

**This agent MUST NOT:**
- Write, modify, or delete any project source files
- Implement any code
- Create implementation plans (that is Agent 05's job)
- Make architectural decisions (that is Agent 05's job)

## Variables

- **`{{MILESTONES_DIR}}`** _(static)_ — `ai-milestones-and-tasks/`
- **`{{DOCS_DIR}}`** _(static)_ — `docs/`
- **`{{REQUIREMENTS_DIR}}`** _(static)_ — `requirements/`
- **`{{PROJECT_ROOT}}`** _(static)_ — `/Users/pk/Projects/ping-monitoring`

## MCP Servers

| Server | Purpose | Install / Configure | When to Use |
|--------|---------|-------------------|-------------|
| `filesystem` | Directory exploration | No install needed | List files in affected directories |
| `git` | Version control | No install needed | Review existing file structure |
| `memory` | Cross-session persistence | No install needed | Share data between agents |
| `sequential-thinking` | Structured problem decomposition | No install needed | Complex decisions and analysis |

## Skills

No skills required for this agent.

## Workflow

**Step 1: Read Task Definition**

Read the task file in `ai-milestones-and-tasks/`. The task files follow the pattern `milestone-01-backend-platform/task-M1-T*.md` or `milestone-02-dashboard-ui/task-M2-T*.md`. Extract objective, acceptance criteria, and dependencies.

**Step 2: Read Related Requirements**

Read in parallel:
- Related requirements in `requirements/features/` — feature specs (e.g., `feature-0001-backend-setup.md`, `feature-0003-ping-ingest.md`)
- `requirements/api/api-design.md` — API contracts and request/response shapes
- `requirements/data-models/data-models.md` — SQLite schema, tables, indexes
- `requirements/architecture.md` — ADRs, directory structure, tech stack
- Related developer documentation in `docs/` — architecture notes, design specs

**Step 3: Map Affected Files**

**Invoke `filesystem` MCP server** to list files in `dashboard/` and its subdirectories (`server/`, `app/`, `shared/`). Summarize which files will be created, modified, or deleted. The dashboard lives in the `dashboard/` subdirectory — never modify the existing `src/` (Tauri desktop app) or `src-tauri/` directories unless the task explicitly requires it.

## Output

```
Task Scope
  Objective: [1-2 sentence summary]
  Acceptance criteria: [bulleted list]
  Files to create: [list with paths relative to dashboard/]
  Files to modify: [list with paths]
  Files to delete: [list with paths]
  Related docs: [list]
  Next agent: Agent 03 (Analyze Related Code)
```

## Gate

- [ ] Task definition read and understood
- [ ] Requirements cross-referenced
- [ ] Affected files mapped
- [ ] Scope summary produced
