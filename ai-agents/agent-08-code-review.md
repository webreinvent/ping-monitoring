---
title: LNPM - Agent 08 - Code Review
---

# Code Review

## Purpose

Review all implemented code for the LNPM Cloud Dashboard against coding principles, quality standards, and project conventions. Find issues, bugs, and quality problems before UAT. Fix any issues found.

## Scope Boundaries

**This agent MUST:**
- Install and invoke relevant framework skills for review
- Run formatter, linter, type checker, dead code scan, complexity review
- Audit code against coding principles (DRY, KISS, YAGNI, SoC, SRP, SOLID, Security)
- Fix any issues found
- Review the diff for clean output (no debug artifacts, no commented-out code)

**This agent MUST NOT:**
- Plan or redesign the implementation (that was Agent 05's job)
- Run UAT through browser automation (that is Agent 09's job)
- Write new unit or E2E tests (that is Agent 10/11's job)
- Commit or push changes

## Variables

- **`{{PROJECT_ROOT}}`** _(static)_ — `/Users/pk/Projects/ping-monitoring`
- **`{{DASHBOARD_DIR}}`** _(static)_ — `dashboard/`

## MCP Servers

| Server | Purpose | Install / Configure | When to Use |
|--------|---------|-------------------|-------------|
| `git` | Version control | No install needed | Review diff of all changes |
| `sequential-thinking` | Problem decomposition | No install needed | Complex code analysis |
| `memory` | Cross-session persistence | No install needed | Load implementation plan |
| `filesystem` | File and directory operations | No install needed | Read files |

## Skills

| Skill | Install Command | When to Invoke |
|-------|----------------|----------------|
| `nuxt` | Already available in session | Nuxt 4 / Nitro-specific code review |

**Skill Installation Protocol:** Before invoking any skill, check if installed. IF not installed, run `npx skills add <owner/repo>`. Wait for installation. THEN invoke the skill.

## Workflow

**Step 1: Install Skills**

Check and install each skill if needed.

**Step 2: Run Quality Checks**

1. **Formatter** — Auto-format all changed files (`pnpm format` or equivalent)
2. **Linter** — Run ESLint. Zero warnings allowed. Fix issues.
3. **Type checker** — Run `npx tsc --noEmit` in dashboard directory. Zero errors. Fix issues.
4. **Dead code** — Scan for unused imports, variables, functions. Remove them.
5. **Complexity** — Review each function: >30 lines? >3 nesting levels? Multiple concerns? Refactor.

**Step 3: Principles Audit**

Review against:
- **DRY** — no duplicated logic; shared types in `dashboard/shared/types.ts`
- **KISS** — no unnecessary abstraction layers
- **YAGNI** — no out-of-scope features (e.g., auth for public dashboard)
- **SoC** — server logic in `server/`, UI in `app/`, types in `shared/`
- **SRP** — one responsibility per composable, component, or utility
- **SOLID** — no god components, no tight coupling between layers
- **Security** — input validation on ingest, rate limiting, SQL injection prevention (parameterized queries), CSP compliance
- **Accessibility** — semantic HTML, ARIA labels, keyboard navigation (UI only)

**Step 4: Diff Review**

**Invoke `git` MCP server** (`git diff`) to review all staged changes. Confirm no debug artifacts, no commented-out code, no console.log statements left in production code.

**Step 5: Document Issues**

List all issues found with file path, line, description, and severity. Fix each issue.

## Output

```
Code Review
  Formatter: [pass]
  Linter: [pass / issues found and fixed]
  Type check: [pass / issues found and fixed]
  Dead code: [clean / removed]
  Complexity: [clean / refactored]
  Principles audit: [all passed / violations fixed]
  Issues found: [count]
  Issues fixed: [count]
  Diff reviewed: [clean]
  Next agent: Agent 09 (Automated UAT & Bug Fixes)
```

## Gate

- [ ] Formatter — all files formatted
- [ ] Linter — zero warnings
- [ ] Type check — zero errors
- [ ] Dead code — removed
- [ ] Complexity — functions within limits
- [ ] Principles — all passed or fixed
- [ ] Diff reviewed — clean
