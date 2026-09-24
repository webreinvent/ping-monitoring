---
step: 11
title: Automated UAT & Bug Fixes
phase: Execution
---

# Step 11: Automated UAT & Bug Fixes

**Purpose:** Run acceptance tests against the running application and fix any bugs found.

## Stack Branching

### Dashboard tasks — full UAT

1. **Start the dev server** (if not already running):
   - Run `cd dashboard && pnpm dev` (Bash, background) — Nuxt dev server on port 3000.
   - Wait for the server to be ready (check for `Local: http://localhost:3000`).

2. **Run the test suite:**
   - Run `cd dashboard && pnpm test` (Bash) — vitest unit/integration tests.
   - Run `cd dashboard && pnpm test:e2e` (Bash) — Playwright E2E (starts its own dev server via `webServer` config).

3. **Use Playwright MCP tools for interactive UAT** (for acceptance criteria that E2E tests don't cover):
   - Navigate to `http://localhost:3000` (or the specific page the task affects).
   - Interact with the UI: click, fill forms, verify rendered state.
   - Take a screenshot at each acceptance-criterion checkpoint.
   - Check the browser console for errors (`browser_get_console_logs`).

4. **For each acceptance criterion in the task file:**
   - Verify it is met (via E2E test result, MCP interaction, or screenshot).
   - Mark `verified` or `manual-verified` (if you could not automate the check).
   - IF a criterion fails: fix the bug, re-run the relevant test, re-verify.

5. **Stop the dev server** after UAT is complete (if you started it).

### Tauri tasks — lighter UAT

1. **Run unit/integration tests:**
   - Run `pnpm test` (Bash, root) — vitest for `src/` TypeScript.
   - Run `cargo test --manifest-path src-tauri/Cargo.toml --locked` (Bash) — Rust unit tests.

2. **If the task involves UI changes in `src/main.ts`:**
   - The Tauri desktop app cannot be driven by Playwright MCP (it's a native window, not a web page).
   - Verify logic via unit tests and manual code review.
   - Label UI verification as `manual-verified` unless the task includes a testable composable.

3. **For each acceptance criterion:** mark `verified` or `manual-verified`.

### Cross-stack tasks

- Run dashboard UAT (full) + Tauri UAT (lighter) above.
- Verify the cross-stack contract: the Tauri payload matches the dashboard API contract (check `dashboard/shared/types.ts` against `src-tauri/src/sync.rs` payload).

## Memory Entry

- Title: `LNPM — {{TASK_ID}} UAT Results`
- Tags: `uat`, `{{TASK_ID}}`
- Content: acceptance criteria results (verified / manual-verified), bugs found and fixed.

## Completion Criteria

- [ ] All test suites pass (per stack)
- [ ] Every acceptance criterion marked `verified` or `manual-verified`
- [ ] All bugs found during UAT are fixed
- [ ] Memory entry created
