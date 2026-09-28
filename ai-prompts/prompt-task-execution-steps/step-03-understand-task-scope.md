---
step: 3
title: Understand Task Scope
phase: Preparation & Planning
---

# Step 3: Understand Task Scope

**Purpose:** Fully understand what the task requires before planning any implementation.

## Instructions

1. **Read the task file completely:**
   - Path: `{{MILESTONES_DIR}}/milestone-{NN}-{name}/task-{{TASK_ID}}-*.md`
   - Note: title, description, acceptance criteria, feature IDs, effort estimate, dependencies.

2. **Read related requirement docs** (if the task references them):
   - `{{REQUIREMENTS_DIR}}/` — check for a matching requirement doc by feature ID.
   - `{{DOCS_DIR}}/` — check for relevant architecture, API, database, or frontend docs.
   - IF no requirement doc exists for the task's feature ID, note it as `manual-verified` scope.

3. **Identify the stack boundary:**
   - **Dashboard task:** touches `dashboard/` (app/, server/, shared/, schema/).
   - **Tauri task:** touches `src/` and/or `src-tauri/`.
   - **Cross-stack task:** touches both (e.g., new API endpoint consumed by dashboard UI, or new Tauri command synced to dashboard).

4. **List the files you expect to touch** (provisional list — will be refined in Step 7):
   - For Dashboard: `dashboard/shared/types.ts`, `dashboard/server/utils/`, `dashboard/server/api/`, `dashboard/app/`, `dashboard/schema/migrations/`.
   - For Tauri: `src-tauri/src/`, `src/` (TypeScript frontend).
   - For Cross-stack: both sets above.

5. **Write a scope summary** to memory:
   - Title: `LNPM — {{TASK_ID}} Scope`
   - Tags: `task-scope`, `{{TASK_ID}}`
   - Content: task summary, stack, expected files, open questions.

6. **Mark `step-03` as `completed`** in TodoWrite.

## Completion Criteria

- [ ] Task file read completely
- [ ] Related requirement/docs checked
- [ ] Stack identified (Dashboard / Tauri / Cross-stack)
- [ ] Provisional file list written
- [ ] Scope summary persisted to memory
