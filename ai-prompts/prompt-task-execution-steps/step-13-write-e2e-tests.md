---
step: 13
title: Write E2E Tests
phase: Execution
---

# Step 13: Write E2E Tests

**Purpose:** Add Playwright E2E tests for user-facing flows that unit tests cannot cover.

## Stack Branching

### Dashboard tasks — full E2E

1. **Check existing E2E tests** in `dashboard/tests/e2e/`:
   - `api-health.spec.ts` — API health endpoint.
   - `dashboard.spec.ts` — main dashboard UI.
   - `navigation.spec.ts` — page navigation.
   - `websocket.spec.ts` — WebSocket live updates.

2. **Add or extend E2E specs** for the task's user-facing flows:
   - File naming: `dashboard/tests/e2e/{feature}.spec.ts`.
   - Use `data-testid` selectors (NOT CSS class selectors) for element targeting.
   - The Playwright config auto-starts the dev server (`webServer` in `dashboard/playwright.config.ts`) — do NOT start it manually.
   - `baseURL` is `http://localhost:3000` (set in config, no need to prefix URLs).
   - Workers: 1 (serial execution, required for WebSocket state isolation).

3. **Test patterns:**
   ```typescript
   import { test, expect } from "@playwright/test";

   test.describe("Feature Name", () => {
     test("should [expected behavior]", async ({ page }) => {
       await page.goto("/path");
       // interact via data-testid
       const element = page.getByTestId("some-test-id");
       await expect(element).toBeVisible();
       // assert rendered state
       await expect(element).toHaveText("expected");
     });
   });
   ```

4. **Run the E2E suite:**
   - Run `cd dashboard && pnpm test:e2e` (Bash) — all tests must pass.

### Tauri tasks — skip Playwright E2E

- Playwright infrastructure exists only in `dashboard/tests/e2e/`. The Tauri desktop app is a native window and cannot be driven by Playwright.
- **Skip this step for Tauri-only tasks.** Note in your working notes: "Step 13 skipped — Tauri-only task, no Playwright E2E applicable."
- UI verification for Tauri tasks was handled in Step 11 (labelled `manual-verified`).

### Cross-stack tasks

- Write Playwright E2E for the dashboard-side user flow.
- Note that the Tauri→dashboard sync path (client posting to `/api/ping/ingest`) can be tested via the API E2E spec if the task changes the ingest contract.

## Memory Entry

- Title: `LNPM — {{TASK_ID}} E2E Results`
- Tags: `e2e-results`, `{{TASK_ID}}`
- Content: E2E specs added, pass/fail counts, or "skipped — Tauri-only task" justification.

## Completion Criteria

- [ ] Dashboard: `pnpm test:e2e` — zero failures (or step explicitly skipped with justification for Tauri-only tasks)
- [ ] E2E tests use `data-testid` selectors
- [ ] Memory entry created (including skip justification if applicable)
