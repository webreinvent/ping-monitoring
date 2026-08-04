---
title: LNPM — Agent 03 — Verify & Test
description: Code review, UAT through browser automation, write unit tests and E2E tests — the complete quality assurance phase
version: 3.0
---

# Verify & Test

## Purpose

Quality assurance phase: review all implemented code, verify every acceptance criterion through browser automation, write unit tests, and write E2E tests. Fix all defects found. This is a **gate** — do not proceed until all checks pass.

## Variables

- **`{{PROJECT_ROOT}}`** *(static)* — `/Users/pk/Projects/ping-monitoring`
- **`{{DASHBOARD_DIR}}`** *(static)* — `dashboard/`
- **`{{DASHBOARD_URL}}`** *(static)* — `http://localhost:3000`
- **`{{AGENT_OUTPUT_DIR}}`** *(static)* — `.vaahagents/`
- **`{{TASK_ID}}`** *(dynamic)* — Provided by Agent 00 (e.g., `M1-T7`)

## Instructions

- Use the Playwright MCP server for all browser interactions — never rely on visual inspection alone.
- Use the Read tool for file reads, NOT `cat`, `head`, or `tail`.
- Parallelize infrastructure checks; UAT flows and test writing are sequential by nature.
- Invoke MCP servers before executing any workflow step that requires them.
- Write down key findings inline — file paths, patterns, constraints. This survives context compaction.
- Errors are not a reason to skip — they are the work.
- Use `TodoWrite` to track progress through the 4 workflow phases below.

## Scope Boundaries

**This agent MUST:**
- Run formatter, linter, type checker, dead code scan, complexity review
- Audit code against coding principles (DRY, KISS, YAGNI, SoC, SRP, SOLID, Security)
- Start the Nuxt dev server and navigate through every acceptance criterion via browser automation
- Take screenshots, check console, check network for errors
- Fix every bug found, re-run affected flows after each fix (regression test)
- **SET UP TESTING INFRASTRUCTURE** if not already configured (Vitest, Playwright)
- Write integration tests for API endpoints and services
- Write unit tests for business logic, validators, parsers, transformers
- Write deterministic Playwright E2E tests for all acceptance criteria
- Run all tests — every test must pass

