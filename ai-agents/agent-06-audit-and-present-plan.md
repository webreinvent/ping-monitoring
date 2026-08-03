---
title: LNPM - Agent 06 - Audit & Present Plan
description: Audit the implementation plan against engineering principles, present findings to the user, and wait for explicit approval.
version: 2.0
---

# Audit & Present Plan

## Purpose

HARD STOP — DO NOT PROCEED WITHOUT USER APPROVAL. Audit the implementation plan against engineering principles, present findings to the user, and wait for explicit confirmation.

## Instructions

- **Tool-first approach:** Use MCP servers and skills before any manual exploration. Load the plan from memory via the `memory` MCP server.
- **Parallel reads:** Load the implementation plan and review code structure in parallel where possible: `PARALLEL: Load plan from memory, Review existing code structure`.
- **Sequential reads:** Audit must be sequential: `SEQUENTIAL: Load plan -> Principles audit -> Progress report -> Present to user`.
- **Compaction survival:** Audit results and user approval status must be saved to memory so they survive context window compaction.

## Scope Boundaries

**This agent MUST:**
- Audit the implementation plan against coding principles (DRY, KISS, YAGNI, SoC, SRP, SOLID)
- Compile a progress report of all prior agents
- Present the plan to the user with all findings
- Wait for explicit user approval before proceeding

**This agent MUST NOT:**
- Write, modify, or delete any project source files
- Implement any code
- Proceed to implementation without user approval
- Skip the principles audit
- Modify the plan without user consent (report issues, let user decide)

## Variables

- **`{{PROJECT_NAME}}`** _(static)_ — `LNPM Cloud Dashboard`

## MCP Servers

| Server | Purpose | Install / Configure | When to Use |
|--------|---------|-------------------|-------------|
| `memory` | Cross-session persistence | No install needed | Load implementation plan, save audit results |
| `git` | Version control | No install needed | Review existing code structure |
| `filesystem` | File and directory operations | No install needed | Read files |
| `sequential-thinking` | Structured problem decomposition | No install needed | Complex decisions |

## Skills

No skills required for this agent.

## Workflow

### Step 1: Load Implementation Plan

**Invoke `memory` MCP server:** Load `"LNPM Cloud Dashboard — Implementation Plan"`.

**Gate:** Plan loaded successfully before proceeding.

### Step 2: Principles Audit

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

Scan -> document violations -> revise -> re-audit.

**Gate:** All principles audited, violations documented and resolved.

### Step 3: Progress Report

Compile status of all prior agents (00-05):

```
Agent | Title                    | Status | Notes
  00  | Load Session Context     | ✅/⏭️  | [reason if skipped]
  01  | Create Feature Branch    | ...
  02  | Understand Task Scope    | ...
  03  | Analyze Related Code     | ...
  04  | Plan UI/UX Design        | ...
  05  | Create Implementation Plan | ...
```

### Step 4: Present to User

Present: progress report, task summary, implementation plan, principles audit, file inventory, risks.

> "Here is my implementation plan for the LNPM Cloud Dashboard. Audited against SOLID, DRY, KISS, YAGNI, Abstraction, Traceability, Debuggability. The plan follows the architecture defined in requirements/architecture.md (ADRs 001-009). Please review and confirm, or suggest changes."

**Wait for explicit user approval.**

**Gate:** User has given explicit approval before proceeding.

### Step 5: Save to Memory

**Invoke `memory` MCP server:** Save audit results.

**Gate:** Audit results saved to memory. Verify they can be retrieved.

## Report

Status: [Complete | Partial | Blocked]

Principles audit: [all passed / violations found and resolved]
Progress: [agents completed, agents skipped with reason]
Plan summary: [ordered sequence, N steps]
Files: Create [N] | Modify [N]
Risks: [assessment]
User approval: [granted / pending]
Audit saved to memory: [yes/no]
Next agent: Agent 07 (Implement the Task)

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
