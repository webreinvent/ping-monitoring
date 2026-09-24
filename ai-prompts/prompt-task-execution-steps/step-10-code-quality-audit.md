---
step: 10
title: Code Quality & Principles Audit
phase: Execution
---

# Step 10: Code Quality & Principles Audit

**Purpose:** Run all available quality gates on the implemented code and fix issues before testing.

## Instructions

1. **Dashboard TypeScript quality gate:**
   - Run `cd dashboard && pnpm typecheck` (Bash) — `nuxt typecheck`. Fix all type errors.
   - Run `cd dashboard && pnpm test` (Bash) — vitest. Fix all failing tests.
   - IF the task touched server code: run `cd dashboard && pnpm test` specifically for the affected `server/utils/*.test.ts` files.

2. **Root (Tauri) TypeScript quality gate:**
   - Run `pnpm build` (Bash) at root — `tsc && vite build`. Fix all type errors.
   - Run `pnpm test` (Bash) at root — vitest. Fix all failing tests.

3. **Rust quality gate (if any `src-tauri/` files changed):**
   - Run `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check` (Bash). IF output is non-empty, run `cargo fmt --manifest-path src-tauri/Cargo.toml --all` to fix, then re-check.
   - Run `cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets --all-features -- -D warnings` (Bash). Fix all warnings (clippy treats warnings as errors).
   - Run `cargo test --manifest-path src-tauri/Cargo.toml --locked` (Bash). Fix all failing tests.

4. **Manual code review checklist** (read each changed file):
   - [ ] No unused imports or variables (`noUnusedLocals` / `noUnusedParameters` enforced by tsc).
   - [ ] No `any` types introduced without justification.
   - [ ] Error paths handled (try/catch in API routes, `Result` in Rust).
   - [ ] No SQL string concatenation — use parameterized queries (`?` placeholders).
   - [ ] No hardcoded env var values — read from `process.env` with validation.
   - [ ] WebSocket handlers use `message.text` (Nitro native), not `message.data`.
   - [ ] Migrations are idempotent (`IF NOT EXISTS`).
   - [ ] `data-testid` attributes present on all new/changed dashboard UI elements.

5. **Fix all issues found.** Re-run the quality gates until clean.

6. **Report results** in your working notes (not a file):
   - Which commands ran, pass/fail counts, issues fixed.

7. **Mark `step-10` as `completed`** in TodoWrite.

## Completion Criteria

- [ ] `pnpm typecheck` (dashboard) — zero errors
- [ ] `pnpm test` (dashboard) — zero failures
- [ ] `pnpm build` (root) — zero errors (if root TS changed)
- [ ] `pnpm test` (root) — zero failures (if root TS changed)
- [ ] `cargo fmt --check` + `cargo clippy -D warnings` + `cargo test --locked` — all clean (if Rust changed)
- [ ] Manual review checklist passed
