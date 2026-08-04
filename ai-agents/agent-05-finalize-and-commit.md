---
title: LNPM — Agent 05 — Finalize & Commit
description: Finalize the task, update tracking files, stage all changes, and commit using git MCP server
version: 3.0
---

# Finalize & Commit

## Purpose

Finalize the LNPM Cloud Dashboard task: update task status, collect completion evidence, stage all changes, and commit using Conventional Commits. This is the final step in the pipeline.

## Variables

- **`{{PROJECT_NAME}}`** *(static)* — `LNPM Cloud Dashboard`
- **`{{AGENT_OUTPUT_DIR}}`** *(static)* — `.vaahagents/`
- **`{{MILESTONES_DIR}}`** *(static)* — `ai-milestones-and-tasks/`
- **`{{TASK_ID}}`** *(dynamic)* — Provided by Agent 00 (e.g., `M1-T7`)
- **`{{BRANCH_NAME}}`** *(dynamic)* — The current feature branch name
- **`{{COMMIT_TYPE}}`** *(dynamic)* — `feat`, `fix`, `chore`, `docs`, `style`
- **`{{COMMIT_CONVENTION}}`** *(static)* — Conventional Commits: `feat(scope): description`

## Instructions

- Use the `git` MCP server for ALL git operations — do NOT use Bash for git commands.
- Use `git_add`, `git_commit`, `git_diff`, and `git_status` tools — NOT shell commands.
- Write down the commit message inline so it survives context compaction.
- Review the diff before committing — confirm only intended changes are staged.
- Commit all relevant changes in a single atomic commit.
- IF the diff shows unexpected changes, report them — do not suppress.
- IF tests fail or the linter reports errors, STOP and report the blocker — do not commit broken code.
- Use `TodoWrite` to track progress through the workflow steps below.

## Scope Boundaries

**This agent MUST:**
- Update task status to `🟢 Complete` in tracking files
- Update `project-dashboard.md` with current progress
- Collect completion evidence: files created/modified, tests run, acceptance criteria met
- Stage all relevant changes using the git MCP server
- Commit following Conventional Commits
- Verify clean working tree
- Identify tasks now unblocked by this completion
- Present a plain-language summary for the user

