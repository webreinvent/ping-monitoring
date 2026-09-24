---
step: 8
title: Audit & Present Plan
phase: Preparation & Planning
---

# Step 8: Audit & Present Plan

**Purpose:** Self-audit the implementation plan for completeness and correctness, then present it to the user for approval before writing any code.

## Instructions

1. **Audit the plan against this checklist:**

   - [ ] **Scope coverage:** Every acceptance criterion from the task file maps to at least one planned file change.
   - [ ] **No placeholder bullets:** No "TBD", "TODO", "add later", or vague "wire up" items without a concrete file path.
   - [ ] **Layer ordering:** No file depends on a file that appears later in the plan.
   - [ ] **Migration numbering:** Any new migration uses the correct next 3-digit number (check `dashboard/schema/migrations/` for the latest).
   - [ ] **Schema change confirmation:** IF the plan modifies `dashboard/schema/migrations/` or adds a new migration file, flag it — this requires user confirmation before applying (per Blast Radius rule).
   - [ ] **Tauri config confirmation:** IF the plan modifies `src-tauri/tauri.conf.json`, flag it — requires user confirmation.
   - [ ] **Type contract consistency:** Any new shared type in `dashboard/shared/types.ts` has a matching Rust serde struct (`rename_all = "camelCase"`) if cross-stack. Note the deliberate `mac_address` snake_case exception for the dashboard ingest contract.
   - [ ] **Test plan completeness:** Every new/modified function has a test target.
   - [ ] **No out-of-scope changes:** The plan does not touch files outside the task's stated scope.
   - [ ] **`data-testid` plan:** Dashboard UI changes include `data-testid` attributes for E2E.

2. **Fix any gaps found** — update the plan in memory (overwrite the `LNPM — {{TASK_ID}} Implementation Plan` entry).

3. **Present the plan to the user** in this format:

   ```
   ## Implementation Plan — {{TASK_ID}}
   
   **Task:** [task title]
   **Stack:** [Dashboard | Tauri | Cross-stack]
   **Branch:** {{FEATURE_BRANCH}}
   
   ### Files to create/modify (in order)
   1. [file path] — [what changes, 1–2 sentences]
   2. ...
   
   ### Tests
   - [test file / test description]
   
   ### Confirmation required (if any)
   - [migration change / tauri.conf.json change — flag for user approval]
   
   ### Estimated effort
   [from task file]
   ```

4. **Wait for user approval** before proceeding to Step 9. If the user requests changes, revise the plan and re-audit.

5. **Mark `step-08` as `completed`** in TodoWrite.

## Completion Criteria

- [ ] Full audit checklist passed
- [ ] Plan presented to user in the specified format
- [ ] User approval received
- [ ] Any flagged confirmations (migrations, tauri.conf.json) explicitly approved
