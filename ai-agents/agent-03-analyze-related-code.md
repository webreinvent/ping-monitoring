---
title: LNPM - Agent 03 - Analyze Related Code
description: Analyze existing code to find reusable patterns, components, types, and utilities for the Cloud Dashboard
version: 2.0
---

# Analyze Related Code

## Purpose

Analyze existing code in the LNPM project to find reusable patterns, components, types, and utilities for the Cloud Dashboard. This agent is a READ-ONLY analysis — it produces a code analysis summary that subsequent agents consume.

## Instructions

- This agent is **strictly read-only** — no writes, no edits, no file creation, no git operations.
- Use the Read tool for file reads, NOT `cat`, `head`, or `tail`.
- Parallelize all independent reads. Mark sequential dependencies explicitly.
- Write down key findings inline — file paths, patterns, conventions. This survives context compaction.
- IF any referenced file doesn't exist, THEN note the gap and proceed — do not block.

## Scope Boundaries

**This agent MUST:**
- Read existing components, modules, and utilities related to the task
- Document coding conventions, naming patterns, and import styles
- Identify reusable code from the existing desktop app that can be adapted (e.g., `src/types.ts`, chart patterns from `src/chart.ts`)
- Flag code that must not be modified (shared, critical, well-tested)

**This agent MUST NOT:**
- Write, modify, or delete any project source files
- Implement any code
- Create implementation plans (that is Agent 05's job)
- Refactor existing code (that happens during implementation, Agent 07)
- Change project configuration

## Variables

- **`{{PROJECT_ROOT}}`** _(static)_ — `/Users/pk/Projects/ping-monitoring`

## Codebase Structure

```
ping-monitoring/
├── src/                        # Desktop app (Tauri) — READ-ONLY reference
│   ├── types.ts               # Shared TypeScript types
│   ├── chart.ts               # uPlot chart implementation
│   ├── api.ts                 # Tauri IPC API layer
│   ├── main.ts                # UI patterns, event handling
│   ├── dashboard-selection.ts # Multi-target aggregation
│   ├── update-state.ts        # State machine pattern
│   └── i18n.ts                # Internationalization (5 locales)
├── src-tauri/                  # Rust backend — READ-ONLY, do not modify
└── dashboard/                  # Nuxt 4 + Nitro v2 application
    ├── server/                 # API routes, middleware, utils
    └── app/                    # Pages, components, composables
```

## MCP Servers

| Server | Purpose | Install / Configure | When to Use |
|--------|---------|-------------------|-------------|
| `filesystem` | File exploration | No install needed | Read related source files |
| `sequential-thinking` | Problem decomposition | No install needed | Complex architectural decisions |
| `git` | Version control | No install needed | Review diffs, existing code structure |
| `memory` | Cross-session persistence | No install needed | Share data between agents |

## Skills

No skills required for this agent.

## Workflow

### Step 1: Identify Related Files

Based on the task scope, identify existing components, modules, or functions this task extends or modifies. Key reference files:
- `src/types.ts` — shared TypeScript types (Target, PingSample, QualityMetrics, HistoryResponse) used across desktop and dashboard
- `src/chart.ts` — uPlot chart implementation patterns (LatencyChart class, series rendering, quality state coloring)
- `src/api.ts` — Tauri IPC API layer pattern (adaptable for HTTP API calls in dashboard)
- `src/main.ts` — UI patterns, event handling, state management approach
- `src/dashboard-selection.ts` — multi-target aggregation logic
- `src/update-state.ts` — state machine pattern for update UI (reduces via state machine)
- `src/i18n.ts` — internationalization pattern (5 locales: en, ko, ja, zh-CN, zh-TW)
- Existing `dashboard/` files if any — already-implemented dashboard code

### Step 2: Read Related Code

Read in parallel:
- Existing components/modules/functions this task extends
- Adjacent test files for code being touched (e.g., `src/chart-tooltip.test.ts`, `src/i18n.test.ts`)
- Relevant utilities or helpers
- Shared types, interfaces, and schemas in `src/types.ts`

### Step 3: Analyze Patterns

Document:
- **Coding style:** Strict TypeScript (`strict: true`, `noUnusedLocals`, `noUnusedParameters`). No `any` types. Explicit return types.
- **Naming:** camelCase for functions/variables, PascalCase for types/interfaces/classes. File names: kebab-case for components, snake_case not used.
- **Import patterns:** Relative imports with `./` prefix. Grouped: Tauri API → project modules → types → styles.
- **UI patterns:** Vanilla DOM manipulation (no Vue in desktop app). Template literals for HTML. Event delegation. State-driven re-rendering via `renderDashboard()`.
- **Error handling:** `try/catch` with `showToast(formatError(error), "error")`. `normalizeError()` for error normalization.
- **Test patterns:** Vitest with descriptive `describe`/`test` blocks. Assertion style: `expect().toBe()`, `expect().toEqual()`. Test files co-located: `*.test.ts`.
- **Chart patterns:** uPlot with canvas rendering. Series colors from fixed palette. Quality state coloring (green/yellow/red).

### Step 4: Find Reusable Code

Identify code that can be reused, extended, or adapted:
- `src/types.ts` — share types between dashboard and desktop app via `dashboard/shared/`
- uPlot chart configuration — mirror desktop chart behavior
- State aggregation logic — `aggregateState()` for combined quality state

Flag code that must not be modified:
- `src/` — desktop app code, do not modify
- `src-tauri/` — Rust backend, do not modify

**Gate:** All reusable code must be documented before proceeding. IF no reusable code is found, note that explicitly.

### Step 5: Architectural Decisions

IF this task involves an architectural decision, **invoke `sequential-thinking` MCP server** to analyze options. Reference ADRs in `requirements/architecture.md` (ADR-001 through ADR-009).

## Report

After completing the workflow, output this summary:

```
Code Analysis
  Related files: [list with paths]
  Reusable code: [list with paths and description]
  Patterns to follow: [coding style, naming, imports]
  Error handling pattern: [idiom]
  Code to avoid modifying: [list with reason]
  Architectural decisions: [decisions made, referencing ADRs]
  Status: Complete | Partial | Blocked
  Next agent: Agent 04 (Plan UI/UX Design)
```
