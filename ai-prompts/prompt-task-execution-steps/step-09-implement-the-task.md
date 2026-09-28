---
step: 9
title: Implement the Task
phase: Execution
---

# Step 9: Implement the Task

**Purpose:** Write the code, in plan order, following established patterns.

## Instructions

1. **Load the coding-principles reference:**
   - `{{STEPS_DIR}}/reference-coding-principles.md`

2. **Implement in plan order** (from Step 7). For each file:
   - Use **Read** first to confirm current content (the file may have changed since Step 5).
   - Use **Edit** for modifications (never `sed`/`awk`).
   - Use **Write** for new files (never `echo >`).
   - Follow the pattern from the existing file you read in Step 5 — match naming, comment density, error handling, and import style.

3. **Coding conventions (from AGENTS.md):**
   - **Imports:** Relative extensionless paths in root TS (`./types`); aliases in dashboard (`#shared/types`, `#server/utils/...`, `~/composables/...`).
   - **Naming:** camelCase TS vars/functions, PascalCase types/interfaces, snake_case SQL columns. Rust: lowercase snake modules, PascalCase types, `rename_all = "camelCase"` serde.
   - **Error handling:**
     - Rust: `thiserror` enums, `From` impls between layers, `Result<T, CommandError>` for Tauri commands.
     - Dashboard API: h3 `createError({ statusCode, statusMessage, data: { error, code } })`.
     - Dashboard utils: throw `Error` with descriptive message; route catches and maps to HTTP code.
   - **Type style:** explicit interface fields, strict TS (`strict: true`, `noUnusedLocals/Parameters`, `noFallthroughCasesInSwitch`), JSDoc on server utils.
   - **Vue components:** `<script setup lang="ts">`, `useHead()` for titles, `data-testid` attributes, scoped CSS.

4. **Database migrations (dashboard):**
   - Create `dashboard/schema/migrations/NNN_description.sql` (next 3-digit number).
   - Also update `dashboard/schema/index.sql` to append the new migration's SQL.
   - Migration files are idempotent (use `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`).

5. **Rust storage changes (Tauri):**
   - Update `schema_info` version in `src-tauri/src/storage.rs`.
   - Add `ALTER TABLE` statements in the migration sequence (do NOT rewrite existing tables).

6. **Tauri command registration:**
   - Add new `#[tauri::command]` fn in `src-tauri/src/commands.rs`.
   - Register in `generate_handler!` in `src-tauri/src/lib.rs`.
   - Add corresponding `invoke` call in `src/api.ts`.

7. **WebSocket (dashboard):**
   - Use Nitro native `defineWebSocketHandler` in `server/routes/ws/`.
   - To call WS broadcast functions from API routes, use dynamic `import()` to avoid circular deps:
     `const { broadcastSample } = await import("#server/routes/ws/ping")`.

8. **After each file is written**, add a TodoWrite sub-task mark (e.g., `step-09a: types.ts updated`).

9. **Mark `step-09` as `completed`** in TodoWrite when all plan files are implemented.

## Completion Criteria

- [ ] All plan files created/modified in order
- [ ] Coding conventions followed (naming, imports, error handling)
- [ ] No TODO/TBD comments left in code
- [ ] TodoWrite sub-tasks updated per file
