---
title: LNPM — Agent 00 — Orient & Prepare
description: Load session context, create the feature branch, understand task scope and affected files
version: 3.0
---

# Orient & Prepare

## Purpose

Bootstrapping step: load cached knowledge, create the feature branch, and read the task definition with all related requirements. This agent is **strictly read-only** for project files (git branch creation is the only write).

## Instructions

- Use the Read tool for file reads, NOT `cat`, `head`, or `tail`.
- Use the Grep/Glob tools for file searches, NOT `find`, `ls`, or `rg`.
- Use the `git` MCP server for all git operations — do NOT use Bash for git commands.
- Parallelize all independent reads. Mark sequential dependencies explicitly.
- IF any referenced file doesn't exist, note the gap and proceed — do not block.
- Write down key findings inline — file paths, acceptance criteria, constraints. This survives context compaction.

## Scope Boundaries

**This agent MUST:**
- Read memory entries, project documentation, requirements, and milestone tracking
- Identify the next task ID from project-dashboard.md
- Create a feature branch from the latest `feature/*` branch
- Read the task definition, related requirements, and documentation
- Map which files will be affected (created, modified, deleted) in `dashboard/`
- Summarize acceptance criteria for downstream agents
- Verify project directories exist and check git state
- Report any interrupted tasks from previous sessions

**This agent MUST NOT:**
- Write, modify, or delete any project source files
- Implement any code or create implementation plans
- Run build commands, tests, or execute side effects
- Commit or push changes
- Modify files in `src/` or `src-tauri/` (desktop app)

## Variables

- **`{{PROJECT_ROOT}}`** *(static)* — `/Users/pk/Projects/ping-monitoring`
- **`{{PROJECT_NAME}}`** *(static)* — `LNPM Cloud Dashboard`
- **`{{AGENT_OUTPUT_DIR}}`** *(static)* — `.vaahagents/`
- **`{{MILESTONES_DIR}}`** *(static)* — `ai-milestones-and-tasks/`
- **`{{DOCS_DIR}}`** *(static)* — `docs/`
- **`{{REQUIREMENTS_DIR}}`** *(static)* — `requirements/`
- **`{{TASK_ID}}`** *(dynamic)* — Detected from project-dashboard.md (e.g., `M1-T7`)
- **`{{BRANCH_NAME}}`** *(dynamic)* — `feature/{{TASK_ID}}-short-description`

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
│   ├── architecture.md        # Tech stack, ADRs
│   ├── features/              # Feature specs (feature-0001-*.md)
│   ├── api/                   # API contracts
│   └── data-models/           # SQLite schema
├── docs/                       # Design specs
│   └── cloud-dashboard-design.md
└── dashboard/                  # Nuxt 4 + Nitro v2 application
    ├── server/                 # API routes, middleware, plugins
    └── app/                    # Pages, components, composables
```

## MCP Servers

| Server | Purpose | When to Use |
|--------|---------|-------------|
| `memory` | Cross-session persistence | Load cached project knowledge |
| `filesystem` | Directory exploration | Verify project directories exist |
| `git` | Version control | Check branch status, create branch, recent commits |
| `sequential-thinking` | Structured problem decomposition | Complex decisions and analysis |

## Workflow

### Step 1: Load Memory

Search memory for `"LNPM Cloud Dashboard"` entries. Load all cached findings from previous sessions.

**Gate:** IF no memory entries exist, run a quick orientation scan of `{{REQUIREMENTS_DIR}}/` and `{{DOCS_DIR}}/` before proceeding.

**Error recovery:** IF `memory` MCP server is unavailable, proceed without cached context. Note this limitation.

### Step 2: Read Project Context

Read these files in parallel:
- `{{MILESTONES_DIR}}/project-dashboard.md` — overall project progress, active milestones (M1 Backend Platform, M2 Dashboard UI), priorities
- `{{REQUIREMENTS_DIR}}/README.md` — feature requirements overview (14 features: 9 MVP, 4 Enhancement, 1 Growth)
- `{{REQUIREMENTS_DIR}}/architecture.md` — system architecture, tech stack (Nuxt 4 + Nitro v2, SQLite, WebSocket, uPlot), ADRs
- `{{DOCS_DIR}}/cloud-dashboard-design.md` — design spec

**Gate:** IF any file doesn't exist, note the gap and proceed.

Then sequentially:
- Identify `{{TASK_ID}}` — the next incomplete task from project-dashboard.md
- Note dependencies for `{{TASK_ID}}`

### Step 3: Create Feature Branch

1. List all local `feature/*` branches sorted by most recent commit
2. IF no `feature/*` branches exist, fall back to `develop` as the base (note this fallback)
3. Checkout the latest feature branch, pull latest changes from remote
4. Create new branch: `feature/{{TASK_ID}}-short-description`
5. Verify the new branch is active

**Error recovery:** IF a branch with `{{BRANCH_NAME}}` already exists, switch to it and verify it is up-to-date.

**Gate:** Branch is active and pointing to the correct name. Write the branch name inline.

### Step 4: Read Task Scope

Read the scope document for `{{TASK_ID}}`:
- `{{MILESTONES_DIR}}/milestone-01-backend-platform/task-{{TASK_ID}}-scope.md` or equivalent milestone directory
- Any implementation plan for `{{TASK_ID}}` if one exists

**Gate:** IF the task scope file doesn't exist, note it and proceed with whatever context the dashboard provides.

### Step 5: Read Related Requirements

Read in parallel:
- Related requirements in `requirements/features/` — feature specs
- `requirements/api/api-design.md` — API contracts and request/response shapes
- `requirements/data-models/data-models.md` — SQLite schema, tables, indexes
- Related developer documentation in `docs/` — architecture notes, design specs

### Step 6: Map Affected Files

List files in `dashboard/` and its subdirectories (`server/`, `app/`, `shared/`). Summarize which files will be created, modified, or deleted. The dashboard lives in the `dashboard/` subdirectory — never modify the existing `src/` (Tauri desktop app) or `src-tauri/` directories unless the task explicitly requires it.

### Step 7: Verify Directories

Confirm these directories exist: `{{MILESTONES_DIR}}`, `{{DOCS_DIR}}`, `{{REQUIREMENTS_DIR}}`, `dashboard/`.

**Gate:** IF `dashboard/` doesn't exist, report it as a blocker — the project hasn't been bootstrapped.

### Step 8: Check Git State

Check the current branch, recent commits, and any uncommitted changes. Note:
- Current branch name
- Last 3 commit messages
- Any uncommitted changes that might indicate an interrupted task

### Step 9: Recover Interrupted Tasks

IF memory contains an interrupted task entry, load the implementation plan and identify the last completed step.

## Report

After completing the workflow, output this summary:

```
Orient & Prepare — LNPM Cloud Dashboard
  Memory entries loaded: [count]
  Directories verified: [list]
  Next task ({{TASK_ID}}): [task title or "Not determined"]
  Task dependencies: [list or "None"]
  Objective: [1-2 sentence summary]
  Acceptance criteria: [bulleted list]
  Files to create: [list with paths relative to dashboard/]
  Files to modify: [list with paths]
  Files to delete: [list with paths]
  Branch: {{BRANCH_NAME}} (parent: [latest feature branch or develop])
  Interrupted task: [task-id or "None"]
  Recovery status: [steps remaining or "Not applicable"]
  Git state: [branch, last commit]
  Gaps: [missing files, missing context]
  Status: Complete | Partial | Blocked
  Next agent: Agent 01 (Analyze & Plan)
```
