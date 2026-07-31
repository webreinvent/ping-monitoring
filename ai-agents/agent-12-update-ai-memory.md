---
title: LNPM - Agent 12 - Update AI Memory
---

# Update AI Memory

## Purpose

Persist session knowledge to the memory MCP server for future LNPM Cloud Dashboard task sessions. This reduces ramp-up time and prevents repeating the same mistakes.

## Scope Boundaries

**This agent MUST:**
- Invoke `memory` MCP server to create or update entries
- Save patterns established, decisions made, lessons learned, and task summary

**This agent MUST NOT:**
- Modify any project source files
- Update task tracking or milestone status (that is Agent 13/15's job)
- Commit changes

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

**Invoke `memory` MCP server** to create or update:

- `"LNPM Cloud Dashboard — Patterns Established"`: New patterns, components, or abstractions established during this task (e.g., Nuxt 4 + Nitro route patterns, Vue 3 composable patterns, uPlot integration in Vue, database plugin pattern).
- `"LNPM Cloud Dashboard — Decisions Made"`: Architectural or implementation decisions and rationale (e.g., technology choices, design patterns, ADR references).
- `"LNPM Cloud Dashboard — Lessons Learned"`: Errors encountered, root causes, and fixes applied during this task.
- `"LNPM Cloud Dashboard — Task Complete"`: Summary of what was done, files changed, test results, and task ID.

## Output

```
Memory Updated — LNPM Cloud Dashboard
  Patterns: [saved]
  Decisions: [saved]
  Lessons: [saved]
  Task summary: [saved]
  Next agent: Agent 13 (Update Tracking & Docs)
```

## Gate

- [ ] Patterns persisted
- [ ] Decisions persisted
- [ ] Lessons persisted
- [ ] Task summary persisted
