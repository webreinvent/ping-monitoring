---
title: LNPM - Agent 11 - Write E2E Tests
description: Write deterministic Playwright E2E tests for all acceptance criteria with the LNPM Cloud Dashboard frontend UI.
version: 2.0
---

# Write E2E Tests

## Purpose

Write deterministic Playwright E2E tests for all acceptance criteria with the LNPM Cloud Dashboard frontend UI. IF Playwright test infrastructure is not configured, this agent configures it first. There is no skip path.

## Instructions

- **Tool-first approach:** Use MCP servers (playwright, git, memory, filesystem, sequential-thinking) before any CLI commands or manual steps.
- **Parallel reads:** Steps 1 (Install Skills) and 2 (Check & Configure Playwright Infrastructure) can be read in parallel. Steps 3 (Write Tests), 4 (Run Tests), and 5 (Regression Check) must be sequential.
- **Sequential reads:** Step 3 depends on Step 2 (Playwright must be configured before writing tests). Step 4 depends on Step 3 (tests must be written before running). Step 5 depends on Step 4 (regression check runs after E2E tests pass).
- **Compaction survival:** If the context window is nearing capacity, prioritize Steps 3 (Write E2E Tests) and 4 (Run Tests) — all E2E tests must pass twice before this agent completes.

## Scope Boundaries

**This agent MUST:**
- Install and invoke the Playwright skill
- **SET UP PLAYWRIGHT INFRASTRUCTURE** if not already configured (install Playwright, create config, set up fixtures)
- Write `.spec.ts` files for each acceptance criterion with frontend UI
- Use `page.getByRole` / `page.getByTestId` selectors — never CSS/XPath
- Run tests twice to confirm determinism
- Fix any flakes — never `test.skip` or `test.fixme`
- Run Agent 10 tests as regression check

**This agent MUST NOT:**
- Skip because Playwright is not configured — configure it instead
- Skip because the project "has no frontend" — the dashboard has a web UI
- Use CSS or XPath selectors
- Mask flakes with skip/fixme
- Commit changes

## Codebase Structure

```
ping-monitoring/
  dashboard/
    app/                    # Vue 3 pages, components, composables
      pages/
        index.vue           # Dashboard home page
        settings.vue        # Settings page
      components/           # Layout, Sidebar, Chart, Metrics, Modals
      composables/          # useMonitors, useWebSocket, useChart
    server/
      api/                  # Nitro API routes (health, ping, monitors, clients)
      ws/                   # WebSocket endpoints (ws/ping)
      middleware/           # Rate limiting middleware
      utils/                # Business logic (ping-validation, ping-ingest, etc.)
    tests/
      e2e/                  # Playwright E2E test files (.spec.ts)
    playwright.config.ts    # Playwright configuration
    nuxt.config.ts          # Nuxt 4 configuration
```

## Variables

- **`{{PROJECT_ROOT}}`** _(static)_ — `/Users/pk/Projects/ping-monitoring`
- **`{{DASHBOARD_DIR}}`** _(static)_ — `dashboard/`
- **`{{DASHBOARD_URL}}`** _(static)_ — `http://localhost:3000`

## MCP Servers

| Server | Purpose | Install / Configure | When to Use |
|--------|---------|-------------------|-------------|
| `playwright` | Browser automation | Configure Playwright MCP | Run E2E tests |
| `git` | Version control | No install needed | Review changes |
| `memory` | Cross-session persistence | No install needed | Load acceptance criteria |
| `filesystem` | File and directory operations | No install needed | Create test files |
| `sequential-thinking` | Structured problem decomposition | No install needed | Complex test design |

## Skills

| Skill | Install Command | When to Invoke |
|-------|----------------|----------------|
| `playwright` | `npx skills add microsoft/playwright` | Before writing E2E tests |

**Skill Installation Protocol:** Before invoking any skill, check if installed. IF not installed, run `npx skills add <owner/repo>`. Wait for installation. THEN invoke the skill.

## Workflow

### Step 1: Install Skills

Check and install each skill if needed.

**Gate:** All required skills installed and confirmed before proceeding.

### Step 2: Check & Configure Playwright Infrastructure

**IF Playwright test infrastructure does not exist in the dashboard directory:**
1. Install Playwright test runner (`@playwright/test`)
2. Create `dashboard/playwright.config.ts` with Chromium browser and base URL `http://localhost:3000`
3. Set up global fixtures: API test data factories (mock ping samples, monitor data)
4. Verify Playwright runs: `cd dashboard && npx playwright test --list`

**IF Playwright infrastructure exists**, verify it runs.

**Gate:** Playwright infrastructure verified (existing or newly configured) before proceeding.

### Step 3: Write E2E Tests

For each acceptance criterion with frontend UI:
- Create or extend a `.spec.ts` file in `dashboard/tests/e2e/`
- Use role/testid selectors — add `data-testid` attributes to Vue components as needed
- Cover: happy path, primary edge case, primary error path
- Use `await expect(...).toBeVisible()` assertions

E2E test scenarios:
- **Dashboard load test** — navigate to `/`, verify sidebar, chart container, and metrics area load
- **Monitors list test** — verify monitors appear in sidebar, grouped by client
- **Monitor selection test** — click a monitor, verify detail view renders
- **All-monitors chart test** — verify combined chart renders all monitors
- **Settings page test** — navigate to settings, verify form fields
- **API health test** — verify `/api/health` returns 200 with expected shape
- **WebSocket connection test** — verify WS connection is established at `/ws/ping`

### Step 4: Run Tests

Run E2E tests. Run twice to confirm determinism. Fix flakes.

**Gate:** All E2E tests pass twice (deterministic) before proceeding.

### Step 5: Regression Check

Run all tests from Agent 10 — confirm they still pass.

**Gate:** Agent 10 regression tests still pass.

## Report

Provide a concise report covering E2E test results:

```
E2E Tests — LNPM Cloud Dashboard
  Playwright infrastructure: [existing / configured]
  Test files created or updated: [list with paths]
  Total tests: [N]
  Pass: [N]
  Fail: [N]
  Deterministic: [yes — ran twice with same results]
  Regression: [Agent 10 tests still pass / Agent 10 tests failed — details]
  Status: [Complete | Partial | Blocked]
  Next agent: Agent 12 (Update AI Memory)
```

- **Complete:** All E2E tests pass twice, regression passes.
- **Partial:** Some tests pass, others blocked by infrastructure or runtime issues.
- **Blocked:** Cannot run tests (e.g., dashboard not running, Playwright install failed).
