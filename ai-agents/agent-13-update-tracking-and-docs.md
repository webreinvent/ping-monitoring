---
title: LNPM - Agent 13 - Update Tracking & Generate Docs
---

# Update Tracking & Generate Docs

## Purpose

Update the project dashboard and milestone tracking. Generate or update technical documentation for any new components, patterns, or architectural decisions in the LNPM Cloud Dashboard.

## Scope Boundaries

**This agent MUST:**
- Update `project-dashboard.md` with current progress
- Generate documentation for new components, composables, utilities, or API patterns
- Include: purpose, API/parameters, usage example, integration notes, edge cases

**This agent MUST NOT:**
- Modify application source code
- Set task status to `🟢 Complete` (that is Agent 15's job)
- Commit changes

## Variables

- **`{{MILESTONES_DIR}}`** _(static)_ — `ai-milestones-and-tasks/`
- **`{{DOCS_DIR}}`** _(static)_ — `docs/`
- **`{{PROJECT_NAME}}`** _(static)_ — `LNPM Cloud Dashboard`

## MCP Servers

| Server | Purpose | Install / Configure | When to Use |
|--------|---------|-------------------|-------------|
| `filesystem` | File read/write | No install needed | Update dashboard, write docs |
| `memory` | Cross-session persistence | No install needed | Load session context |
| `git` | Version control | No install needed | Review changes |
| `sequential-thinking` | Structured problem decomposition | No install needed | Complex decisions |

## Skills

No skills required for this agent.

## Workflow

**Step 1: Update Tracking**

**Invoke `filesystem` MCP server:** Update `ai-milestones-and-tasks/project-dashboard.md` with current progress. Update the task status to `🟡 In Progress` or appropriate intermediate status. Update the progress section.

**Step 2: Generate Documentation**

IF this task introduced new components, composables, utilities, API patterns, or architectural decisions:

For each new or significantly modified module:
1. Determine scope — list new items
2. Create/update doc files in `docs/`
3. Required sections: Purpose, API/Parameters, Usage example, Integration notes, Edge cases
4. Code snippets must be copy-pasteable and reflect actual code

Documentation targets for the Cloud Dashboard:
- New API endpoints — document request/response shapes, error codes
- New database tables or migrations — document schema, indexes
- New Vue components — document props, events, slots
- New composables — document parameters, return values, reactivity
- New utilities — document function signature, inputs, outputs
- WebSocket protocol — document subscription model, message shapes

## Output

```
Tracking & Docs
  Dashboard: [updated]
  Docs created: [list with paths]
  Docs updated: [list with paths]
  New patterns documented: [list]
  Next agent: Agent 14 (Update Project Context)
```

## Gate

- [ ] Dashboard updated
- [ ] Docs generated (or skipped with reason if minor fix)
