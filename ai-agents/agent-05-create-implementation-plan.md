---
title: LNPM - Agent 05 - Create Implementation Plan
description: Synthesize all prior analysis into a concrete, ordered implementation plan for the LNPM Cloud Dashboard.
version: 2.0
---

# Create Implementation Plan

## Purpose

MANDATORY — DO NOT SKIP. Synthesize all prior analysis into a concrete, ordered implementation plan for the LNPM Cloud Dashboard. Every file and function must be named. Invoke planning skills before writing the plan.

## Instructions

- **Tool-first approach:** Use MCP servers and skills before any manual exploration. Only read files directly when a tool cannot answer the question.
- **Parallel reads:** Steps that load independent files (e.g., reviewing Agent 02, 03, and 04 outputs) should be executed concurrently: `PARALLEL: Read agent-02-output, Read agent-03-output, Read agent-04-output`.
- **Sequential reads:** Steps with dependencies must be sequential: `SEQUENTIAL: Review inputs -> Create sequence -> File inventory`.
- **Compaction survival:** All critical decisions and the final plan must be saved to memory so they survive context window compaction.

## Scope Boundaries

**This agent MUST:**
- Install and invoke `brainstorming` and `sequential-thinking` skills
- Review all prior agent outputs (scope, research, code analysis, UI plan)
- Produce a numbered, ordered implementation sequence
- List every file to create and modify within the `dashboard/` subdirectory
- Document dependencies and risks
- Save the plan to memory for Agent 07 to consume

**This agent MUST NOT:**
- Write, modify, or delete any project source files
- Implement any code
- Run build commands or tests
- Commit changes
- Execute the implementation (that is Agent 07's job)

## Variables

- **`{{PROJECT_NAME}}`** _(static)_ — `LNPM Cloud Dashboard`
- **`{{PROJECT_ROOT}}`** _(static)_ — `/Users/pk/Projects/ping-monitoring`

## MCP Servers

| Server | Purpose | Install / Configure | When to Use |
|--------|---------|-------------------|-------------|
| `sequential-thinking` | Problem decomposition | No install needed | Decompose task into ordered steps |
| `memory` | Cross-session persistence | No install needed | Save implementation plan |
| `git` | Version control | No install needed | Review existing code structure |
| `filesystem` | File and directory operations | No install needed | Explore existing files |

## Skills

| Skill | Install Command | When to Invoke |
|-------|----------------|----------------|
| `brainstorming` | Already available in session | Explore 2+ approaches, document rationale |
| `nuxt` | Already available in session | Nuxt 4 patterns, Nitro server routes, WebSocket |

**Skill Installation Protocol:** Before invoking any skill, check if installed. IF not installed, run `npx skills add <owner/repo>`. Wait for installation. THEN invoke the skill.

**MANDATORY:** Invoke `brainstorming` and `sequential-thinking` skills.

## Workflow

### Step 1: Install & Invoke Planning Skills

1. Check and install each skill if needed
2. Invoke `brainstorming` — explore at least 2 approaches, document rationale
3. Invoke `sequential-thinking` — decompose into ordered steps
4. Invoke `nuxt` skill — reference Nuxt 4 + Nitro v2 patterns

**Gate:** Planning skills installed and invoked before proceeding.

### Step 2: Review Inputs

PARALLEL: Review outputs from prior agents concurrently:
- Agent 02 — Task scope and acceptance criteria
- Agent 03 — Related code analysis and reusable patterns (src/types.ts, chart patterns, i18n)
- Agent 04 — UI/UX design plan

**Gate:** All prior agent outputs reviewed and understood.

### Step 3: Create Implementation Sequence

Produce a numbered, ordered list following layer-order:
1. **Project Setup** — Nuxt 4 config, Nitro persistent runtime, package.json, tsconfig
2. **Data Layer** — SQLite schema, migrations (`better-sqlite3`), database plugin
3. **Business Logic** — services, validators, quality classifier, cache
4. **API Layer** — Nitro API routes (`server/api/`), file-based routing
5. **WebSocket Layer** — Nitro WebSocket routes (`server/ws/`), topic subscriptions
6. **Shared Types** — TypeScript interfaces in `dashboard/shared/`
7. **Frontend State** — Vue 3 composables (`useMonitors`, `useWebSocket`, `useChart`)
8. **Frontend Components** — Layout, Sidebar, Chart, Metrics, Modals
9. **Tests** — write as you go, not all at the end

### Step 4: File Inventory

List every file to create and modify, grouped by layer. Reference the directory structure in `requirements/architecture.md`:
```
dashboard/
├── server/
│   ├── api/           # API routes
│   ├── ws/            # WebSocket routes
│   ├── plugins/       # database.ts, websocket.ts
│   ├── utils/         # db.ts, client.ts, ping-validation.ts, etc.
│   └── middleware/    # rate-limit.ts
├── app/
│   ├── pages/         # Nuxt pages
│   ├── components/    # Vue components
│   └── composables/   # useMonitors, useWebSocket, useChart
├── schema/
│   ├── index.sql
│   └── migrations/
└── shared/
    └── types.ts
```

### Step 5: Dependency Graph & Risk Assessment

Document dependency chain, parallelizable work, and risks with mitigation.

**Gate:** Dependencies mapped, risks assessed, plan complete and ordered.

### Step 6: Save to Memory

**Invoke `memory` MCP server:** Save as `"LNPM Cloud Dashboard — Implementation Plan"`.

**Gate:** Plan saved to memory. Verify it can be retrieved.

## Report

Status: [Complete | Partial | Blocked]

Sequence: [N steps, ordered by layer]
Files: Create [N] | Modify [N]
Dependencies: [chain with parallelizable items]
Risks: [identified risks and mitigation]
Complexity: [Low/Medium/High]
Plan saved to memory: [yes/no]
Next agent: Agent 06 (Audit & Present Plan)

If Blocked, state the reason and what is needed to unblock.

## Codebase Structure

```
ping-monitoring/
├── dashboard/          # Cloud Dashboard (this task's target)
│   ├── server/         # Nitro server routes, plugins, utils
│   ├── app/            # Nuxt 4 frontend (pages, components, composables)
│   ├── schema/         # SQLite schema and migrations
│   └── shared/         # Shared TypeScript types
├── src/                # Desktop app source (do not modify unless required)
├── src-tauri/          # Tauri backend (do not modify unless required)
├── requirements/       # Architecture, ADRs, specifications
└── ai-agents/          # Agent definitions (this directory)
```
