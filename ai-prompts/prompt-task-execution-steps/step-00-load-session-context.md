---
step: 0
title: Load Session Context
phase: Orientation
---

# Step 0: Load Session Context

**Purpose:** Establish full project context and restore prior state before starting work.

## Instructions

1. **Invoke TodoWrite** with the full 19-step progress tracker from `{{PROMPT_FILE_PATH}}` § "Progress Tracker (TodoWrite)". Mark `step-00` as `in_progress`.

2. **Load project context** (only if not already in context from prior steps):
   - Read `AGENTS.md` at project root — conventions, ADRs (ADR-001–ADR-051), per-milestone sections. This is the primary AI-context file (450+ lines).
   - Read `{{MILESTONES_DIR}}/project-dashboard.md` for the current milestone dashboard.
   - Read `{{PROMPT_FILE_PATH}}` completely if this is a new session or `{{TASK_ID}}` changed.

3. **Check memory for prior context:**
   - Search `memory` MCP for notes tagged with `task-execution` and `{{TASK_ID}}`.
   - IF a prior plan exists (e.g., `"LNPM — {{TASK_ID}} Implementation Plan"`), load it and note which steps were already completed.
   - IF memory indicates a prior run was compacted, note the last completed step from the TodoWrite list.

4. **Verify project state:**
   - Run `git status` (Bash) — confirm working tree state and current branch.
   - Run `git branch` (Bash) — confirm `develop` branch exists (gitflow base).
   - IF the working tree has uncommitted changes from a previous task, flag them to the user before proceeding.

5. **Mark `step-00` as `completed`** in TodoWrite.

## Completion Criteria

- [ ] TodoWrite invoked with all 19 steps
- [ ] AGENTS.md and milestone dashboard loaded
- [ ] Memory checked for prior task context
- [ ] Git state verified (branch, uncommitted changes)
