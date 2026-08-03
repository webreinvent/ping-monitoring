---
title: LNPM - Agent 12 - Update AI Memory
description: Persist session knowledge to the memory MCP server for future LNPM Cloud Dashboard task sessions.
version: 2.0
---

# Update AI Memory

## Purpose

Persist session knowledge to the memory MCP server for future LNPM Cloud Dashboard task sessions. This reduces ramp-up time and prevents repeating the same mistakes.

## Instructions

- **Tool-first approach:** Use the `memory` MCP server as the primary tool for all operations. Use `git` and `filesystem` MCP servers for context review before saving.
- **Parallel reads:** There are no parallel steps — this agent has a single sequential workflow.
- **Sequential reads:** Load session context from `memory` before writing new entries to ensure updates augment rather than duplicate existing knowledge.
- **Compaction survival:** If the context window is nearing capacity, prioritize the `"LNPM Cloud Dashboard — Task Complete"` entry — it summarizes the entire task and is the most critical for the next agent.

## Scope Boundaries

**This agent MUST:**
- Invoke `memory` MCP server to create or update entries
- Save patterns established, decisions made, lessons learned, and task summary

**This agent MUST NOT:**
- Modify any project source files
- Update task tracking or milestone status (that is Agent 13/15's job)
- Commit changes

## Codebase Structure

```
ping-monitoring/
  ai-agents/                  # Agent definitions (this file's siblings)
  ai-milestones-and-tasks/    # Milestone and task tracking
    project-dashboard.md      # Project-level task dashboard
  dashboard/
    app/                      # Vue 3 pages, components, composables
    server/                   # Nitro API routes, WebSocket, utils
    shared/                   # TypeScript types shared between server/client
```

## Variables

- **`{{PROJECT_NAME}}`** _(static)_ — `LNPM Cloud Dashboard`

## MCP Servers

| Server | Purpose | Install / Configure | When to Use |
|--------|---------|-------------------|-------------|
| `memory` | Cross-session persistence | No install needed | Save all session knowledge |
| `git` | Version control | No install needed | Review changes for context |
| `filesystem` | File and directory operations | No install needed | Read files |
| `sequential-thinking` | Structured problem decomposition | No install needed | Complex decisions |

## Skills

No skills required for this agent.

## Workflow

### Step 1: Load Existing Memory

**Invoke `memory` MCP server** to check if any existing entries for LNPM Cloud Dashboard are present. This ensures updates augment rather than duplicate existing knowledge.

**Gate:** Existing memory reviewed before creating or updating entries.

### Step 2: Save Session Knowledge

**Invoke `memory` MCP server** to create or update:

- `"LNPM Cloud Dashboard — Patterns Established"`: New patterns, components, or abstractions established during this task (e.g., Nuxt 4 + Nitro route patterns, Vue 3 composable patterns, uPlot integration in Vue, database plugin pattern).
- `"LNPM Cloud Dashboard — Decisions Made"`: Architectural or implementation decisions and rationale (e.g., technology choices, design patterns, ADR references).
- `"LNPM Cloud Dashboard — Lessons Learned"`: Errors encountered, root causes, and fixes applied during this task.
- `"LNPM Cloud Dashboard — Task Complete"`: Summary of what was done, files changed, test results, and task ID.

**Gate:** All four memory entries created or updated.

## Report

Provide a concise report confirming memory persistence:

```
Memory Updated — LNPM Cloud Dashboard
  Patterns: [saved / updated / skipped — reason]
  Decisions: [saved / updated / skipped — reason]
  Lessons: [saved / updated / skipped — reason]
  Task summary: [saved / updated / skipped — reason]
  Status: [Complete | Partial | Blocked]
  Next agent: Agent 13 (Generate Documentation)
```

- **Complete:** All four memory entries saved successfully.
- **Partial:** Some entries saved, others skipped (with reason).
- **Blocked:** Memory server unavailable or write failed.
