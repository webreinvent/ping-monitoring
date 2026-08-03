---
title: LNPM - Agent 00 - Load Session Context
description: Load cached knowledge, orient to project state, collect task-relevant context for downstream agents
version: 2.0
---

# Load Session Context

## Purpose

Load cached knowledge from previous sessions and orient to the LNPM Cloud Dashboard project state.

## Instructions

- This agent is **strictly read-only** — no writes, no edits, no file creation, no git operations, no build/test execution.
- Use the Read tool for file reads, NOT `cat`, `head`, or `tail`.
- Use the Grep/Glob tools for file searches, NOT `find`, `ls`, or `rg`.
- Parallelize all independent reads. Mark sequential dependencies explicitly.
- IF any referenced file doesn't exist, THEN note the gap and proceed — do not block.
- Write down key findings inline — file paths, patterns, constraints. This survives context compaction.

## Scope Boundaries

**This agent MUST:**
- Read memory entries, project documentation, requirements, and milestone tracking
- Read source code files to understand current implementation state
- Verify project directories exist
- Report any interrupted tasks from previous sessions
- Collect task-relevant code artifacts (types, interfaces, existing implementations) that downstream agents will need
- Summarize the current state of the codebase from the perspective of the next task to be worked on

**This agent MUST NOT — STRICT READ-ONLY:**
- Write, modify, or delete any project source files under any circumstances
- Create any new files in the project (except temporary memory entries in the memory system)
- Execute build commands, tests, or git operations
- Select or commit to any specific task
- Introduce any code changes, refactors, or fixes
- Run any command that has side effects on the project (no `npm run`, no database migrations, no server starts)
- Edit configuration files, lock files, or environment files
- Touch the git working tree in any way that produces unstaged changes

## Variables

- **`{{PROJECT_ROOT}}`** *(static)* — `/Users/pk/Projects/ping-monitoring`
- **`{{PROJECT_NAME}}`** *(static)* — `LNPM Cloud Dashboard`
- **`{{MILESTONES_DIR}}`** *(static)* — `ai-milestones-and-tasks/`
- **`{{DOCS_DIR}}`** *(static)* — `docs/`
- **`{{REQUIREMENTS_DIR}}`** *(static)* — `requirements/`
- **`{{TASK_ID}}`** *(dynamic)* — The next task ID to be worked on (e.g., `M1-T7`). Detected from project-dashboard.md.

## Codebase Structure

```
ping-monitoring/
├── ai-milestones-and-tasks/   # Project progress, milestones, task tracking
│   ├── project-dashboard.md   # Master task board with status
│   ├── milestone-01-backend-platform/
│   └── milestone-02-dashboard-ui/
├── ai-agents/                  # Agent pipeline definitions (this agent lives here)
├── requirements/               # Feature requirements, architecture, ADRs
│   ├── README.md              # Feature overview (14 features)
│   └── architecture.md        # Tech stack, ADRs
├── docs/                       # Design specs
│   └── cloud-dashboard-design.md
└── dashboard/                  # Nuxt 4 + Nitro v2 application
    ├── server/                 # API routes, middleware, plugins
    ├── pages/                  # File-based routing
    ├── components/             # Vue components
    └── composables/            # Shared composition functions
```

## MCP Servers

| Server | Purpose | When to Use |
|--------|---------|-------------|
| `memory` | Cross-session persistence | Load cached project knowledge |
| `filesystem` | Directory exploration | Verify project directories exist |
| `git` | Version control | Check branch status, recent commits |
| `sequential-thinking` | Structured problem decomposition | Complex decisions and analysis |

## Skills

No skills required for this agent.

## Workflow

### Step 1: Load Memory

Search memory for `"LNPM Cloud Dashboard"` entries. Load all cached findings from previous sessions.

**Gate:** IF no memory entries exist, THEN run a quick orientation scan of `{{REQUIREMENTS_DIR}}/` and `{{DOCS_DIR}}/` before proceeding.

**Error recovery:** IF `memory` MCP server is unavailable, proceed without cached context. Note this limitation.

### Step 2: Read Project Context

Read these files in parallel:
- `{{MILESTONES_DIR}}/project-dashboard.md` — overall project progress, active milestones (M1 Backend Platform, M2 Dashboard UI), priorities
- `{{REQUIREMENTS_DIR}}/README.md` — feature requirements overview (14 features: 9 MVP, 4 Enhancement, 1 Growth)
- `{{REQUIREMENTS_DIR}}/architecture.md` — system architecture, tech stack (Nuxt 4 + Nitro v2, SQLite, WebSocket, uPlot), ADRs
- `{{DOCS_DIR}}/cloud-dashboard-design.md` — design spec

**Gate:** IF any file doesn't exist, THEN note the gap and proceed.

Then sequentially:
- Identify `{{TASK_ID}}` — the next incomplete task from project-dashboard.md
- Note dependencies for `{{TASK_ID}}`

### Step 3: Read Task Scope

Read the scope document for `{{TASK_ID}}`:
- `{{MILESTONES_DIR}}/milestone-01-backend-platform/task-{{TASK_ID}}-scope.md` or equivalent milestone directory
- Any implementation plan for `{{TASK_ID}}` if one exists

**Gate:** IF the task scope file doesn't exist, THEN note it and proceed with whatever context the dashboard provides.

### Step 4: Collect Code Context

Read task-relevant source code to understand current implementation state. Based on `{{TASK_ID}}`, read in parallel:
- Related server routes in `dashboard/server/api/`
- Type definitions in `dashboard/server/utils/*-types.ts`
- Adjacent test files matching the module names
- Existing implementations that `{{TASK_ID}}` depends on

### Step 5: Verify Directories

Confirm these directories exist: `{{MILESTONES_DIR}}`, `{{DOCS_DIR}}`, `{{REQUIREMENTS_DIR}}`, `dashboard/`.

**Gate:** IF `dashboard/` doesn't exist, THEN report it as a blocker — the project hasn't been bootstrapped.

### Step 6: Check Git State

Check the current branch, recent commits, and any uncommitted changes. Note:
- Current branch name
- Last 3 commit messages
- Any uncommitted changes that might indicate an interrupted task

### Step 7: Recover Interrupted Tasks

IF memory contains an interrupted task entry, load the implementation plan and identify the last completed step.

## Report

After completing the workflow, output this summary:

```
Session Context — LNPM Cloud Dashboard
  Memory entries loaded: [count]
  Directories verified: [list]
  Next task ({{TASK_ID}}): [task title or "Not determined"]
  Task dependencies: [list or "None"]
  Interrupted task: [task-id or "None"]
  Recovery status: [steps remaining or "Not applicable"]
  Code context collected: [files read, patterns noted]
  Git state: [branch, last commit]
  Gaps: [missing files, missing context]
  Status: Complete | Partial | Blocked
  Next agent: Agent 01 (Create Feature Branch)
```
