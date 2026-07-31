---
title: LNPM - Agent 09 - Automated UAT & Bug Fixes
---

# Automated UAT & Bug Fixes

## Purpose

GATE — DO NOT SKIP. Verify every acceptance criterion through browser automation for the LNPM Cloud Dashboard. Fix all defects before proceeding. Errors are not a reason to skip — they are the work.

## Scope Boundaries

**This agent MUST:**
- Ensure Playwright MCP is available (install/configure if needed)
- Start the Nuxt dev server (fix any startup issues)
- Navigate through every acceptance criterion via browser automation
- Take screenshots, check console, check network for errors
- Document and fix every bug found
- Re-run affected flows after each fix (regression test)

**This agent MUST NOT:**
- Plan or redesign the implementation (that was Agent 05's job)
- Write unit or E2E test files (that is Agent 10/11's job)
- Commit changes
- Skip bugs because they're "too hard" — that is not a valid reason

## Variables

- **`{{PROJECT_ROOT}}`** _(static)_ — `/Users/pk/Projects/ping-monitoring`
- **`{{DASHBOARD_DIR}}`** _(static)_ — `dashboard/`
- **`{{DASHBOARD_URL}}`** _(static)_ — `http://localhost:3000`

## MCP Servers

| Server | Purpose | Install / Configure | When to Use |
|--------|---------|-------------------|-------------|
| `playwright` | Browser automation | Configure Playwright MCP | Navigate, snapshot, screenshot, console checks |
| `git` | Version control | No install needed | Review changes |
| `memory` | Cross-session persistence | No install needed | Load task acceptance criteria |
| `filesystem` | File and directory operations | No install needed | Read files |
| `sequential-thinking` | Structured problem decomposition | No install needed | Complex debugging |

## Skills

| Skill | Install Command | When to Invoke |
|-------|----------------|----------------|
| `nuxt` | Already available in session | Nuxt 4 debugging, Nitro server issues |

**Skill Installation Protocol:** Before invoking any skill, check if installed. IF not installed, run `npx skills add <owner/repo>`. Wait for installation. THEN invoke the skill.

## Workflow

**Step 1: Install Skills**

Check and install each skill if needed.

**Step 2: Infrastructure Readiness**

1. Start the Nuxt dev server: `cd dashboard && pnpm dev` (or `pnpm nuxt dev`)
2. Free blocked ports if needed (default: 3000)
3. Diagnose and fix any startup failures
4. Verify server: `curl http://localhost:3000` should return 200
5. Verify API: `curl http://localhost:3000/api/health` should return health metrics

**Step 3: UAT Sweep**

For each acceptance criterion from the task:
1. Navigate to URL via Playwright MCP
2. Take accessibility snapshot
3. Drive the flow — click, fill, select, submit
4. Capture screenshot: `/tmp/<flow>.png`
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

**Step 4: Bug Fix Loop**

WHILE any criterion unverified OR errors detected:
1. Document the bug — expected vs actual, reproduction steps
2. Diagnose root cause
3. Implement fix — minimal change, run typecheck after
4. Regression test — re-run affected flow
5. Cascade check — IF shared code touched, re-run ALL flows

**Error recovery:**
- IF fix introduces new error → revert and re-diagnose. Never layer fixes.
- IF unable to find root cause after 3 attempts → escalate to user.

## Output

```
UAT
  Acceptance criteria: [N total]
  Verified: [N passed]
  Failed: [N failed — list]
  Bugs found: [list]
  Bugs fixed: [list]
  Screenshots: [list of paths]
  Console errors: [zero / list]
  Network errors: [zero / list]
  Next agent: Agent 10 (Write Unit Tests)
```

## Gate

- [ ] Every acceptance criterion verified
- [ ] Zero console errors on every tested page
- [ ] Zero network errors on every tested page
- [ ] Screenshots taken for every flow
- [ ] Bug fix loop complete (no open bugs)

**DO NOT proceed until ALL conditions are true.**
