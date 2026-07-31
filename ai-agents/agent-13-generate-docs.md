---
title: LNPM - Agent 13 - Generate Documentation
---

# Generate Documentation

## Purpose

Generate or update technical documentation for any new components, patterns, or architectural decisions in the LNPM Cloud Dashboard. This agent handles **documentation only** — no tracking updates, no task status changes.

## Scope Boundaries

**This agent MUST:**
- Generate documentation for new components, composables, utilities, API patterns, or architectural decisions
- Include: purpose, API/parameters, usage example, integration notes, edge cases
- Create or update doc files in `docs/`
- Ensure code snippets are copy-pasteable and reflect actual code

**This agent MUST NOT:**
- Modify application source code
- Update `project-dashboard.md` or task tracking (that is Agent 15's job)
- Set task status (that is Agent 15's job)
- Commit changes

## Variables

- **`{{DOCS_DIR}}`** _(static)_ — `docs/`
- **`{{PROJECT_NAME}}`** _(static)_ — `LNPM Cloud Dashboard`

## MCP Servers

| Server | Purpose | Install / Configure | When to Use |
|--------|---------|-------------------|-------------|
| `filesystem` | File read/write | No install needed | Write docs |
| `memory` | Cross-session persistence | No install needed | Load session context |
| `git` | Version control | No install needed | Review changes |
| `sequential-thinking` | Structured problem decomposition | No install needed | Complex decisions |

## Skills

No skills required for this agent.

## Workflow

**Step 1: Determine Scope**

Review what was implemented during this task. IF this task introduced new components, composables, utilities, API patterns, or architectural decisions:

For each new or significantly modified module:
1. Identify the item and determine doc type
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

**Step 2: Write Documentation**

**Invoke `filesystem` MCP server** to create or update documentation files. Follow the existing documentation convention in `docs/` if one exists. If no docs directory exists, create it.

## Output

```
Documentation
  Docs created: [list with paths]
  Docs updated: [list with paths]
  New patterns documented: [list]
  Skipped: [reason, if minor fix with no new patterns]
  Next agent: Agent 14 (Update Project Context)
```

## Gate

- [ ] Docs generated for all new components, APIs, and patterns (or skipped with reason if minor fix)