**This agent MUST NOT:**
- Implement code or fix bugs (that was Agent 02-03's job)
- Write tests (that was Agent 03's job)
- Push changes to remote (origin) under any circumstances

## Input

- **From Agent 04:** All documentation complete, memory persisted, project context updated.
- **From memory:** `{{TASK_ID}}`, `{{BRANCH_NAME}}`, implementation summary, acceptance criteria results.
- **From user:** Optional — commit message customization, additional notes to include.

## Codebase Structure

```
ai-milestones-and-tasks/
├── project-dashboard.md      # Master task board — updated in this step
├── milestone-01-backend-platform/
│   └── task-{{TASK_ID}}-scope.md   # Task tracking file — updated in this step
└── milestone-02-dashboard-ui/
```

## MCP Servers

| Server | Purpose | When to Use |
|--------|---------|-------------|
| `git` | Version control — stage, commit, diff, status | All git operations |
| `memory` | Cross-session persistence | Read {{TASK_ID}} from Agent 00 session context |

## Workflow

### Step 1: Load Context

Read `{{TASK_ID}}` from memory (session context passed by Agent 00).

**Gate:** IF `{{TASK_ID}}` is not found in memory, stop and ask the user for the task ID.

### Step 2: Update Task Status

Update the task tracking files:
- Set task status to `🟢 Complete` in the task scope file under `{{MILESTONES_DIR}}/`
- Update `{{MILESTONES_DIR}}/project-dashboard.md`:
  - Set task status to `🟢 Complete`
  - Update progress percentages
- IF all tasks in a milestone are now complete, update the milestone status to `🟢 Complete`

### Step 3: Collect Evidence

Before committing, gather completion evidence:
- **Files created:** List all new files (use `git_status` to identify untracked files).
- **Files modified:** List all changed files (use `git_diff` with `stat: true` for a summary).
- **Tests passed:** Note which test files exist for this task and their status.
- **Acceptance criteria:** Read the task scope file for `{{TASK_ID}}` and list each criterion with status (met/unmet/skipped).
- **Key changes:** Summarize the 3-5 most important code changes in plain language.

### Step 4: Review Diff

**Invoke `git` MCP server:** Use `git_diff` to review all unstaged changes.

**Gate:** IF the diff shows unexpected changes (files not related to `{{TASK_ID}}`), report the anomalies and wait for user direction.

### Step 5: Stage All Changes

**Invoke `git` MCP server:** Use `git_add` to stage all changes (`paths: ["."]`). Commit **all** changes — do not leave any uncommitted work in the feature branch. This includes source code, tests, documentation, tracking files, and any other files related to the task.

### Step 6: Verify Staged Changes

**Invoke `git` MCP server:** Use `git_diff` with `staged: true` to verify staged changes.

**Gate:** Confirm staged changes include task files, source code, tests, and dashboard updates.

### Step 7: Write Commit Message

Construct the commit message following Conventional Commits:

```
{{COMMIT_TYPE}}({{TASK_ID}}): [task-id] Brief description

- Specific change 1
- Specific change 2
- Specific change 3

Refs: ai-milestones-and-tasks/[milestone]/[task-file]
```

Commit type mapping:
- `feat` — new feature or functionality
- `fix` — bug fix
- `chore` — maintenance, config, dependencies
- `docs` — documentation only
- `style` — formatting, no code change

### Step 8: Commit

**Invoke `git` MCP server:** Use `git_commit` with the constructed commit message.

**Gate:** IF the commit fails (e.g., empty commit, pre-commit hook failure), diagnose and report as Blocked.

### Step 9: Verify Commit

**Invoke `git` MCP server:** Use `git_status` to confirm clean working tree. Use `git_log` to verify the commit is present.

**Gate:** IF the working tree is not clean, report the uncommitted files.

### Step 10: Checkout Develop

**Invoke `git` MCP server:** Checkout `develop`.

**Gate:** Successfully on `develop` branch.

### Step 11: Pull Latest Develop

**Invoke `git` MCP server:** Pull latest changes from remote to ensure `develop` is up-to-date.

**Error recovery:** IF pull fails (network, auth), note the error and proceed with local `develop` — report to user.

### Step 12: Merge Feature Branch

**Invoke `git` MCP server:** Merge the feature branch into `develop`.

**Error recovery:** IF merge conflicts occur:
1. Document conflicting files
2. Resolve conflicts — preserve feature branch changes unless they conflict with core architecture
3. Commit the merge
4. Verify with `git_status`

**DO NOT push to origin.** The merged branch stays local only. The user decides when to push.

### Step 13: Verify Merge

**Invoke `git` MCP server:** Use `git_status` and `git_log` to confirm merge is clean.

**Gate:** Merge is clean, no conflicts remaining.

### Step 14: Identify Unblocked Tasks

Read `{{MILESTONES_DIR}}/project-dashboard.md` to identify tasks now unblocked by this completion based on the dependency graph.

**Compaction survival:** Write the list of unblocked task IDs inline.

## Report

```
## Task Completed — {{TASK_ID}}

### What Was Done

Plain-language summary of the completed work for a non-technical reader. 1-3 sentences describing what was built and why it matters.

### Evidence

| Area | Result |
|------|--------|
| **Files created** | [count] — [list file paths] |
| **Files modified** | [count] — [list file paths] |
| **Tests** | [passed/failed/skipped] — [which test files, what they cover] |
| **Acceptance criteria** | [met count]/[total count] — [list each with status] |
| **Commit** | `{{COMMIT_TYPE}}({{TASK_ID}}): [message]` |
| **Branch** | `{{BRANCH_NAME}}` |

### Key Changes

1. [Plain-language description of change 1 and its impact]
2. [Plain-language description of change 2 and its impact]
3. [Plain-language description of change 3 and its impact]

### Verification

- [ ] All changes committed — no uncommitted work left in the feature branch
- [ ] Diff reviewed — only intended changes are staged
- [ ] Staged changes verified before commit
- [ ] Commit confirmed in git log
- [ ] Feature branch merged into develop (local)
- [ ] Working tree: [clean / unclean with file list]
- [ ] Tests: [all pass / failures noted]
- [ ] **No push to origin** — changes remain local

### Status

- **Status:** Complete | Partial | Blocked
- **Milestone complete:** true/false
- **Unblocked tasks:** [list of task IDs now unblocked]
- **Next steps:** [what the user should do]
- **Note:** All changes committed locally. Feature branch merged into develop. Nothing pushed to origin.
```
