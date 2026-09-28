---
step: 14
title: Propagate Impact to Upcoming Tasks
phase: Completion
---

# Step 14: Propagate Impact to Upcoming Tasks

**Purpose:** Document how this task's changes affect upcoming tasks so the next task executor doesn't re-derive context.

## Instructions

1. **Review the milestone dashboard:** `{{MILESTONES_DIR}}/project-dashboard.md`.

2. **Identify upcoming tasks** (status = Not Started) that may be affected by this task's changes:
   - New types in `dashboard/shared/types.ts` that upcoming tasks will consume.
   - New migrations that change the DB schema upcoming tasks will build on.
   - New composables or utilities that upcoming tasks should reuse.
   - New Tauri commands that upcoming tasks should call via `src/api.ts`.
   - New CSS design tokens or component patterns that upcoming tasks should follow.

3. **For each affected upcoming task file** (`{{MILESTONES_DIR}}/milestone-{NN}-{name}/task-{ID}-*.md`):
   - Add a short note to the task file's "Notes" or "Dependencies" section (append, do NOT rewrite):
     ```
     > **Note ({{TASK_ID}}):** [one-line description of what changed and why it matters for this task].
     ```
   - Only add notes for tasks that are genuinely affected — do not add boilerplate notes to every task.

4. **Update the feature coverage table** in `project-dashboard.md` if this task completed a feature (F1–F14) that upcoming tasks depend on.

5. **Write impact summary to memory:**
   - Title: `LNPM — {{TASK_ID}} Impact Propagation`
   - Tags: `impact-propagation`, `{{TASK_ID}}`
   - Content: list of upcoming tasks affected, what changed, what the next task should know.

6. **Mark `step-14` as `completed`** in TodoWrite.

## Completion Criteria

- [ ] Upcoming tasks reviewed for impact
- [ ] Notes added to genuinely affected task files (appended, not rewritten)
- [ ] Feature coverage table updated (if a feature was completed)
- [ ] Memory entry created
