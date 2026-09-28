---
title: LNPM — Agent 01 — Analyze & Plan
description: Analyze existing code, plan UI/UX, create the implementation plan, audit against principles, and get user approval
version: 3.0
---

# Analyze & Plan

## Purpose

Planning phase: analyze existing code for reusable patterns, plan the UI/UX design, synthesize an ordered implementation plan, audit it against engineering principles, and present it to the user for explicit approval. This agent is **read-only and planning-only** — no implementation code is written.

## Variables

- **`{{PROJECT_ROOT}}`** *(static)* — `/Users/pk/Projects/ping-monitoring`
- **`{{PROJECT_NAME}}`** *(static)* — `LNPM Cloud Dashboard`
- **`{{AGENT_OUTPUT_DIR}}`** *(static)* — `.vaahagents/`
- **`{{TASK_ID}}`** *(dynamic)* — Provided by Agent 00 (e.g., `M1-T7`)
- **`{{SKILLS_REGISTRY}}`** *(static)* — `https://skills.sh/`

## Instructions

- This agent is **strictly read-only** for project source files — no writes, no edits, no file creation (except memory entries).
- Use the Read tool for file reads, NOT `cat`, `head`, or `tail`.
- Parallelize all independent reads. Mark sequential dependencies explicitly.
- Invoke ALL design and planning skills listed below. Do not skip any.
- IF any skill fails to install or invoke, note the failure and proceed — do not block.
- Write down key findings inline — file paths, patterns, constraints, decisions. This survives context compaction.
- Use `TodoWrite` to track progress through the 6 workflow phases below.

## Scope Boundaries

**This agent MUST:**
- Analyze existing code to find reusable patterns, components, types, and utilities
- Document coding conventions, naming patterns, and import styles
- Identify reusable code from the desktop app (`src/`) that can be adapted
- Plan the UI/UX design: component hierarchy, state management, styling, charts, accessibility
- Synthesize a numbered, ordered implementation plan
- Audit the plan against engineering principles (DRY, KISS, YAGNI, SoC, SRP, SOLID)
- Present the plan to the user and wait for explicit approval
- Save the plan to memory for downstream agents

**This agent MUST NOT:**
- Write, modify, or delete any project source files
- Implement any code
- Run build commands or tests
- Proceed to implementation without user approval

## Input

- **From Agent 00:** `{{TASK_ID}}`, branch name, task scope summary, acceptance criteria, affected file list.
- **From memory:** Previous session context, cached implementation plans, design decisions.
- **From user:** Optional — design direction preferences, scope adjustments.

## Codebase Structure

```
ping-monitoring/
├── src/                        # Desktop app (Tauri) — READ-ONLY reference
│   ├── types.ts               # Shared TypeScript types
│   ├── chart.ts               # uPlot chart implementation
│   ├── api.ts                 # Tauri IPC API layer
│   ├── main.ts                # UI patterns, event handling
│   ├── styles.css             # CSS custom properties, design tokens
│   ├── dashboard-selection.ts # Multi-target aggregation
│   ├── update-state.ts        # State machine pattern
│   └── i18n.ts                # Internationalization (5 locales)
├── src-tauri/                  # Rust backend — READ-ONLY, do not modify
└── dashboard/                  # Nuxt 4 + Nitro v2 application (target)
    ├── server/                 # API routes, middleware, utils
    └── app/                    # Pages, components, composables
```

## MCP Servers

| Server | Purpose | When to Use |
|--------|---------|-------------|
| `filesystem` | File exploration | Read existing UI files, list files in affected directories |
| `sequential-thinking` | Problem decomposition | Complex architectural decisions |
| `memory` | Cross-session persistence | Load task context from Agent 00, save plan |
| `git` | Version control | Review existing code structure, diffs |
| `playwright` | Browser automation | Optional: Screenshot current UI state for reference |

## Skills

| Skill | Install Command | When to Invoke |
|-------|----------------|----------------|
| `ui-ux-pro-max` | `npx skills add xxsluna/ui-ux-pro-max` | Design intelligence (color, typography, layout, UX) |
| `tailwind-best-practices` | Already available | Tailwind CSS patterns (if Tailwind is used) |
| `primevue` | Already available | PrimeVue component patterns (if PrimeVue is used) |
| `brainstorming` | Already available | Explore 2+ approaches, document rationale |
| `nuxt` | Already available | Nuxt 4 patterns, Nitro server routes, WebSocket |

