---
title: LNPM - Write Unit Tests
---

# Write Unit Tests

## Purpose

MANDATORY — Unit tests are NOT skippable. IF the testing framework is not configured in the dashboard directory, this agent configures it first, then writes the tests. There is no skip path.

## Scope Boundaries

**This agent MUST:**
- Install and invoke relevant testing skills
- **SET UP TESTING INFRASTRUCTURE** if not already configured (install Vitest, create config, seed test fixtures)
- Write integration tests for API endpoints and services
- Write unit tests for business logic, validators, parsers, transformers
- Run the full test suite — all tests must pass
- Run typecheck and lint — zero errors

**This agent MUST NOT:**
- Skip because testing framework is not configured — configure it instead
- Write E2E tests (that is Agent 11's job)
- Modify production code to "make tests pass" (that is a bug, not a test)
- Commit changes

## Variables

- **`{{PROJECT_ROOT}}`** _(static)_ — `/Users/pk/Projects/ping-monitoring`
- **`{{DASHBOARD_DIR}}`** _(static)_ — `dashboard/`

## MCP Servers

| Server | Purpose | Install / Configure | When to Use |
|--------|---------|-------------------|-------------|
| `git` | Version control | No install needed | Review diff of test files |
| `memory` | Cross-session persistence | No install needed | Load implementation plan |
| `filesystem` | File and directory operations | No install needed | Create test files |
| `sequential-thinking` | Structured problem decomposition | No install needed | Complex test design |

## Skills

| Skill | Install Command | When to Invoke |
|-------|----------------|----------------|
| `nuxt` | Already available in session | Nuxt 4 testing patterns |

**Skill Installation Protocol:** Before invoking any skill, check if installed. IF not installed, run `npx skills add <owner/repo>`. Wait for installation. THEN invoke the skill.

## Workflow

**Step 1: Install Skills**

Check and install each skill if needed.

**Step 2: Check & Configure Test Infrastructure**

**IF the dashboard directory does not have a configured test runner:**
1. Install Vitest `^4.1.10` (matching the project's existing version) and any required plugins
2. Create the test configuration in `dashboard/vitest.config.ts` or add to `dashboard/nuxt.config.ts`
3. Set up test utilities: mock factories for database, fixtures for ping samples, helpers for API testing
4. Verify the test runner executes: `cd dashboard && pnpm test -- --run`

**IF test infrastructure exists**, verify it runs: execute the test suite once to confirm.

**Test patterns to follow (from existing project):**
- Vitest with `describe`/`test` blocks
- Assertion style: `expect().toBe()`, `expect().toEqual()`
- Test files co-located: `*.test.ts` next to source files
- Mock database sessions — never hit a real database in unit tests

**Step 3: Write Integration Tests**

For each API endpoint or service:
- Create or extend a test file co-located with source
- Cover: happy path, primary edge case, primary error path, auth/permission guards
- Use mock database sessions — never hit a real database

Test targets:
- `server/utils/ping-validation.ts` — validation rules (valid samples, invalid samples, edge cases)
- `server/utils/ping-ingest.ts` — ingest engine (dedup, upsert, auto-create monitor)
- `server/utils/client.ts` — slug generation, name default, upsert
- `server/utils/quality-classifier.ts` — quality state transitions
- `server/utils/rate-limiter.ts` — rate limiting behavior
- `server/utils/cache.ts` — LRU cache operations
- API routes — test request/response shapes

**Step 4: Write Unit Tests**

Write for:
- Pure business-logic functions with non-trivial branches
- Validators, parsers, transformers, calculators
- Composables with conditional reactive behavior
- Edge-case handling that integration tests cannot exercise
- State machines, transition logic, status guards

**Step 5: Run Tests**

Run the full test suite: `cd dashboard && pnpm test -- --run`. All tests must pass.

**Step 6: Type Check & Lint**

Run typecheck and linter. Zero errors.

## Output

```
Unit Tests
  Test infrastructure: [existing / configured]
  Integration tests: [N files, N tests]
  Unit tests: [N files, N tests]
  Pass: [N]
  Fail: [N]
  Typecheck: [pass]
  Lint: [pass]
  Next agent: Agent 11 (Write E2E Tests)
```

## Gate

- [ ] Test infrastructure configured (or verified existing)
- [ ] All unit and integration tests pass
- [ ] Zero typecheck errors
- [ ] Zero lint errors
