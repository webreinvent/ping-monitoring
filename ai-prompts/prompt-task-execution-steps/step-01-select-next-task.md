---
step: 1
title: Select Next Task
phase: Orientation
---

# Step 1: Select Next Task

**Purpose:** Identify the next development task from the milestone tracker.

## Instructions

1. **Read the milestone dashboard:** `{{MILESTONES_DIR}}/project-dashboard.md`.

2. **Identify the active milestone:**
   - Current status as of 2026-09-25: M1 (Backend Platform) 🟢 Complete (11/12), M2 (Dashboard UI) 🟢 Complete (9/9), M3 (Tauri Client Enhancement) ⚪ Not Started (0/2).
   - Pick the earliest milestone with an incomplete task, in dependency order.
   - **Note:** `project-dashboard.md` may still show M1-T11 as "Not Started" — this is a known staleness (the task file says Complete). Skip M1-T11; M3 is the active milestone.

3. **Open the milestone directory** (`{{MILESTONES_DIR}}/milestone-{NN}-{name}/`) and scan task files:
   - M3 tasks: `task-M3-T1-match-tauri-chart-with-dashboard.md`, `task-M3-T2-fix-tauri-slug-generation.md`
   - Each task file has frontmatter with `Status:` (Not Started / In Progress / Complete), priority, and effort.

4. **Select the next task** by:
   - Status = `Not Started` (or `In Progress` if resuming).
   - Dependencies satisfied (check the `dependencies:` field in the task frontmatter against completed tasks).
   - Highest priority within the milestone.

5. **Extract task details from the task file:**
   - `{{TASK_ID}}` (e.g., `M3-T1`)
   - Task title and acceptance criteria
   - Related feature IDs (F1–F14) if mentioned
   - Affected stack: Dashboard, Tauri, or Cross-stack

6. **Persist to memory:** Create a `memory` MCP note:
   - Title: `LNPM — {{TASK_ID}} Selected`
   - Tags: `task-selection`, `{{TASK_ID}}`
   - Content: task title, acceptance criteria, dependencies, stack, priority.

7. **Mark `step-01` as `completed`** in TodoWrite.

## Completion Criteria

- [ ] Task file read and `{{TASK_ID}}` set
- [ ] Dependencies verified as complete
- [ ] Stack identified (Dashboard / Tauri / Cross-stack)
- [ ] Memory entry created for task selection