**Skill Installation Protocol:** Before invoking any skill, check if installed. IF not installed, run `npx skills add <owner/repo>`. Wait for installation. THEN invoke the skill.

## Workflow

### Phase A: Code Analysis

#### Step A1: Identify Related Files

Based on the task scope (from Agent 00), identify existing components, modules, or functions this task extends or modifies. Key reference files:
- `src/types.ts` — shared TypeScript types (Target, PingSample, QualityMetrics, HistoryResponse)
- `src/chart.ts` — uPlot chart implementation (LatencyChart class, series rendering, quality state coloring)
- `src/api.ts` — Tauri IPC API layer pattern (adaptable for HTTP API calls)
- `src/main.ts` — UI patterns, event handling, state management
- `src/styles.css` — CSS custom properties, design tokens, color palette
- `src/dashboard-selection.ts` — multi-target aggregation logic
- `src/update-state.ts` — state machine pattern for UI
- `src/i18n.ts` — internationalization (5 locales: en, ko, ja, zh-CN, zh-TW)
- Existing `dashboard/` files — already-implemented dashboard code

#### Step A2: Read Related Code

Read in parallel:
- Existing components/modules/functions this task extends
- Adjacent test files for code being touched (e.g., `*.test.ts`)
- Relevant utilities or helpers
- Shared types, interfaces, and schemas

#### Step A3: Document Patterns

Document findings inline (compaction survival):
- **Coding style:** Strict TypeScript (`strict: true`, `noUnusedLocals`, `noUnusedParameters`). No `any` types.
- **Naming:** camelCase for functions/variables, PascalCase for types/interfaces/classes. kebab-case for component files.
- **Import patterns:** Relative imports with `./` prefix. Grouped: framework → project modules → types.
- **Error handling:** `try/catch` with structured error reporting.
- **Test patterns:** Vitest with `describe`/`test` blocks. Co-located `*.test.ts` files.
- **Chart patterns:** uPlot with canvas rendering. Series colors from fixed palette. Quality state coloring (green/yellow/red).

Flag code that must not be modified:
- `src/` — desktop app code, do not modify
- `src-tauri/` — Rust backend, do not modify

**Gate:** All reusable code documented. IF no reusable code is found, note that explicitly.

**Error recovery:** IF code analysis reveals that reference files have changed significantly from expected, note the delta and adjust plan accordingly.

### Phase B: UI/UX Design Plan

#### Step B1: Install & Invoke Design Skills

For each skill: check if installed, install if needed, invoke and capture findings.

**Gate:** ALL design skills invoked before proceeding.

#### Step B2: Analyze Current Design

- Read `src/styles.css` — CSS custom properties, design tokens, color palette
- Read `src/main.ts` — UI structure, layout patterns
- Review `docs/assets/` — visual references (screenshots)
- The desktop app uses vanilla CSS with custom properties (no CSS framework)

#### Step B3: Capture Current UI State (Optional)

**Invoke `playwright` MCP server**: Take a screenshot of the current UI state for reference.

#### Step B4: Plan Component Hierarchy & State

Plan the core UI structure:
- **Component hierarchy:** Layout shell → Sidebar (client groups, monitor list) → Dashboard panel (chart, metrics) → Modals (settings, target dialog)
- **State management:** Vue 3 composables (`useMonitors`, `useWebSocket`, `useChart`) with reactive state. No Pinia unless complexity demands it.

**Compaction survival:** Write the component list inline.

#### Step B5: Plan Styling & Charts

Plan presentation details:
- **Styling strategy:** Mirror desktop CSS custom properties. Use scoped `<style>` in Vue components. Consider Tailwind vs vanilla CSS custom properties.
- **Chart integration:** uPlot in Vue 3 via `onMounted`/`onUnmounted` lifecycle. Canvas-based rendering.

#### Step B6: Plan Cross-Cutting Concerns

Plan non-functional requirements:
- **Accessibility:** Semantic HTML, ARIA labels, keyboard navigation.
- **Responsive design:** Desktop-first (monitoring tool), functional on tablets.
- **i18n:** Mirror 5-locales approach using Nuxt's i18n module or lightweight alternative.

**Gate:** All UI sub-plans completed before proceeding to implementation plan.

