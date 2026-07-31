---
title: LNPM - Agent 15 - Finalize & Commit
---

# Finalize & Commit

## Purpose

Finalize the LNPM Cloud Dashboard task: update task status, stage changes, and commit. This is the last agent in the pipeline.

## Scope Boundaries

**This agent MUST:**
- Update task status to `🟢 Complete` in tracking files
- Update `project-dashboard.md` with current progress
- Stage all changes and commit following Conventional Commits
- Report completion summary to the user

**This agent MUST NOT:**
- Implement code or fix bugs (that was Agent 07-09's job)
- Write tests (that was Agent 10-11's job)
- Push changes to remote without explicit user confirmation

## Variables

- **`{{PROJECT_NAME}}`** _(static)_ — `LNPM Cloud Dashboard`
- **`{{MILESTONES_DIR}}`** _(static)_ — `ai-milestones-and-tasks/`
- **`{{COMMIT_CONVENTION}}`** _(static)_ — Conventional Commits: `feat(scope): description`, `fix(scope): description`, `chore(scope): description`, `docs(scope): description`, `style(scope): description`

## MCP Servers

| Server | Purpose | Install / Configure | When to Use |
|--------|---------|-------------------|-------------|
| `git` | Version control | No install needed | Stage, commit, diff |
| `filesystem` | File read/write | No install needed | Update task status and dashboard |
| `memory` | Cross-session persistence | No install needed | Load session context |
| `sequential-thinking` | Structured problem decomposition | No install needed | Complex decisions |

## Skills

No skills required for this agent.

## Workflow

**Step 1: Finalize Task**

**Invoke `filesystem` MCP server:**
- Update the task file in `ai-milestones-and-tasks/` to status `🟢 Complete`
- Update `ai-milestones-and-tasks/project-dashboard.md` with current progress
- IF all tasks in a milestone are complete, update milestone status to `🟢 Complete`

**Step 2: Git Commit**

**Invoke `git` MCP server:**
- Review the diff one final time
- Stage all changes: `git add .`
- Write commit message following Conventional Commits:

```
feat(M1-T1): [task-id] Brief description

- Specific change 1
- Specific change 2

Refs: ai-milestones-and-tasks/[milestone]/[task-file]
```

Commit type mapping:
- `feat` — new feature or functionality
- `fix` — bug fix
- `chore` — maintenance, config, dependencies
- `docs` — documentation only
- `style` — formatting, no code change

- Commit locally. Do NOT push without user confirmation.

**Step 3: Notify Completion**

> "Task is complete on branch `[branch]`. Ready to merge."

Identify and list any tasks now unblocked based on the dependency graph in `project-dashboard.md`.

## Output

```
Task Finalized
  Task status: 🟢 Complete
  Dashboard: Updated
  Commit: [message]
  Branch: [branch name]
  Unblocked tasks: [list]
```

## Gate

- [ ] Task status updated to `🟢 Complete`
- [ ] Dashboard updated
- [ ] Committed locally (not pushed)
