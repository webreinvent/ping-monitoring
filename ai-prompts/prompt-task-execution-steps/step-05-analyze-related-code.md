---
step: 5
title: Analyze Related Code
phase: Preparation & Planning
---

# Step 5: Analyze Related Code

**Purpose:** Understand the existing code the task will modify or extend, so the implementation fits established patterns.

## Instructions

1. **Load the key-files reference:**
   - `{{STEPS_DIR}}/reference-key-files.md` — maps task types to relevant files.

2. **Read the files the task will touch or depend on** (use Read tool, not cat):

   **Dashboard tasks — read in this order:**
   - `dashboard/shared/types.ts` — client-server type contract. Check for existing types the task reuses.
   - `dashboard/server/utils/db.ts` — `getDb()` pattern (singleton on `globalThis.__db`).
   - The relevant `dashboard/server/utils/{module}.ts` — existing business logic to extend.
   - The relevant `dashboard/server/api/{route}.ts` — existing route patterns.
   - `dashboard/schema/migrations/` — latest migration number (new migrations continue the sequence).
   - `dashboard/app/composables/` — existing composables for the feature area.
   - `dashboard/app/components/` — existing components in the same feature group.

   **Tauri tasks — read in this order:**
   - `src-tauri/src/lib.rs` — app builder, registered commands, state.
   - `src-tauri/src/commands.rs` — existing command patterns, `CommandError` mapping.
   - `src-tauri/src/{module}.rs` — the module the task modifies.
   - `src-tauri/src/storage.rs` — DB schema if the task touches local DB.
   - `src/api.ts` — Tauri invoke bridge (frontend side).
   - `src/types.ts` — frontend types mirroring Rust serde output.

   **Cross-stack tasks:** read both sets above.

3. **Note patterns to preserve:**
   - Naming conventions (camelCase TS, PascalCase types, snake_case SQL columns, `rename_all = "camelCase"` serde).
   - Error handling patterns (`thiserror` enums in Rust; h3 `createError` in dashboard; `CommandError` for Tauri commands).
   - Test patterns (colocated `*.test.ts`, `#[cfg(test)]` in Rust, mocked DB in dashboard vitest).

4. **Identify what NOT to change:**
   - Files outside the task scope.
   - Working code that the task does not require modifying.

5. **Write analysis to memory:**
   - Title: `LNPM — {{TASK_ID}} Code Analysis`
   - Tags: `code-analysis`, `{{TASK_ID}}`
   - Content: files read, patterns observed, files to preserve, files to modify.

6. **Mark `step-05` as `completed`** in TodoWrite.

## Completion Criteria

- [ ] All task-relevant source files read
- [ ] Existing patterns documented
- [ ] Files to preserve identified
- [ ] Code analysis persisted to memory
