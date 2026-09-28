---
step: 12
title: Write Unit and Integration Tests
phase: Execution
---

# Step 12: Write Unit and Integration Tests

**Purpose:** Add tests for all new/modified logic so the test suite covers the task's changes.

## Instructions

### Dashboard (vitest)

1. **Unit tests** — colocated `*.test.ts` files next to source:
   - Server utils: `dashboard/server/utils/{module}.test.ts` (mock DB with the pattern from `dashboard/test/mock-db-factory.ts`).
   - Composables: `dashboard/app/composables/{composable}.test.ts`.
   - Utils: `dashboard/app/utils/{module}.test.ts`.
   - **IMPORTANT:** better-sqlite3 is a native module that segfaults in forked vitest workers. Always mock it — see `dashboard/test/setup.ts` and existing test files for the mock pattern.

2. **Integration tests** — `*.integration.test.ts` for DB-level behavior:
   - Test actual SQL against a real SQLite file (not the mock) when the logic is SQL-dependent.
   - Use `dashboard/test/fixtures.ts` for test data setup.

3. **Test naming and style:**
   - `describe` blocks per module/function.
   - `it` descriptions: "should [expected behavior] when [condition]".
   - Edge cases in separate `*.edge-cases.test.ts` files if the module has non-obvious boundary conditions.

4. **Run the tests:**
   - Run `cd dashboard && pnpm test` (Bash) — all tests must pass.

### Tauri (Rust)

1. **Unit tests** — `#[cfg(test)] mod tests` blocks in the same `.rs` file:
   - Test pure functions directly.
   - For storage: use `tempfile` (dev-dependency) to create a temporary SQLite DB.
   - For probe/monitor: test the status classification logic, not the actual ping execution.

2. **Run the tests:**
   - Run `cargo test --manifest-path src-tauri/Cargo.toml --locked` (Bash) — all tests must pass.

### Tauri frontend (TypeScript)

1. **Unit tests** — colocated `*.test.ts` in `src/`:
   - Test pure logic functions (e.g., `dashboard-selection.ts`, `chart-tooltip.ts`).
   - Mock `@tauri-apps/api` invoke calls.

2. **Run the tests:**
   - Run `pnpm test` (Bash, root) — all tests must pass.

### Cross-stack tasks

- Write tests in all affected stacks above.
- Add a contract test in `dashboard/server/utils/` if the Tauri→dashboard payload shape changed (verify the shape matches `dashboard/shared/types.ts`).

## Memory Entry

- Title: `LNPM — {{TASK_ID}} Test Results`
- Tags: `test-results`, `{{TASK_ID}}`
- Content: test files added, pass/fail counts per stack, any tests that could not be automated.

## Completion Criteria

- [ ] Every new/modified function has at least one test
- [ ] Dashboard: `pnpm test` — zero failures
- [ ] Root TS: `pnpm test` — zero failures (if changed)
- [ ] Rust: `cargo test --locked` — zero failures (if changed)
- [ ] Memory entry created