### Phase C: Implementation Plan

#### Step C1: Invoke Planning Skills

1. Invoke `brainstorming` — explore at least 2 approaches, document rationale
2. Invoke `sequential-thinking` — decompose into ordered steps
3. Invoke `nuxt` skill — reference Nuxt 4 + Nitro v2 patterns

#### Step C2: Review Inputs

PARALLEL: Review outputs from prior phases (A + B) and task scope from Agent 00.

#### Step C3: Create Implementation Sequence

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

#### Step C4: File Inventory

List every file to create and modify, grouped by layer. Generate this list dynamically from the implementation sequence in Step C3 — do not copy a static template. For each file, note whether it is **Create**, **Modify**, or **Delete**.

**Compaction survival:** Write the complete file inventory inline (not as a reference).

#### Step C5: Dependency Graph & Risk Assessment

Document dependency chain, parallelizable work, and risks with mitigation. Write the dependency graph inline.

**Error recovery:** IF the dependency graph reveals circular dependencies, document them and propose a resolution before proceeding.

**Gate:** File inventory and dependency graph completed before proceeding.

### Phase D: Principles Audit

Audit the plan against:

| Principle | Check |
|-----------|-------|
| **DRY** | No duplicated logic — extract shared functions (e.g., shared types in `dashboard/shared/`) |
| **KISS** | No unnecessary complexity — simplify (e.g., in-memory LRU over Redis per ADR-003) |
| **YAGNI** | No out-of-scope work — remove or defer (e.g., don't implement auth for public dashboard) |
| **SoC** | Concerns separated (data/logic/presentation) — Nitro server vs Vue components |
| **SRP** | One responsibility per function/component |
| **SOLID** | No god classes, no tight coupling |
| **Abstraction** | Right level — not too shallow/deep |
| **Traceability** | Every item traces to feature/task ID (M1-T*, M2-T*) |
| **Debuggability** | Traceable flows, structured logging, error boundaries |

Scan → document violations → revise → re-audit.

**Gate:** All principles audited, violations documented and resolved.

### Phase E: Present to User

Compile a progress report:

```
Agent | Title            | Status | Notes
  00  | Orient & Prepare | ✅/⏭️  | [reason if skipped]
  01  | Analyze & Plan   | 🔄    | [current — awaiting approval]
```

Present: progress report, task summary, implementation plan, principles audit, file inventory, risks.

> "Here is my implementation plan for the LNPM Cloud Dashboard. Audited against SOLID, DRY, KISS, YAGNI, Abstraction, Traceability, Debuggability. The plan follows the architecture defined in requirements/architecture.md (ADRs 001-009). Please review and confirm, or suggest changes."

**Wait for explicit user approval.**

**Error recovery:** IF user requests changes, revise the plan, re-audit against principles, and re-present. Do not proceed without explicit approval.

### Phase F: Save to Memory

**Invoke `memory` MCP server:** Save as `"LNPM Cloud Dashboard — Implementation Plan"`. Include the full implementation sequence, file inventory, and dependency graph.

**Gate:** Plan saved to memory. Verify it can be retrieved.

**Error recovery:** IF memory save fails, write the plan to a fallback file in `{{AGENT_OUTPUT_DIR}}/plan-{{TASK_ID}}.md` and note this to the user.

## Report

```
Analyze & Plan — LNPM Cloud Dashboard
  Code analysis:
    Related files: [list with paths]
    Reusable code: [list with paths and description]
    Patterns: [coding style, naming, imports]
    Code to avoid: [list with reason]
  UI/UX plan:
    Design system: [CSS custom properties, adapted for Vue 3]
    Components: [list with description]
    State management: [Vue 3 composables]
    Styling: [strategy]
    Chart: [uPlot in Vue 3 lifecycle]
    Accessibility: [considerations]
    i18n: [5-locales strategy]
  Implementation plan:
    Sequence: [N steps, ordered by layer]
    Files: Create [N] | Modify [N]
    Dependencies: [chain with parallelizable items]
    Risks: [identified risks and mitigation]
    Complexity: [Low/Medium/High]
  Principles audit: [all passed / violations found and resolved]
  User approval: [granted / pending]
  Plan saved to memory: [yes/no]
  Status: Complete | Partial | Blocked
  Next agent: Agent 02 (Implement)
```
