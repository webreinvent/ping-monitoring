---
step: 7
title: Create Implementation Plan
phase: Preparation & Planning
---

# Step 7: Create Implementation Plan

**Purpose:** Produce a step-by-step implementation plan that orders work by dependency and layer.

## Instructions

1. **Order work by layer** (lowest → highest dependency):

   **Dashboard tasks:**
   1. `dashboard/shared/types.ts` — new/changed type contracts (client-server).
   2. `dashboard/schema/migrations/NNN_*.sql` — new migration if schema changes (3-digit prefix, continues from latest).
   3. `dashboard/server/utils/` — business logic (pure functions, testable).
   4. `dashboard/server/api/` or `dashboard/server/routes/ws/` — HTTP/WS routes.
   5. `dashboard/server/plugins/` — only if startup/shutdown lifecycle changes.
   6. `dashboard/app/composables/` — data-fetching / WS composables.
   7. `dashboard/app/components/` — Vue components.
   8. `dashboard/app/pages/` — route-level pages (last, depends on all above).

   **Tauri tasks:**
   1. `src-tauri/src/domain.rs` — core types if changed.
   2. `src-tauri/src/{module}.rs` — business logic (probe, quality, storage, sync, monitor).
   3. `src-tauri/src/storage.rs` — DB schema changes (rusqlite; `schema_info` version + `ALTER TABLE`).
   4. `src-tauri/src/commands.rs` — new/changed `#[tauri::command]` functions.
   5. `src-tauri/src/lib.rs` — register new commands in `generate_handler!` + state.
   6. `src/api.ts` — frontend `invoke` bridge.
   7. `src/types.ts` — frontend types.
   8. `src/main.ts` — UI wiring (last).

   **Cross-stack tasks:** dashboard backend first (types → migrations → utils → routes), then dashboard frontend, then Tauri (Rust → TS frontend).

2. **For each file to create/modify**, specify:
   - File path (absolute or repo-relative).
   - What to add/change (1–3 sentences).
   - Which existing pattern to follow (reference the file you read in Step 5).

3. **Identify test targets:**
   - Dashboard: `*.test.ts` colocated; `*.integration.test.ts` for DB-level; Playwright `*.spec.ts` for E2E.
   - Tauri: `#[cfg(test)]` modules in the same `.rs` file; `*.test.ts` in `src/` for frontend logic.

4. **Write the plan to memory:**
   - Title: `LNPM — {{TASK_ID}} Implementation Plan`
   - Tags: `implementation-plan`, `{{TASK_ID}}`
   - Content: ordered file list, changes per file, test targets, estimated effort.

5. **Mark `step-07` as `completed`** in TodoWrite.

## Completion Criteria

- [ ] Implementation ordered by layer (shared → server → frontend)
- [ ] Each file change specified with pattern reference
- [ ] Test targets identified
- [ ] Plan persisted to memory (recoverable after compaction)
