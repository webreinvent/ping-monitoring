---
step: 16
title: Update Tracking & Generate Docs
phase: Completion
---

# Step 16: Update Tracking & Generate Docs

**Purpose:** Update the milestone dashboard and generate/update documentation for the completed task.

## Instructions

### 1. Update task file status

- Open the task file: `{{MILESTONES_DIR}}/milestone-{NN}-{name}/task-{{TASK_ID}}-*.md`.
- Update the frontmatter `Status:` field to `Complete` (or `In Progress` if partially done).
- Update the `> **Status:**` line in the file body to match.
- Append a "Completion Notes" section at the end of the task file:
  ```markdown
  ## Completion Notes
  - **Completed:** [YYYY-MM-DD]
  - **Branch:** {{FEATURE_BRANCH}}
  - **Files changed:** [list]
  - **Tests:** [pass count + commands]
  - **Notes:** [key decisions, patterns established]
  ```

### 2. Update milestone dashboard

- Open `{{MILESTONES_DIR}}/project-dashboard.md`.
- Update the task row for `{{TASK_ID}}`: change status from `Not Started` / `In Progress` to `Complete`.
- Update the milestone progress count (e.g., M3: 0/2 → 1/2).
- Update the overall progress percentage if the milestone count changed.

### 3. Generate/update documentation

- Check `{{DOCS_DIR}}/` for an existing doc that covers this task's feature:
  - API endpoints: `{{DOCS_DIR}}/api/{endpoint-name}.md`
  - Database tables: `{{DOCS_DIR}}/database/{table-name}-table.md`
  - Frontend components: `{{DOCS_DIR}}/frontend/components/{ComponentName}.md`
  - Composables: `{{DOCS_DIR}}/frontend/composables/{useXxx}.md`
  - Utils: `{{DOCS_DIR}}/utils/{module}.md`
  - WebSocket: `{{DOCS_DIR}}/websocket/{topic}.md`

- IF a doc exists for the touched module: update it with the new/changed behavior.
- IF no doc exists and the task added a significant new module: create a new doc file following the existing structure (H1 title, "## Purpose", "## API", "## Usage", "## Patterns" sections).
- IF the task was a small fix with no new module: skip doc creation (note in working notes).

### 4. Memory entry

- Title: `LNPM — {{TASK_ID}} Tracking Updated`
- Tags: `tracking`, `{{TASK_ID}}`
- Content: task file status updated, dashboard progress updated, docs created/updated (list).

### 5. Mark `step-16` as `completed`** in TodoWrite.

## Completion Criteria

- [ ] Task file `Status:` updated to `Complete`
- [ ] Task file "Completion Notes" section appended
- [ ] Milestone dashboard task row + progress count updated
- [ ] Relevant docs updated or created (or skip justified)
- [ ] Memory entry created
