---
title: LNPM - Agent 05 - Create Implementation Plan
---

# Create Implementation Plan

## Purpose

MANDATORY — DO NOT SKIP. Synthesize all prior analysis into a concrete, ordered implementation plan for the LNPM Cloud Dashboard. Every file and function must be named. Invoke planning skills before writing the plan.

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

**Step 1: Install & Invoke Planning Skills**

1. Check and install each skill if needed
2. Invoke `brainstorming` — explore at least 2 approaches, document rationale
3. Invoke `sequential-thinking` — decompose into ordered steps
4. Invoke `nuxt` skill — reference Nuxt 4 + Nitro v2 patterns

**Step 2: Review Inputs**

Review outputs from prior agents:
- Agent 02 — Task scope and acceptance criteria
- Agent 03 — Related code analysis and reusable patterns (src/types.ts, chart patterns, i18n)
- Agent 04 — UI/UX design plan

**Step 3: Create Implementation Sequence**

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

**Step 4: File Inventory**

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

**Step 5: Dependency Graph & Risk Assessment**

Document dependency chain, parallelizable work, and risks with mitigation.

**Step 6: Save to Memory**

**Invoke `memory` MCP server:** Save as `"LNPM Cloud Dashboard — Implementation Plan"`.

## Output

```
Implementation Plan

Sequence:
  1. [Step — file path — description]
  2. [Step — file path — description]
  ...

Files: Create [N] | Modify [N]
Dependencies: [chain with parallelizable items]
Risks: [identified risks and mitigation]
Complexity: [Low/Medium/High]
Plan saved to memory: ✅
Next agent: Agent 06 (Audit & Present Plan)
```

## Gate

- [ ] Planning skills installed and invoked
- [ ] Prior agent outputs reviewed
- [ ] Implementation sequence complete and ordered
- [ ] File inventory documented
- [ ] Dependencies mapped
- [ ] Risks assessed
- [ ] Plan saved to memory
