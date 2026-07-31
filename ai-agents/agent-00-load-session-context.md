---
title: LNPM - Agent 00 - Load Session Context
---

# Load Session Context

## Purpose

Load cached knowledge from previous sessions and orient yourself to the LNPM Cloud Dashboard project state. This is the first agent in the pipeline — it primes context for all subsequent agents.

## Scope Boundaries

**This agent MUST:**
- Read memory entries, project documentation, requirements, and milestone tracking
- Verify project directories exist
- Report any interrupted tasks from previous sessions

**This agent MUST NOT:**
- Write, modify, or delete any project source files
- Create new files (except temporary memory entries)
- Execute build commands, tests, or git operations
- Select or commit to any specific task

## Variables

- **`{{PROJECT_ROOT}}`** _(static)_ — `/Users/pk/Projects/ping-monitoring`
- **`{{PROJECT_NAME}}`** _(static)_ — `LNPM Cloud Dashboard`
- **`{{MILESTONES_DIR}}`** _(static)_ — `ai-milestones-and-tasks/`
- **`{{DOCS_DIR}}`** _(static)_ — `docs/`
- **`{{REQUIREMENTS_DIR}}`** _(static)_ — `requirements/`

## MCP Servers

| Server | Purpose | Install / Configure | When to Use |
|--------|---------|-------------------|-------------|
| `memory` | Cross-session persistence | No install needed | Load cached project knowledge |
| `filesystem` | Directory exploration | No install needed | Verify project directories exist |
| `git` | Version control | No install needed | Check branch status, recent commits |
| `sequential-thinking` | Structured problem decomposition | No install needed | Complex decisions and analysis |

## Skills

No skills required for this agent.

## Workflow

**Step 1: Load Memory**

**Invoke `memory` MCP server:** Search for `"LNPM Cloud Dashboard"` entries. Load all cached findings from previous sessions.

**Gate:** IF no memory entries exist, THEN run a quick orientation scan of `requirements/` and `docs/` before proceeding.

**Error recovery:** IF `memory` MCP server is unavailable, proceed without cached context. Note this limitation.

**Step 2: Read Project Context**

Read in parallel:
- `ai-milestones-and-tasks/project-dashboard.md` — overall project progress, active milestones (M1 Backend Platform, M2 Dashboard UI), priorities
- `requirements/README.md` — feature requirements overview (14 features: 9 MVP, 4 Enhancement, 1 Growth)
- `requirements/architecture.md` — system architecture, tech stack (Nuxt 4 + Nitro v2, SQLite, WebSocket, uPlot), ADRs
- `docs/cloud-dashboard-design.md` — design spec

**Step 3: Verify Directories**

**Invoke `filesystem` MCP server** to confirm `ai-milestones-and-tasks/`, `docs/`, `requirements/`, and `dashboard/` exist.

**Step 4: Recover Interrupted Tasks**

IF memory contains an interrupted task entry, load the implementation plan and identify the last completed step.

## Output

```
Session Context — LNPM Cloud Dashboard
  Memory entries loaded: [count]
  Directories verified: [list]
  Interrupted task: [task-id or "None"]
  Recovery status: [steps remaining or "Not applicable"]
  Next agent: Agent 01 (Create Feature Branch)
```

## Gate

- [ ] Memory entries loaded (or absence noted)
- [ ] Project directories verified
- [ ] Interrupted task recovery checked