**This agent MUST NOT:**
- Plan or redesign the implementation (that was Agent 01's job)
- Commit or push changes
- Skip bugs because they're "too hard"
- Skip because test infrastructure is missing — configure it instead
- Use CSS or XPath selectors in E2E tests
- Mask flakes with `test.skip` or `test.fixme`

## Input

- **From Agent 02:** Implemented code (all files created/modified per the plan).
- **From memory:** Task acceptance criteria (from `{{TASK_ID}}` scope file), implementation plan with file inventory.
- **From user:** Optional — additional test scenarios beyond acceptance criteria.

## Codebase Structure

```
ping-monitoring/
├── dashboard/
│   ├── app/                    # Frontend (pages, components, composables)
│   │   ├── components/         # Vue UI components
│   │   ├── composables/        # Shared composition functions
│   │   └── pages/              # File-based routing pages
│   ├── server/                 # Nitro server (API, middleware, plugins, utils)
│   │   ├── api/                # API route handlers
│   │   ├── middleware/         # Rate limiting, auth middleware
│   │   ├── plugins/            # Database plugin
│   │   ├── utils/              # Business logic utilities
│   │   └── ws/                 # WebSocket handlers
│   ├── shared/                 # Shared types between client and server
│   └── tests/
│       └── e2e/                # Playwright E2E test files (.spec.ts)
```

## MCP Servers

| Server | Purpose | When to Use |
|--------|---------|-------------|
| `playwright` | Browser automation | Navigate, snapshot, screenshot, console checks, run E2E tests |
| `git` | Version control | Review diff of all changes |
| `sequential-thinking` | Problem decomposition | Complex debugging, test design |
| `memory` | Cross-session persistence | Load implementation plan, task acceptance criteria |
| `filesystem` | File and directory operations | Create test files, read files |

## Skills

| Skill | Install Command | When to Invoke |
|-------|----------------|----------------|
| `nuxt` | Already available | Nuxt 4 / Nitro-specific code review, debugging |
| `playwright` | `npx skills add microsoft/playwright` | Before writing E2E tests |

**Skill Installation Protocol:** Before invoking any skill, check if installed. IF not installed, run `npx skills add <owner/repo>`. Wait for installation. THEN invoke the skill.

## Workflow

### Phase A: Code Review

#### Step A0: Prepare Environment

1. **Set Node.js version** — Source NVM and switch to Node 22:
   ```bash
   source ~/.nvm/nvm.sh && nvm use 22
   ```
   Verify `node --version` is **22.19.0+** or **24.11.0+**. If older, install: `nvm install 22 && nvm use 22`.
   **Warning:** Homebrew's Node may take PATH priority over NVM. Always verify.

2. **Rebuild native modules if needed** — If `better-sqlite3` fails:
   ```bash
   rm -rf node_modules/better-sqlite3 && npm install better-sqlite3@11.7.0 --build-from-source
   ```

3. **Start the dev server** — `cd dashboard && npm run dev`. Confirm it starts without errors. Note the port (may use 3001 if 3000 is in use).
4. **Fix any startup errors** — Diagnose and fix before proceeding.

**Gate:** The dev server must be running without errors before proceeding.

#### Step A1: Run Quality Checks

1. **Formatter** — Auto-format all changed files (`pnpm format` or equivalent)
2. **Linter** — Run ESLint. Zero warnings allowed. Fix issues.
3. **Type checker** — Run `npx tsc --noEmit` in dashboard directory. Zero errors. Fix issues.
4. **Dead code** — Scan for unused imports, variables, functions. Remove them.
5. **Complexity** — Review each function: >30 lines? >3 nesting levels? Multiple concerns? Refactor.

#### Step A2: Principles Audit

Review against:
- **DRY** — no duplicated logic; shared types in `dashboard/shared/types.ts`
- **KISS** — no unnecessary abstraction layers
- **YAGNI** — no out-of-scope features (e.g., auth for public dashboard)
- **SoC** — server logic in `server/`, UI in `app/`, types in `shared/`
- **SRP** — one responsibility per composable, component, or utility
- **SOLID** — no god components, no tight coupling between layers
- **Security** — input validation on ingest, rate limiting, SQL injection prevention (parameterized queries), CSP compliance
- **Accessibility** — semantic HTML, ARIA labels, keyboard navigation (UI only)

#### Step A3: Diff Review

**Invoke `git` MCP server** (`git diff`) to review all staged changes. Confirm no debug artifacts, no commented-out code, no `console.log` statements left in production code.

**Gate:** All quality checks pass. Diff is clean.

### Phase B: Automated UAT & Bug Fixes

#### Step B1: Infrastructure Readiness

1. **Start the Nuxt dev server** — `cd dashboard && npm run dev`
2. **Free blocked ports if needed** — Detect the actual port from server output.
3. **Verify server** — `curl <actual-port>/api/health` should return health metrics

**Gate:** Server must be running and healthy (200 on root and /api/health) before starting UAT.

#### Step B2: Load Acceptance Criteria

**Invoke `memory` MCP server** or read the task scope file for `{{TASK_ID}}` to load the acceptance criteria list. Write them inline so they survive compaction.

**Gate:** Acceptance criteria loaded before proceeding with UAT sweep.

#### Step B3: UAT Sweep

For each acceptance criterion:
1. Navigate to URL via Playwright MCP
2. Take accessibility snapshot
3. Drive the flow — click, fill, select, submit
4. Capture screenshot: `.vaahagents/screenshots/<flow>.png`
5. Check console — zero errors
6. Check network — zero 4xx/5xx

Cover:
- **Dashboard load** — homepage loads, sidebar renders, chart renders
- **Monitors list** — monitors appear in sidebar, grouped by client
- **Per-monitor view** — clicking a monitor shows detail view with chart and metrics
- **All-monitors chart** — combined chart shows all monitors
- **Live updates** — WebSocket connection established, real-time updates received
- **Settings** — settings modal/page loads and works
- **API endpoints** — test each API endpoint with correct request/response shapes
- **Edge cases** — empty state, error state, loading state

**Compaction survival:** Write the UAT result for each criterion inline (pass/fail + screenshot path).

### Phase C: Fix Bugs

After UAT sweep, enter the bug fix loop:

WHILE any criterion unverified OR errors detected:
1. Document the bug — expected vs actual, reproduction steps
2. Diagnose root cause
3. Implement fix — minimal change, run typecheck after
4. Regression test — re-run affected flow
5. Cascade check — IF shared code touched, re-run ALL flows

**Error recovery:**
- IF fix introduces new error, revert and re-diagnose. Never layer fixes.
- IF unable to find root cause after 3 attempts, escalate to user.

**Gate:** Every acceptance criterion verified, zero console errors, zero network errors, all screenshots captured, no open bugs.

### Phase D: Unit Tests

#### Step C1: Check & Configure Test Infrastructure

**IF the dashboard directory does not have a configured test runner:**
1. Install Vitest `^4.1.10` and any required plugins
2. Create `dashboard/vitest.config.ts` or add to `dashboard/nuxt.config.ts`
3. Set up test utilities: mock factories for database, fixtures for ping samples, helpers for API testing
4. Verify: `cd dashboard && pnpm test -- --run`

**Test patterns to follow:**
- Vitest with `describe`/`test` blocks
- Assertion style: `expect().toBe()`, `expect().toEqual()`
- Test files co-located: `*.test.ts` next to source files
- Mock database sessions — never hit a real database

**Gate:** Test infrastructure configured and verified before writing tests.

#### Step C2: Write Integration Tests

For each API endpoint or service:
- Create or extend a test file co-located with source
- Cover: happy path, primary edge case, primary error path, auth/permission guards
- Use mock database sessions

Test targets:
- `server/utils/ping-validation.ts` — validation rules
- `server/utils/ping-ingest.ts` — ingest engine (dedup, upsert, auto-create monitor)
- `server/utils/client.ts` — slug generation, name default, upsert
- `server/utils/quality-classifier.ts` — quality state transitions
- `server/utils/rate-limiter.ts` — rate limiting behavior
- `server/utils/cache.ts` — LRU cache operations
- API routes — test request/response shapes

#### Step C3: Write Unit Tests

Write for:
- Pure business-logic functions with non-trivial branches
- Validators, parsers, transformers, calculators
- Composables with conditional reactive behavior
- Edge-case handling that integration tests cannot exercise
- State machines, transition logic, status guards

#### Step C4: Run Tests

Run the full test suite: `cd dashboard && pnpm test -- --run`. All tests must pass.

**Gate:** All tests pass with zero failures. Typecheck and lint pass.

### Phase D: E2E Tests

#### Step D1: Check & Configure Playwright Infrastructure

**IF Playwright test infrastructure does not exist in the dashboard directory:**
1. Install Playwright test runner (`@playwright/test`)
2. Create `dashboard/playwright.config.ts` with Chromium and base URL `http://localhost:3000`
3. Set up global fixtures: API test data factories
4. Verify: `cd dashboard && npx playwright test --list`

**Gate:** Playwright infrastructure verified before proceeding.

#### Step D2: Write E2E Tests

For each acceptance criterion with frontend UI:
- Create `.spec.ts` file in `dashboard/tests/e2e/`
- Use `page.getByRole` / `page.getByTestId` selectors — never CSS/XPath
- Add `data-testid` attributes to Vue components as needed
- Cover: happy path, primary edge case, primary error path

E2E test scenarios:
- **Dashboard load** — navigate to `/`, verify sidebar, chart container, metrics area
- **Monitors list** — verify monitors appear in sidebar, grouped by client
- **Monitor selection** — click a monitor, verify detail view renders
- **All-monitors chart** — verify combined chart renders all monitors
- **Settings page** — navigate to settings, verify form fields
- **API health** — verify `/api/health` returns 200 with expected shape
- **WebSocket connection** — verify WS connection at `/ws/ping`

#### Step D3: Run E2E Tests

Run E2E tests. Run **twice** to confirm determinism. Fix any flakes — never `test.skip` or `test.fixme`.

#### Step D4: Regression Check

Run all unit tests from Phase C — confirm they still pass.

**Gate:** All E2E tests pass twice (deterministic). Unit tests still pass.

## Report

```
Verify & Test — LNPM Cloud Dashboard
  Code Review:
    Formatter: [pass]
    Linter: [pass / issues found and fixed]
    Type check: [pass / issues found and fixed]
    Dead code: [clean / removed]
    Complexity: [clean / refactored]
    Principles audit: [all passed / violations fixed]
    Diff reviewed: [clean]
  UAT:
    Acceptance criteria: [N total]
    Verified: [N passed]
    Bugs found and fixed: [list]
    Screenshots: [list of paths]
    Console errors: [zero / list]
    Network errors: [zero / list]
  Unit Tests:
    Infrastructure: [existing / configured]
    Integration tests: [N files, N tests]
    Unit tests: [N files, N tests]
    Pass: [N] | Fail: [N]
  E2E Tests:
    Infrastructure: [existing / configured]
    Test files: [list with paths]
    Total tests: [N]
    Pass: [N] | Fail: [N]
    Deterministic: [yes — ran twice]
    Regression: [unit tests still pass]
  Status: Complete | Partial | Blocked
  Next agent: Agent 04 (Document & Persist)
```
