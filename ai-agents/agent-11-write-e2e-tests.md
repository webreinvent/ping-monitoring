---
title: LNPM - Agent 11 - Write E2E Tests
---

# Write E2E Tests

## Purpose

Write deterministic Playwright E2E tests for all acceptance criteria with the LNPM Cloud Dashboard frontend UI. IF Playwright test infrastructure is not configured, this agent configures it first. There is no skip path.

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

**Step 1: Install Skills**

Check and install each skill if needed.

**Step 2: Check & Configure Playwright Infrastructure**

**IF Playwright test infrastructure does not exist in the dashboard directory:**
1. Install Playwright test runner (`@playwright/test`)
2. Create `dashboard/playwright.config.ts` with Chromium browser and base URL `http://localhost:3000`
3. Set up global fixtures: API test data factories (mock ping samples, monitor data)
4. Verify Playwright runs: `cd dashboard && npx playwright test --list`

**IF Playwright infrastructure exists**, verify it runs.

**Step 3: Write E2E Tests**

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

**Step 4: Run Tests**

Run E2E tests. Run twice to confirm determinism. Fix flakes.

**Step 5: Regression Check**

Run all tests from Agent 10 — confirm they still pass.

## Output

```
E2E Tests
  Playwright infrastructure: [existing / configured]
  Test files: [list with paths]
  Tests: [N]
  Pass: [N]
  Fail: [N]
  Deterministic: [yes — ran twice]
  Regression: [Agent 10 tests still pass]
  Next agent: Agent 12 (Update AI Memory)
```

## Gate

- [ ] Playwright infrastructure configured (or verified existing)
- [ ] All E2E tests pass twice (deterministic)
- [ ] Agent 10 tests still pass (regression)
